'use strict';

const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { once } = require('node:events');
const { before, after, beforeEach, afterEach, test } = require('node:test');
const { MongoClient } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../app');
const { initializeDatabase } = require('../database/mongodb/database');
const { initializeAuthSessions } = require('../database/connection');
const { createEmailVerificationService } = require('../services/email-verification.service');
const { createMailer } = require('../utils/mailer');

// Real HTTP + disposable MongoDB. Only email delivery is replaced; no verification bypass.
let replica, client, db, server, baseUrl, sent, mailer;
const rows = () => db.collection('registration_email_verifications');
const newEmail = () => `${randomUUID()}@fitlife.example`;
const hash = value => createHash('sha256').update(value).digest('hex');
const codeIn = message => /\b(\d{6})\b/.exec(message.text)[1];
const onboarding = email => ({ email, password: ' Test password 123 ', confirm_password: ' Test password 123 ',
  full_name: 'OTP test', gender: 'male', age: 23, height: 170, weight: 65,
  activity_level: 'moderate', goal: 'maintain', timezone: 'Asia/Ho_Chi_Minh' });

before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
  db = client.db('fitlife_email_verification_test');
  await initializeDatabase(db);
  await initializeAuthSessions(db);
}, { timeout: 240000 });
after(async () => { if (client) await client.close(); if (replica) await replica.stop(); });
beforeEach(async () => {
  sent = [];
  mailer = { configured: true, smtp: true, async send(message) { sent.push(message); } };
  server = createApp({ db, mailer, logger: { error() {} } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

async function request(path, body, token) {
  const response = await fetch(baseUrl + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
const sendCode = email => request('/api/auth/register/email-code', { email });
const verify = (email, code) => request('/api/auth/register/verify-email', { email, code });
const register = body => request('/api/auth/register', body);
async function verified(email) {
  assert.equal((await sendCode(email)).status, 200);
  const response = await verify(email, codeIn(sent.at(-1)));
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.verification_token;
}

test('email must be verified before registration, and confirmation/proof never leak into a user', async () => {
  const email = newEmail(), body = onboarding(email);
  assert.equal((await register(body)).status, 403);
  const result = await sendCode(`  ${email.toUpperCase()}  `);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.body.expires_in, 600);
  assert.equal(result.body.code, undefined);
  assert.equal(result.body.verification_token, undefined);
  assert.equal(sent[0].to, email);
  const code = codeIn(sent[0]);
  const pending = await rows().findOne({ _id: email });
  assert.equal(pending.code_hash, hash(pending.nonce + ':' + code));
  assert.equal(pending.code, undefined);
  assert.equal((await register(body)).status, 403);
  assert.equal(await db.collection('users').countDocuments({ email }), 0);
  const proof = await verify(email, code);
  assert.equal(proof.status, 200);
  assert.match(proof.body.verification_token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(proof.body.token, undefined);
  const token = proof.body.verification_token;
  assert.equal((await request('/api/auth/me', undefined, token)).status, 401);
  assert.equal((await rows().findOne({ _id: email })).token_hash, hash(token));
  assert.equal((await rows().findOne({ _id: email })).code_hash, undefined);
  assert.equal((await verify(email, code)).status, 400);
  assert.equal((await register({ ...body, verification_token: token, confirm_password: 'different' })).status, 400);
  const registered = await register({ ...body, verification_token: token });
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  assert.equal(await rows().findOne({ _id: email }), null);
  const stored = await db.collection('users').findOne({ email });
  for (const field of ['password', 'confirm_password', 'verification_token']) {
    assert.equal(Object.hasOwn(stored, field), false);
    assert.equal(Object.hasOwn(registered.body.user, field), false);
  }
  assert.equal((await request('/api/auth/me', undefined, registered.body.token)).status, 200);
  assert.equal((await register({ ...body, verification_token: token })).status, 409);
  assert.equal((await sendCode(email)).status, 409);
});

test('forged, malformed and cross-email proofs cannot register; a proof cannot be reused after consumption', async () => {
  const email = newEmail(), other = newEmail(), body = onboarding(email);
  const token = await verified(email);
  for (const fake of [null, 123, {}, 'bad', 'A'.repeat(43)]) {
    assert.equal((await register({ ...body, verification_token: fake })).status, 403);
  }
  assert.equal((await register({ ...onboarding(other), verification_token: token })).status, 403);
  assert.equal(await db.collection('users').countDocuments({ email: other }), 0);
  const created = await register({ ...body, verification_token: token });
  assert.equal(created.status, 201);
  // Removing only this test user proves rejection comes from consuming the proof, not an email conflict.
  const id = created.body.user.user_id;
  for (const name of ['auth_sessions', 'daily_quest_logs', 'users']) await db.collection(name).deleteMany({ user_id: id });
  assert.equal((await register({ ...body, verification_token: token })).status, 403);
});

test('parallel wrong OTP guesses stop at five and lock out even the correct code', async () => {
  const email = newEmail();
  await sendCode(email);
  const code = codeIn(sent[0]), wrong = code === '000000' ? '111111' : '000000';
  const results = await Promise.all(Array.from({ length: 7 }, () => verify(email, wrong)));
  assert.ok(results.every(result => result.status === 400));
  assert.equal((await rows().findOne({ _id: email })).attempts, 5);
  assert.equal((await verify(email, code)).status, 400);
});

test('expired OTPs and verified tokens are rejected before the TTL monitor removes their rows', async () => {
  const email = newEmail();
  await sendCode(email);
  await rows().updateOne({ _id: email }, { $set: { expires_at: new Date(Date.now() - 1000) } });
  assert.equal((await verify(email, codeIn(sent[0]))).status, 400);
  const second = newEmail(), token = await verified(second);
  await rows().updateOne({ _id: second }, { $set: { expires_at: new Date(Date.now() - 1000) } });
  assert.equal((await register({ ...onboarding(second), verification_token: token })).status, 403);
});

test('resend has an atomic cooldown, replaces the OTP and invalidates a previous proof', async () => {
  const email = newEmail();
  const results = await Promise.all([sendCode(email), sendCode(email)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 429]);
  assert.equal(results.find(r => r.status === 429).headers.get('retry-after'), '60');
  assert.equal(sent.length, 1);
  const original = await rows().findOne({ _id: email });
  const code = codeIn(sent[0]);
  await rows().updateOne({ _id: email }, { $set: { sent_at: new Date(Date.now() - 61000) } });
  assert.equal((await sendCode(email)).status, 200);
  assert.notEqual((await rows().findOne({ _id: email })).nonce, original.nonce);
  const replacement = codeIn(sent[1]);
  if (replacement !== code) assert.equal((await verify(email, code)).status, 400);
  const token = (await verify(email, replacement)).body.verification_token;
  await rows().updateOne({ _id: email }, { $set: { sent_at: new Date(Date.now() - 61000) } });
  assert.equal((await sendCode(email)).status, 200);
  assert.equal((await register({ ...onboarding(email), verification_token: token })).status, 403);
});

test('parallel verification and registration produce one proof and one complete account', async () => {
  const email = newEmail();
  await sendCode(email);
  const code = codeIn(sent[0]);
  const proofs = await Promise.all([verify(email, code), verify(email, code)]);
  assert.deepEqual(proofs.map(r => r.status).sort(), [200, 400]);
  const body = { ...onboarding(email), verification_token: proofs.find(r => r.status === 200).body.verification_token };
  const results = await Promise.all([register(body), register({ ...body, email: email.toUpperCase() })]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  const user = await db.collection('users').findOne({ email });
  assert.equal(await db.collection('users').countDocuments({ email }), 1);
  assert.equal(await db.collection('daily_quest_logs').countDocuments({ user_id: user.user_id }), 7);
  assert.equal(await db.collection('auth_sessions').countDocuments({ user_id: user.user_id }), 1);
});

test('a failed registration transaction keeps the proof for a safe retry', async () => {
  const email = newEmail(), token = await verified(email);
  const body = { ...onboarding(email), verification_token: token };
  const [metadata] = await db.listCollections({ name: 'auth_sessions' }).toArray();
  try {
    await db.command({ collMod: 'auth_sessions', validator: { $and: [metadata.options.validator, { user_id: 'reject-test-user' }] } });
    assert.equal((await register(body)).status, 500);
    assert.equal(await db.collection('users').countDocuments({ email }), 0);
    assert.equal((await rows().findOne({ _id: email })).token_hash, hash(token));
  } finally { await db.command({ collMod: 'auth_sessions', validator: metadata.options.validator }); }
  assert.equal((await register(body)).status, 201);
});

test('SMTP failure does not activate an OTP; missing SMTP never falls back to console verification', async () => {
  const email = newEmail();
  mailer.send = async () => { throw new Error('SMTP secret must not appear in response'); };
  const result = await sendCode(email);
  assert.equal(result.status, 503);
  assert.equal(JSON.stringify(result.body).includes('SMTP secret'), false);
  assert.equal(await rows().findOne({ _id: email }), null);
  mailer.smtp = false;
  assert.equal((await sendCode(newEmail())).status, 503);
  const consoleMailer = createMailer({}, { log() { throw new Error('Must not log verification OTP'); } });
  const service = createEmailVerificationService({ db, mailer: consoleMailer });
  await assert.rejects(service.send({ email }), { httpStatus: 503 });
  assert.equal(createMailer({ host: 'smtp.gmail.com', user: 'sender@example.com', pass: 'test-only' }).smtp, true);
});

test('OTP is unusable until delivery succeeds', async () => {
  const email = newEmail();
  let release, deliveryStarted;
  const started = new Promise(resolve => { deliveryStarted = resolve; });
  mailer.send = async message => {
    sent.push(message);
    deliveryStarted();
    await new Promise(resolve => { release = resolve; });
  };
  const pending = sendCode(email);
  await started;
  try { assert.equal((await verify(email, codeIn(sent[0]))).status, 400); }
  finally { release(); }
  assert.equal((await pending).status, 200);
  assert.equal((await verify(email, codeIn(sent[0]))).status, 200);
});

test('email endpoints reject malformed bodies and enforce per-IP send limits', async () => {
  const service = createEmailVerificationService({ db, mailer });
  for (const body of [null, [], {}, { email: {} }, { email: 'bad' }, { email: newEmail(), role: 'admin' }]) {
    await assert.rejects(service.send(body), { httpStatus: 400 });
  }
  for (const code of [null, 123456, {}, '12345', '1234567', 'abcdef']) {
    assert.equal((await verify(newEmail(), code)).status, 400);
  }
  for (let i = 0; i < 5; i++) assert.equal((await sendCode('bad')).status, 400);
  const limited = await sendCode(newEmail());
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.equal(sent.length, 0);
});

test('verification storage has a TTL, rejects plaintext fields, and initialization preserves live proofs', async () => {
  const email = newEmail(), token = await verified(email);
  const stored = await rows().findOne({ _id: email });
  const indexes = await rows().listIndexes().toArray();
  assert.equal(indexes.find(i => i.name === 'ttl_registration_email_expiry').expireAfterSeconds, 0);
  await assert.rejects(rows().updateOne({ _id: email }, { $set: { code: '123456' } }), { code: 121 });
  await initializeAuthSessions(db);
  assert.deepEqual(await rows().findOne({ _id: email }), stored);
  assert.equal((await register({ ...onboarding(email), verification_token: token })).status, 201);
});
