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
const { splitMeal } = require('../services/nutrition.service');
const { fitToTime, secondsOf } = require('../services/workout-plan.service');

// A fake OpenAI-compatible endpoint stands in for the real AI so the AI paths run offline.
let aiReply = {};
let aiCalls = 0;
const fakeAi = http.createServer((req, res) => {
  aiCalls += 1;
  req.resume();
  req.on('end', () => res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(aiReply) } }] })));
});

let replica, client, db, server, baseUrl, member, ai;
before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri()); await client.connect();
  db = client.db('fitlife_nutrition_test'); await initializeDatabase(db); await initializeAuthSessions(db);
  fakeAi.listen(0, '127.0.0.1'); await once(fakeAi, 'listening');
  ai = { apiKey: 'test', provider: 'openai', baseUrl: `http://127.0.0.1:${fakeAi.address().port}`, fast: 'm', smart: 'm', model: 'm' };
  const now = new Date();
  await db.collection('exercises').insertMany(['Barbell Bench Press', 'Dumbbell Shoulder Press', 'Cable Triceps Pushdown',
    'Dumbbell Fly', 'Lateral Raise', 'Dumbbell Biceps Curl'].map((name, i) => ({
    exercise_id: randomUUID(), source: 'exercisedb_v1', source_exercise_id: `t${i}`, name, gif_url: `https://example.com/${i}.gif`,
    body_parts: [i === 1 || i === 4 ? 'shoulders' : i === 2 || i === 5 ? 'upper arms' : 'chest'], equipments: ['dumbbell'],
    target_muscles: [i === 5 ? 'biceps' : i === 2 ? 'triceps' : 'pectorals'], secondary_muscles: [], instructions: ['x'],
    is_active: true, synced_at: now, created_at: now, updated_at: now })));
}, { timeout: 240000 });
after(async () => { fakeAi.close(); if (client) await client.close(); if (replica) await replica.stop(); });
beforeEach(async () => { member = undefined; aiCalls = 0; });
afterEach(async () => { if (server) await new Promise(resolve => server.close(resolve)); server = undefined; });

async function start(withAi) {
  server = createApp({ db, ai: withAi ? ai : {}, logger: { error() {} } }).listen(0, '127.0.0.1');
  await once(server, 'listening'); baseUrl = `http://127.0.0.1:${server.address().port}`;
  const result = await request('/api/auth/register', null, 'POST', { email: `${randomUUID()}@fitlife.example`,
    password: 'nutrition-test-password', full_name: 'Nutrition test', gender: 'male', age: 23, height: 170,
    weight: 70, activity_level: 'moderate', goal: 'gain' });
  assert.equal(result.status, 201); member = result.body;
}
async function request(path, token, method = 'GET', body) {
  const response = await fetch(baseUrl + path, { method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
const call = (path, method, body) => request(path, member.token, method, body);

test('meal text splits into amounts, units and names', () => {
  assert.deepEqual(splitMeal('300g thịt gà, 2 quả trứng và 1 bát cơm'), [
    { amount: 300, unit: 'g', name: 'thịt gà' }, { amount: 2, unit: 'quả', name: 'trứng' }, { amount: 1, unit: 'bát', name: 'cơm' }]);
});

test('known foods are worked out locally; targets, suggestion, eating it and finishing the day', async () => {
  await start(false);
  const parsed = await call('/api/nutrition/parse', 'POST', { text: '300g ức gà luộc, 2 quả trứng, 1 bát cơm, bánh xèo' });
  assert.equal(parsed.status, 200);
  assert.deepEqual(parsed.body.items.map(i => [i.name, i.grams, i.calories]), [['ức gà', 300, 495], ['trứng', 100, 155], ['cơm', 150, 195]]);
  assert.deepEqual(parsed.body.unknown, ['bánh xèo']);
  assert.match(parsed.body.message, /bánh xèo/);
  assert.equal(aiCalls, 0);

  const today = await call('/api/nutrition/today');
  assert.equal(today.body.targets.protein, 140);
  assert.equal(today.body.consumed.calories, 0);
  assert.equal(today.body.completed, false);

  const suggested = await call('/api/nutrition/suggestions', 'POST');
  assert.equal(suggested.status, 201);
  const s = suggested.body.suggestion;
  assert.ok(s.calories > 0 && s.calories <= 900 && s.items.length >= 2);
  const eaten = await call(`/api/nutrition/suggestions/${s.suggestion_id}/eat`, 'POST');
  assert.equal(eaten.status, 200);
  assert.equal((await call(`/api/nutrition/suggestions/${s.suggestion_id}/eat`, 'POST')).body.replayed, true);
  const after = await call('/api/nutrition/today');
  assert.equal(after.body.consumed.calories, s.calories);
  assert.equal(after.body.meals.length, 1);
  assert.equal(after.body.suggestion, null);

  assert.equal((await call('/api/nutrition/day', 'PUT', { completed: true })).status, 200);
  assert.equal((await call('/api/nutrition/today')).body.completed, true);
});

test('unknown foods go to AI once, are cached, and the free AI quota is enforced', async () => {
  await start(true);
  aiReply = { items: [{ name: 'bánh cuốn', grams: 250, kcal: 160, protein: 5, carbs: 28, fat: 3 }] };
  const parsed = await call('/api/nutrition/parse', 'POST', { text: '1 đĩa bánh cuốn' });
  assert.equal(parsed.body.engine, 'ai');
  assert.equal(parsed.body.items[0].calories, 400);
  const cached = await call('/api/nutrition/parse', 'POST', { text: '200g bánh cuốn' });
  assert.equal(cached.body.engine, 'table');
  assert.equal(cached.body.items[0].calories, 320);
  assert.equal(aiCalls, 1);

  aiReply = { items: [{ name: `món ${randomUUID()}`, grams: 100, kcal: 100, protein: 1, carbs: 1, fat: 1 }] };
  for (let i = 0; i < 4; i += 1) assert.equal((await call('/api/nutrition/parse', 'POST', { text: `món lạ ${i}` })).status, 200);
  const blocked = await call('/api/nutrition/parse', 'POST', { text: 'món lạ nữa' });
  assert.equal(blocked.status, 402);
  assert.equal((await call('/api/nutrition/today')).body.ai.used, 5);
});

test('AI workout plans are Premium, use only catalog exercises and fit the chosen time', async () => {
  await start(true);
  const body = { split: 'ppl', focus: 'push', minutes: 30, note: 'không có tạ đòn' };
  assert.equal((await call('/api/workout-plans', 'POST', body)).status, 402);
  assert.equal((await call('/api/workout-plans', 'POST', { ...body, focus: 'legs', split: 'upper_lower' })).status, 400);
  await db.collection('memberships').insertOne({ user_id: member.user.user_id, premium_until: new Date(Date.now() + 86400000),
    created_at: new Date(), updated_at: new Date() });

  aiReply = { title: 'Push nhanh', tip: 'Giữ lưng thẳng.', items: [{ i: 0, sets: 6, reps: '8-10', rest: 120 }, { i: 1, sets: 6, rest: 120 },
    { i: 2, sets: 6, rest: 120 }, { i: 99, sets: 3 }, { i: 0, sets: 3 }] };
  const created = await call('/api/workout-plans', 'POST', body);
  assert.equal(created.status, 201);
  const plan = created.body.plan;
  assert.equal(plan.engine, 'ai');
  assert.equal(plan.title, 'Push nhanh');
  assert.ok(plan.estimated_minutes <= 30, `plan takes ${plan.estimated_minutes} min`);
  assert.ok(plan.items.every(i => i.gif_url.startsWith('https://example.com/') && i.name !== 'Dumbbell Biceps Curl'));
  assert.equal(new Set(plan.items.map(i => i.exercise_id)).size, plan.items.length);
  assert.equal((await call('/api/workout-plans/today')).body.plan.plan_id, plan.plan_id);

  const done = await call(`/api/workout-plans/${plan.plan_id}/complete`, 'POST');
  assert.equal(done.status, 200);
  const logs = await call('/api/workout-logs');
  assert.equal(logs.body.logs[0].workout_id, plan.plan_id);
});

test('fitting a plan trims long sessions and fills short ones', () => {
  const pool = Array.from({ length: 8 }, (_, i) => ({ exercise_id: `e${i}`, name: `Press ${i}`, gif_url: 'g', target_muscles: ['x'] }));
  const item = (i, sets) => ({ exercise_id: `e${i}`, name: `Press ${i}`, sets, reps: '8', rest_seconds: 90 });
  const long = fitToTime([0, 1, 2, 3, 4, 5].map(i => item(i, 5)), pool, 20);
  assert.ok(secondsOf(long, 20) <= 20 * 60);
  const short = fitToTime([item(0, 2)], pool, 60);
  assert.ok(secondsOf(short, 60) <= 60 * 60 && secondsOf(short, 60) > 50 * 60);
});
