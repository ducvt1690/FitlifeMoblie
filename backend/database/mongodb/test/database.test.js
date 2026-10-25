'use strict';

const assert = require('node:assert/strict');
const { randomUUID, scryptSync } = require('node:crypto');
const { before, after, test } = require('node:test');
const { MongoClient } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { collections } = require('../schema');
const { initializeDatabase, verifyDatabase } = require('../database');
const { seedCatalogs, seedDemo, buildDemoDocuments, DEMO_USER_ID, localDate } = require('../seed');

// A real ephemeral MongoDB replica set exercises validators, indexes and transactions.
// Tests do not read .env or contact Atlas.
const password = 'FitLife-test-only-password';
const now = new Date('2026-10-20T18:00:00.000Z');
let replica;
let client;
let db;
let fixture;

before(async () => {
  replica = await MongoMemoryReplSet.create({
    binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  client = new MongoClient(replica.getUri());
  await client.connect();
  db = client.db('fitlife_test');
  await initializeDatabase(db);
  await seedCatalogs(db, now);
  assert.equal(await seedDemo(db, client, password, now), true);
  fixture = buildDemoDocuments(password, now);
}, { timeout: 240000 });

after(async () => {
  if (client) await client.close();
  if (replica) await replica.stop();
});

test('all 13 collections, validators, indexes and demo references pass the audit', async () => {
  const report = await verifyDatabase(db);
  assert.equal(report.ok, true, report.issues.join('\n'));
  assert.equal(Object.keys(report.counts).length, 13);
  assert.equal(report.counts.reward_items, 6);
  assert.equal(report.counts.challenges, 3);
  assert.equal(report.counts.daily_quest_logs, 7);
  assert.ok(Object.values(report.counts).every((count) => count > 0));
});

test('schema and catalog reruns preserve catalog edits and existing user data', async () => {
  const reward = await db.collection('reward_items').findOne({ cost_coins: 120 });
  await db.collection('reward_items').updateOne({ item_id: reward.item_id }, { $set: { cost_coins: 130 } });
  await initializeDatabase(db);
  await seedCatalogs(db, new Date('2026-10-22T00:00:00Z'));
  assert.equal((await db.collection('reward_items').findOne({ item_id: reward.item_id })).cost_coins, 130);
  assert.equal(await db.collection('reward_items').countDocuments(), 6);
  assert.equal(await db.collection('challenges').countDocuments(), 3);
  assert.equal((await db.collection('users').findOne({ user_id: DEMO_USER_ID })).fit_coins, 10);
});

test('demo reruns on a different day do not reset balance, password or add rewards', async () => {
  const old = await db.collection('users').findOne({ user_id: DEMO_USER_ID });
  await db.collection('users').updateOne({ user_id: DEMO_USER_ID }, { $set: { fit_coins: 9 } });
  assert.equal(await seedDemo(db, client, 'a-different-password', new Date('2026-10-23T00:00:00Z')), false);
  const current = await db.collection('users').findOne({ user_id: DEMO_USER_ID });
  assert.equal(current.fit_coins, 9);
  assert.equal(current.password_hash, old.password_hash);
  assert.equal(await db.collection('daily_quest_logs').countDocuments(), 7);
  await db.collection('users').updateOne({ user_id: DEMO_USER_ID }, { $set: { fit_coins: old.fit_coins } });
});

test('duplicate emails and user/day/quest entries are rejected', async () => {
  await assert.rejects(db.collection('users').insertOne({ ...fixture.users[0], user_id: randomUUID() }), { code: 11000 });
  await assert.rejects(db.collection('daily_quest_logs').insertOne({
    ...fixture.daily_quest_logs[0], quest_log_id: randomUUID(),
  }), { code: 11000 });
  await assert.rejects(db.collection('users').insertOne({
    ...fixture.users[0], user_id: randomUUID(), email: fixture.users[0].email.toUpperCase(),
  }), { code: 121 });
});

test('negative balance, plaintext password, invalid enum, fractions and unknown fields are rejected', async () => {
  for (const changes of [
    { fit_coins: -1 }, { password_hash: '123' }, { goal: 'invalid' }, { age: 23.5 },
    { target_calories: 799 }, { password: 'do-not-store-plaintext' },
  ]) {
    await assert.rejects(db.collection('users').updateOne({ user_id: DEMO_USER_ID }, { $set: changes }), { code: 121 });
  }
  for (const changes of [{ amount: 0 }, { amount: 1.5 }, { log_time: '25:70' }, { log_date: '21/10/2026' }]) {
    await assert.rejects(db.collection('water_logs').insertOne({
      ...fixture.water_logs[0], log_id: randomUUID(), ...changes,
    }), { code: 121 });
  }
  await assert.rejects(db.collection('sleep_logs').insertOne({
    ...fixture.sleep_logs[0], sleep_id: randomUUID(), hours: 25,
  }), { code: 121 });
});

test('completed quests require a completion timestamp', async () => {
  const quest = { ...fixture.daily_quest_logs[0], quest_log_id: randomUUID(), quest_date: '2026-10-22' };
  delete quest.completed_at;
  await assert.rejects(db.collection('daily_quest_logs').insertOne(quest), { code: 121 });
});

test('concurrent duplicate badge purchases allow one insert; vouchers can repeat', async (t) => {
  const badge = { ...fixture.purchases[0], user_id: randomUUID() };
  t.after(async () => db.collection('purchases').deleteMany({ user_id: badge.user_id }));
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => db.collection('purchases').insertOne({
    ...badge, purchase_id: randomUUID(),
  })));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  for (const result of results.filter((entry) => entry.status === 'rejected')) assert.equal(result.reason.code, 11000);
  const voucher = await db.collection('reward_items').findOne({ category: 'voucher' });
  await db.collection('purchases').insertMany([1, 2].map(() => ({
    ...badge, purchase_id: randomUUID(), item_id: voucher.item_id, item_category: 'voucher', spent_coins: voucher.cost_coins,
  })));
});

test('the same user cannot join the same challenge twice', async () => {
  await assert.rejects(db.collection('user_challenges').insertOne({
    ...fixture.user_challenges[0], id: randomUUID(),
  }), { code: 11000 });
});

test('audit detects orphan references and a forged purchase category', async (t) => {
  const id = randomUUID();
  const purchaseId = randomUUID();
  t.after(async () => {
    await db.collection('water_logs').deleteOne({ log_id: id });
    await db.collection('purchases').deleteOne({ purchase_id: purchaseId });
  });
  await db.collection('water_logs').insertOne({ ...fixture.water_logs[0], log_id: id, user_id: randomUUID() });
  await db.collection('purchases').insertOne({ ...fixture.purchases[0], purchase_id: purchaseId, item_category: 'voucher' });
  const report = await verifyDatabase(db);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.includes('Orphan references: water_logs.user_id')));
  assert.ok(report.issues.some((issue) => issue.includes('Purchase category differs')));
});

test('demo transaction rolls back all new user data when a later insert fails', async () => {
  const isolated = client.db('fitlife_rollback_test');
  await initializeDatabase(isolated);
  await seedCatalogs(isolated, now);
  // A deliberate collision in the last collection must roll back earlier inserts.
  await isolated.collection('ai_chat_messages').insertOne(fixture.ai_chat_messages[0]);
  await assert.rejects(seedDemo(isolated, client, password, now), { code: 11000 });
  for (const definition of collections.filter((entry) => !['ai_chat_messages', 'reward_items', 'challenges'].includes(entry.name))) {
    assert.equal(await isolated.collection(definition.name).countDocuments(), 0, definition.name);
  }
});

test('demo stores a salted scrypt hash and derives the local date at the Vietnam day boundary', async () => {
  const user = await db.collection('users').findOne({ user_id: DEMO_USER_ID });
  const [algorithm, N, r, p, salt, hash] = user.password_hash.split('$');
  assert.equal(algorithm, 'scrypt');
  assert.equal(scryptSync(password, salt, 64, { N: Number(N), r: Number(r), p: Number(p) }).toString('hex'), hash);
  assert.notEqual(user.password_hash, fixture.users[0].password_hash);
  assert.equal(localDate(new Date('2026-10-20T16:59:59Z')), '2026-10-20');
  assert.equal(localDate(new Date('2026-10-20T17:00:00Z')), '2026-10-21');
});

test('final read-only audit is clean after all constraint checks', async () => {
  const report = await verifyDatabase(db);
  assert.equal(report.ok, true, report.issues.join('\n'));
});
