'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { before, after, beforeEach, afterEach, test } = require('node:test');
const { MongoClient } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../app');
const { initializeDatabase } = require('../database/mongodb/database');
const { initializeAuthSessions } = require('../database/connection');

let replica, client, db, server, baseUrl, first, second;
before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri()); await client.connect();
  db = client.db('fitlife_meal_test'); await initializeDatabase(db); await initializeAuthSessions(db);
}, { timeout: 240000 });
after(async () => { if (client) await client.close(); if (replica) await replica.stop(); });
beforeEach(async () => {
  server = createApp({ db, logger: { error() {} } }).listen(0, '127.0.0.1');
  await once(server, 'listening'); baseUrl = `http://127.0.0.1:${server.address().port}`;
  first = await register(); second = await register();
});
afterEach(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

async function request(path, token, method = 'GET', body) {
  const response = await fetch(baseUrl + path, { method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
async function register() {
  const result = await request('/api/auth/register', null, 'POST', { email: `${randomUUID()}@fitlife.example`,
    password: 'meal-test-password', full_name: 'Meal test', gender: 'male', age: 23, height: 170,
    weight: 65, activity_level: 'moderate', goal: 'maintain' });
  assert.equal(result.status, 201); return result.body;
}
const meal = (extra = {}) => ({ meal_id: randomUUID(), meal_name: 'Phở bò', calories: 450,
  protein: 25, carbs: 55, fat: 14, meal_type: 'breakfast', ...extra });
const create = (body, member = first) => request('/api/meal-logs', member.token, 'POST', body);

test('meal routes require an active user session and keep records private', async () => {
  assert.equal((await request('/api/meal-logs')).status, 401);
  await db.collection('users').updateOne({ user_id: first.user.user_id }, { $set: { role: 'trainer' } });
  assert.equal((await request('/api/meal-logs', first.token)).status, 403);
  await db.collection('users').updateOne({ user_id: first.user.user_id }, { $set: { role: 'user' } });
  assert.equal((await create(meal(), second)).status, 201);
  assert.equal((await request('/api/meal-logs', first.token)).body.logs.length, 0);
});

test('create, read and retry a meal; first meal completes q_meal and grants ten coins', async () => {
  const body = meal({ meal_name: '  Phở bò  ' });
  const created = await create(body);
  assert.equal(created.status, 201);
  assert.equal(created.body.log.meal_name, 'Phở bò');
  assert.equal(created.body.log.user_id, first.user.user_id);
  assert.equal(created.body.reward_coins, 10);
  assert.equal(created.body.fit_coins, 10);
  const replay = await create({ ...body, meal_name: ' Phở bò ' });
  assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true); assert.equal(replay.body.reward_coins, 0);
  const history = await request('/api/meal-logs', first.token);
  assert.equal(history.status, 200); assert.equal(history.body.logs.length, 1);
  assert.equal(history.body.total_calories, 450); assert.equal(history.body.total_protein, 25);
  assert.equal(history.body.total_carbs, 55); assert.equal(history.body.total_fat, 14);
  const quest = (await request('/api/quests', first.token)).body.quests.find(q => q.quest_key === 'q_meal');
  assert.equal(quest.is_completed, true);
});

test('meal conflicts and validation errors do not create duplicate or injected records', async () => {
  const body = meal(); assert.equal((await create(body)).status, 201);
  assert.equal((await create({ ...body, calories: 451 })).status, 409);
  assert.equal((await create(body, second)).status, 409);
  for (const invalid of [null, [], {}, meal({ meal_name: ' ' }), meal({ calories: 0 }), meal({ calories: 1.5 }),
    meal({ protein: -1 }), meal({ meal_type: 'brunch' }), meal({ user_id: second.user.user_id }), meal({ meal_date: '2020-01-01' })]) {
    assert.equal((await create(invalid)).status, 400, JSON.stringify(invalid));
  }
  assert.equal(await db.collection('meal_logs').countDocuments({ user_id: first.user.user_id }), 1);
});

test('patch updates only the owner and delete removes the meal with a quest refund', async () => {
  const created = await create(meal()); const id = created.body.log.meal_id;
  const updated = await request(`/api/meal-logs/${id}`, first.token, 'PATCH', {
    meal_name: 'Cơm gà', calories: 600, protein: 35, carbs: 65, fat: 18, meal_type: 'lunch',
  });
  assert.equal(updated.status, 200); assert.equal(updated.body.meal.meal_name, 'Cơm gà');
  assert.equal(updated.body.meal.meal_date, created.body.log.meal_date);
  assert.equal((await request(`/api/meal-logs/${id}`, second.token, 'PATCH', {
    meal_name: 'Không được sửa', calories: 1, protein: 0, carbs: 0, fat: 0, meal_type: 'snack',
  })).status, 404);
  assert.equal((await request(`/api/meal-logs/${id}`, first.token, 'DELETE')).status, 204);
  assert.equal((await request('/api/meal-logs', first.token)).body.logs.length, 0);
  assert.equal((await request('/api/profile', first.token)).body.profile.fit_coins, 0);
  const quest = (await request('/api/quests', first.token)).body.quests.find(q => q.quest_key === 'q_meal');
  assert.equal(quest.is_completed, false);
  assert.equal((await request(`/api/meal-logs/${id}`, first.token, 'DELETE')).status, 404);
});

test('deleting one of two meals keeps the daily quest reward until the last meal is removed', async () => {
  const one = await create(meal()); const two = await create(meal({ meal_type: 'lunch', meal_name: 'Cơm gà' }));
  assert.equal((await request(`/api/meal-logs/${one.body.log.meal_id}`, first.token, 'DELETE')).status, 204);
  assert.equal((await request('/api/profile', first.token)).body.profile.fit_coins, 10);
  assert.equal((await request(`/api/meal-logs/${two.body.log.meal_id}`, first.token, 'DELETE')).status, 204);
  assert.equal((await request('/api/profile', first.token)).body.profile.fit_coins, 0);
});

test('meal date query rejects impossible dates and concurrent creates reward once', async () => {
  assert.equal((await request('/api/meal-logs?date=2026-02-30', first.token)).status, 400);
  const results = await Promise.all([1, 2, 3].map(() => create(meal())));
  for (const result of results) assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(results.reduce((sum, result) => sum + result.body.reward_coins, 0), 10);
  assert.equal((await request('/api/profile', first.token)).body.profile.fit_coins, 10);
  assert.equal((await request('/api/meal-logs', first.token)).body.logs.length, 3);
});

test('meal quest failure rolls back the meal and balance', async () => {
  const original = db.collection.bind(db); const id = randomUUID();
  db.collection = (name, ...args) => {
    const collection = original(name, ...args);
    if (name === 'daily_quest_logs') collection.updateOne = async () => { throw new Error('injected quest failure'); };
    return collection;
  };
  try { assert.equal((await create(meal({ meal_id: id }))).status, 500); }
  finally { db.collection = original; }
  assert.equal(await db.collection('meal_logs').countDocuments({ meal_id: id }), 0);
  assert.equal((await request('/api/profile', first.token)).body.profile.fit_coins, 0);
});

test('partial meal patches retain other fields and reject ID or system field changes', async () => {
  const created = await create(meal());
  const id = created.body.log.meal_id;
  const result = await request(`/api/meal-logs/${id}`, first.token, 'PATCH', { calories: 600 });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.meal.calories, 600);
  for (const key of ['meal_id', 'user_id', 'meal_name', 'meal_date', 'protein', 'carbs', 'fat', 'meal_type', 'created_at']) {
    assert.deepEqual(result.body.meal[key], created.body.log[key], key);
  }
  for (const body of [{}, { meal_id: randomUUID() }, { user_id: second.user.user_id },
    { meal_date: '2026-01-01' }, { reward_coins: 100 }, { protein: -1 }, { calories: 0 }]) {
    assert.equal((await request(`/api/meal-logs/${id}`, first.token, 'PATCH', body)).status, 400, JSON.stringify(body));
  }
  const stored = await db.collection('meal_logs').findOne({ meal_id: id });
  assert.equal(stored.calories, 600);
  assert.equal(stored.protein, 25);
});

test('concurrent removal of the last two meals resets the quest and refunds only once', async () => {
  const one = await create(meal());
  const two = await create(meal({ meal_name: 'Cơm gà', meal_type: 'lunch' }));
  const results = await Promise.all([one, two].map(result =>
    request(`/api/meal-logs/${result.body.log.meal_id}`, first.token, 'DELETE')));
  for (const result of results) assert.equal(result.status, 204, JSON.stringify(result.body));
  assert.equal(await db.collection('meal_logs').countDocuments({ user_id: first.user.user_id }), 0);
  assert.equal((await request('/api/profile', first.token)).body.profile.fit_coins, 0);
  const quest = (await request('/api/quests', first.token)).body.quests.find(q => q.quest_key === 'q_meal');
  assert.equal(quest.is_completed, false);
  assert.equal(quest.completed_at, null);
});

test('insufficient balance rejects last-meal deletion with 409 and rolls back all changes', async () => {
  const created = await create(meal());
  const id = created.body.log.meal_id;
  // Simulate the earned coins already having been spent by another feature.
  await db.collection('users').updateOne({ user_id: first.user.user_id }, { $set: { fit_coins: 0 } });
  const userBefore = await db.collection('users').findOne({ user_id: first.user.user_id });
  const questBefore = await db.collection('daily_quest_logs').findOne({ user_id: first.user.user_id, quest_key: 'q_meal' });
  const result = await request(`/api/meal-logs/${id}`, first.token, 'DELETE');
  assert.equal(result.status, 409, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
  assert.equal(await db.collection('meal_logs').countDocuments({ meal_id: id, user_id: first.user.user_id }), 1);
  assert.deepEqual(await db.collection('users').findOne({ user_id: first.user.user_id }), userBefore);
  assert.deepEqual(await db.collection('daily_quest_logs').findOne({ user_id: first.user.user_id, quest_key: 'q_meal' }), questBefore);
});
