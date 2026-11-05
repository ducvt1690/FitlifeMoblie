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

// Real HTTP + disposable MongoDB. The over-eager provider tries to change app
// data even for informational questions, so absence of actions is observable.
let replica, client, db, server, baseUrl, member, ai, providerCalls;
const fakeAi = http.createServer(async (req, res) => {
  providerCalls += 1;
  let input = '';
  for await (const chunk of req) input += chunk;
  const request = JSON.parse(input);
  const system = request.messages?.find(message => message.role === 'system')?.content || '';
  let payload;
  if (system.includes('Bạn là huấn luyện viên thể hình')) {
    payload = { title: 'Lịch kiểm thử', tip: 'Tập có kiểm soát.',
      items: [{ i: 0, sets: 3 }, { i: 1, sets: 3 }] };
  } else if (system.includes('Tách mô tả bữa ăn')) {
    payload = { items: [{ name: 'ức gà', grams: 200, kcal: 165, protein: 31, carbs: 0, fat: 3.6 }], invalid: [] };
  } else {
    payload = { reply: 'Mình có thể hỗ trợ các chức năng trong FitLife.', actions: [
      { type: 'plan', focus: 'push', minutes: 30 },
      { type: 'meal', text: '200g ức gà', meal_type: 'lunch' },
      { type: 'remember', fact: 'Model tự suy diễn điều không được yêu cầu' },
    ] };
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }));
});

before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
  db = client.db('fitlife_chat_scope_test');
  await initializeDatabase(db);
  await initializeAuthSessions(db);
  fakeAi.listen(0, '127.0.0.1');
  await once(fakeAi, 'listening');
  ai = { apiKey: 'test-only', provider: 'openai', baseUrl: `http://127.0.0.1:${fakeAi.address().port}`,
    fast: 'test-model', smart: 'test-model', model: 'test-model' };
  const now = new Date();
  await db.collection('exercises').insertMany(['Bench press', 'Push-up'].map((name, index) => ({
    exercise_id: randomUUID(), source: 'exercisedb_v1', source_exercise_id: `scope-${index}`,
    name, gif_url: `https://example.com/scope-${index}.gif`, body_parts: ['chest'],
    equipments: ['bodyweight'], target_muscles: ['pectorals'], secondary_muscles: [],
    instructions: ['Test fixture'], is_active: true, synced_at: now, created_at: now, updated_at: now,
  })));
}, { timeout: 240000 });

beforeEach(async () => {
  providerCalls = 0;
  await start(ai);
  const password = 'Chat-scope-fixture-password';
  const input = { email: `${randomUUID()}@fitlife.example`, password, confirm_password: password,
    full_name: 'Scope test', gender: 'male', age: 23, height: 170, weight: 65,
    activity_level: 'moderate', goal: 'maintain' };
  const created = await request('/api/auth/register', await verifiedRegistration(db, input));
  assert.equal(created.status, 201, JSON.stringify(created.body));
  member = created.body;
});

afterEach(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  server = undefined;
});

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

async function dataChanges() {
  return Object.fromEntries(await Promise.all([
    'workout_plans', 'meal_logs', 'coach_memory', 'ai_usage', 'nutrition_suggestions', 'nutrition_profiles',
  ].map(async name => [name, await db.collection(name).countDocuments({ user_id: member.user.user_id })])));
}

function noActions(response) {
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.plan, null);
  assert.deepEqual(response.body.actions, []);
}

test('a greeting is conversational and cannot execute an eager model action', async () => {
  const before = await dataChanges();
  const response = await send('hi', { context: 'workout' });
  noActions(response);
  assert.match(response.body.reply.content, /chào/i);
  assert.doesNotMatch(response.body.reply.content, /tóm tắt hôm nay|hiệp|đã lên lịch/i);
  assert.equal(providerCalls, 0);
  assert.deepEqual(await dataChanges(), before);
});

test('the actual reduce-kg question receives actionable app guidance without changing the goal', async () => {
  await new Promise(resolve => server.close(resolve));
  await start({});
  const before = await dataChanges();
  const response = await send('hôm nay nên làm gì để giảm kg');
  noActions(response);
  assert.match(response.body.reply.content, /giảm cân/i);
  assert.match(response.body.reply.content, /hồ sơ/i);
  assert.doesNotMatch(response.body.reply.content, /^Tóm tắt hôm nay:/i);
  const user = await db.collection('users').findOne({ user_id: member.user.user_id });
  assert.equal(user.goal, 'maintain', 'A question must not silently edit the member goal.');
  assert.deepEqual(await dataChanges(), before);
});

test('off-topic subjects never reach the provider or mutate app data, even with an app-name prefix', async () => {
  const before = await dataChanges();
  for (const [index, content] of [
    'viết code Python giúp tôi',
    'thời tiết Hà Nội hôm nay thế nào?',
    'cơ sở dữ liệu là gì?',
    'viết văn phân tích một bài thơ',
    'nên mua cổ phiếu nào hôm nay?',
    'FitLife viết code Python giúp tôi',
  ].entries()) {
    const response = await send(content, { context: index % 2 ? 'workout' : 'nutrition' });
    noActions(response);
    assert.match(response.body.reply.content, /FitLife/i, content);
    assert.match(response.body.reply.content, /chỉ|phạm vi|trong (?:app|ứng dụng)|không hỗ trợ/i, content);
    assert.doesNotMatch(response.body.reply.content, /Tóm tắt hôm nay:/i, content);
  }
  assert.equal(providerCalls, 0);
  assert.deepEqual(await dataChanges(), before);
});

test('password help explains the real navigation without model actions or a workout', async () => {
  const before = await dataChanges();
  const response = await send('đổi mật khẩu ở đâu?');
  noActions(response);
  assert.match(response.body.reply.content, /hồ sơ/i);
  assert.match(response.body.reply.content, /đổi mật khẩu/i);
  assert.equal(providerCalls, 0);
  assert.deepEqual(await dataChanges(), before);
});

test('an informational water question cannot authorize plan, meal or memory actions', async () => {
  const logged = await request('/api/water-logs', { log_id: randomUUID(), amount: 500 }, member.token);
  assert.equal(logged.status, 201);
  const before = await dataChanges();
  const response = await send('Hôm nay tôi uống bao nhiêu nước?');
  noActions(response);
  assert.match(response.body.reply.content, /500/);
  assert.match(response.body.reply.content, /nước|ml/i);
  assert.deepEqual(await dataChanges(), before);
  assert.doesNotMatch(response.body.reply.content, /đã ghi bữa|đã lên lịch|lịch "|đã ghi nhớ/i);
});

test('negated and informational workout requests remain read-only', async () => {
  const before = await dataChanges();
  for (const content of ['đừng tạo lịch tập', 'không cần lên lịch tập', 'lịch tập là gì?']) {
    const response = await send(content, { context: 'workout' });
    noActions(response);
  }
  assert.deepEqual(await dataChanges(), before);
});

test('an explicit workout request still creates a real plan through the scoped chat', async () => {
  const response = await send('Lên lịch tập ngực 30 phút cho mình');
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.deepEqual(response.body.actions, ['plan'], 'The current turn authorizes only workout creation.');
  assert.equal(await db.collection('workout_plans').countDocuments({ user_id: member.user.user_id }), 1);
});

test('an off-topic new turn does not inherit the previous workout command', async () => {
  const sessionId = randomUUID();
  const workout = await send('Lên lịch tập ngực 30 phút cho mình', { sessionId });
  assert.equal(workout.status, 201);
  assert.ok(workout.body.actions.includes('plan'));
  const before = await dataChanges(), calls = providerCalls;
  const response = await send('cơ sở dữ liệu là gì?', { sessionId, context: 'workout' });
  noActions(response);
  assert.match(response.body.reply.content, /FitLife/i);
  assert.equal(providerCalls, calls, 'A topic change must not inherit model context as authorization.');
  assert.deepEqual(await dataChanges(), before);
});

test('a no-provider food question answers the food calories rather than the daily calorie target', async () => {
  await new Promise(resolve => server.close(resolve));
  await start({});
  const before = await dataChanges();
  const response = await send('100g ức gà có bao nhiêu calo?');
  noActions(response);
  assert.match(response.body.reply.content, /100\s*g.*ức gà/i);
  assert.match(response.body.reply.content, /165\s*kcal/i);
  assert.doesNotMatch(response.body.reply.content, /2[.,]?484|mục tiêu.*kcal|hôm nay đã ghi/i);
  assert.equal(providerCalls, 0);
  assert.deepEqual(await dataChanges(), before);
});

test('an unknown food calorie question acknowledges missing data without substituting daily targets', async () => {
  await new Promise(resolve => server.close(resolve));
  await start({});
  const before = await dataChanges();
  const response = await send('cua có bao calorie');
  noActions(response);
  assert.match(response.body.reply.content, /chưa có số liệu chắc chắn.*cua/i);
  assert.match(response.body.reply.content, /Ăn uống|Tính macro/i);
  assert.doesNotMatch(response.body.reply.content, /2[.,]?484|hôm nay đã ghi/i);
  assert.equal(providerCalls, 0);
  assert.deepEqual(await dataChanges(), before);
});

test('a short water follow-up uses the same conversation topic and actual remaining total', async () => {
  await new Promise(resolve => server.close(resolve));
  await start({});
  const logged = await request('/api/water-logs', { log_id: randomUUID(), amount: 500 }, member.token);
  assert.equal(logged.status, 201);
  const sessionId = randomUUID(), before = await dataChanges();
  const first = await send('Hôm nay tôi uống bao nhiêu nước?', { sessionId });
  noActions(first);
  assert.match(first.body.reply.content, /500/);
  const followUp = await send('còn lại bao nhiêu?', { sessionId });
  noActions(followUp);
  assert.match(followUp.body.reply.content, /1[.,]?775\s*ml/i);
  assert.match(followUp.body.reply.content, /còn|thiếu|thêm/i);
  assert.equal(providerCalls, 0);
  assert.deepEqual(await dataChanges(), before);
});

test('more than ten greetings and refusals do not exhaust substantive coaching allowance', async () => {
  await new Promise(resolve => server.close(resolve));
  await start({});
  const sessionId = randomUUID(), before = await dataChanges();
  for (let i = 0; i < 12; i++) {
    const greeting = await send('hi', { sessionId });
    noActions(greeting);
    assert.match(greeting.body.reply.content, /chào/i);
    const refusal = await send('viết code Python giúp tôi', { sessionId });
    noActions(refusal);
    assert.match(refusal.body.reply.content, /FitLife/);
  }
  const usage = () => db.collection('ai_question_usage').countDocuments({ user_id: member.user.user_id });
  assert.equal(await usage(), 0);
  assert.equal(providerCalls, 0);
  assert.deepEqual(await dataChanges(), before);
  // Greetings must not hide the real limit either: ten relevant questions still
  // work, and the eleventh is rejected using the existing substantive quota.
  for (let i = 0; i < 10; i++) noActions(await send('Hôm nay tôi uống bao nhiêu nước?', { sessionId }));
  assert.equal(await usage(), 10);
  assert.equal((await send('Hôm nay tôi uống bao nhiêu nước?', { sessionId })).status, 402);
});


test('a question about eating cannot authorize a meal log', async () => {
  const before = await dataChanges();
  const response = await send('Tôi ăn 2 quả trứng có béo không?');
  noActions(response);
  assert.deepEqual(await dataChanges(), before);
});

test('unmetered greetings still have a per-minute request limit', async () => {
  for (let i = 0; i < 60; i++) assert.equal((await send('hi')).status, 201);
  const response = await send('hi');
  assert.equal(response.status, 429);
  assert.equal(providerCalls, 0);
  assert.equal(await db.collection('ai_question_usage').countDocuments({ user_id: member.user.user_id }), 0);
});
