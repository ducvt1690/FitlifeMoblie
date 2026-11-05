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
  if (path === '/api/auth/register') body = await require('./verified-registration')(db, body);
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
    email, password, confirm_password: password, full_name: `Role ${role}`, gender: 'male', age: 30, height: 172, weight: 70,
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
  assert.equal((await request('/api/trainer/overview', member.token)).status, 403);
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
  assert.equal((await request(`/api/admin/accounts/${member.id}`, admin.token, 'PATCH', { is_active: true })).status, 200);

  const found = await request(`/api/admin/accounts?q=${encodeURIComponent('Role user')}&role=user`, admin.token);
  assert.ok(found.body.accounts.every(row => row.role === 'user' && row.password_hash === undefined));

  const challenge = { challenge_id: randomUUID(), title: '5 ngày uống đủ nước', description: 'Check-in 5 ngày.',
    target_days: 5, reward_coins: 50, badge_icon: 'water-outline', is_active: true };
  assert.equal((await request('/api/admin/challenges', admin.token, 'POST', challenge)).status, 201);
  assert.ok((await request('/api/challenges', student.token)).body.challenges.some(c => c.challenge_id === challenge.challenge_id));
  await request(`/api/admin/challenges/${challenge.challenge_id}`, admin.token, 'PATCH', { is_active: false });
  assert.ok(!(await request('/api/challenges', student.token)).body.challenges.some(c => c.challenge_id === challenge.challenge_id));
  assert.equal((await request(`/api/admin/challenges/${challenge.challenge_id}`, admin.token, 'PATCH', { target_days: 0 })).status, 400);

  const logs = (await request('/api/admin/logs', admin.token)).body.logs.map(row => row.action);
  for (const action of ['lock_account', 'unlock_account', 'create_challenge', 'update_challenge']) {
    assert.ok(logs.includes(action), action);
  }
});

test('admin changes user/trainer role with audit and session revocation, never admin elevation', async () => {
  const [admin, member] = await Promise.all([account('admin'), account()]);
  assert.equal((await request(`/api/admin/accounts/${admin.id}`, admin.token, 'PATCH', { role: 'trainer' })).status, 409);
  assert.equal((await request(`/api/admin/accounts/${member.id}`, member.token, 'PATCH', { role: 'trainer' })).status, 403);
  assert.equal((await request(`/api/admin/accounts/${member.id}`, admin.token, 'PATCH', { role: 'trainer' })).status, 400);
  assert.equal((await request(`/api/admin/accounts/${member.id}`, admin.token, 'PATCH', { role: 'trainer', note: '   ' })).status, 400);
  assert.equal((await request(`/api/admin/accounts/${member.id}`, admin.token, 'PATCH', { role: 'user' })).status, 200, 'unchanged role needs no reason');
  const changed = await request(`/api/admin/accounts/${member.id}`, admin.token, 'PATCH', { role: 'trainer', note: 'Đủ điều kiện huấn luyện viên' });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.account.role, 'trainer');
  assert.equal((await request('/api/auth/me', member.token)).status, 401);
  assert.equal((await request('/api/admin/accounts?role=trainer', admin.token)).body.accounts.some(a => a.user_id === member.id), true);
  assert.equal((await request(`/api/admin/accounts/${member.id}`, admin.token, 'PATCH', { role: 'admin' })).status, 400);
  assert.equal((await request(`/api/admin/accounts/${member.id}`, admin.token, 'PATCH', { role: 'user', note: 'Thu hồi vai trò huấn luyện viên' })).status, 200);
  assert.equal(await db.collection('admin_logs').countDocuments({ target_id: member.id, action: 'change_account_role' }), 2);
});
