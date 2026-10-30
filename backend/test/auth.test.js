'use strict';

const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { gzipSync } = require('node:zlib');
const { before, after, beforeEach, afterEach, test } = require('node:test');
const { MongoClient } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../app');
const { initializeAuthSessions } = require('../database/connection');
const { initializeDatabase } = require('../database/mongodb/database');
const { seedCatalogs, seedDemo, DEMO_USER_ID, DEMO_EMAIL } = require('../database/mongodb/seed');
const { verifyDatabase } = require('../database/mongodb/database');
const { localDay } = require('../auth/registration');

// Tests use a disposable MongoDB replica set and real HTTP requests. They never
// load .env, connect to Atlas, or change users in an existing database.
const password = '  FitLife integration test password  ';
const logger = { info() {}, warn() {}, error() {}, log() {} };
let replica;
let client;
let db;
let server;
let baseUrl;

before(async () => {
  replica = await MongoMemoryReplSet.create({
    binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  client = new MongoClient(replica.getUri());
  await client.connect();
  db = client.db('fitlife_auth_test');
  await initializeDatabase(db);
  await seedCatalogs(db);
  await seedDemo(db, client, password);
  await initializeAuthSessions(db);
}, { timeout: 240000 });

beforeEach(async () => {
  // A new app also isolates each test's rate-limit counters.
  server = createApp({ db, sessionTtlSeconds: 3600, logger }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server = undefined;
  }
  if (db) await db.collection('auth_sessions').deleteMany({});
});

after(async () => {
  if (client) await client.close();
  if (replica) await replica.stop();
});

async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
}

async function login(email = DEMO_EMAIL, suppliedPassword = password) {
  const response = await request('/api/auth/login', { method: 'POST', body: { email, password: suppliedPassword } });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function assertPublicUser(user) {
  assert.equal(user.user_id, DEMO_USER_ID);
  assert.equal(user.id, DEMO_USER_ID);
  assert.equal(user.email, DEMO_EMAIL);
  assert.equal(user.role, 'user');
  assert.equal(typeof user.name, 'string');
  for (const field of ['password', 'password_hash', '_id']) assert.equal(Object.hasOwn(user, field), false, field);
  assert.deepEqual(Object.keys(user.profile).sort(), ['coins', 'height', 'target_calories', 'target_water', 'weight']);
}

test('login uses Atlas-compatible user hashes, canonicalizes email, and returns only a public profile', async () => {
  const result = await login(`  ${DEMO_EMAIL.toUpperCase()}  `);
  assert.equal(result.success, true);
  assert.match(result.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(result.token_type, 'Bearer');
  const remaining = new Date(result.expires_at).getTime() - Date.now();
  assert.ok(remaining > 3500 * 1000 && remaining <= 3600 * 1000);
  assertPublicUser(result.user);
  const profile = await db.collection('users').findOne({ user_id: DEMO_USER_ID });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(profile.password_hash), false);
  assert.equal(serialized.includes(password), false);
  assert.match(result.token, /^[A-Za-z0-9_-]+$/);
});

test('sessions persist only a token digest and initialization preserves an existing session', async () => {
  const { token } = await login();
  const stored = await db.collection('auth_sessions').findOne({ token_hash: tokenHash(token) });
  assert.ok(stored);
  assert.equal(stored.user_id, DEMO_USER_ID);
  assert.ok(stored.created_at instanceof Date);
  assert.ok(stored.expires_at instanceof Date);
  assert.equal(JSON.stringify(stored).includes(token), false);
  await initializeAuthSessions(db);
  assert.deepEqual(await db.collection('auth_sessions').findOne({ _id: stored._id }), stored);
  await assert.rejects(db.collection('auth_sessions').insertOne({ ...stored, _id: undefined }), { code: 11000 });
  const indexes = await db.collection('auth_sessions').listIndexes().toArray();
  assert.ok(indexes.some(index => index.unique && index.key.token_hash === 1));
  assert.ok(indexes.some(index => index.key.expires_at === 1 && index.expireAfterSeconds === 0));
});

test('the same generic rejection covers wrong password, unknown email, and a password with spaces removed', async () => {
  const failures = [];
  for (const [email, suppliedPassword] of [
    [DEMO_EMAIL, 'incorrect-password'],
    ['missing@fitlife.example', password],
    [DEMO_EMAIL, password.trim()],
    ['demo@fitlife.app', '123'],
  ]) {
    const response = await request('/api/auth/login', { method: 'POST', body: { email, password: suppliedPassword } });
    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
    failures.push(response.body);
  }
  for (const failure of failures) assert.deepEqual(failure, failures[0]);
  assert.equal(await db.collection('auth_sessions').countDocuments(), 0);
});

test('external-auth users without password_hash cannot sign in through the password endpoint', async (t) => {
  const source = await db.collection('users').findOne({ user_id: DEMO_USER_ID });
  const external = { ...source, user_id: randomUUID(), email: 'external@fitlife.example' };
  delete external._id;
  delete external.password_hash;
  t.after(async () => db.collection('users').deleteOne({ user_id: external.user_id }));
  await db.collection('users').insertOne(external);
  const response = await request('/api/auth/login', { method: 'POST', body: { email: external.email, password } });
  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(await db.collection('auth_sessions').countDocuments(), 0);
});

test('malformed credentials and MongoDB operator injection receive 400 without creating sessions', async () => {
  for (const body of [
    {},
    { email: DEMO_EMAIL },
    { email: { $ne: null }, password },
    { email: DEMO_EMAIL, password: { $ne: null } },
    { email: ['demo@fitlife.example'], password },
    { email: '', password },
    { email: DEMO_EMAIL, password: '' },
    { email: DEMO_EMAIL, password: 'x'.repeat(1025) },
  ]) {
    const response = await request('/api/auth/login', { method: 'POST', body });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(response.body.success, false);
  }
  assert.equal(await db.collection('auth_sessions').countDocuments(), 0);
});

test('malformed JSON produces a controlled JSON error', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":',
  });
  assert.equal(response.status, 400);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const result = await response.json();
  assert.equal(result.success, false);
  assert.equal(Object.hasOwn(result, 'stack'), false);
});

test('unsupported encodings and corrupt compressed bodies return client errors without leaking credentials', async () => {
  for (const [headers, body, status] of [
    [{ 'Content-Type': 'application/json; charset=iso-8859-1' }, JSON.stringify({ email: DEMO_EMAIL, password }), 415],
    [{ 'Content-Encoding': 'br' }, JSON.stringify({ email: DEMO_EMAIL, password }), 415],
    [{ 'Content-Encoding': 'gzip' }, Buffer.from('invalid gzip ' + password), 400],
  ]) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body,
    });
    assert.equal(response.status, status);
    assert.match(response.headers.get('content-type'), /application\/json/);
    const result = await response.json();
    assert.equal(result.success, false);
    assert.deepEqual(Object.keys(result).sort(), ['message', 'success']);
    assert.equal(JSON.stringify(result).includes(password), false);
  }
  assert.equal(await db.collection('auth_sessions').countDocuments(), 0);
  // A supported, correctly encoded body must still reach the login handler.
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
    body: gzipSync(JSON.stringify({ email: DEMO_EMAIL, password })),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
});

test('both plain and compressed oversized JSON are rejected before authentication', async () => {
  const oversized = JSON.stringify({ email: DEMO_EMAIL, password: password + 'x'.repeat(17000) });
  for (const [headers, body] of [[{}, oversized], [{ 'Content-Encoding': 'gzip' }, gzipSync(oversized)]]) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body,
    });
    assert.equal(response.status, 413);
    const result = await response.json();
    assert.equal(result.success, false);
    assert.equal(JSON.stringify(result).includes(password), false);
  }
  assert.equal(await db.collection('auth_sessions').countDocuments(), 0);
});

test('login throttles repeated requests and untrusted forwarding headers cannot reset the IP limit', async () => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await request('/api/auth/login', {
      method: 'POST', body: {}, headers: { 'X-Forwarded-For': `203.0.113.${attempt + 1}` },
    });
    assert.equal(response.status, 400);
  }
  const limited = await request('/api/auth/login', {
    method: 'POST', body: { email: DEMO_EMAIL, password }, headers: { 'X-Forwarded-For': '203.0.113.100' },
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.body.success, false);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.equal(await db.collection('auth_sessions').countDocuments(), 0);
});

test('me requires a valid bearer session and never exposes a password hash', async () => {
  for (const options of [
    {},
    { token: 'not-a-session' },
    { token: 'A'.repeat(43) },
    { headers: { Authorization: 'Basic abc' } },
  ]) {
    const response = await request('/api/auth/me', options);
    assert.equal(response.status, 401);
  }
  const { token } = await login();
  const response = await request('/api/auth/me', { token });
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assertPublicUser(response.body.user);
  assert.equal(JSON.stringify(response.body).includes('password_hash'), false);
});

test('logout revokes the selected session immediately, preserves another login, and supports retry', async () => {
  const first = await login();
  const second = await login();
  assert.notEqual(first.token, second.token);
  assert.equal((await request('/api/auth/logout', { method: 'POST', token: first.token })).status, 204);
  assert.equal((await request('/api/auth/me', { token: first.token })).status, 401);
  assert.equal((await request('/api/auth/me', { token: second.token })).status, 200);
  assert.equal(await db.collection('auth_sessions').countDocuments({ token_hash: tokenHash(first.token) }), 0);
  assert.equal(await db.collection('auth_sessions').countDocuments({ token_hash: tokenHash(second.token) }), 1);
  assert.equal((await request('/api/auth/logout', { method: 'POST', token: first.token })).status, 204);
  assert.equal((await request('/api/auth/logout', { method: 'POST' })).status, 401);
  assert.equal((await request('/api/auth/logout', { method: 'POST', token: 'invalid' })).status, 401);
});

test('expired sessions are rejected before the TTL background cleanup removes them', async () => {
  const { token } = await login();
  await db.collection('auth_sessions').updateOne({ token_hash: tokenHash(token) }, {
    $set: { expires_at: new Date(Date.now() - 1000) },
  });
  assert.equal((await request('/api/auth/me', { token })).status, 401);
});

test('register and login default to fixed 12-hour sessions; requests do not extend expiry', async (t) => {
  await new Promise(resolve => server.close(resolve));
  server = createApp({ db, logger }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const body = onboarding();
  cleanupRegistration(t, body.email);
  const registered = await request('/api/auth/register', { method: 'POST', body });
  assert.equal(registered.status, 201);
  const signedIn = await login(body.email, body.password);
  for (const result of [registered.body, signedIn]) {
    const stored = await db.collection('auth_sessions').findOne({ token_hash: tokenHash(result.token) });
    assert.equal(stored.expires_at.getTime() - stored.created_at.getTime(), 12 * 60 * 60 * 1000);
    assert.equal(result.expires_at, stored.expires_at.toISOString());
  }
  const expiry = new Date(signedIn.expires_at).getTime();
  t.mock.timers.enable({ apis: ['Date'], now: expiry - 1 });
  assert.equal((await request('/api/auth/me', { token: signedIn.token })).status, 200);
  assert.equal((await db.collection('auth_sessions').findOne({ token_hash: tokenHash(signedIn.token) })).expires_at.getTime(), expiry);
  t.mock.timers.setTime(expiry);
  for (const path of ['/api/auth/me', '/api/profile']) {
    assert.equal((await request(path, { token: signedIn.token })).status, 401, path);
  }
  t.mock.timers.reset();
  assert.equal((await request('/api/auth/logout', { method: 'POST', token: signedIn.token })).status, 204);
});

test('legacy sessions cannot remain authorized beyond 12 hours even with a later stored expiry', async () => {
  const { token } = await login();
  await db.collection('auth_sessions').updateOne({ token_hash: tokenHash(token) }, {
    $set: { created_at: new Date(Date.now() - 12 * 60 * 60 * 1000), expires_at: new Date(Date.now() + 86400000) },
  });
  assert.equal((await request('/api/auth/me', { token })).status, 401);
});

test('authentication refuses configuration longer than 12 hours', () => {
  const { createAuthRouter } = require('../routes/auth.routes');
  assert.throws(() => createAuthRouter({ db, sessionTtlSeconds: 43201 }), /Invalid authentication configuration/);
});

test('inactive accounts cannot log in and previously issued sessions stop working', async (t) => {
  const { token } = await login();
  t.after(async () => db.collection('users').updateOne({ user_id: DEMO_USER_ID }, { $set: { is_active: true } }));
  await db.collection('users').updateOne({ user_id: DEMO_USER_ID }, { $set: { is_active: false } });
  const rejectedLogin = await request('/api/auth/login', { method: 'POST', body: { email: DEMO_EMAIL, password } });
  assert.equal(rejectedLogin.status, 403);
  assert.equal((await request('/api/auth/me', { token })).status, 403);
  const wrongPassword = await request('/api/auth/login', {
    method: 'POST', body: { email: DEMO_EMAIL, password: 'incorrect-password' },
  });
  assert.equal(wrongPassword.status, 401);
});

test('deleting a user invalidates their existing bearer session', async (t) => {
  const source = await db.collection('users').findOne({ user_id: DEMO_USER_ID });
  const temporary = { ...source, user_id: randomUUID(), email: 'deleted@fitlife.example' };
  delete temporary._id;
  t.after(async () => db.collection('users').deleteOne({ user_id: temporary.user_id }));
  await db.collection('users').insertOne(temporary);
  const { token } = await login(temporary.email);
  await db.collection('users').deleteOne({ user_id: temporary.user_id });
  assert.equal((await request('/api/auth/me', { token })).status, 401);
});

test('public users and legacy business routes are not exposed', async () => {
  for (const [path, method] of [
    ['/api/auth/users', 'GET'],
    ['/api/health/summary', 'GET'],
    ['/api/shop/items', 'GET'],
    ['/api/ai/chat', 'POST'],
  ]) {
    const response = await request(path, { method });
    assert.equal(response.status, 404, path);
    assert.equal(response.body.success, false);
  }
});

function onboarding(overrides = {}) {
  return {
    email: `register-${randomUUID()}@fitlife.example`, password,
    full_name: '  Nguyễn Văn An  ', gender: 'male', age: 23, height: 170, weight: 65,
    activity_level: 'moderate', goal: 'maintain', ...overrides,
  };
}

function cleanupRegistration(t, email) {
  t.after(async () => {
    const user = await db.collection('users').findOne({ email: email.trim().toLowerCase() });
    if (!user) return;
    await db.collection('auth_sessions').deleteMany({ user_id: user.user_id });
    await db.collection('daily_quest_logs').deleteMany({ user_id: user.user_id });
    await db.collection('users').deleteOne({ user_id: user.user_id });
  });
}

test('register creates an onboarded user, seven unrewarded quests and a usable login/logout session', async (t) => {
  const body = onboarding();
  cleanupRegistration(t, body.email);
  const before = new Date();
  const response = await request('/api/auth/register', {
    method: 'POST', body: { ...body, email: `  ${body.email.toUpperCase()}  ` },
  });
  const after = new Date();
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.success, true);
  assert.equal(response.body.token_type, 'Bearer');
  assert.match(response.body.token, /^[A-Za-z0-9_-]{43}$/);
  const remaining = new Date(response.body.expires_at).getTime() - after.getTime();
  assert.ok(remaining > 3500 * 1000 && remaining <= 3600 * 1000);
  assert.equal(response.body.user.email, body.email);
  assert.equal(response.body.user.name, 'Nguyễn Văn An');
  assert.equal(response.body.user.role, 'user');
  assert.deepEqual(response.body.user.profile, {
    height: 170, weight: 65, target_water: 2275, target_calories: 2484, coins: 0,
  });
  const stored = await db.collection('users').findOne({ email: body.email });
  assert.equal(stored.is_active, true);
  assert.equal(stored.streak_days, 0);
  assert.equal(stored.timezone, 'Asia/Ho_Chi_Minh');
  assert.ok(stored.created_at instanceof Date);
  assert.ok(stored.updated_at instanceof Date);
  assert.equal(await verifyRegistrationPassword(stored, body.password), true);
  assert.equal(await verifyRegistrationPassword(stored, body.password.trim()), false);
  const serialized = JSON.stringify(response.body);
  assert.equal(serialized.includes(stored.password_hash), false);
  assert.equal(serialized.includes(body.password), false);
  assert.equal(Object.hasOwn(response.body.user, '_id'), false);
  const quests = await db.collection('daily_quest_logs').find({ user_id: stored.user_id }).toArray();
  assert.equal(quests.length, 7);
  assert.deepEqual(quests.map((quest) => quest.quest_key).sort(),
    ['q_water', 'q_workout', 'q_meal', 'q_sleep', 'q_mood', 'q_checkin', 'q_chat'].sort());
  for (const quest of quests) {
    assert.equal(quest.is_completed, false);
    assert.equal(quest.reward_coins, 10);
    assert.equal(quest.completed_at, null);
    assert.ok([localDay(before, stored.timezone), localDay(after, stored.timezone)].includes(quest.quest_date));
  }
  const session = await db.collection('auth_sessions').findOne({ user_id: stored.user_id });
  assert.equal(session.token_hash, tokenHash(response.body.token));
  assert.equal(JSON.stringify(session).includes(response.body.token), false);
  assert.equal((await request('/api/auth/me', { token: response.body.token })).body.user.user_id, stored.user_id);
  assert.equal((await request('/api/auth/logout', { method: 'POST', token: response.body.token })).status, 204);
  assert.equal((await request('/api/auth/me', { token: response.body.token })).status, 401);
  assert.equal((await login(body.email, body.password)).user.user_id, stored.user_id);
  for (const name of ['bmi_history', 'water_logs', 'workout_logs']) {
    assert.equal(await db.collection(name).countDocuments({ user_id: stored.user_id }), 0);
  }
  const audit = await verifyDatabase(db);
  assert.equal(audit.ok, true, audit.issues.join('\n'));
});

async function verifyRegistrationPassword(user, suppliedPassword) {
  const { verifyPassword } = require('../auth/password');
  return verifyPassword(suppliedPassword, user.password_hash);
}

test('register rejects missing fields, wrong numeric types and out-of-range onboarding without writing data', async () => {
  const valid = onboarding();
  const before = await db.collection('users').countDocuments();
  const cases = [
    {}, [], null,
    { ...valid, full_name: '   ' }, { ...valid, full_name: 'a'.repeat(101) },
    { ...valid, email: 'bad-email' }, { ...valid, email: { $ne: null } },
    { ...valid, email: '   ' },
    { ...valid, full_name: '   ', email: '   ', password: '        ' },
    { ...valid, age: '23' }, { ...valid, age: 23.5 }, { ...valid, age: 4 }, { ...valid, age: 101 },
    { ...valid, height: 79 }, { ...valid, height: 251 }, { ...valid, height: '170' },
    { ...valid, weight: 24 }, { ...valid, weight: 301 },
    { ...valid, weight: null }, { ...valid, goal: undefined },
  ];
  for (const body of cases) {
    const response = await request('/api/auth/register', { method: 'POST', body });
    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
  }
  assert.equal(await db.collection('users').countDocuments(), before);
  assert.equal(await db.collection('auth_sessions').countDocuments(), 0);
});

test('register rejects privilege, balance, target and identity injection fields instead of trusting them', async () => {
  const valid = onboarding();
  const before = await db.collection('users').countDocuments();
  for (const [key, value] of Object.entries({
    role: 'admin', is_active: false, fit_coins: 999, streak_days: 99,
    target_water: 500, target_calories: 9999, password_hash: 'forged-hash',
    user_id: DEMO_USER_ID, _id: 'forged-id', created_at: '2026-01-01',
    updated_at: '2026-01-01', streak_last_date: '2026-01-01', unknown: true,
    constructor: { prototype: { role: 'admin' } },
  })) {
    const response = await request('/api/auth/register', { method: 'POST', body: { ...valid, [key]: value } });
    assert.equal(response.status, 400, key);
  }
  const protoBody = JSON.parse(JSON.stringify(valid).replace(/}$/, ',"__proto__":{"role":"admin"}}'));
  assert.equal((await request('/api/auth/register', { method: 'POST', body: protoBody })).status, 400);
  assert.equal(await db.collection('users').countDocuments(), before);
});

test('register validates password, timezone and enum values without operator/prototype coercion', async () => {
  const valid = onboarding();
  for (const overrides of [
    { password: 'short' }, { password: ' '.repeat(8) }, { password: 'x'.repeat(1025) },
    { password: { $ne: null } }, { password: '😀'.repeat(4) },
    { gender: 'other' }, { activity_level: 'toString' }, { goal: '__proto__' },
    { goal: { $ne: null } }, { timezone: 'Foo/Bar' }, { timezone: '' },
    { timezone: null }, { timezone: '+07:00' },
  ]) {
    const response = await request('/api/auth/register', { method: 'POST', body: { ...valid, ...overrides } });
    assert.equal(response.status, 400);
  }
  assert.equal(await db.collection('users').countDocuments({ email: valid.email }), 0);
  assert.equal(await db.collection('auth_sessions').countDocuments(), 0);
});

test('register derives v2 targets including female/male floors, water rounding/cap, activity and goal', async (t) => {
  for (const [overrides, water, calories] of [
    [{ gender: 'female', age: 60, height: 150, weight: 45, activity_level: 'sedentary', goal: 'lose' }, 1575, 1200],
    [{ age: 60, height: 150, weight: 45, activity_level: 'sedentary', goal: 'lose' }, 1575, 1500],
    [{ activity_level: 'active', goal: 'gain' }, 2275, 3164],
    [{ activity_level: 'light', goal: 'lose' }, 2275, 1703],
    [{ weight: 65.5 }, 2293, 2492],
    [{ weight: 300 }, 4000, 6126],
  ]) {
    const body = onboarding(overrides);
    cleanupRegistration(t, body.email);
    const response = await request('/api/auth/register', { method: 'POST', body });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.user.profile.target_water, water);
    assert.equal(response.body.user.profile.target_calories, calories);
  }
});

test('register uses the requested timezone and salts identical passwords independently', async (t) => {
  const ids = [];
  const hashes = [];
  for (const timezone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
    const body = onboarding({ timezone, password: '😀'.repeat(8) });
    cleanupRegistration(t, body.email);
    const before = new Date();
    const response = await request('/api/auth/register', { method: 'POST', body });
    const after = new Date();
    assert.equal(response.status, 201);
    const user = await db.collection('users').findOne({ email: body.email });
    hashes.push(user.password_hash);
    ids.push(user.user_id);
    assert.equal(user.timezone, timezone);
    assert.equal(await verifyRegistrationPassword(user, body.password), true);
    const dates = await db.collection('daily_quest_logs').distinct('quest_date', { user_id: user.user_id });
    assert.equal(dates.length, 1);
    assert.ok([localDay(before, timezone), localDay(after, timezone)].includes(dates[0]));
  }
  assert.notEqual(ids[0], ids[1]);
  assert.notEqual(hashes[0], hashes[1]);
  const boundary = new Date('2026-10-28T18:00:00.000Z');
  assert.equal(localDay(boundary, 'Asia/Ho_Chi_Minh'), '2026-10-29');
  assert.equal(localDay(boundary, 'America/Los_Angeles'), '2026-10-28');
});

test('existing email conflicts preserve profile, password, quests and sessions', async () => {
  const oldUser = await db.collection('users').findOne({ user_id: DEMO_USER_ID });
  const oldQuests = await db.collection('daily_quest_logs').find({ user_id: DEMO_USER_ID }).toArray();
  const { token } = await login();
  const response = await request('/api/auth/register', {
    method: 'POST', body: onboarding({ email: `  ${DEMO_EMAIL.toUpperCase()} ` }),
  });
  assert.equal(response.status, 409);
  assert.equal(response.body.success, false);
  assert.equal(response.body.token, undefined);
  assert.deepEqual(await db.collection('users').findOne({ user_id: DEMO_USER_ID }), oldUser);
  assert.deepEqual(await db.collection('daily_quest_logs').find({ user_id: DEMO_USER_ID }).toArray(), oldQuests);
  assert.equal(await db.collection('auth_sessions').countDocuments(), 1);
  assert.equal((await request('/api/auth/me', { token })).status, 200);
});

test('concurrent registrations of a canonical email create exactly one complete account', async (t) => {
  const body = onboarding();
  cleanupRegistration(t, body.email);
  const responses = await Promise.all([
    request('/api/auth/register', { method: 'POST', body }),
    request('/api/auth/register', { method: 'POST', body: { ...body, email: body.email.toUpperCase() } }),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  const user = await db.collection('users').findOne({ email: body.email });
  assert.equal(await db.collection('users').countDocuments({ email: body.email }), 1);
  assert.equal(await db.collection('daily_quest_logs').countDocuments({ user_id: user.user_id }), 7);
  assert.equal(await db.collection('auth_sessions').countDocuments({ user_id: user.user_id }), 1);
  const winner = responses.find((response) => response.status === 201);
  assert.equal((await request('/api/auth/me', { token: winner.body.token })).status, 200);
});

test('failure of the final session insert rolls back the user and all seven quests', async (t) => {
  const body = onboarding();
  cleanupRegistration(t, body.email);
  const counts = async () => Promise.all(['users', 'daily_quest_logs', 'auth_sessions'].map(
    (name) => db.collection(name).countDocuments()));
  const before = await counts();
  const [metadata] = await db.listCollections({ name: 'auth_sessions' }).toArray();
  try {
    // A real MongoDB validation failure, after user + quest inserts in the transaction.
    await db.command({ collMod: 'auth_sessions', validator: {
      $and: [metadata.options.validator, { user_id: DEMO_USER_ID }],
    } });
    const response = await request('/api/auth/register', { method: 'POST', body });
    assert.equal(response.status, 500);
    assert.equal(response.body.success, false);
    assert.equal(response.body.token, undefined);
    assert.equal(JSON.stringify(response.body).includes(body.password), false);
    assert.deepEqual(await counts(), before);
  } finally {
    await db.command({ collMod: 'auth_sessions', validator: metadata.options.validator });
  }
  const retry = await request('/api/auth/register', { method: 'POST', body });
  assert.equal(retry.status, 201);
});

test('register limits repeated attempts separately from login and rejects malformed/oversized JSON', async () => {
  const malformed = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":',
  });
  assert.equal(malformed.status, 400);
  const oversized = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: 'x'.repeat(17000) }),
  });
  assert.equal(oversized.status, 413);
  for (let i = 0; i < 20; i += 1) {
    assert.equal((await request('/api/auth/register', { method: 'POST', body: {} })).status, 400);
  }
  const limited = await request('/api/auth/register', { method: 'POST', body: {} });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.equal((await login()).user.user_id, DEMO_USER_ID);
});
