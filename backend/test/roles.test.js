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

// Trainer and admin permissions and lifecycles against disposable MongoDB only.
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
const template = () => ({ template_id: randomUUID(), title: 'Full body 30 phút', category: 'Strength',
  duration_seconds: 1800, calories_est: 220, level: 'beginner', description: 'Squat, push-up, plank 3 hiệp.' });

test('each area rejects the other roles', async () => {
  const [member, trainer, admin] = await Promise.all([account(), account('trainer'), account('admin')]);
  assert.equal((await request('/api/trainer/overview', member.token)).status, 403);
  assert.equal((await request('/api/admin/overview', member.token)).status, 403);
  assert.equal((await request('/api/admin/overview', trainer.token)).status, 403);
  assert.equal((await request('/api/trainer/overview', admin.token)).status, 403);
  assert.equal((await request('/api/coaching', trainer.token)).status, 403);
  assert.equal((await request('/api/trainer/overview', trainer.token)).status, 200);
  assert.equal((await request('/api/admin/overview', admin.token)).status, 200);
  assert.equal((await request('/api/auth/me', admin.token)).body.user.role, 'admin');
});

test('trainer works only with members who accepted, and access ends with the open work', async () => {
  const [member, stranger, trainer] = await Promise.all([account(), account(), account('trainer')]);
  const plan = template();
  assert.equal((await request('/api/trainer/templates', trainer.token, 'POST', plan)).status, 201);
  const replay = await request('/api/trainer/templates', trainer.token, 'POST', plan);
  assert.equal(replay.body.replayed, true);

  // No consent yet: no assignment and no data.
  const early = { id: randomUUID(), user_id: stranger.id, template_id: plan.template_id, note: '' };
  assert.equal((await request('/api/trainer/assignments', trainer.token, 'POST', early)).status, 403);
  assert.equal((await request(`/api/trainer/students/${stranger.id}`, trainer.token)).status, 403);

  const invite = await request('/api/trainer/links', trainer.token, 'POST');
  assert.equal(invite.status, 201);
  const code = invite.body.link.invite_code;
  assert.match(code, /^[A-Z0-9]{8}$/);
  assert.equal((await request('/api/coaching/links', member.token, 'POST', { code: 'WRONG123' })).status, 404);
  assert.equal((await request('/api/coaching/links', member.token, 'POST', { code: code.toLowerCase() })).status, 201);
  assert.equal((await request('/api/coaching/links', stranger.token, 'POST', { code })).status, 404, 'a code is single-use');

  // Linked but nothing open: basic info only.
  const linked = await request(`/api/trainer/students/${member.id}`, trainer.token);
  assert.equal(linked.status, 200);
  assert.equal(linked.body.health, null);

  const work = { id: randomUUID(), user_id: member.id, template_id: plan.template_id, note: 'Tập buổi sáng' };
  assert.equal((await request('/api/trainer/assignments', trainer.token, 'POST', work)).status, 201);
  assert.equal((await request('/api/trainer/assignments', trainer.token, 'POST', work)).body.replayed, true);
  assert.equal((await request('/api/trainer/assignments', trainer.token, 'POST', { ...work, id: randomUUID() })).status, 409);
  const open = await request(`/api/trainer/students/${member.id}?days=7`, trainer.token);
  assert.equal(open.body.health.days.length, 7);
  assert.equal(open.body.health.weight, 70);

  const mine = await request('/api/coaching', member.token);
  assert.equal(mine.body.links.length, 1);
  assert.equal(mine.body.assignments[0].template.title, plan.title);
  assert.equal((await request(`/api/coaching/assignments/${work.id}/complete`, stranger.token, 'POST')).status, 404);
  const done = await request(`/api/coaching/assignments/${work.id}/complete`, member.token, 'POST');
  assert.equal(done.body.assignment.status, 'done');
  assert.equal((await request(`/api/trainer/students/${member.id}`, trainer.token)).body.health, null);

  // Member ends the link: open work is cancelled and the trainer loses access.
  const again = { ...work, id: randomUUID() };
  assert.equal((await request('/api/trainer/assignments', trainer.token, 'POST', again)).status, 201);
  const ended = await request(`/api/coaching/links/${mine.body.links[0].link_id}`, member.token, 'DELETE');
  assert.equal(ended.body.cancelled_assignments, 1);
  assert.equal((await request(`/api/trainer/students/${member.id}`, trainer.token)).status, 403);
  assert.equal((await request('/api/trainer/assignments', trainer.token, 'POST', { ...work, id: randomUUID() })).status, 403);
});

test('trainer edits only own templates', async () => {
  const [owner, other] = await Promise.all([account('trainer'), account('trainer')]);
  const plan = template();
  await request('/api/trainer/templates', owner.token, 'POST', plan);
  assert.equal((await request(`/api/trainer/templates/${plan.template_id}`, other.token, 'PATCH', { title: 'Đổi tên' })).status, 404);
  const off = await request(`/api/trainer/templates/${plan.template_id}`, owner.token, 'PATCH', { is_active: false });
  assert.equal(off.body.template.is_active, false);
  assert.equal((await request(`/api/trainer/templates/${plan.template_id}`, owner.token, 'PATCH', { role: 'admin' })).status, 400);
});

test('admin locks accounts, grants trainer and manages the catalogs with an audit trail', async () => {
  const [admin, member, trainer, student] = await Promise.all([account('admin'), account(), account('trainer'), account()]);

  const locked = await request(`/api/admin/accounts/${member.id}`, admin.token, 'PATCH', { is_active: false, note: 'Spam' });
  assert.equal(locked.body.account.is_active, false);
  assert.equal((await request('/api/quests', member.token)).status, 401, 'old sessions are revoked');
  assert.equal((await request(`/api/admin/accounts/${admin.id}`, admin.token, 'PATCH', { is_active: false })).status, 409);
  assert.equal((await request(`/api/admin/accounts/${member.id}`, admin.token, 'PATCH', { role: 'admin' })).status, 400);
  assert.equal((await request(`/api/admin/accounts/${member.id}`, admin.token, 'PATCH', { is_active: true })).status, 200);

  // Revoking the trainer role closes their links, open work and templates.
  const plan = template();
  await request('/api/trainer/templates', trainer.token, 'POST', plan);
  const { body: { link } } = await request('/api/trainer/links', trainer.token, 'POST');
  await request('/api/coaching/links', student.token, 'POST', { code: link.invite_code });
  const work = { id: randomUUID(), user_id: student.id, template_id: plan.template_id, note: '' };
  await request('/api/trainer/assignments', trainer.token, 'POST', work);
  assert.equal((await request(`/api/admin/accounts/${trainer.id}`, admin.token, 'PATCH', { role: 'user' })).status, 200);
  assert.equal((await db.collection('trainer_assignments').findOne({ id: work.id })).status, 'cancelled');
  assert.equal((await db.collection('trainer_links').findOne({ link_id: link.link_id })).status, 'ended');
  assert.equal((await db.collection('workout_templates').findOne({ template_id: plan.template_id })).is_active, false);

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
  const sales = await request('/api/admin/transactions', admin.token);
  assert.ok(sales.body.transactions.some(row => row.item_id === item.item_id && row.item_title === item.title));

  const logs = (await request('/api/admin/logs', admin.token)).body.logs.map(row => row.action);
  for (const action of ['lock_account', 'unlock_account', 'set_role_user', 'create_challenge', 'update_challenge', 'create_reward_item']) {
    assert.ok(logs.includes(action), action);
  }
});
