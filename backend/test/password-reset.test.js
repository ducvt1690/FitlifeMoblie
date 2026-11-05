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
const { createPasswordResetService } = require('../services/password-reset.service');

// Disposable MongoDB and a fake mailer that records messages instead of sending email.
let replica, client, db, server, baseUrl, sent;
const mailer = { configured: true, async send(message) { sent.push(message); } };
before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
  db = client.db('fitlife_reset_test');
  await initializeDatabase(db);
  await initializeAuthSessions(db);
}, { timeout: 240000 });
after(async () => { if (client) await client.close(); if (replica) await replica.stop(); });
beforeEach(async () => {
  sent = [];
  server = createApp({ db, mailer, logger: { error() {} } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

async function request(path, token, method = 'GET', body) {
  if (path === '/api/auth/register') body = await require('./verified-registration')(db, body);
  const response = await fetch(baseUrl + path, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
async function register() {
  const account = { email: `${randomUUID()}@fitlife.example`, password: 'old-password-123', confirm_password: 'old-password-123', full_name: 'Reset test',
    gender: 'male', age: 23, height: 170, weight: 65, activity_level: 'moderate', goal: 'maintain' };
  const result = await request('/api/auth/register', null, 'POST', account);
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return { ...account, token: result.body.token, user_id: result.body.user.user_id };
}
const forgot = email => request('/api/auth/forgot-password', null, 'POST', { email });
const login = (email, password) => request('/api/auth/login', null, 'POST', { email, password });
const codeIn = message => /\b(\d{6})\b/.exec(message.text)[1];

test('forgot-password answers the same for unknown emails and only emails registered accounts', async () => {
  const user = await register();
  const unknown = await forgot(`${randomUUID()}@fitlife.example`);
  const known = await forgot(user.email.toUpperCase());
  assert.equal(unknown.status, 200); assert.equal(known.status, 200);
  assert.equal(unknown.body.message, known.body.message);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, user.email);
  // Chỉ lưu hash, không lưu mã gốc
  const stored = await db.collection('password_resets').findOne({ user_id: user.user_id });
  assert.equal(stored.attempts, 0);
  assert.equal(JSON.stringify(stored).includes(codeIn(sent[0])), false);
  // Gửi lại ngay trong 1 phút: không có email mới
  assert.equal((await forgot(user.email)).status, 200);
  assert.equal(sent.length, 1);
  // Trường lạ bị từ chối
  assert.equal((await request('/api/auth/forgot-password', null, 'POST', { email: user.email, role: 'admin' })).status, 400);
});

test('a correct code sets the new password once and signs out every device', async () => {
  const user = await register();
  await forgot(user.email);
  const code = codeIn(sent[0]);
  const reset = (extra = {}) => request('/api/auth/reset-password', null, 'POST',
    { email: user.email, code, new_password: 'new-password-456', ...extra });
  assert.equal((await reset({ code: 'abc123' })).status, 400);
  assert.equal((await reset({ new_password: 'ngan' })).status, 400);
  const ok = await reset();
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  // Phiên cũ bị thu hồi, mật khẩu cũ hết tác dụng, mật khẩu mới dùng được
  assert.equal((await request('/api/auth/me', user.token)).status, 401);
  assert.equal((await login(user.email, user.password)).status, 401);
  assert.equal((await login(user.email, 'new-password-456')).status, 200);
  // Mã đã dùng thì không dùng lại được
  assert.equal((await reset({ new_password: 'another-password-789' })).status, 400);
  assert.equal((await login(user.email, 'new-password-456')).status, 200);
});

test('five wrong codes lock the code even if the right one is sent afterwards', async () => {
  const user = await register();
  await forgot(user.email);
  const code = codeIn(sent[0]);
  const wrong = code === '000000' ? '111111' : '000000';
  const reset = guess => request('/api/auth/reset-password', null, 'POST',
    { email: user.email, code: guess, new_password: 'new-password-456' });
  for (let i = 0; i < 5; i += 1) assert.equal((await reset(wrong)).status, 400);
  assert.equal((await reset(code)).status, 400);
  assert.equal((await db.collection('password_resets').findOne({ user_id: user.user_id })).attempts, 5);
  assert.equal((await login(user.email, user.password)).status, 200);
});

test('expired codes are rejected and an unconfigured mailer answers 503', async () => {
  const user = await register();
  await forgot(user.email);
  await db.collection('password_resets').updateOne({ user_id: user.user_id }, { $set: { expires_at: new Date(Date.now() - 1000) } });
  const expired = await request('/api/auth/reset-password', null, 'POST',
    { email: user.email, code: codeIn(sent[0]), new_password: 'new-password-456' });
  assert.equal(expired.status, 400);
  const service = createPasswordResetService({ db, mailer: { configured: false } });
  await assert.rejects(service.request({ email: user.email }), { httpStatus: 503 });
});
