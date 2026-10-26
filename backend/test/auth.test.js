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

test('old JSON registration, public users, and legacy business routes are not exposed', async () => {
  for (const [path, method] of [
    ['/api/auth/register', 'POST'],
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
