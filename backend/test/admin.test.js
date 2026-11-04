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

// Admin APIs (YeuCau_Admin_FitLife): accounts, Premium, coins, payments, AI limits, exercises, analytics and logs. Disposable MongoDB only.
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
  const text = await response.text();
  return { status: response.status, headers: response.headers,
    body: response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}
// A VNPay order as the payment service stores it (the IPN flow itself is covered by payment.test.js).
async function order(userId, product, status, changes = {}) {
  const amounts = { premium_month: 49000, premium_year: 399000, coins_200: 20000, coins_550: 50000 };
  const now = new Date();
  const row = { order_id: randomUUID(), user_id: userId, product, amount_vnd: amounts[product], status,
    txn_ref: randomUUID().replace(/-/g, ''), return_url: 'fitlife://payment', expires_at: new Date(now.getTime() + 15 * 60000),
    response_code: status === 'paid' ? '00' : null, vnp_transaction_no: status === 'paid' ? '14000001' : null, bank_code: status === 'paid' ? 'NCB' : null,
    paid_at: status === 'paid' ? now : null, vnp_response: status === 'paid' ? { vnp_ResponseCode: '00', vnp_BankCode: 'NCB' } : null,
    created_at: now, updated_at: now, ...changes };
  await db.collection('payment_orders').insertOne(row);
  return row;
}
const exerciseBody = (changes = {}) => ({ exercise_id: randomUUID(), name_vi: 'Hít đất tay hẹp', body_parts: ['chest'],
  target_muscles: ['triceps'], equipments: ['body weight'], gif_url: 'https://cdn.example/pushup.gif',
  instructions_vi: ['Chống tay hẹp hơn vai', 'Hạ ngực chạm sàn rồi đẩy lên'], rest_seconds: 60, ...changes });
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

test('admin endpoints reject members', async () => {
  const member = await account();
  for (const [path, method] of [['/api/admin/analytics'], [`/api/admin/accounts/${member.id}`], [`/api/admin/accounts/${member.id}/logout-all`, 'POST'],
    [`/api/admin/accounts/${member.id}/premium`, 'POST'], [`/api/admin/accounts/${member.id}/coins`, 'POST'], ['/api/admin/payments/export'],
    ['/api/admin/settings/ai-limits'], ['/api/admin/exercises'], [`/api/admin/challenges/${member.id}`]]) {
    assert.equal((await request(path, member.token, method)).status, 403, path);
  }
});

test('account detail shows profile, plan, 30-day activity, AI quota and wallet but never passwords or chat contents', async () => {
  const [admin, member] = await Promise.all([account('admin'), account()]);
  await request('/api/water-logs', member.token, 'POST', { log_id: randomUUID(), amount: 250 });
  await request('/api/water-logs', member.token, 'POST', { log_id: randomUUID(), amount: 300 });
  await request('/api/chat/messages', member.token, 'POST', { session_id: randomUUID(), message_id: randomUUID(), content: 'Bí mật riêng tư' });
  const detail = await request(`/api/admin/accounts/${member.id}`, admin.token);
  assert.equal(detail.status, 200, JSON.stringify(detail.body));
  assert.equal(detail.body.account.email, member.email);
  assert.equal(detail.body.profile.height, 172);
  assert.equal(detail.body.profile.weight, 70);
  assert.equal(detail.body.profile.goal, 'maintain');
  assert.equal(typeof detail.body.profile.bmi_value, 'number');
  assert.equal(detail.body.membership.plan, 'free');
  assert.equal(detail.body.activity_30d.water_ml, 550);
  assert.equal(detail.body.activity_30d.ai_questions, 1);
  assert.equal(detail.body.ai.chat.used_24h, 1);
  assert.equal(detail.body.ai.chat.limit, 10);
  assert.equal(detail.body.ai.meal_ai.limit, 5);
  assert.equal(detail.body.sessions.active, 1);
  // Quest rewards from the water logs are in the coin ledger and match the balance.
  assert.ok(detail.body.wallet.fit_coins > 0);
  assert.equal(detail.body.wallet.transactions[0].balance_after, detail.body.wallet.fit_coins);
  assert.ok(detail.body.wallet.transactions.every(row => row.source === 'quest'));
  const text = JSON.stringify(detail.body);
  for (const secret of ['password_hash', 'Bí mật riêng tư']) assert.equal(text.includes(secret), false, secret);
  assert.equal((await request(`/api/admin/accounts/${randomUUID()}`, admin.token)).status, 404);
});

test('logout-all revokes every session of a member, is audited, and cannot target admins', async () => {
  const [admin, otherAdmin, member] = await Promise.all([account('admin'), account('admin'), account()]);
  const second = (await request('/api/auth/login', null, 'POST', { email: member.email, password: member.password })).body.token;
  assert.equal((await request(`/api/admin/accounts/${member.id}/logout-all`, admin.token, 'POST', { role: 'admin' })).status, 400);
  const done = await request(`/api/admin/accounts/${member.id}/logout-all`, admin.token, 'POST', { note: 'Mất điện thoại' });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.revoked_sessions, 2);
  assert.equal((await request('/api/auth/me', member.token)).status, 401);
  assert.equal((await request('/api/auth/me', second)).status, 401);
  assert.equal((await request('/api/auth/login', null, 'POST', { email: member.email, password: member.password })).status, 200);
  // Old path still works.
  assert.equal((await request(`/api/admin/accounts/${member.id}/logout`, admin.token, 'POST')).body.revoked_sessions, 1);
  assert.equal((await request(`/api/admin/accounts/${otherAdmin.id}/logout-all`, admin.token, 'POST')).status, 409);
  assert.equal((await request(`/api/admin/accounts/${admin.id}/logout-all`, admin.token, 'POST')).status, 409);
  const logs = await request(`/api/admin/logs?action=force_logout&target_id=${member.id}`, admin.token);
  assert.equal(logs.body.total, 2);
  assert.ok(logs.body.logs.some(row => row.note === 'Mất điện thoại'));
  assert.ok(logs.body.logs.every(row => row.target_label.includes(member.email)), 'logs name their target');
});

test('granting admin needs a reason, ends the member sessions, and admins cannot change other admins', async () => {
  const [admin, otherAdmin, member] = await Promise.all([account('admin'), account('admin'), account()]);
  const path = `/api/admin/accounts/${member.id}`;
  assert.equal((await request(path, admin.token, 'PATCH', { role: 'admin' })).status, 400);
  assert.equal((await request(path, admin.token, 'PATCH', { role: 'user', note: 'x' })).status, 400);
  const granted = await request(path, admin.token, 'PATCH', { role: 'admin', note: 'Nhân sự vận hành mới' });
  assert.equal(granted.status, 200, JSON.stringify(granted.body));
  assert.equal(granted.body.account.role, 'admin');
  assert.equal((await request('/api/auth/me', member.token)).status, 401);
  assert.equal((await request(`/api/admin/accounts/${otherAdmin.id}`, admin.token, 'PATCH', { is_active: false, note: 'x' })).status, 409);
  assert.equal((await request(`/api/admin/logs?action=grant_admin&target_id=${member.id}`, admin.token)).body.total, 1);
  const admins = await request('/api/admin/accounts?role=admin', admin.token);
  assert.ok(admins.body.accounts.some(row => row.user_id === member.id));
});

test('Premium can be granted, extended and revoked; the AI quota follows the plan immediately', async () => {
  const [admin, member] = await Promise.all([account('admin'), account()]);
  const premium = `/api/admin/accounts/${member.id}/premium`;
  assert.equal((await request(premium, admin.token, 'POST', { days: 30 })).status, 400, 'note required');
  assert.equal((await request(premium, admin.token, 'POST', { days: 0, note: 'x' })).status, 400);
  assert.equal((await request(`/api/admin/accounts/${admin.id}/premium`, admin.token, 'POST', { days: 1, note: 'x' })).status, 409);
  const first = await request(premium, admin.token, 'POST', { days: 30, note: 'Bồi thường sự cố' });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const extended = await request(premium, admin.token, 'POST', { days: 10, note: 'Khuyến mãi' });
  const gap = (new Date(extended.body.premium_until) - new Date(first.body.premium_until)) / 86400000;
  assert.equal(Math.round(gap), 10, 'extends from the current end date');
  let detail = (await request(`/api/admin/accounts/${member.id}`, admin.token)).body;
  assert.equal(detail.membership.plan, 'premium');
  assert.equal(detail.ai.chat.limit, 200);
  assert.equal(detail.ai.meal_ai.limit, 50);
  assert.equal((await request('/api/admin/accounts?plan=premium', admin.token)).body.accounts.some(row => row.user_id === member.id), true);
  assert.equal((await request('/api/admin/accounts?plan=free', admin.token)).body.accounts.some(row => row.user_id === member.id), false);
  assert.equal((await request(premium, admin.token, 'DELETE', {})).status, 400, 'note required');
  assert.equal((await request(premium, admin.token, 'DELETE', { note: 'Gian lận' })).status, 200);
  assert.equal((await request(premium, admin.token, 'DELETE', { note: 'Gian lận' })).status, 409);
  detail = (await request(`/api/admin/accounts/${member.id}`, admin.token)).body;
  assert.equal(detail.membership.plan, 'free');
  assert.equal(detail.ai.chat.limit, 10);
  const actions = (await request(`/api/admin/logs?target_id=${member.id}`, admin.token)).body.logs.map(row => row.action);
  assert.deepEqual(actions.filter(action => action.endsWith('premium')).sort(), ['grant_premium', 'grant_premium', 'revoke_premium']);
});

test('coin adjustments never go below zero and appear in the ledger and the audit log', async () => {
  const [admin, member] = await Promise.all([account('admin'), account()]);
  const coins = `/api/admin/accounts/${member.id}/coins`;
  const balance = async () => (await db.collection('users').findOne({ user_id: member.id })).fit_coins;
  const start = await balance();
  assert.equal((await request(coins, admin.token, 'POST', { amount: 50 })).status, 400, 'note required');
  assert.equal((await request(coins, admin.token, 'POST', { amount: 0, note: 'x' })).status, 400);
  assert.equal((await request(coins, admin.token, 'POST', { amount: 1.5, note: 'x' })).status, 400);
  const added = await request(coins, admin.token, 'POST', { amount: 50, note: 'Thưởng sự kiện' });
  assert.equal(added.status, 200, JSON.stringify(added.body));
  assert.equal(added.body.fit_coins, start + 50);
  const tooMuch = await request(coins, admin.token, 'POST', { amount: -(start + 51), note: 'Thu hồi' });
  assert.equal(tooMuch.status, 409);
  assert.equal(await balance(), start + 50);
  const removed = await request(coins, admin.token, 'POST', { amount: -(start + 50), note: 'Thu hồi xu gian lận' });
  assert.equal(removed.body.fit_coins, 0);
  const ledger = await request(`/api/admin/transactions?user_id=${member.id}&source=admin`, admin.token);
  assert.equal(ledger.status, 200);
  assert.deepEqual(ledger.body.transactions.map(row => row.amount), [-(start + 50), 50]);
  assert.equal(ledger.body.transactions[0].balance_after, 0);
  assert.equal(ledger.body.transactions[0].email, member.email);
  assert.equal((await request(`/api/admin/logs?action=adjust_coins&target_id=${member.id}`, admin.token)).body.total, 2);
  assert.equal((await request('/api/admin/transactions?source=steal', admin.token)).status, 400);
});

test('deleting AI data removes chats and coach memory but keeps the quota', async () => {
  const [admin, member] = await Promise.all([account('admin'), account()]);
  await request('/api/chat/messages', member.token, 'POST', { session_id: randomUUID(), message_id: randomUUID(), content: 'Xin chào' });
  assert.equal((await request(`/api/admin/accounts/${member.id}/chat`, admin.token, 'DELETE', {})).status, 400);
  const done = await request(`/api/admin/accounts/${member.id}/chat`, admin.token, 'DELETE', { note: 'Người dùng yêu cầu xóa' });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.ok(done.body.deleted.messages >= 1);
  assert.equal(await db.collection('ai_chat_messages').countDocuments({ user_id: member.id }), 0);
  assert.equal((await request('/api/chat/sessions', member.token)).body.sessions.length, 0);
  assert.equal((await request(`/api/admin/accounts/${member.id}`, admin.token)).body.ai.chat.used_24h, 1);
});

test('payments filter by status, product, user and date; detail, CSV export and refund work', async () => {
  const [admin, member, other] = await Promise.all([account('admin'), account(), account()]);
  const past = new Date(Date.now() - 60 * 60000);
  const paid = await order(member.id, 'premium_month', 'paid');
  await order(member.id, 'coins_200', 'pending', { expires_at: past, created_at: past });
  await order(member.id, 'coins_550', 'pending');
  await order(other.id, 'coins_200', 'failed', { response_code: '24' });
  const list = query => request(`/api/admin/payments?user_id=${member.id}&${query}`, admin.token);
  assert.equal((await list('')).body.total, 3);
  assert.equal((await list('status=paid')).body.total, 1);
  const expired = await list('status=expired');
  assert.equal(expired.body.total, 1);
  assert.equal(expired.body.payments[0].status, 'expired');
  assert.equal((await list('status=pending')).body.total, 1);
  assert.equal((await list('product=coins_550')).body.total, 1);
  for (const bad of ['status=done', 'product=gold', 'from=2026-13-01', 'from=2026-05-02&to=2026-05-01']) {
    assert.equal((await list(bad)).status, 400, bad);
  }
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  assert.equal((await list(`from=${today}&to=${today}`)).body.total >= 2, true);
  assert.equal((await list('from=2000-01-01&to=2000-01-02')).body.total, 0);

  const detail = await request(`/api/admin/payments/${paid.order_id}`, admin.token);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.order.vnp_response.vnp_BankCode, 'NCB');
  assert.equal(detail.body.order.txn_ref, paid.txn_ref);
  assert.equal(detail.body.user.email, member.email);
  assert.equal((await request(`/api/admin/payments/${randomUUID()}`, admin.token)).status, 404);

  assert.equal((await request('/api/admin/payments/export', admin.token)).status, 400, 'from/to required');
  const csv = await request(`/api/admin/payments/export?from=${today}&to=${today}`, admin.token);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.headers.get('content-disposition'), /attachment/);
  assert.ok(csv.body.includes(paid.txn_ref));
  assert.ok(csv.body.includes('order_id,vnp_TxnRef,email'));

  // Simulate what the paid order gave: 30 days of Premium and 100 coins (60 already spent).
  const until = new Date(Date.now() + 40 * 86400000);
  await db.collection('memberships').updateOne({ user_id: member.id }, { $set: { premium_until: until, created_at: new Date(), updated_at: new Date() } }, { upsert: true });
  await db.collection('users').updateOne({ user_id: member.id }, { $set: { fit_coins: 40 } });
  const refund = `/api/admin/payments/${paid.order_id}/refund`;
  assert.equal((await request(refund, admin.token, 'POST', {})).status, 400, 'note required');
  const done = await request(refund, admin.token, 'POST', { note: 'Khách khiếu nại, đã hoàn trên cổng VNPay' });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.revoked_premium_days, 30);
  assert.equal(done.body.revoked_coins, 40);
  assert.equal(done.body.coins_not_recovered, 60);
  assert.equal((await db.collection('users').findOne({ user_id: member.id })).fit_coins, 0);
  const left = (await db.collection('memberships').findOne({ user_id: member.id })).premium_until - Date.now();
  assert.equal(Math.round(left / 86400000), 10);
  assert.equal((await request(refund, admin.token, 'POST', { note: 'lần 2' })).status, 409);
  assert.equal((await list('status=refunded')).body.total, 1);
  const refundLog = (await request(`/api/admin/logs?action=refund_payment&target_type=payment&target_id=${paid.order_id}`, admin.token)).body;
  assert.equal(refundLog.total, 1);
  assert.equal(refundLog.logs[0].note, 'Khách khiếu nại, đã hoàn trên cổng VNPay (thu hồi 30 ngày Premium, 40 xu)');
  assert.match(refundLog.logs[0].target_label, /^Premium 1 tháng · /);
  assert.equal((await request(`/api/admin/transactions?user_id=${member.id}&source=payment_refund`, admin.token)).body.transactions[0].amount, -40);
});

test('AI limits are configurable per plan and apply to members at once', async () => {
  const [admin, member] = await Promise.all([account('admin'), account()]);
  const current = await request('/api/admin/settings/ai-limits', admin.token);
  assert.equal(current.status, 200);
  assert.deepEqual(current.body.limits.free, { chat: 10, workout_plan: 5, meal_ai: 5 });
  const put = body => request('/api/admin/settings/ai-limits', admin.token, 'PUT', body);
  assert.equal((await put({ free: { chat: 3 } })).status, 400, 'note required');
  assert.equal((await put({ free: { chat: -1 }, note: 'x' })).status, 400);
  assert.equal((await put({ free: { voice: 3 }, note: 'x' })).status, 400);
  assert.equal((await put({ gold: {}, note: 'x' })).status, 400);
  const saved = await put({ free: { chat: 1 }, note: 'Giảm tải máy chủ AI' });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.deepEqual(saved.body.limits.free, { chat: 1, workout_plan: 5, meal_ai: 5 });
  assert.equal(saved.body.limits.premium.chat, 200);
  const ask = () => request('/api/chat/messages', member.token, 'POST', { session_id: randomUUID(), message_id: randomUUID(), content: 'Chào' });
  assert.notEqual((await ask()).status, 402);
  assert.equal((await ask()).status, 402);
  assert.equal((await request(`/api/admin/accounts/${member.id}`, admin.token)).body.ai.chat.limit, 1);
  assert.equal((await request('/api/admin/logs?action=update_ai_limits&target_type=setting', admin.token)).body.total, 1);
  // Restore the defaults for the other tests.
  assert.equal((await put({ free: { chat: 10 }, note: 'Khôi phục' })).status, 200);
});

test('admin manages the exercise catalog; hidden exercises disappear for members', async () => {
  const [admin, member] = await Promise.all([account('admin'), account()]);
  const body = exerciseBody();
  const post = payload => request('/api/admin/exercises', admin.token, 'POST', payload);
  assert.equal((await post({ ...body, gif_url: 'http://insecure.example/a.gif' })).status, 400);
  assert.equal((await post({ ...body, rest_seconds: 900 })).status, 400);
  assert.equal((await post({ ...body, body_parts: [] })).status, 400);
  assert.equal((await post({ ...body, secret: 1 })).status, 400);
  const created = await post(body);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.exercise.source, 'admin');
  assert.equal((await post(body)).status, 200, 'same exercise_id is a replay');
  const listed = await request(`/api/exercises?q=${encodeURIComponent('tay hẹp')}&limit=100`, member.token);
  assert.ok(listed.body.data.some(row => row.exercise_id === body.exercise_id), 'members see admin exercises');
  const found = await request(`/api/admin/exercises?q=${encodeURIComponent('tay hẹp')}`, admin.token);
  assert.ok(found.body.exercises.some(row => row.exercise_id === body.exercise_id));
  const patch = changes => request(`/api/admin/exercises/${body.exercise_id}`, admin.token, 'PATCH', changes);
  assert.equal((await patch({})).status, 400);
  assert.equal((await patch({ source: 'exercisedb_v1' })).status, 400);
  const renamed = await patch({ name_vi: 'Hít đất kim cương', tips_vi: ['Giữ lưng thẳng'], rest_seconds: 45 });
  assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
  assert.equal(renamed.body.exercise.rest_seconds, 45);
  assert.equal((await patch({ is_active: false, note: 'GIF lỗi' })).status, 200);
  assert.ok((await request('/api/admin/exercises?status=hidden', admin.token)).body.exercises.some(row => row.exercise_id === body.exercise_id));
  assert.ok(!(await request('/api/admin/exercises?status=active', admin.token)).body.exercises.some(row => row.exercise_id === body.exercise_id));
  const memberView = await request(`/api/exercises/${body.exercise_id}`, member.token);
  assert.ok([403, 404].includes(memberView.status), `hidden exercise visible: ${memberView.status}`);
  assert.equal((await request(`/api/admin/exercises/${randomUUID()}`, admin.token, 'PATCH', { rest_seconds: 30 })).status, 404);
  const actions = (await request(`/api/admin/logs?target_type=exercise&target_id=${body.exercise_id}`, admin.token)).body.logs.map(row => row.action);
  assert.deepEqual(actions.sort(), ['create_exercise', 'hide_exercise', 'update_exercise']);
});

test('analytics return one row per day with revenue, signups, DAU and conversion', async () => {
  const [admin, member] = await Promise.all([account('admin'), account()]);
  await request('/api/water-logs', member.token, 'POST', { log_id: randomUUID(), amount: 250 });
  await request('/api/workout-logs', member.token, 'POST', { workout_id: randomUUID(), title: 'Chạy bộ', category: 'cardio',
    duration_seconds: 900, calories_burned: 120 });
  await order(member.id, 'premium_month', 'paid');
  await order(member.id, 'coins_200', 'paid');
  const result = await request('/api/admin/analytics?range=7d', admin.token);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.days.length, 7);
  const today = result.body.days.at(-1);
  assert.equal(today.date, result.body.to);
  assert.ok(today.revenue_premium_vnd >= 49000);
  assert.ok(today.revenue_coins_vnd >= 20000);
  assert.ok(today.signups >= 2);
  assert.ok(today.dau >= 1);
  assert.ok(today.workouts >= 1);
  assert.ok(result.body.totals.revenue_premium_vnd >= 49000);
  assert.ok(result.body.conversion.new_premium_members >= 1);
  assert.ok(result.body.conversion.rate > 0 && result.body.conversion.rate <= 1);
  assert.equal((await request('/api/admin/analytics', admin.token)).body.days.length, 30);
  assert.equal((await request('/api/admin/analytics?range=90d', admin.token)).body.days.length, 90);
  assert.equal((await request('/api/admin/stats?days=7', admin.token)).body.days.length, 7, 'old path');
  for (const bad of ['0d', '14d', 'abc']) assert.equal((await request(`/api/admin/analytics?range=${bad}`, admin.token)).status, 400);
});

test('logs filter by date, action and target; malformed filters are rejected', async () => {
  const [admin, member] = await Promise.all([account('admin'), account()]);
  await request(`/api/admin/accounts/${member.id}/coins`, admin.token, 'POST', { amount: 5, note: 'Kiểm thử nhật ký' });
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  assert.ok((await request(`/api/admin/logs?from=${today}&to=${today}&target_id=${member.id}`, admin.token)).body.total >= 1);
  assert.equal((await request(`/api/admin/logs?from=2000-01-01&to=2000-01-01&target_id=${member.id}`, admin.token)).body.total, 0);
  assert.equal((await request('/api/admin/logs?target_type=payment', admin.token)).status, 200);
  for (const bad of ['target_type=wallet', 'action=DROP%20TABLE', 'from=hôm-nay', 'from=2026-02-02&to=2026-02-01']) {
    assert.equal((await request(`/api/admin/logs?${bad}`, admin.token)).status, 400, bad);
  }
  assert.equal((await request('/api/admin/overview', admin.token)).body.counts.purchases_total >= 0, true);
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
