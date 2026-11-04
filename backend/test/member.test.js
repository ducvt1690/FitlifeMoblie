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
const { localDay } = require('../auth/registration');

// Disposable MongoDB and real HTTP requests; no Atlas credentials or .env.
let replica, client, db, server, baseUrl, first, second;
before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
  db = client.db('fitlife');
  await initializeDatabase(db);
  await initializeAuthSessions(db);
}, { timeout: 240000 });
after(async () => { if (client) await client.close(); if (replica) await replica.stop(); });
beforeEach(async () => {
  server = createApp({ db, logger: { error() {} } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  first = await register();
  second = await register();
});
afterEach(async () => { if (server) await new Promise(resolve => server.close(resolve)); });
async function request(path, token, method = 'GET', body) {
  const response = await fetch(baseUrl + path, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
async function register() {
  const result = await request('/api/auth/register', null, 'POST', {
    email: `${randomUUID()}@fitlife.example`, password: 'member-test-password', full_name: 'Member test',
    gender: 'male', age: 23, height: 170, weight: 65, activity_level: 'moderate', goal: 'maintain',
  });
  assert.equal(result.status, 201);
  return result.body;
}
test('member routers require a valid session and user role', async () => {
  for (const path of ['/api/profile', '/api/water-logs', '/api/quests']) {
    assert.equal((await request(path)).status, 401);
  }
  await db.collection('users').updateOne({ user_id: first.user.user_id }, { $set: { role: 'trainer' } });
  assert.equal((await request('/api/profile', first.token)).status, 403);
  assert.equal((await request('/api/water-logs', first.token, 'POST', { log_id: randomUUID(), amount: 250 })).status, 403);
});
test('profile service updates only the authenticated user and rejects system fields', async () => {
  const result = await request('/api/profile', first.token, 'PATCH', { full_name: 'Updated name', weight: 75 });
  assert.equal(result.status, 200);
  assert.equal(result.body.profile.target_water, 2625);
  assert.equal(result.body.profile.full_name, 'Updated name');
  assert.equal(JSON.stringify(result.body).includes('password'), false);
  assert.equal((await request('/api/profile', second.token)).body.profile.weight, 65);
  for (const body of [{ role: 'admin' }, { fit_coins: 999 }, { timezone: 'UTC' }, { age: 0 }]) {
    assert.equal((await request('/api/profile', first.token, 'PATCH', body)).status, 400);
  }
  assert.equal((await request('/api/profile', first.token)).body.profile.weight, 75);
});
test('concurrent water writes award exactly one quest reward and remain private', async () => {
  const results = await Promise.all([1, 2, 3].map(() => request('/api/water-logs', first.token, 'POST', { log_id: randomUUID(), amount: 250 })));
  for (const result of results) assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(results.reduce((sum, result) => sum + result.body.reward_coins, 0), 10);
  assert.equal((await request('/api/profile', first.token)).body.profile.fit_coins, 10);
  assert.equal((await request('/api/water-logs', first.token)).body.total, 750);
  assert.equal((await request('/api/water-logs', second.token)).body.total, 0);
  const quests = (await request('/api/quests', first.token)).body.quests;
  assert.equal(quests.length, 7);
  assert.deepEqual(quests.filter(q => q.is_completed).map(q => q.quest_key), ['q_water']);
  assert.equal((await request('/api/water-logs?date=2026-02-30', first.token)).status, 400);
});
test('water retry does not create another log or debit/reward and conflicts return 409', async () => {
  const body = { log_id: randomUUID(), amount: 250 };
  assert.equal((await request('/api/water-logs', first.token, 'POST', body)).status, 201);
  const retry = await request('/api/water-logs', first.token, 'POST', body);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.replayed, true);
  assert.equal(retry.body.reward_coins, 0);
  assert.equal((await request('/api/water-logs', first.token, 'POST', { ...body, amount: 500 })).status, 409);
  assert.equal((await request('/api/water-logs', second.token, 'POST', body)).status, 409);
  assert.equal((await request('/api/water-logs', first.token, 'POST', { ...body, user_id: second.user.user_id })).status, 400);
  assert.equal((await request('/api/water-logs', first.token)).body.logs.length, 1);
});
test('quest failure rolls back the log and balance through service boundaries', async () => {
  const original = db.collection.bind(db);
  const id = randomUUID();
  db.collection = (name, ...args) => {
    const collection = original(name, ...args);
    if (name === 'daily_quest_logs') collection.updateOne = async () => { throw new Error('injected quest failure'); };
    return collection;
  };
  try {
    assert.equal((await request('/api/water-logs', first.token, 'POST', { log_id: id, amount: 250 })).status, 500);
  } finally { db.collection = original; }
  assert.equal(await db.collection('water_logs').countDocuments({ log_id: id }), 0);
  assert.equal((await request('/api/profile', first.token)).body.profile.fit_coins, 0);
  assert.equal((await request('/api/quests', first.token)).body.quests.some(q => q.is_completed), false);
});

test('invalid water amounts cannot corrupt totals or select another user', async () => {
  for (const amount of ['abc', -500, '250', 0, null, 1.5]) {
    assert.equal((await request('/api/water-logs', first.token, 'POST', { log_id: randomUUID(), amount })).status, 400);
  }
  for (const amount of [300, 700]) {
    assert.equal((await request('/api/water-logs', first.token, 'POST', { log_id: randomUUID(), amount })).status, 201);
  }
  assert.equal((await request('/api/water-logs', first.token)).body.total, 1000);
  assert.equal((await request('/api/water-logs', second.token)).body.total, 0);
  assert.equal((await request('/api/water-logs', first.token, 'POST', {
    log_id: randomUUID(), amount: 500, userId: second.user.user_id,
  })).status, 400);
});

test('health logs at early Vietnam morning use local date for water, workout and meals', async t => {
  const day = localDay(new Date(), 'Asia/Ho_Chi_Minh');
  // Advance to next local midnight; renew only this disposable test session.
  const now = new Date(day + 'T18:05:00Z'); // 01:05 the next day in Vietnam.
  t.mock.timers.enable({ apis: ['Date'], now });
  await db.collection('auth_sessions').updateMany({ user_id: first.user.user_id }, {
    $set: { created_at: now, expires_at: new Date(now.getTime() + 3600000) },
  });
  const expectedDay = localDay(now, 'Asia/Ho_Chi_Minh');
  assert.notEqual(expectedDay, now.toISOString().slice(0, 10));
  const water = await request('/api/water-logs', first.token, 'POST', { log_id: randomUUID(), amount: 250 });
  assert.equal(water.status, 201);
  assert.equal(water.body.log.log_date, expectedDay);
  assert.equal(water.body.log.log_time, '01:05');
  const workout = await request('/api/workout-logs', first.token, 'POST', {
    workout_id: randomUUID(), title: 'Hít đất', category: 'Toàn thân', duration_seconds: 60, calories_burned: 10,
  });
  assert.equal(workout.status, 201);
  assert.equal(workout.body.log.workout_date, expectedDay);
  const meal = await request('/api/meal-logs', first.token, 'POST', {
    meal_id: randomUUID(), meal_name: 'Bữa ăn kiểm thử', calories: 450, protein: 25, carbs: 55, fat: 14, meal_type: 'breakfast',
  });
  assert.equal(meal.status, 201);
  assert.equal(meal.body.log.meal_date, expectedDay);
  assert.equal((await request('/api/quests', first.token)).body.date, expectedDay);
});
