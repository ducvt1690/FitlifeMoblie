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

// All accounts and writes belong to disposable MongoDB; never load Atlas/.env.
const password = 'profile-test-password';
const timezone = 'Asia/Ho_Chi_Minh';
let replica, client, db, server, baseUrl, first, second;
before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
  db = client.db('fitlife_profile_test');
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
function onboarding(extra = {}) {
  return { email: `${randomUUID()}@fitlife.example`, password, full_name: 'Profile test',
    gender: 'male', age: 23, height: 170, weight: 65, activity_level: 'moderate', goal: 'maintain',
    timezone, ...extra };
}
async function register(extra) {
  const result = await request('/api/auth/register', null, 'POST', onboarding(extra));
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body;
}
const patch = (body, member = first) => request('/api/profile', member.token, 'PATCH', body);
const profile = async (member = first) => (await request('/api/profile', member.token)).body.profile;
const stored = (member = first) => db.collection('users').findOne({ user_id: member.user.user_id });
const birthOnJanuaryFirst = age => `${Number(localDay(new Date(), timezone).slice(0, 4)) - age}-01-01`;
function referenceAge(birth, today) {
  return Number(today.slice(0, 4)) - Number(birth.slice(0, 4)) - (today.slice(5) < birth.slice(5) ? 1 : 0);
}
const expectedCalories = age => Math.max(1500, Math.round((10 * 65 + 6.25 * 170 - 5 * age + 5) * 1.55));

test('legacy profiles expose their existing email and an unknown birthday as null', async () => {
  const result = await profile();
  assert.equal(result.email, first.user.email);
  assert.equal(result.date_of_birth, null);
  assert.equal(result.age, 23);
  assert.equal(Object.hasOwn(await stored(), 'date_of_birth'), false);
  assert.equal(Object.hasOwn(result, 'password_hash'), false);
  assert.equal(Object.hasOwn(result, '_id'), false);
});

test('profile changes remain authenticated, private and protected against owner/system injection', async () => {
  assert.equal((await request('/api/profile', null, 'PATCH', { email: 'updated@fitlife.example' })).status, 401);
  for (const injected of [{ user_id: second.user.user_id }, { role: 'admin' }, { fit_coins: 100 },
    { target_calories: 2000 }, { timezone: 'UTC' }, { password_hash: 'plaintext' }]) {
    assert.equal((await patch({ email: 'updated@fitlife.example', ...injected })).status, 400);
  }
  await db.collection('users').updateOne({ user_id: first.user.user_id }, { $set: { role: 'trainer' } });
  assert.equal((await patch({ date_of_birth: birthOnJanuaryFirst(29) })).status, 403);
  await db.collection('users').updateOne({ user_id: first.user.user_id }, { $set: { role: 'user', is_active: false } });
  assert.equal((await patch({ email: 'updated@fitlife.example' })).status, 403);
  assert.equal((await stored(second)).email, second.user.email);
});

test('birthday changes derive age and calorie targets while preserving other profile data', async () => {
  const before = await stored();
  const dateOfBirth = birthOnJanuaryFirst(29);
  const result = await patch({ date_of_birth: dateOfBirth });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.profile.date_of_birth, dateOfBirth);
  assert.equal(result.body.profile.age, 29);
  assert.equal(result.body.profile.target_calories, expectedCalories(29));
  assert.equal(result.body.profile.target_water, 2275);
  const user = await stored();
  assert.equal(user.date_of_birth, dateOfBirth);
  assert.equal(user.age, 29);
  for (const key of ['user_id', 'email', 'password_hash', 'height', 'weight', 'fit_coins', 'streak_days']) {
    assert.equal(user[key], before[key], key);
  }
  assert.equal((await profile(second)).date_of_birth, null);
  assert.equal((await patch({ age: 28 })).status, 400);
  assert.equal((await patch({ age: 29, full_name: 'Updated name' })).status, 200);
  assert.equal((await profile()).date_of_birth, dateOfBirth);
});

test('birthday validation rejects invalid types, nonexistent dates, future dates and ages outside 5–100', async () => {
  const today = localDay(new Date(), timezone);
  const future = new Date(today + 'T12:00:00.000Z');
  future.setUTCDate(future.getUTCDate() + 1);
  const before = await stored();
  for (const date_of_birth of [null, '', ' ', 20000101, true, [], { $ne: null },
    '31/12/2000', '2000-2-01', '2001-02-29', '2000-04-31', '2000-01-01T00:00:00Z',
    future.toISOString().slice(0, 10), birthOnJanuaryFirst(4), birthOnJanuaryFirst(101)]) {
    const result = await patch({ date_of_birth, full_name: 'Must not persist' });
    assert.equal(result.status, 400, JSON.stringify({ date_of_birth, result: result.body }));
  }
  assert.equal((await patch({ date_of_birth: birthOnJanuaryFirst(29), age: 28 })).status, 400);
  const user = await stored();
  assert.equal(user.full_name, before.full_name);
  assert.equal(user.age, before.age);
  assert.equal(user.target_calories, before.target_calories);
  assert.equal(Object.hasOwn(user, 'date_of_birth'), false);
});

test('birthday age boundaries and leap-day birthdays are accepted when valid', async () => {
  for (const age of [5, 100]) {
    const result = await patch({ date_of_birth: birthOnJanuaryFirst(age), age });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.profile.age, age);
  }
  const leap = '2000-02-29';
  const result = await patch({ date_of_birth: leap });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.profile.date_of_birth, leap);
  assert.equal(result.body.profile.age, referenceAge(leap, localDay(new Date(), timezone)));
});

test('canonical email changes keep account identity/password/session and become the new login address', async () => {
  const before = await stored();
  const email = `changed-${randomUUID()}@fitlife.example`;
  const result = await patch({ email: `  ${email.toUpperCase()}  ` });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.profile.email, email);
  assert.equal(result.body.profile.user_id, first.user.user_id);
  assert.equal((await stored()).password_hash, before.password_hash);
  assert.equal((await request('/api/auth/me', first.token)).body.user.email, email);
  assert.equal((await request('/api/auth/login', null, 'POST', { email: first.user.email, password })).status, 401);
  const login = await request('/api/auth/login', null, 'POST', { email, password });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.user_id, first.user.user_id);
  assert.equal((await patch({ email: email.toUpperCase() })).status, 200);
});

test('invalid and duplicate emails reject the entire profile update without partial writes', async () => {
  const before = await stored();
  for (const email of [null, '', 'bad-email', 'a@b', 123, [], { $ne: null }, 'x'.repeat(90) + '@fitlife.example']) {
    assert.equal((await patch({ email, full_name: 'Must not persist' })).status, 400, JSON.stringify(email));
  }
  const result = await patch({ email: ` ${second.user.email.toUpperCase()} `,
    full_name: 'Must not persist', date_of_birth: birthOnJanuaryFirst(29), weight: 75 });
  assert.equal(result.status, 409, JSON.stringify(result.body));
  const user = await stored();
  for (const key of ['email', 'full_name', 'age', 'weight', 'target_calories', 'target_water', 'password_hash']) {
    assert.equal(user[key], before[key], key);
  }
  assert.equal(Object.hasOwn(user, 'date_of_birth'), false);
});

test('concurrent email claims permit exactly one account and leave the losing profile untouched', async () => {
  const email = `claim-${randomUUID()}@fitlife.example`;
  const results = await Promise.all([
    patch({ email, full_name: 'First claimant' }, first),
    patch({ email: email.toUpperCase(), full_name: 'Second claimant' }, second),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(await db.collection('users').countDocuments({ email }), 1);
  const winner = results[0].status === 200 ? first : second;
  const loser = winner === first ? second : first;
  assert.equal((await stored(winner)).email, email);
  assert.equal((await stored(loser)).email, loser.user.email);
  assert.equal((await stored(loser)).full_name, 'Profile test');
});

test('registration accepts birthdays without redundant age and rejects conflicting age', async () => {
  const body = onboarding({ date_of_birth: birthOnJanuaryFirst(29) });
  delete body.age;
  const result = await request('/api/auth/register', null, 'POST', body);
  assert.equal(result.status, 201, JSON.stringify(result.body));
  const user = await db.collection('users').findOne({ user_id: result.body.user.user_id });
  assert.equal(user.age, 29);
  assert.equal(user.date_of_birth, body.date_of_birth);
  assert.equal(user.target_calories, expectedCalories(29));
  const conflict = onboarding({ date_of_birth: birthOnJanuaryFirst(29), age: 23 });
  assert.equal((await request('/api/auth/register', null, 'POST', conflict)).status, 400);
  assert.equal(await db.collection('users').countDocuments({ email: conflict.email }), 0);
});

test('birthday updates after workout preserve the daily water bonus and existing coins', async () => {
  const workout = await request('/api/workout-logs', first.token, 'POST', {
    workout_id: randomUUID(), title: 'Hít đất', category: 'fullbody', duration_seconds: 600, calories_burned: 50,
  });
  assert.equal(workout.status, 201);
  const result = await patch({ date_of_birth: birthOnJanuaryFirst(29), weight: 75 });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.profile.target_water, 2975);
  assert.equal(result.body.profile.fit_coins, 10);
  assert.equal((await request('/api/water-logs', first.token)).body.target, 2975);
});

test('profile reads derive the current age and calorie target rather than trusting a stale cached age', async () => {
  const dateOfBirth = birthOnJanuaryFirst(29);
  assert.equal((await patch({ date_of_birth: dateOfBirth })).status, 200);
  await db.collection('users').updateOne({ user_id: first.user.user_id }, {
    $set: { age: 28, target_calories: expectedCalories(28) },
  });
  const result = await profile();
  assert.equal(result.date_of_birth, dateOfBirth);
  assert.equal(result.age, 29);
  assert.equal(result.target_calories, expectedCalories(29));
});

test('the same active session sees birthday age and calories change at local midnight', async t => {
  // Mock Date only: real HTTP, MongoDB I/O and driver timers continue normally.
  // The session is created inside this window and remains valid across midnight.
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2030-10-28T16:59:00.000Z') });
  const member = await register({ date_of_birth: '2000-10-29', age: 29 });
  const before = await request('/api/profile', member.token);
  assert.equal(before.status, 200);
  assert.equal(before.body.profile.age, 29);
  assert.equal(before.body.profile.target_calories, expectedCalories(29));

  // 00:01 on October 29 in Asia/Ho_Chi_Minh, while UTC is still October 28.
  t.mock.timers.setTime(new Date('2030-10-28T17:01:00.000Z').getTime());
  const after = await request('/api/profile', member.token);
  assert.equal(after.status, 200);
  assert.equal(after.body.profile.date_of_birth, '2000-10-29');
  assert.equal(after.body.profile.age, 30);
  assert.equal(after.body.profile.target_calories, expectedCalories(30));
  const me = await request('/api/auth/me', member.token);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.profile.target_calories, expectedCalories(30));

  // Updating another field must not reject yesterday's cached age or keep it.
  const updated = await patch({ full_name: 'After birthday' }, member);
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.profile.age, 30);
  assert.equal((await stored(member)).age, 30);
});

test('a birthday becomes eligible only once the fifth birthday has arrived in the account timezone', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2030-10-28T16:59:00.000Z') });
  const member = await register({ age: 23 });
  const before = await patch({ date_of_birth: '2025-10-29' }, member);
  assert.equal(before.status, 400);
  assert.equal(Object.hasOwn(await stored(member), 'date_of_birth'), false);

  t.mock.timers.setTime(new Date('2030-10-28T17:01:00.000Z').getTime());
  const after = await patch({ date_of_birth: '2025-10-29' }, member);
  assert.equal(after.status, 200, JSON.stringify(after.body));
  assert.equal(after.body.profile.age, 5);
  assert.equal(after.body.profile.date_of_birth, '2025-10-29');
});

test('profile updates never accept a client supplied clock or an age that conflicts with birthday', async () => {
  const dateOfBirth = birthOnJanuaryFirst(29);
  for (const body of [
    { date_of_birth: dateOfBirth, now: '2030-10-29T00:00:00.000Z' },
    { date_of_birth: dateOfBirth, current_date: '2030-10-29' },
    { date_of_birth: dateOfBirth, age: 28 },
  ]) {
    assert.equal((await patch(body)).status, 400, JSON.stringify(body));
  }
  const user = await stored();
  assert.equal(Object.hasOwn(user, 'date_of_birth'), false);
  assert.equal(user.age, 23);
});
