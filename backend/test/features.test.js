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
const { seedCatalogs } = require('../database/mongodb/seed');
const { localDay } = require('../auth/registration');
const { addDays } = require('../utils/validate');

// Sleep, mood, BMI, check-in/streak, challenges, rewards, stats and chat against disposable MongoDB only.
let replica, client, db, server, baseUrl, member;
before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
  db = client.db('fitlife_features_test');
  await initializeDatabase(db);
  await initializeAuthSessions(db);
  await seedCatalogs(db);
}, { timeout: 240000 });
after(async () => { if (client) await client.close(); if (replica) await replica.stop(); });
beforeEach(async () => {
  server = createApp({ db, logger: { error() {} } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  member = await register();
});
afterEach(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

async function request(path, token, method = 'GET', body) {
  const response = await fetch(baseUrl + path, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
async function register() {
  const response = await request('/api/auth/register', null, 'POST', {
    email: `${randomUUID()}@fitlife.example`, password: 'feature-test-password', full_name: 'Feature test',
    gender: 'female', age: 22, height: 160, weight: 52, activity_level: 'light', goal: 'maintain', timezone: 'Asia/Ho_Chi_Minh',
  });
  assert.equal(response.status, 201);
  return response.body;
}
const coins = async token => (await request('/api/quests', token)).body.fit_coins;

test('sleep and mood upsert one record per day, keep the UUID and reward once', async () => {
  const first = await request('/api/sleep-logs', member.token, 'PUT', { hours: 7.5, quality: 'Sâu' });
  assert.equal(first.status, 200);
  assert.equal(first.body.reward_coins, 10);
  const second = await request('/api/sleep-logs', member.token, 'PUT', { hours: 6, quality: 'Chập chờn' });
  assert.equal(second.body.reward_coins, 0);
  assert.equal(second.body.log.sleep_id, first.body.log.sleep_id);
  assert.equal(second.body.log.hours, 6);
  assert.equal((await request('/api/sleep-logs', member.token)).body.log.quality, 'Chập chờn');
  assert.equal((await request('/api/sleep-logs', member.token, 'PUT', { hours: 25, quality: 'Sâu' })).status, 400);
  assert.equal((await request('/api/sleep-logs', member.token, 'PUT', { hours: 7, quality: 'Tốt' })).status, 400);

  const mood = await request('/api/mood-logs', member.token, 'PUT', { mood_label: 'Năng lượng', note: '  ' });
  assert.equal(mood.body.reward_coins, 10);
  assert.equal(mood.body.log.note, '');
  assert.equal((await request('/api/mood-logs', member.token, 'PUT', { mood_label: '' })).status, 400);
  assert.equal(await coins(member.token), 20);
});

test('check-in pays once and five completed quests start a streak once', async () => {
  assert.equal((await request('/api/quests/checkin', member.token, 'POST')).body.reward_coins, 10);
  assert.equal((await request('/api/quests/checkin', member.token, 'POST')).body.reward_coins, 0);
  await request('/api/water-logs', member.token, 'POST', { log_id: randomUUID(), amount: 250 });
  await request('/api/sleep-logs', member.token, 'PUT', { hours: 8, quality: 'Sâu' });
  assert.equal((await request('/api/quests', member.token)).body.streak_days, 0);
  await request('/api/mood-logs', member.token, 'PUT', { mood_label: 'Vui' });
  await request('/api/meal-logs', member.token, 'POST', { meal_id: randomUUID(), meal_name: 'Phở', calories: 450,
    protein: 20, carbs: 60, fat: 10, meal_type: 'lunch' });
  const quests = await request('/api/quests', member.token);
  assert.equal(quests.body.quests.filter(q => q.is_completed).length, 5);
  assert.equal(quests.body.streak_days, 1);
  await request('/api/workout-logs', member.token, 'POST', { workout_id: randomUUID(), title: 'Chạy', category: 'cardio',
    duration_seconds: 600, calories_burned: 80 });
  assert.equal((await request('/api/quests', member.token)).body.streak_days, 1);
});

test('profile weight changes record BMI history and BMI is computed by the server', async () => {
  const empty = await request('/api/bmi-records', member.token);
  assert.equal(empty.body.records.length, 0);
  assert.equal(empty.body.current.bmi_value, 20.31);
  assert.equal(empty.body.current.bmi_status, 'Cân đối');
  assert.equal((await request('/api/profile', member.token, 'PATCH', { weight: 62 })).status, 200);
  const history = await request('/api/bmi-records', member.token);
  assert.equal(history.body.records.length, 1);
  assert.equal(history.body.records[0].bmi_value, 24.22);
  assert.equal(history.body.records[0].bmi_status, 'Thừa cân nhẹ');
  const again = await request('/api/bmi-records', member.token, 'POST', { bmi_value: 1 });
  assert.equal(again.status, 201);
  assert.equal(again.body.record.record_id, history.body.records[0].record_id);
  assert.equal(again.body.record.bmi_value, 24.22);
});

test('challenges allow one active run, one check-in per day and pay completion once', async () => {
  const challengeId = randomUUID(), now = new Date();
  await db.collection('challenges').insertOne({ challenge_id: challengeId, title: 'Một ngày', description: 'Test',
    target_days: 1, reward_coins: 30, badge_icon: 'flag-outline', is_active: true, created_at: now, updated_at: now });
  assert.equal((await request(`/api/challenges/${challengeId}/checkin`, member.token, 'POST')).status, 404);
  assert.equal((await request(`/api/challenges/${challengeId}/join`, member.token, 'POST')).status, 201);
  assert.equal((await request(`/api/challenges/${challengeId}/join`, member.token, 'POST')).status, 409);
  const done = await request(`/api/challenges/${challengeId}/checkin`, member.token, 'POST');
  assert.equal(done.body.is_completed, true);
  assert.equal(done.body.fit_coins, 30);
  const listed = (await request('/api/challenges', member.token)).body.challenges.find(c => c.challenge_id === challengeId);
  assert.deepEqual([listed.joined, listed.completed_count], [false, 1]);

  const week = (await request('/api/challenges', member.token)).body.challenges.find(c => c.target_days === 7);
  await request(`/api/challenges/${week.challenge_id}/join`, member.token, 'POST');
  assert.equal((await request(`/api/challenges/${week.challenge_id}/checkin`, member.token, 'POST')).body.current_progress, 1);
  assert.equal((await request(`/api/challenges/${week.challenge_id}/checkin`, member.token, 'POST')).status, 409);
  assert.equal((await request('/api/challenges/not-a-uuid/join', member.token, 'POST')).status, 400);
});

test('reward purchases debit once, refuse duplicates of owned badges and insufficient coins', async () => {
  const shop = await request('/api/rewards', member.token);
  const free = shop.body.items.find(i => i.cost_coins === 0);
  const paid = shop.body.items.find(i => i.cost_coins === 50);
  const purchaseId = randomUUID();
  assert.equal((await request(`/api/rewards/${free.item_id}/purchase`, member.token, 'POST', { purchase_id: purchaseId })).status, 201);
  assert.equal((await request(`/api/rewards/${free.item_id}/purchase`, member.token, 'POST', { purchase_id: purchaseId })).body.replayed, true);
  assert.equal((await request(`/api/rewards/${free.item_id}/purchase`, member.token, 'POST', { purchase_id: randomUUID() })).status, 409);
  assert.equal((await request(`/api/rewards/${paid.item_id}/purchase`, member.token, 'POST', { purchase_id: randomUUID() })).status, 409);

  await db.collection('users').updateOne({ user_id: member.user.user_id }, { $set: { fit_coins: 60 } });
  const bought = await request(`/api/rewards/${paid.item_id}/purchase`, member.token, 'POST', { purchase_id: randomUUID() });
  assert.equal(bought.body.fit_coins, 10);
  const after = await request('/api/rewards', member.token);
  assert.equal(after.body.fit_coins, 10);
  assert.equal(after.body.items.find(i => i.item_id === paid.item_id).owned, true);
  assert.equal(after.body.purchases.length, 2);
});

test('stats summarise the requested days and chat stores both turns with a once-a-day reward', async () => {
  await request('/api/water-logs', member.token, 'POST', { log_id: randomUUID(), amount: 500 });
  await request('/api/water-logs', member.token, 'POST', { log_id: randomUUID(), amount: 300 });
  const stats = await request('/api/stats?days=7', member.token);
  assert.equal(stats.body.days.length, 7);
  assert.equal(stats.body.days.at(-1).date, stats.body.today);
  assert.equal(stats.body.days.at(-1).water_ml, 800);
  assert.equal(stats.body.days[0].water_ml, 0);
  assert.equal((await request('/api/stats?days=40', member.token)).status, 400);

  const sessionId = randomUUID();
  const sent = await request('/api/chat/messages', member.token, 'POST', { session_id: sessionId, message_id: randomUUID(), content: 'Hôm nay mình uống đủ nước chưa?' });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.reward_coins, 10);
  assert.equal(sent.body.reply.sender, 'ai');
  assert.match(sent.body.reply.content, /800/);
  const next = await request('/api/chat/messages', member.token, 'POST', { session_id: sessionId, message_id: randomUUID(), content: 'Cảm ơn' });
  assert.equal(next.body.reward_coins, 0);
  const history = await request(`/api/chat/sessions/${sessionId}/messages`, member.token);
  assert.deepEqual(history.body.messages.map(m => m.sender), ['user', 'ai', 'user', 'ai']);
  const other = await register();
  assert.equal((await request(`/api/chat/sessions/${sessionId}/messages`, other.token)).status, 404);
  assert.equal((await request('/api/chat/messages', other.token, 'POST', { session_id: sessionId, message_id: randomUUID(), content: 'Hi' })).status, 404);
});

test('challenge daily limits span completed runs and concurrent check-ins', async () => {
  const challengeId = randomUUID(), now = new Date();
  const path = `/api/challenges/${challengeId}`;
  await db.collection('challenges').insertOne({ challenge_id: challengeId, title: 'One day', description: 'Regression',
    target_days: 1, reward_coins: 30, badge_icon: 'flag-outline', is_active: true, created_at: now, updated_at: now });
  await request(path + '/join', member.token, 'POST');
  assert.equal((await request(path + '/checkin', member.token, 'POST')).body.reward_coins, 30);
  assert.equal((await request(path + '/join', member.token, 'POST')).status, 201);
  const retries = await Promise.all([1, 2].map(() => request(path + '/checkin', member.token, 'POST')));
  assert.deepEqual(retries.map(r => r.status), [409, 409]);
  const listed = (await request('/api/challenges', member.token)).body.challenges.find(c => c.challenge_id === challengeId);
  assert.equal(listed.checked_in_today, true);
  assert.equal(listed.current_progress, 0);
  assert.equal(await coins(member.token), 30);

  // A previous run checked in yesterday must not block today's new run.
  await db.collection('user_challenges').updateOne({ user_id: member.user.user_id, challenge_id: challengeId, is_completed: true },
    { $set: { last_checkin_date: addDays(localDay(now, 'Asia/Ho_Chi_Minh'), -1) } });
  assert.equal((await request(path + '/checkin', member.token, 'POST')).body.reward_coins, 30);
  assert.equal(await coins(member.token), 60);
});

test('ownership outlives the last 100 purchases and stays private to the member', async () => {
  const items = (await request('/api/rewards', member.token)).body.items;
  const badge = items.find(i => i.cost_coins === 0);
  const voucher = await db.collection('reward_items').findOne({ category: 'voucher' });
  await request(`/api/rewards/${badge.item_id}/purchase`, member.token, 'POST', { purchase_id: randomUUID() });
  const now = new Date();
  await db.collection('purchases').insertMany(Array.from({ length: 101 }, (_, i) => ({
    purchase_id: randomUUID(), user_id: member.user.user_id, item_id: voucher.item_id, item_category: 'voucher',
    spent_coins: 0, purchased_at: new Date(now.getTime() + i + 1), created_at: now, updated_at: now,
  })));
  const shop = (await request('/api/rewards', member.token)).body;
  assert.equal(shop.purchases.length, 100);
  assert.equal(shop.items.find(i => i.item_id === badge.item_id).owned, true);
  const other = await register();
  const otherShop = (await request('/api/rewards', other.token)).body;
  assert.equal(otherShop.items.find(i => i.item_id === badge.item_id).owned, false);
});

test('concurrent chat retries recover the same reply without duplicate messages or rewards', async () => {
  const body = { session_id: randomUUID(), message_id: randomUUID(), content: 'Hôm nay uống nước bao nhiêu?' };
  const first = await request('/api/chat/messages', member.token, 'POST', body);
  assert.equal(first.status, 201);
  const retries = await Promise.all([1, 2, 3].map(() => request('/api/chat/messages', member.token, 'POST', body)));
  for (const retry of retries) {
    assert.equal(retry.status, 200);
    assert.equal(retry.body.replayed, true);
    assert.equal(retry.body.reward_coins, 0);
    assert.deepEqual(retry.body.reply, first.body.reply);
  }
  assert.equal(await db.collection('ai_chat_messages').countDocuments({ session_id: body.session_id }), 2);
  assert.equal(await coins(member.token), 10);
  const forged = { ...body, message_id: first.body.reply.message_id, content: first.body.reply.content };
  assert.equal((await request('/api/chat/messages', member.token, 'POST', forged)).status, 409);
});

test('chat retry resumes after reply persistence fails without paying the quest again', async () => {
  const body = { session_id: randomUUID(), message_id: randomUUID(), content: 'Gợi ý tập luyện' };
  const originalCollection = db.collection;
  let failReply = true;
  db.collection = function (...args) {
    const collection = originalCollection.apply(this, args);
    if (args[0] === 'ai_chat_messages') {
      const insert = collection.insertOne.bind(collection);
      collection.insertOne = async (document, ...options) => {
        if (document.sender === 'ai' && failReply) { failReply = false; throw new Error('Injected reply write failure'); }
        return insert(document, ...options);
      };
    }
    return collection;
  };
  try {
    assert.equal((await request('/api/chat/messages', member.token, 'POST', body)).status, 500);
  } finally { db.collection = originalCollection; }
  assert.equal(await coins(member.token), 10);
  const retried = await Promise.all([1, 2].map(() => request('/api/chat/messages', member.token, 'POST', body)));
  for (const result of retried) {
    assert.equal(result.status, 200);
    assert.equal(result.body.reward_coins, 0);
    assert.equal(result.body.reply.sender, 'ai');
  }
  assert.equal(retried[0].body.reply.message_id, retried[1].body.reply.message_id);
  assert.equal(await coins(member.token), 10);
  assert.equal(await db.collection('ai_chat_messages').countDocuments({ session_id: body.session_id }), 2);
});
