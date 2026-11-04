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

// Admin account detail, force logout, challenge participants, daily stats and list filters against disposable MongoDB only.
let replica, client, db, server, baseUrl;
before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
  db = client.db('fitlife_admin_test');
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
  const password = 'admin-test-password';
  const created = await request('/api/auth/register', null, 'POST', {
    email, password, full_name: `Admin test ${role}`, gender: 'male', age: 30, height: 172, weight: 70,
    activity_level: 'moderate', goal: 'maintain', timezone: 'Asia/Ho_Chi_Minh',
  });
  assert.equal(created.status, 201);
  if (role === 'user') return { token: created.body.token, id: created.body.user.user_id, email, password };
  await db.collection('users').updateOne({ email }, { $set: { role } });
  const login = await request('/api/auth/login', null, 'POST', { email, password });
  return { token: login.body.token, id: login.body.user.user_id, email, password };
}

test('new admin endpoints reject members', async () => {
  const member = await account();
  assert.equal((await request('/api/admin/stats', member.token)).status, 403);
  assert.equal((await request(`/api/admin/accounts/${member.id}`, member.token)).status, 403);
  assert.equal((await request(`/api/admin/accounts/${member.id}/logout`, member.token, 'POST')).status, 403);
  assert.equal((await request(`/api/admin/challenges/${member.id}`, member.token)).status, 403);
});

test('account detail shows counts and balances but never health metrics, logs or chats', async () => {
  const [admin, member] = await Promise.all([account('admin'), account()]);
  await request('/api/water-logs', member.token, 'POST', { log_id: randomUUID(), amount: 250 });
  await request('/api/water-logs', member.token, 'POST', { log_id: randomUUID(), amount: 300 });
  await request('/api/chat/messages', member.token, 'POST', { session_id: randomUUID(), message_id: randomUUID(), content: 'Bí mật riêng tư' });
  const detail = await request(`/api/admin/accounts/${member.id}`, admin.token);
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal(detail.body.account.email, member.email);
  assert.equal(detail.body.account.fit_coins, 20);
  assert.equal(detail.body.activity_30d.water_logs, 2);
  assert.equal(detail.body.activity_30d.chat_questions, 1);
  assert.equal(detail.body.activity_30d.quests_completed, 2);
  assert.equal(detail.body.sessions.active, 1);
  assert.equal(detail.body.membership.premium, false);
  const text = JSON.stringify(detail.body);
  for (const secret of ['password_hash', 'weight', 'height', 'Bí mật riêng tư']) assert.equal(text.includes(secret), false, secret);
  assert.equal((await request(`/api/admin/accounts/${randomUUID()}`, admin.token)).status, 404);
});

test('force logout revokes every session of a member, is audited, and cannot target admins', async () => {
  const [admin, otherAdmin, member] = await Promise.all([account('admin'), account('admin'), account()]);
  const second = (await request('/api/auth/login', null, 'POST', { email: member.email, password: member.password })).body.token;
  assert.equal((await request(`/api/admin/accounts/${member.id}/logout`, admin.token, 'POST', { role: 'admin' })).status, 400);
  const done = await request(`/api/admin/accounts/${member.id}/logout`, admin.token, 'POST', { note: 'Mất điện thoại' });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.revoked_sessions, 2);
  assert.equal((await request('/api/auth/me', member.token)).status, 401);
  assert.equal((await request('/api/auth/me', second)).status, 401);
  // Không có body vẫn được; tài khoản vẫn đăng nhập lại bình thường
  assert.equal((await request('/api/auth/login', null, 'POST', { email: member.email, password: member.password })).status, 200);
  assert.equal((await request(`/api/admin/accounts/${member.id}/logout`, admin.token, 'POST')).body.revoked_sessions, 1);
  assert.equal((await request(`/api/admin/accounts/${otherAdmin.id}/logout`, admin.token, 'POST')).status, 409);
  assert.equal((await request(`/api/admin/accounts/${admin.id}/logout`, admin.token, 'POST')).status, 409);
  const logs = await request(`/api/admin/logs?action=force_logout&target_id=${member.id}`, admin.token);
  assert.equal(logs.status, 200);
  assert.equal(logs.body.total, 2);
  assert.ok(logs.body.logs.some(row => row.note === 'Mất điện thoại'));
});

test('challenge detail lists participants with progress and filters by status', async () => {
  const [admin, one, two] = await Promise.all([account('admin'), account(), account()]);
  const challenge = { challenge_id: randomUUID(), title: 'Admin detail', description: 'Kiểm thử', target_days: 1,
    reward_coins: 5, badge_icon: 'flag-outline', is_active: true };
  assert.equal((await request('/api/admin/challenges', admin.token, 'POST', challenge)).status, 201);
  const path = `/api/challenges/${challenge.challenge_id}`;
  await request(`${path}/join`, one.token, 'POST');
  await request(`${path}/checkin`, one.token, 'POST');
  await request(`${path}/join`, two.token, 'POST');
  const detail = await request(`/api/admin/challenges/${challenge.challenge_id}`, admin.token);
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.deepEqual(detail.body.summary, { active: 1, completed: 1 });
  assert.equal(detail.body.total, 2);
  const completed = await request(`/api/admin/challenges/${challenge.challenge_id}?status=completed`, admin.token);
  assert.equal(completed.body.participants.length, 1);
  assert.equal(completed.body.participants[0].user_id, one.id);
  assert.equal(typeof completed.body.participants[0].email, 'string');
  assert.equal((await request(`/api/admin/challenges/${challenge.challenge_id}?status=x`, admin.token)).status, 400);
  assert.equal((await request(`/api/admin/challenges/${randomUUID()}`, admin.token)).status, 404);
  assert.equal((await request('/api/admin/challenges/khong-phai-uuid', admin.token)).status, 400);
});

test('daily stats return one row per day with today’s activity and validate the range', async () => {
  const [admin, member] = await Promise.all([account('admin'), account()]);
  await request('/api/water-logs', member.token, 'POST', { log_id: randomUUID(), amount: 250 });
  await request('/api/workout-logs', member.token, 'POST', { workout_id: randomUUID(), title: 'Chạy bộ', category: 'cardio',
    duration_seconds: 900, calories_burned: 120 });
  const stats = await request('/api/admin/stats?days=7', admin.token);
  assert.equal(stats.status, 200, JSON.stringify(stats.body));
  assert.equal(stats.body.days.length, 7);
  assert.equal(stats.body.days.at(-1).date, stats.body.to);
  const today = stats.body.days.at(-1);
  assert.ok(today.new_users >= 2);
  assert.ok(today.active_members >= 1);
  assert.equal(stats.body.days[0].date, stats.body.from);
  assert.equal((await request('/api/admin/stats', admin.token)).body.days.length, 30);
  for (const bad of ['0', '91', 'abc']) assert.equal((await request(`/api/admin/stats?days=${bad}`, admin.token)).status, 400);
});

test('transactions, payments and logs accept filters and reject malformed ones', async () => {
  const [admin, buyer, other] = await Promise.all([account('admin'), account(), account()]);
  const free = (await request('/api/rewards', buyer.token)).body.items.find(item => item.cost_coins === 0);
  for (const member of [buyer, other]) {
    assert.equal((await request(`/api/rewards/${free.item_id}/purchase`, member.token, 'POST', { purchase_id: randomUUID() })).status, 201);
  }
  const mine = await request(`/api/admin/transactions?user_id=${buyer.id}`, admin.token);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.total, 1);
  assert.equal(mine.body.transactions[0].user_id, buyer.id);
  assert.ok((await request(`/api/admin/transactions?item_id=${free.item_id}`, admin.token)).body.total >= 2);
  assert.equal((await request('/api/admin/transactions?item_id=abc', admin.token)).status, 400);
  assert.equal((await request(`/api/admin/payments?user_id=${buyer.id}`, admin.token)).body.total, 0);
  assert.equal((await request('/api/admin/logs?target_type=payment', admin.token)).status, 400);
  assert.equal((await request('/api/admin/logs?action=DROP%20TABLE', admin.token)).status, 400);
  // Danh sách cũ không có bộ lọc vẫn hoạt động như trước
  assert.equal((await request('/api/admin/transactions?page=1', admin.token)).status, 200);
  assert.equal((await request('/api/admin/overview', admin.token)).status, 200);
});

test('joined members keep the challenge rules: admin cannot change days/reward mid-run, and closing only stops new members', async () => {
  const [admin, one, two, late] = await Promise.all([account('admin'), account(), account(), account()]);
  const challenge = { challenge_id: randomUUID(), title: 'Chạy 7 ngày', description: 'Kiểm thử luật', target_days: 7,
    reward_coins: 100, badge_icon: 'walk-outline', is_active: true };
  assert.equal((await request('/api/admin/challenges', admin.token, 'POST', challenge)).status, 201);
  const path = `/api/challenges/${challenge.challenge_id}`;
  const edit = changes => request(`/api/admin/challenges/${challenge.challenge_id}`, admin.token, 'PATCH', changes);
  assert.equal((await request(`${path}/join`, one.token, 'POST')).status, 201);
  assert.equal((await request(`${path}/join`, two.token, 'POST')).status, 201);
  assert.equal((await request(`${path}/checkin`, one.token, 'POST')).status, 200);

  // Đang có người tham gia: không đổi được số ngày hay phần thưởng
  const days = await edit({ target_days: 30 });
  assert.equal(days.status, 409);
  assert.match(days.body.message, /2 người tham gia/);
  assert.equal((await edit({ reward_coins: 10 })).status, 409);
  // Gửi lại đúng giá trị cũ, hoặc sửa tên/mô tả: vẫn được
  assert.equal((await edit({ target_days: 7, title: 'Chạy bộ 7 ngày' })).status, 200);

  // Tắt thử thách: người mới không tham gia được, người đang chơi vẫn thấy và check-in tiếp
  assert.equal((await edit({ is_active: false })).status, 200);
  assert.equal((await request(`${path}/join`, late.token, 'POST')).status, 404);
  assert.ok(!(await request('/api/challenges', late.token)).body.challenges.some(c => c.challenge_id === challenge.challenge_id));
  const mine = (await request('/api/challenges', two.token)).body.challenges.find(c => c.challenge_id === challenge.challenge_id);
  assert.equal(mine.accepting_new, false);
  assert.equal(mine.joined, true);
  const checkin = await request(`${path}/checkin`, two.token, 'POST');
  assert.equal(checkin.status, 200, JSON.stringify(checkin.body));
  assert.equal(checkin.body.target_days, 7);

  // Khi không còn ai đang chơi thì admin đổi luật được
  assert.equal((await request(`${path}/leave`, one.token, 'POST')).status, 200);
  assert.equal((await request(`${path}/leave`, two.token, 'POST')).status, 200);
  assert.equal((await edit({ target_days: 30, reward_coins: 300 })).status, 200);
});
