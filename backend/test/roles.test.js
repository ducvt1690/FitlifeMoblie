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

// Admin permissions and lifecycles against disposable MongoDB only.
let replica, client, db, server, baseUrl;
before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
  db = client.db('fitlife_roles_test');
  await initializeDatabase(db);
  await initializeAuthSessions(db);
  await seedCatalogs(db);
}, { timeout: 240000 });
after(async () => { if (client) await client.close(); if (replica) await replica.stop(); });
beforeEach(async () => {
  server = createApp({ db, logger: { error() {} } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

async function request(path, token, method = 'GET', body) {
  const response = await fetch(baseUrl + path, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
// Register through the public API, then grant the role directly as the bootstrap script would.
async function account(role = 'user') {
  const email = `${randomUUID()}@fitlife.example`;
  const password = 'role-test-password';
  const created = await request('/api/auth/register', null, 'POST', {
    email, password, full_name: `Role ${role}`, gender: 'male', age: 30, height: 172, weight: 70,
    activity_level: 'moderate', goal: 'maintain', timezone: 'Asia/Ho_Chi_Minh',
  });
  assert.equal(created.status, 201);
  if (role === 'user') return { token: created.body.token, id: created.body.user.user_id };
  await db.collection('users').updateOne({ email }, { $set: { role } });
  const login = await request('/api/auth/login', null, 'POST', { email, password });
  return { token: login.body.token, id: login.body.user.user_id };
}
test('each area rejects the other role', async () => {
  const [member, admin] = await Promise.all([account(), account('admin')]);
  assert.equal((await request('/api/admin/overview', member.token)).status, 403);
  assert.equal((await request('/api/quests', admin.token)).status, 403);
  assert.equal((await request('/api/trainer/overview', member.token)).status, 404);
  assert.equal((await request('/api/admin/overview', admin.token)).status, 200);
  assert.equal((await request('/api/auth/me', admin.token)).body.user.role, 'admin');
});

test('admin locks accounts and manages the catalogs with an audit trail', async () => {
  const [admin, member, student] = await Promise.all([account('admin'), account(), account()]);

  const locked = await request(`/api/admin/accounts/${member.id}`, admin.token, 'PATCH', { is_active: false, note: 'Spam' });
  assert.equal(locked.body.account.is_active, false);
  assert.equal((await request('/api/quests', member.token)).status, 401, 'old sessions are revoked');
  assert.equal((await request(`/api/admin/accounts/${admin.id}`, admin.token, 'PATCH', { is_active: false })).status, 409);
  assert.equal((await request(`/api/admin/accounts/${member.id}`, admin.token, 'PATCH', { role: 'admin' })).status, 400);
  assert.equal((await request(`/api/admin/accounts/${member.id}`, admin.token, 'PATCH', { is_active: true })).status, 400, 'a reason is required');
  assert.equal((await request(`/api/admin/accounts/${member.id}`, admin.token, 'PATCH', { is_active: true, note: 'Đã xác minh' })).status, 200);

  const found = await request(`/api/admin/accounts?q=${encodeURIComponent('Role user')}&role=user`, admin.token);
  assert.ok(found.body.accounts.every(row => row.role === 'user' && row.password_hash === undefined));

  const challenge = { challenge_id: randomUUID(), title: '5 ngày uống đủ nước', description: 'Check-in 5 ngày.',
    target_days: 5, reward_coins: 50, badge_icon: 'water-outline', is_active: true };
  assert.equal((await request('/api/admin/challenges', admin.token, 'POST', challenge)).status, 201);
  assert.ok((await request('/api/challenges', student.token)).body.challenges.some(c => c.challenge_id === challenge.challenge_id));
  await request(`/api/admin/challenges/${challenge.challenge_id}`, admin.token, 'PATCH', { is_active: false });
  assert.ok(!(await request('/api/challenges', student.token)).body.challenges.some(c => c.challenge_id === challenge.challenge_id));
  assert.equal((await request(`/api/admin/challenges/${challenge.challenge_id}`, admin.token, 'PATCH', { target_days: 0 })).status, 400);

  const item = { item_id: randomUUID(), title: 'Huy hiệu thử nghiệm', category: 'badge', cost_coins: 0, icon: 'ribbon-outline', is_available: true };
  assert.equal((await request('/api/admin/rewards', admin.token, 'POST', item)).status, 201);
  assert.equal((await request(`/api/rewards/${item.item_id}/purchase`, student.token, 'POST', { purchase_id: randomUUID() })).status, 201);
  const sales = await request('/api/admin/rewards', admin.token);
  assert.equal(sales.body.items.find(row => row.item_id === item.item_id).sold, 1);

  const logs = (await request('/api/admin/logs', admin.token)).body.logs.map(row => row.action);
  for (const action of ['lock_account', 'unlock_account', 'create_challenge', 'update_challenge', 'create_reward_item']) {
    assert.ok(logs.includes(action), action);
  }
});
