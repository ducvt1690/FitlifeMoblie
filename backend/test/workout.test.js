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

// Exercise real HTTP routes and transactions against disposable MongoDB only.
let replica, client, db, server, baseUrl, first, second;
before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
  db = client.db('fitlife_workout_test');
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
async function register(timezone = 'Asia/Ho_Chi_Minh') {
  const response = await request('/api/auth/register', null, 'POST', {
    email: `${randomUUID()}@fitlife.example`, password: 'workout-test-password', full_name: 'Workout test',
    gender: 'male', age: 23, height: 170, weight: 65, activity_level: 'moderate', goal: 'maintain', timezone,
  });
  assert.equal(response.status, 201);
  return response.body;
}
const workout = (extra = {}) => ({ workout_id: randomUUID(), title: 'Hít đất', category: 'fullbody',
  duration_seconds: 600, calories_burned: 50, ...extra });
const create = (body, member = first) => request('/api/workout-logs', member.token, 'POST', body);
const storedUser = () => db.collection('users').findOne({ user_id: first.user.user_id });

test('workout routes reject missing/expired sessions, trainer/admin roles and locked accounts', async () => {
  assert.equal((await request('/api/workout-logs')).status, 401);
  assert.equal((await request('/api/workout-logs', null, 'POST', workout())).status, 401);
  for (const role of ['trainer', 'admin']) {
    await db.collection('users').updateOne({ user_id: first.user.user_id }, { $set: { role } });
    assert.equal((await request('/api/workout-logs', first.token)).status, 403);
    assert.equal((await create(workout())).status, 403);
  }
  await db.collection('users').updateOne({ user_id: first.user.user_id }, { $set: { role: 'user', is_active: false } });
  assert.equal((await create(workout())).status, 403);
  await db.collection('users').updateOne({ user_id: first.user.user_id }, { $set: { is_active: true } });
  await db.collection('auth_sessions').updateMany({ user_id: first.user.user_id }, { $set: { expires_at: new Date(0) } });
  assert.equal((await create(workout())).status, 401);
  assert.equal(await db.collection('workout_logs').countDocuments({ user_id: first.user.user_id }), 0);
});

test('new workouts are private, trim text, persist totals, and update quest/profile/water/me once', async () => {
  const empty = await request('/api/workout-logs', first.token);
  assert.deepEqual(empty.body.logs, []);
  assert.equal(empty.body.total_duration_seconds, 0);
  const body = workout({ title: '  Hít đất  ', category: ' fullbody ' });
  const result = await create(body);
  assert.equal(result.status, 201);
  assert.equal(result.body.replayed, false);
  assert.equal(result.body.log.title, 'Hít đất');
  assert.equal(result.body.log.category, 'fullbody');
  assert.equal(result.body.log.user_id, first.user.user_id);
  assert.equal(result.body.log.workout_date, localDay(new Date(), 'Asia/Ho_Chi_Minh'));
  assert.equal(Object.hasOwn(result.body.log, '_id'), false);
  assert.equal(result.body.reward_coins, 10);
  assert.equal(result.body.fit_coins, 10);
  assert.equal(result.body.target_water, 2625);
  const next = await create(workout({ duration_seconds: 300, calories_burned: 0 }));
  assert.equal(next.status, 201);
  assert.equal(next.body.reward_coins, 0);
  assert.equal(next.body.target_water, 2625);
  const history = await request('/api/workout-logs', first.token);
  assert.equal(history.body.logs.length, 2);
  assert.equal(history.body.total_duration_seconds, 900);
  assert.equal(history.body.total_calories_burned, 50);
  assert.equal((await request('/api/workout-logs', second.token)).body.logs.length, 0);
  assert.equal((await request('/api/profile', first.token)).body.profile.target_water, 2625);
  assert.equal((await request('/api/water-logs', first.token)).body.target, 2625);
  assert.equal((await request('/api/auth/me', first.token)).body.user.profile.target_water, 2625);
  const quests = (await request('/api/quests', first.token)).body.quests;
  assert.deepEqual(quests.filter(q => q.is_completed).map(q => q.quest_key), ['q_workout']);
});

test('workout retries normalize text and reject conflicting payloads or another owner', async () => {
  const body = workout();
  assert.equal((await create(body)).status, 201);
  const replay = await create({ ...body, title: ' Hít đất ', category: ' fullbody ' });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.reward_coins, 0);
  assert.equal(replay.body.fit_coins, 10);
  for (const change of [{ title: 'Squat' }, { category: 'core' }, { duration_seconds: 601 }, { calories_burned: 51 }]) {
    assert.equal((await create({ ...body, ...change })).status, 409);
  }
  const conflict = await create(body, second);
  assert.equal(conflict.status, 409);
  assert.equal(Object.hasOwn(conflict.body, 'log'), false);
  assert.equal(await db.collection('workout_logs').countDocuments({ workout_id: body.workout_id }), 1);
  assert.equal((await storedUser()).fit_coins, 10);
});

test('invalid payloads fail before writing, including field injection and BSON integer overflow', async () => {
  for (const body of [null, [], {}, workout({ workout_id: 'invalid' }), workout({ title: ' ' }),
    workout({ title: 'x'.repeat(151) }), workout({ category: 'x'.repeat(51) }),
    workout({ duration_seconds: 0 }), workout({ duration_seconds: 1.5 }), workout({ duration_seconds: '600' }),
    workout({ duration_seconds: 2147483648 }), workout({ calories_burned: -1 }),
    workout({ calories_burned: 2147483648 }), workout({ calories_burned: '50' }),
    workout({ title: { $ne: null } }), workout({ user_id: second.user.user_id }),
    workout({ workout_date: '2026-01-01' }), workout({ reward_coins: 1000 }), workout({ gif_url: 'https://example.com/image.gif' })]) {
    assert.equal((await create(body)).status, 400, JSON.stringify(body));
  }
  assert.equal(await db.collection('workout_logs').countDocuments({ user_id: first.user.user_id }), 0);
  assert.equal((await storedUser()).fit_coins, 0);
  const boundary = await create(workout({ title: '💪'.repeat(150), category: '💪'.repeat(50),
    duration_seconds: 2147483647, calories_burned: 2147483647 }));
  assert.equal(boundary.status, 201, JSON.stringify(boundary.body));
});

test('date filters reject impossible dates, objects, arrays and empty dates', async () => {
  for (const suffix of ['date=2026-02-30', 'date=not-a-date', 'date=', 'date=2026-1-01',
    'date[]=2026-01-01', 'date[x]=2026-01-01', 'date=2026-01-01&date=2026-01-02']) {
    assert.equal((await request('/api/workout-logs?' + suffix, first.token)).status, 400, suffix);
  }
  const historical = await request('/api/workout-logs?date=2000-02-29', first.token);
  assert.equal(historical.status, 200);
  assert.deepEqual(historical.body.logs, []);
});

test('concurrent distinct workouts award only one reward and one daily water bonus', async () => {
  const results = await Promise.all([1, 2, 3].map(() => create(workout())));
  for (const result of results) assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(results.reduce((sum, result) => sum + result.body.reward_coins, 0), 10);
  assert.equal((await storedUser()).fit_coins, 10);
  assert.equal((await storedUser()).target_water, 2625);
  assert.equal((await request('/api/workout-logs', first.token)).body.logs.length, 3);
});

test('concurrent identical IDs create a single log, and water/workout rewards remain independent', async () => {
  const body = workout();
  const results = await Promise.all([1, 2, 3].map(() => create(body)));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 200, 201]);
  assert.equal(results.reduce((sum, result) => sum + result.body.reward_coins, 0), 10);
  assert.equal(await db.collection('workout_logs').countDocuments({ workout_id: body.workout_id }), 1);
  const mixed = await Promise.all([
    create(workout(), second),
    request('/api/water-logs', second.token, 'POST', { log_id: randomUUID(), amount: 250 }),
  ]);
  for (const result of mixed) assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(mixed.reduce((sum, result) => sum + result.body.reward_coins, 0), 20);
  const profile = (await request('/api/profile', second.token)).body.profile;
  assert.equal(profile.fit_coins, 20);
  assert.equal(profile.target_water, 2625);
});

test('quest failure rolls back workout, reward and persisted water target', async () => {
  const original = db.collection.bind(db), body = workout();
  db.collection = (name, ...args) => {
    const coll = original(name, ...args);
    if (name === 'daily_quest_logs') coll.updateOne = async () => { throw new Error('injected quest failure'); };
    return coll;
  };
  try { assert.equal((await create(body)).status, 500); }
  finally { db.collection = original; }
  assert.equal(await db.collection('workout_logs').countDocuments({ workout_id: body.workout_id }), 0);
  const user = await storedUser();
  assert.equal(user.fit_coins, 0);
  assert.equal(user.target_water, 2275);
  assert.equal((await request('/api/quests', first.token)).body.quests.some(q => q.is_completed), false);
});

test('editing profile after exercise keeps the bonus and caps the target at 4350 ml', async () => {
  assert.equal((await create(workout())).status, 201);
  let result = await request('/api/profile', first.token, 'PATCH', { weight: 75 });
  assert.equal(result.status, 200);
  assert.equal(result.body.profile.target_water, 2975);
  result = await request('/api/profile', first.token, 'PATCH', { weight: 150 });
  assert.equal(result.body.profile.target_water, 4350);
  assert.equal((await create(workout())).body.target_water, 4350);
});

test('historical retries never complete today quest or retain yesterday water bonus', async () => {
  const body = workout(), today = localDay(new Date(), 'Asia/Ho_Chi_Minh');
  const yesterday = new Date(today + 'T00:00:00.000Z');
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const date = yesterday.toISOString().slice(0, 10), now = new Date();
  await db.collection('workout_logs').insertOne({ ...body, user_id: first.user.user_id,
    workout_date: date, created_at: now, updated_at: now });
  await db.collection('users').updateOne({ user_id: first.user.user_id }, { $set: { target_water: 2625 } });
  const replay = await create(body);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.log.workout_date, date);
  assert.equal(replay.body.target_water, 2275);
  assert.equal(replay.body.reward_coins, 0);
  assert.equal((await request('/api/profile', first.token)).body.profile.target_water, 2275);
  assert.equal((await request('/api/water-logs', first.token)).body.target, 2275);
  assert.equal((await request('/api/auth/me', first.token)).body.user.profile.target_water, 2275);
  assert.equal((await request('/api/workout-logs', first.token)).body.logs.length, 0);
  assert.equal((await request('/api/workout-logs?date=' + date, first.token)).body.logs.length, 1);
  const login = await request('/api/auth/login', null, 'POST', {
    email: first.user.email, password: 'workout-test-password',
  });
  assert.equal(login.body.user.profile.target_water, 2275);
  assert.equal((await request('/api/quests', first.token)).body.quests.find(q => q.quest_key === 'q_workout').is_completed, false);
});

test('recorded day and default history use each authenticated user timezone', async () => {
  // These zones differ by 26 hours, so the assertion cannot accidentally pass
  // for both accounts if the server used a single machine-local date instead.
  const east = await register('Pacific/Kiritimati'), west = await register('Etc/GMT+12');
  for (const [member, timezone] of [[east, 'Pacific/Kiritimati'], [west, 'Etc/GMT+12']]) {
    const result = await create(workout(), member);
    assert.equal(result.status, 201);
    assert.equal(result.body.log.workout_date, localDay(new Date(), timezone));
    const list = await request('/api/workout-logs', member.token);
    assert.equal(list.body.date, result.body.log.workout_date);
    assert.equal(list.body.logs.length, 1);
  }
});
