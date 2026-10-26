'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { before, after, test } = require('node:test');
const { MongoClient } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const legacySchema = require('../migrations/v1-schema.json');
const { initializeDatabase, verifyDatabase } = require('../database');
const { planMigration, migrateDatabase, MIGRATION_ID, JOURNAL, backupName } = require('../migrations/v2');
const { buildDemoDocuments, DEMO_USER_ID } = require('../seed');
const catalogs = require('../data/catalogs.json');

const now = new Date('2026-10-25T04:00:00Z');
let replica;
let client;
let serial = 0;

before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
}, { timeout: 240000 });
after(async () => { if (client) await client.close(); if (replica) await replica.stop(); });

async function legacyDatabase() {
  const db = client.db(`migration_${++serial}`);
  const documents = buildDemoDocuments('migration-test-password', now);
  documents.reward_items = catalogs.reward_items.map((row) => ({ ...row, created_at: now, updated_at: now }));
  documents.challenges = catalogs.challenges.map((row) => ({ ...row, created_at: now, updated_at: now }));
  documents.users = [documents.users[0]];
  for (const key of ['role', 'is_active', 'streak_last_date']) delete documents.users[0][key];
  documents.users[0].streak_days = 0;
  documents.users[0].target_water = 2275;
  for (const quest of documents.daily_quest_logs) {
    const names = { q_meal: 'q_meals', q_chat: 'q_weight', q_checkin: 'q_bowel' };
    quest.quest_key = names[quest.quest_key] || quest.quest_key;
  }
  for (const message of documents.ai_chat_messages) delete message.session_id;
  for (const definition of legacySchema) {
    const { name, validator, validationLevel, validationAction, indexes } = definition;
    await db.createCollection(name, { validator, validationLevel, validationAction });
    await db.collection(name).createIndexes(indexes);
    const rows = documents[name] || [];
    if (rows.length) await db.collection(name).insertMany(rows);
  }
  return db;
}

test('read-only plan reports changes without touching data, schema, or creating backups', async () => {
  const db = await legacyDatabase();
  const before = await db.listCollections().toArray();
  const oldUser = await db.collection('users').findOne({ user_id: DEMO_USER_ID });
  const plan = await migrateDatabase(db, client, { now });
  assert.equal(plan.applied, false);
  assert.deepEqual(plan.issues, []);
  assert.equal(plan.archivedQuests, 2);
  assert.equal(plan.summary.daily_quest_logs.before, 7);
  assert.equal(plan.summary.daily_quest_logs.after, 7);
  assert.deepEqual(await db.collection('users').findOne({ user_id: DEMO_USER_ID }), oldUser);
  assert.deepEqual(await db.listCollections().toArray(), before);
});

test('db:init refuses to change populated v1 schemas and directs callers to migration', async () => {
  const db = await legacyDatabase();
  await assert.rejects(initializeDatabase(db), /needs migration/);
  const users = (await db.listCollections({ name: 'users' }).toArray())[0];
  assert.deepEqual(users.options.validator, legacySchema[0].validator);
});

test('migration preserves balances, history and original backups; second run is a no-op', async () => {
  const db = await legacyDatabase();
  const oldUser = await db.collection('users').findOne({ user_id: DEMO_USER_ID });
  const report = await migrateDatabase(db, client, { apply: true, now });
  assert.equal(report.applied, true);
  assert.equal(report.audit.ok, true);
  const user = await db.collection('users').findOne({ user_id: DEMO_USER_ID });
  assert.equal(user.role, 'user');
  assert.equal(user.is_active, true);
  assert.equal(user.fit_coins, oldUser.fit_coins);
  assert.equal(user.streak_days, oldUser.streak_days);
  assert.equal(user.password_hash, oldUser.password_hash);
  assert.equal(user.target_water, 2625);
  assert.deepEqual(await db.collection(backupName('users')).findOne({ user_id: DEMO_USER_ID }), oldUser);
  assert.equal(await db.collection('archived_daily_quest_logs').countDocuments(), 2);
  assert.equal(await db.collection('daily_quest_logs').countDocuments({ quest_key: 'q_meal' }), 1);
  assert.equal(await db.collection('daily_quest_logs').countDocuments({ quest_key: { $in: ['q_weight', 'q_bowel', 'q_meals'] } }), 0);
  assert.equal(await db.collection('daily_quest_logs').countDocuments({ quest_key: { $in: ['q_checkin', 'q_chat'] }, is_completed: false }), 2);
  assert.equal(await db.collection('ai_chat_sessions').countDocuments(), 1);
  const session = await db.collection('ai_chat_sessions').findOne();
  assert.equal(await db.collection('ai_chat_messages').countDocuments({ session_id: session.session_id, user_id: session.user_id }), 2);
  assert.equal((await db.collection(JOURNAL).findOne({ _id: MIGRATION_ID })).status, 'complete');
  assert.equal((await migrateDatabase(db, client, { apply: true, now })).alreadyApplied, true);
  assert.equal((await verifyDatabase(db)).ok, true);
});

test('duplicate daily logs stop migration before modifying existing schema or data', async () => {
  const db = await legacyDatabase();
  const original = await db.collection('sleep_logs').findOne();
  const duplicate = { ...original, _id: undefined, sleep_id: randomUUID() };
  delete duplicate._id;
  await db.collection('sleep_logs').insertOne(duplicate);
  const report = await migrateDatabase(db, client, { apply: true, now });
  assert.equal(report.applied, false);
  assert.ok(report.issues.some((issue) => issue.includes('sleep_logs.uq_user_sleep_date')));
  assert.equal(await db.collection('sleep_logs').countDocuments(), 2);
  assert.equal(await db.collection(JOURNAL).countDocuments(), 0);
  assert.equal((await db.listCollections({ name: backupName('users') }).toArray()).length, 0);
});

test('non-standard legacy quest rewards require review before data is changed', async () => {
  const db = await legacyDatabase();
  // v1 accepts this legacy quest key; v2 deliberately rejects unknown values.
  const oldQuest = await db.collection('daily_quest_logs').findOne({ quest_key: 'q_water' });
  await db.collection('daily_quest_logs').updateOne({ _id: oldQuest._id }, { $set: { reward_coins: 20 } });
  const report = await migrateDatabase(db, client, { apply: true, now });
  assert.equal(report.applied, false);
  assert.ok(report.issues.some((issue) => issue.includes('manual review')));
  const user = await db.collection('users').findOne({ user_id: DEMO_USER_ID });
  assert.equal(Object.hasOwn(user, 'role'), false);
});

test('staging validator failures leave original collections untouched', async () => {
  const db = await legacyDatabase();
  const user = await db.collection('users').findOne({ user_id: DEMO_USER_ID });
  // Inject a bad value as a legacy/imported document to test full v2 validation.
  await db.collection('users').updateOne({ user_id: DEMO_USER_ID }, { $set: { email: 'UPPER@fitlife.example' } }, { bypassDocumentValidation: true });
  await assert.rejects(migrateDatabase(db, client, { apply: true, now }), { code: 121 });
  assert.equal(await db.collection(JOURNAL).countDocuments(), 0);
  assert.equal((await db.listCollections().toArray()).some((entry) => entry.name.startsWith('__fitlife_v2_check_')), false);
  await db.collection('users').updateOne({ user_id: DEMO_USER_ID }, { $set: { email: user.email } });
});

test('plan catches missing references without overwriting source documents', async () => {
  const db = await legacyDatabase();
  await db.collection('water_logs').updateOne({}, { $set: { user_id: randomUUID() } });
  const report = await planMigration(db, now);
  assert.ok(report.issues.some((issue) => issue.includes('water_logs')));
  assert.equal(await db.collection(JOURNAL).countDocuments(), 0);
});
