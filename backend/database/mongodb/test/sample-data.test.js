'use strict';

const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { MongoClient } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { initializeDatabase, verifyDatabase } = require('../database');
const { collections, QUEST_KEYS } = require('../schema');
const { seedCatalogs, seedDemo, localDate } = require('../seed');
const { planSampleData, applySampleData, verifySamplePlan } = require('../sample-data');

const password = 'FitLife-sample-test-only-password';
const now = new Date('2026-10-26T03:00:00.000Z');
let replica;
let client;
let serial = 0;

before(async () => {
  replica = await MongoMemoryReplSet.create({
    binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  client = new MongoClient(replica.getUri());
  await client.connect();
}, { timeout: 240000 });

after(async () => {
  if (client) await client.close();
  if (replica) await replica.stop();
});

async function sampleDatabase() {
  const db = client.db(`sample_data_${++serial}`);
  await initializeDatabase(db);
  await seedCatalogs(db, now);
  await seedDemo(db, client, password, now);
  // Migration artifacts are outside the sample-data scope and must survive untouched.
  for (const name of ['__fitlife_v1_users', '__fitlife_migrations', 'archived_daily_quest_logs']) {
    await db.collection(name).insertOne({ marker: `preserve-${name}`, created_at: now });
  }
  return db;
}

async function snapshot(db) {
  const result = {};
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((row) => row.name).sort();
  for (const name of names) result[name] = await db.collection(name).find().sort({ _id: 1 }).toArray();
  return result;
}

async function assertOldDocumentsPreserved(db, old) {
  for (const [name, rows] of Object.entries(old)) {
    for (const document of rows) {
      assert.deepEqual(await db.collection(name).findOne({ _id: document._id }), document,
        `Existing ${name} document changed`);
    }
    if (name.startsWith('__') || name === 'archived_daily_quest_logs') {
      assert.deepEqual(await db.collection(name).find().sort({ _id: 1 }).toArray(), rows,
        `Migration artifact changed: ${name}`);
    }
  }
}

async function assertCohortConsistency(db, userIds) {
  const logDates = {
    q_water: ['water_logs', 'log_date'],
    q_workout: ['workout_logs', 'workout_date'],
    q_meal: ['meal_logs', 'meal_date'],
    q_sleep: ['sleep_logs', 'sleep_date'],
    q_mood: ['mood_logs', 'mood_date'],
  };
  for (const user_id of userIds) {
    const user = await db.collection('users').findOne({ user_id });
    assert.equal(user.role, 'user');
    assert.match(user.email, /\.example$/);
    const quests = await db.collection('daily_quest_logs').find({ user_id }).toArray();
    assert.equal(quests.length, 7);
    assert.deepEqual(new Set(quests.map((quest) => quest.quest_key)), new Set(QUEST_KEYS));
    assert.ok(quests.every((quest) => quest.is_completed && quest.completed_at instanceof Date));
    const purchases = await db.collection('purchases').find({ user_id }).toArray();
    const earned = quests.reduce((sum, quest) => sum + quest.reward_coins, 0);
    const spent = purchases.reduce((sum, purchase) => sum + purchase.spent_coins, 0);
    assert.equal(user.fit_coins, earned - spent, 'Sample balance must reconcile with recorded activity');
    assert.ok(user.fit_coins >= 0);
    assert.equal(user.streak_days, 1);
    assert.equal(user.streak_last_date, quests[0].quest_date);
    for (const quest of quests) {
      assert.equal(localDate(quest.completed_at, user.timezone), quest.quest_date);
      if (logDates[quest.quest_key]) {
        const [collection, field] = logDates[quest.quest_key];
        assert.ok(await db.collection(collection).countDocuments({ user_id, [field]: quest.quest_date }),
          `Completed ${quest.quest_key} must have a matching same-user/day log`);
      } else if (quest.quest_key === 'q_chat') {
        const messages = await db.collection('ai_chat_messages').find({ user_id, sender: 'user' }).toArray();
        assert.ok(messages.some((message) => localDate(message.timestamp, user.timezone) === quest.quest_date),
          'Completed chat quest must have a saved user message that day');
      }
    }
  }
  const bmiRows = await db.collection('bmi_history').find({ user_id: { $in: userIds } }).toArray();
  assert.ok(bmiRows.length > 0);
  for (const row of bmiRows) {
    const rawBmi = row.weight / ((row.height / 100) ** 2);
    assert.equal(row.bmi_value, Math.round(rawBmi * 100) / 100);
    const expectedStatus = rawBmi < 18.5 ? 'Thiếu cân' : rawBmi < 23 ? 'Cân đối'
      : rawBmi < 25 ? 'Thừa cân nhẹ' : 'Tiền béo phì / Béo phì';
    assert.equal(row.bmi_status, expectedStatus);
  }
  const sessions = await db.collection('ai_chat_sessions').find({ user_id: { $in: userIds } }).toArray();
  for (const session of sessions) {
    assert.ok(await db.collection('ai_chat_messages').countDocuments({
      session_id: session.session_id, user_id: session.user_id, sender: 'user',
    }), 'Each new chat session must contain a user message');
  }
}

test('sample plan is read-only and application tops up every business collection coherently', async () => {
  const db = await sampleDatabase();
  const old = await snapshot(db);
  const plan = await planSampleData(db, password, now);
  assert.equal(verifySamplePlan(plan), true);
  assert.equal(plan.database, db.databaseName);
  assert.equal(plan.userIds.length, 3);
  assert.equal(plan.documents.users.length, 3);
  assert.equal(plan.beforeCounts.users, 3);
  assert.equal(plan.afterCounts.users, 6);
  assert.deepEqual(await snapshot(db), old, 'Planning must not change the database');
  await applySampleData(db, client, plan);
  const report = await verifyDatabase(db);
  assert.equal(report.ok, true, report.issues.join('\n'));
  for (const { name } of collections) {
    assert.ok(report.counts[name] >= 6, `${name} must have at least six documents`);
    assert.equal(report.counts[name], plan.afterCounts[name]);
  }
  await assertOldDocumentsPreserved(db, old);
  await assertCohortConsistency(db, plan.userIds);
});

test('later rerun does not append records or reset balances and passwords', async () => {
  const db = await sampleDatabase();
  const firstPlan = await planSampleData(db, password, now);
  await applySampleData(db, client, firstPlan);
  const user_id = firstPlan.userIds[0];
  await db.collection('users').updateOne({ user_id }, { $set: { fit_coins: 1 } });
  const old = await snapshot(db);
  const plan = await planSampleData(db, 'a-different-sample-password', new Date('2026-11-02T03:00:00Z'));
  assert.equal(verifySamplePlan(plan), true);
  assert.deepEqual(plan.documents, {});
  assert.deepEqual(plan.userIds, []);
  assert.deepEqual(plan.beforeCounts, plan.afterCounts);
  await applySampleData(db, client, plan);
  assert.deepEqual(await snapshot(db), old);
});

test('a duplicate ID in the last message rolls back all inserts', async () => {
  const db = await sampleDatabase();
  const plan = await planSampleData(db, password, now);
  const existingMessage = await db.collection('ai_chat_messages').findOne();
  const messages = plan.documents.ai_chat_messages;
  assert.ok(messages.length > 0);
  messages[messages.length - 1].message_id = existingMessage.message_id;
  const old = await snapshot(db);
  await assert.rejects(applySampleData(db, client, plan), { code: 11000 });
  assert.deepEqual(await snapshot(db), old, 'Late insert failure must leave every collection unchanged');
  const report = await verifyDatabase(db);
  assert.equal(report.ok, true, report.issues.join('\n'));
});
