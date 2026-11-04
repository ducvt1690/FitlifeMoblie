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
const { signedQuery, sign, verifyCallback } = require('../utils/vnpay');

// VNPay orders, signed callbacks, Premium and the free AI limit against disposable MongoDB only.
const payments = { tmnCode: 'FITTEST1', hashSecret: 'test-secret-not-real', payUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  publicApiUrl: 'http://api.test', webAppUrl: 'http://web.test' };
let replica, client, db, server, baseUrl;
before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
  db = client.db('fitlife_payment_test');
  await initializeDatabase(db);
  await initializeAuthSessions(db);
  await seedCatalogs(db);
}, { timeout: 240000 });
after(async () => { if (client) await client.close(); if (replica) await replica.stop(); });
beforeEach(async () => {
  server = createApp({ db, payments, logger: { error() {} } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

async function request(path, token, method = 'GET', body) {
  const response = await fetch(baseUrl + path, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  return { status: response.status, body: response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}
async function member() {
  const email = `${randomUUID()}@fitlife.example`;
  const created = await request('/api/auth/register', null, 'POST', {
    email, password: 'payment-test-password', full_name: 'Payment Tester', gender: 'female',
    age: 26, height: 160, weight: 52, activity_level: 'light', goal: 'maintain', timezone: 'Asia/Ho_Chi_Minh',
  });
  assert.equal(created.status, 201);
  return { token: created.body.token, id: created.body.user.user_id, email };
}
// What VNPay sends back: the order's TxnRef and amount, signed with the shared secret.
function callback(paymentUrl, overrides = {}) {
  const sent = Object.fromEntries(new URL(paymentUrl).searchParams);
  const fields = { vnp_TmnCode: sent.vnp_TmnCode, vnp_Amount: sent.vnp_Amount, vnp_TxnRef: sent.vnp_TxnRef, vnp_BankCode: 'NCB',
    vnp_OrderInfo: sent.vnp_OrderInfo, vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: '14000001',
    vnp_PayDate: '20261104120000', ...overrides };
  return `${signedQuery(fields)}&vnp_SecureHash=${sign(payments.hashSecret, signedQuery(fields))}`;
}
const order = (user, product, extra = {}) => request('/api/payments/orders', user.token, 'POST', { order_id: randomUUID(), product, ...extra });

test('payment URL is signed, uses server prices and verifies', async () => {
  const user = await member();
  const created = await order(user, 'premium_month', { amount_vnd: 1000 });
  assert.equal(created.status, 400, 'client cannot send a price');
  const ok = await order(user, 'premium_month');
  assert.equal(ok.status, 201);
  assert.equal(ok.body.order.amount_vnd, 49000);
  assert.equal(ok.body.order.txn_ref, undefined);
  const url = new URL(ok.body.payment_url);
  assert.equal(url.searchParams.get('vnp_Amount'), '4900000');
  assert.equal(url.searchParams.get('vnp_ReturnUrl'), 'http://api.test/api/payments/vnpay/return');
  assert.ok(verifyCallback(payments.hashSecret, Object.fromEntries(url.searchParams)));
  const tampered = Object.fromEntries(url.searchParams);
  tampered.vnp_Amount = '100';
  assert.equal(verifyCallback(payments.hashSecret, tampered), null);
});

test('IPN credits coins exactly once and rejects bad signature or amount', async () => {
  const user = await member();
  const coins = async () => (await request('/api/profile', user.token)).body.profile.fit_coins;
  const start = await coins();
  const { body } = await order(user, 'coins_200');
  const bad = await request(`/api/payments/vnpay/ipn?${callback(body.payment_url)}`.replace(/vnp_SecureHash=[0-9a-f]{4}/, 'vnp_SecureHash=0000'));
  assert.equal(bad.body.RspCode, '97');
  const wrongAmount = await request(`/api/payments/vnpay/ipn?${callback(body.payment_url, { vnp_Amount: '100' })}`);
  assert.equal(wrongAmount.body.RspCode, '04');
  const missing = await request(`/api/payments/vnpay/ipn?${callback(body.payment_url, { vnp_TxnRef: 'f'.repeat(32) })}`);
  assert.equal(missing.body.RspCode, '01');
  const first = await request(`/api/payments/vnpay/ipn?${callback(body.payment_url)}`);
  assert.deepEqual(first.body, { RspCode: '00', Message: 'Confirm Success' });
  const again = await request(`/api/payments/vnpay/ipn?${callback(body.payment_url)}`);
  assert.equal(again.body.RspCode, '02');
  assert.equal(await coins(), start + 200);
  const detail = await request(`/api/payments/orders/${body.order.order_id}`, user.token);
  assert.equal(detail.body.order.status, 'paid');
  assert.equal(detail.body.order.vnp_transaction_no, '14000001');
});

test('failed payment changes nothing; return page settles and redirects to the app', async () => {
  const user = await member();
  const failed = await order(user, 'coins_550');
  const cancel = await request(`/api/payments/vnpay/return?${callback(failed.body.payment_url, { vnp_ResponseCode: '24', vnp_TransactionStatus: '02' })}`);
  assert.equal(cancel.status, 200);
  assert.match(cancel.body, /chưa thành công/);
  assert.equal((await request(`/api/payments/orders/${failed.body.order.order_id}`, user.token)).body.order.status, 'failed');

  const app = await order(user, 'premium_month', { return_url: 'fitlife://payment' });
  const page = await request(`/api/payments/vnpay/return?${callback(app.body.payment_url)}`);
  assert.match(page.body, /Thanh toán thành công/);
  assert.ok(page.body.includes(`fitlife://payment?order=${app.body.order.order_id}&amp;status=paid`));
  // The IPN arriving after the return must not credit twice.
  assert.equal((await request(`/api/payments/vnpay/ipn?${callback(app.body.payment_url)}`)).body.RspCode, '02');
  assert.equal((await order(user, 'coins_200', { return_url: 'https://evil.example/steal' })).status, 400);
});

test('Premium extends from the current end date and lifts the AI limit', async () => {
  const user = await member();
  const send = () => request('/api/chat/messages', user.token, 'POST', { session_id: chatId, message_id: randomUUID(), content: 'Hôm nay tôi nên ăn gì?' });
  const chatId = randomUUID();
  for (let i = 0; i < 10; i++) assert.equal((await send()).status, 201, `message ${i + 1}`);
  const blocked = await send();
  assert.equal(blocked.status, 402);
  assert.match(blocked.body.message, /Premium/);

  for (let i = 0; i < 2; i++) {
    const { body } = await order(user, 'premium_month');
    assert.equal((await request(`/api/payments/vnpay/ipn?${callback(body.payment_url)}`)).body.RspCode, '00');
  }
  const plans = await request('/api/payments/plans', user.token);
  assert.equal(plans.body.membership.premium, true);
  const days = (new Date(plans.body.membership.premium_until) - Date.now()) / 86400000;
  assert.ok(days > 59.9 && days <= 60, `premium days ${days}`);
  assert.equal((await send()).status, 201);
});

test('orders are private, admin sees revenue, other roles cannot buy', async () => {
  const [owner, other] = await Promise.all([member(), member()]);
  const { body } = await order(owner, 'premium_year');
  await request(`/api/payments/vnpay/ipn?${callback(body.payment_url)}`);
  assert.equal((await request(`/api/payments/orders/${body.order.order_id}`, other.token)).status, 404);
  assert.equal((await request('/api/payments/orders', other.token)).body.total, 0);
  const replay = await request('/api/payments/orders', owner.token, 'POST', { order_id: body.order.order_id, product: 'premium_year' });
  assert.equal(replay.status, 409, 'a finished order cannot be paid again');

  await db.collection('users').updateOne({ user_id: other.id }, { $set: { role: 'admin' } });
  const login = await request('/api/auth/login', null, 'POST', { email: other.email, password: 'payment-test-password' });
  const admin = { token: login.body.token };
  const overview = await request('/api/admin/overview', admin.token);
  assert.ok(overview.body.counts.revenue_vnd >= 399000);
  assert.ok(overview.body.counts.premium_members >= 1);
  const list = await request('/api/admin/payments?status=paid', admin.token);
  assert.ok(list.body.payments.some(row => row.order_id === body.order.order_id && row.email));
  assert.equal((await request('/api/payments/plans', admin.token)).status, 403);
});

test('steps add up per day and are validated', async () => {
  const user = await member();
  assert.equal((await request('/api/steps-logs', user.token)).body.steps, 0);
  await request('/api/steps-logs', user.token, 'POST', { amount: 500 });
  const after = await request('/api/steps-logs', user.token, 'POST', { amount: 1200 });
  assert.equal(after.body.steps, 1700);
  assert.equal((await request('/api/steps-logs', user.token, 'POST', { amount: 0 })).status, 400);
  assert.equal((await request('/api/steps-logs', user.token, 'POST', { amount: 1.5 })).status, 400);
});

test('payments answer 503 when VNPay is not configured', async () => {
  const bare = createApp({ db, logger: { error() {} } }).listen(0, '127.0.0.1');
  await once(bare, 'listening');
  const user = await member();
  const response = await fetch(`http://127.0.0.1:${bare.address().port}/api/payments/orders`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
    body: JSON.stringify({ order_id: randomUUID(), product: 'coins_200' }) });
  assert.equal(response.status, 503);
  await new Promise(resolve => bare.close(resolve));
});
