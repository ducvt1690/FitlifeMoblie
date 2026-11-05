'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { before, after, beforeEach, afterEach, test } = require('node:test');
const { MongoClient } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../app');
const { initializeDatabase } = require('../database/mongodb/database');
const { initializeAuthSessions } = require('../database/connection');
const verifiedRegistration = require('./verified-registration');

// Real HTTP and disposable MongoDB. The model is intentionally over-eager so these
// tests prove that message intent, rather than model output, controls app actions.
let replica, client, db, server, baseUrl, member, ai, providerCalls, coachReply;
const fakeAi = http.createServer(async (req, res) => {
  providerCalls += 1;
  let source = '';
  for await (const chunk of req) source += chunk;
  const body = JSON.parse(source);
  const system = body.messages?.find(message => message.role === 'system')?.content || '';
  const payload = system.includes('Bạn là huấn luyện viên thể hình')
    ? { title: 'Lịch kiểm thử', tip: 'Tập có kiểm soát.', items: [{ i: 0, sets: 3 }, { i: 1, sets: 3 }] }
    : coachReply;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }));
});

before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
  db = client.db('fitlife_chat_intent_test');
  await initializeDatabase(db);
  await initializeAuthSessions(db);
  fakeAi.listen(0, '127.0.0.1');
  await once(fakeAi, 'listening');
  ai = { apiKey: 'test-only', provider: 'openai', baseUrl: `http://127.0.0.1:${fakeAi.address().port}`,
    fast: 'test-model', smart: 'test-model', model: 'test-model' };
  const now = new Date();
  await db.collection('exercises').insertMany(['Bench press', 'Push-up'].map((name, index) => ({
    exercise_id: randomUUID(), source: 'exercisedb_v1', source_exercise_id: `intent-${index}`,
    name, gif_url: `https://example.com/intent-${index}.gif`, body_parts: ['chest'],
    equipments: ['bodyweight'], target_muscles: ['pectorals'], secondary_muscles: [],
    instructions: ['Test fixture'], is_active: true, synced_at: now, created_at: now, updated_at: now,
  })));
}, { timeout: 240000 });

beforeEach(async () => {
  providerCalls = 0;
  coachReply = { reply: 'Mình có thể giúp bạn về sức khỏe và tập luyện.', actions: [{ type: 'plan', focus: 'push', minutes: 30 }] };
  await start(ai);
  const password = 'Chat-intent-test-password';
  const input = { email: `${randomUUID()}@fitlife.example`, password, confirm_password: password,
    full_name: 'Intent test', gender: 'male', age: 23, height: 170, weight: 65,
    activity_level: 'moderate', goal: 'maintain' };
  const registered = await request('/api/auth/register', await verifiedRegistration(db, input));
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  member = registered.body;
});
afterEach(async () => { if (server) await new Promise(resolve => server.close(resolve)); server = undefined; });
after(async () => {
  await new Promise(resolve => fakeAi.close(resolve));
  if (client) await client.close();
  if (replica) await replica.stop();
});

async function start(config) {
  server = createApp({ db, ai: config, logger: { error() {} } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}
async function request(path, body, token) {
  const response = await fetch(baseUrl + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
const send = (content, { sessionId = randomUUID(), context = 'general' } = {}) => request('/api/chat/messages', {
  session_id: sessionId, message_id: randomUUID(), content, context,
}, member.token);
async function sideEffects() {
  return Object.fromEntries(await Promise.all(['workout_plans', 'meal_logs', 'coach_memory', 'ai_usage'].map(async name => [
    name, await db.collection(name).countDocuments({ user_id: member.user.user_id }),
  ])));
}
function assertGreeting(response) {
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.plan, null);
  assert.deepEqual(response.body.actions, []);
  assert.match(response.body.reply.content, /chào/i);
  assert.doesNotMatch(response.body.reply.content, /đã lên lịch|hiệp|khởi động|tóm tắt hôm nay/i);
}

test('greeting-only messages bypass an over-eager model and never create plans, meals or memory', async () => {
  coachReply = { reply: 'Đã lên lịch cho bạn.', actions: [
    { type: 'plan', focus: 'push', minutes: 30 },
    { type: 'meal', text: '200g ức gà', meal_type: 'lunch' },
    { type: 'remember', fact: 'Thông tin model tự suy diễn' },
  ] };
  const before = await sideEffects();
  for (const greeting of ['hi', 'Hi!', 'hello', 'xin chào']) assertGreeting(await send(greeting));
  assert.equal(providerCalls, 0, 'A greeting must not invoke the model or any nested AI operation.');
  assert.deepEqual(await sideEffects(), before);
});

test('a greeting after a real workout request does not repeat the old history action', async () => {
  const sessionId = randomUUID();
  const created = await send('Lên lịch tập ngực 30 phút', { sessionId });
  assert.equal(created.status, 201);
  assert.ok(created.body.actions.includes('plan'));
  assert.equal(await db.collection('workout_plans').countDocuments({ user_id: member.user.user_id }), 1);
  const before = await sideEffects(), calls = providerCalls;
  for (const greeting of ['hi', 'Hi!', 'hello', 'xin chào']) assertGreeting(await send(greeting, { sessionId }));
  assert.equal(providerCalls, calls);
  assert.deepEqual(await sideEffects(), before);
});

test('workout page context cannot turn a greeting into a workout command', async () => {
  const before = await sideEffects();
  for (const greeting of ['hi', 'Hi!', 'hello', 'xin chào']) assertGreeting(await send(greeting, { context: 'workout' }));
  assert.equal(providerCalls, 0);
  assert.deepEqual(await sideEffects(), before);
});

test('the no-provider fallback greets naturally and keeps existing workout data unchanged', async () => {
  await new Promise(resolve => server.close(resolve));
  await start({});
  const sessionId = randomUUID();
  const planned = await send('Lên lịch tập ngực 30 phút', { sessionId });
  assert.equal(planned.status, 201);
  assert.ok(planned.body.plan?.items.length);
  const before = await sideEffects();
  assertGreeting(await send('hi', { sessionId, context: 'workout' }));
  assert.deepEqual(await sideEffects(), before);
  assert.equal(providerCalls, 0);
});

test('a greeting followed by an explicit workout request still creates a plan', async () => {
  const response = await send('Hi, lên lịch tập ngực 45 phút', { context: 'workout' });
  assert.equal(response.status, 201);
  assert.ok(response.body.actions.includes('plan'));
  assert.equal(await db.collection('workout_plans').countDocuments({ user_id: member.user.user_id }), 1);
  assert.ok(providerCalls >= 1);
});

test('unrelated current questions cannot authorize a plan action suggested by model history', async () => {
  const sessionId = randomUUID();
  await send('Lên lịch tập ngực 30 phút', { sessionId });
  const before = await sideEffects();
  const response = await send('Bạn có thể giúp mình những gì?', { sessionId, context: 'workout' });
  assert.equal(response.status, 201);
  assert.equal(response.body.plan, null);
  assert.deepEqual(response.body.actions, []);
  assert.deepEqual(await sideEffects(), before);
});

test('negated commands and questions about workout plans do not create a plan', async () => {
  const sessionId = randomUUID();
  await send('Lên lịch tập ngực 30 phút', { sessionId });
  const before = await sideEffects();
  for (const content of ['đừng tạo lịch tập', 'không cần lên lịch tập', 'lịch tập là gì?']) {
    const response = await send(content, { sessionId, context: 'workout' });
    assert.equal(response.status, 201);
    assert.equal(response.body.plan, null, content);
    assert.deepEqual(response.body.actions, [], content);
  }
  assert.deepEqual(await sideEffects(), before);
});

test('an explicit adjustment of a workout remains an authorized plan action', async () => {
  const sessionId = randomUUID();
  await send('Lên lịch tập ngực 30 phút', { sessionId });
  const response = await send('Chỉnh lại lịch tập ngực thành 45 phút', { sessionId, context: 'workout' });
  assert.equal(response.status, 201);
  assert.ok(response.body.actions.includes('plan'));
  assert.equal(await db.collection('workout_plans').countDocuments({ user_id: member.user.user_id }), 2);
});
