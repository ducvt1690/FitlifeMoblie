'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { before, beforeEach, after, test } = require('node:test');
const { MongoClient } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { collections } = require('../schema');
const { initializeDatabase } = require('../database');
const { buildDemoDocuments } = require('../seed');
const { migrateProfileBirthDate, planProfileBirthDate } = require('../migrations/profile-birth-date');

const users = collections.find(definition => definition.name === 'users');
const previousValidator = structuredClone(users.validator);
delete previousValidator.$jsonSchema.properties.date_of_birth;
let replica, client, db, fixture;

before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
  fixture = buildDemoDocuments('profile-migration-test-password').users;
}, { timeout: 240000 });
beforeEach(async () => {
  db = client.db('fitlife');
  await db.dropDatabase();
  await initializeDatabase(db);
  await db.command({ collMod: 'users', validator: previousValidator });
  await db.collection('users').insertMany(structuredClone(fixture));
});
after(async () => { if (client) await client.close(); if (replica) await replica.stop(); });

test('planning is read-only and reports only counts, without inventing birthdays', async () => {
  const before = await db.collection('users').find().toArray();
  const metadata = await db.listCollections({ name: 'users' }).toArray();
  const plan = await planProfileBirthDate(db);
  assert.equal(plan.applied, false);
  assert.equal(plan.needsMigration, true);
  assert.equal(plan.documentCount, 3);
  assert.equal(plan.invalidDocuments, 0);
  assert.deepEqual(plan.issues, []);
  assert.equal(JSON.stringify(plan).includes(fixture[0].email), false);
  assert.deepEqual(await db.collection('users').find().toArray(), before);
  assert.deepEqual(await db.listCollections({ name: 'users' }).toArray(), metadata);
});

test('migration preserves documents, indexes and unrelated collections; optional date is accepted afterward', async () => {
  const before = await db.collection('users').find().toArray();
  const indexes = await db.collection('users').listIndexes().toArray();
  const water = await db.listCollections({ name: 'water_logs' }).toArray();
  await assert.rejects(db.collection('users').updateOne({ user_id: fixture[0].user_id }, {
    $set: { date_of_birth: '2003-10-20' },
  }), { code: 121 });
  const report = await migrateProfileBirthDate(db, { apply: true });
  assert.equal(report.applied, true);
  assert.equal(report.changed, true);
  assert.deepEqual(report.issues, []);
  assert.deepEqual(await db.collection('users').find().toArray(), before);
  assert.deepEqual(await db.collection('users').listIndexes().toArray(), indexes);
  assert.deepEqual(await db.listCollections({ name: 'water_logs' }).toArray(), water);
  const [metadata] = await db.listCollections({ name: 'users' }).toArray();
  assert.deepEqual(metadata.options.validator, users.validator);
  assert.equal(metadata.options.validationLevel, 'strict');
  assert.equal(metadata.options.validationAction, 'error');
  await db.collection('users').updateOne({ user_id: fixture[0].user_id }, { $set: { date_of_birth: '2003-10-20' } });
  assert.equal((await db.collection('users').findOne({ user_id: fixture[0].user_id })).date_of_birth, '2003-10-20');
  const legacy = { ...fixture[1], user_id: randomUUID(), email: 'legacy-profile@fitlife.example' };
  await db.collection('users').insertOne(legacy);
  for (const date_of_birth of [null, new Date(), '20/10/2003']) {
    await assert.rejects(db.collection('users').updateOne({ user_id: fixture[0].user_id }, {
      $set: { date_of_birth },
    }), { code: 121 });
  }
  await assert.rejects(db.collection('users').updateOne({ user_id: fixture[0].user_id }, {
    $set: { arbitrary_field: 'forbidden' },
  }), { code: 121 });
});

test('repeated apply is a no-op and preserves stored birthdays', async () => {
  await migrateProfileBirthDate(db, { apply: true });
  await db.collection('users').updateOne({ user_id: fixture[0].user_id }, { $set: { date_of_birth: '2003-10-20' } });
  const before = await db.collection('users').find().toArray();
  const report = await migrateProfileBirthDate(db, { apply: true });
  assert.equal(report.applied, false);
  assert.equal(report.changed, false);
  assert.equal(report.needsMigration, false);
  assert.deepEqual(report.issues, []);
  assert.deepEqual(await db.collection('users').find().toArray(), before);
});

test('unexpected validator changes or weaker validation block apply', async () => {
  const drift = structuredClone(previousValidator);
  drift.$jsonSchema.properties.unapproved = { bsonType: 'string' };
  await db.command({ collMod: 'users', validator: drift });
  let report = await migrateProfileBirthDate(db, { apply: true });
  assert.equal(report.applied, false);
  assert.ok(report.issues.some(issue => issue.includes('unexpected')));
  assert.deepEqual((await db.listCollections({ name: 'users' }).toArray())[0].options.validator, drift);
  await db.command({ collMod: 'users', validator: previousValidator, validationAction: 'warn' });
  report = await migrateProfileBirthDate(db, { apply: true });
  assert.equal(report.applied, false);
  assert.ok(report.issues.some(issue => issue.includes('strict/error')));
  assert.equal((await db.listCollections({ name: 'users' }).toArray())[0].options.validationAction, 'warn');
});

test('invalid existing data and missing required unique index block apply without changes', async () => {
  await db.collection('users').updateOne({ user_id: fixture[0].user_id }, {
    $set: { date_of_birth: 'not-a-date' },
  }, { bypassDocumentValidation: true });
  let report = await migrateProfileBirthDate(db, { apply: true });
  assert.equal(report.applied, false);
  assert.equal(report.invalidDocuments, 1);
  assert.deepEqual((await db.listCollections({ name: 'users' }).toArray())[0].options.validator, previousValidator);
  await db.collection('users').updateOne({ user_id: fixture[0].user_id }, { $unset: { date_of_birth: '' } });
  await db.collection('users').dropIndex('uq_user_email');
  report = await migrateProfileBirthDate(db, { apply: true });
  assert.equal(report.applied, false);
  assert.ok(report.issues.some(issue => issue.includes('uq_user_email')));
  assert.equal((await db.collection('users').listIndexes().toArray()).some(index => index.name === 'uq_user_email'), false);
});

test('missing users or another database cannot be migrated silently', async () => {
  await db.collection('users').drop();
  const report = await migrateProfileBirthDate(db, { apply: true });
  assert.equal(report.applied, false);
  assert.ok(report.issues.some(issue => issue.includes('Missing users')));
  await assert.rejects(migrateProfileBirthDate(client.db('unrelated'), { apply: true }), /only accepts the fitlife/);
});
