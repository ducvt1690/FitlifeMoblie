'use strict';
const assert = require('node:assert/strict');
const { before, after, beforeEach, afterEach, test } = require('node:test');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const { MongoClient } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { initializeDatabase } = require('../database/mongodb/database');
const { initializeAuthSessions } = require('../database/connection');
const { createApp } = require('../app');
const { createAuthService } = require('../services/auth.service');
const { createTrainerService } = require('../services/trainer.service');
const { createAdminService } = require('../services/admin.service');
const { hashToken } = require('../auth/session');
let replica, client, db, server, base, auth, trainerService;
before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  client = new MongoClient(replica.getUri()); await client.connect(); db = client.db('platform_http_regression');
  await initializeDatabase(db); await initializeAuthSessions(db);
  auth = createAuthService({ db }); trainerService = createTrainerService({ db });
}, { timeout: 240000 });
beforeEach(async () => {
  server = createApp({ db, logger: { error: (...args) => console.error(...args) } }).listen(0, '127.0.0.1');
  await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => { if (server) await new Promise(r => server.close(r)); });
after(async () => { if (client) await client.close(); if (replica) await replica.stop(); });
async function call(path, token, method = 'GET', body) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}
async function account(role = 'user') {
  const body = { email: `${randomUUID()}@fitlife.example`, password: 'Regression-test-123', confirm_password: 'Regression-test-123', full_name: role,
    gender: 'male', age: 28, height: 172, weight: 70, activity_level: 'moderate', goal: 'maintain' };
  const created = await auth.register(await require('./verified-registration')(db, body));
  if (role !== 'user') await db.collection('users').updateOne({ user_id: created.user.user_id }, { $set: { role } });
  const login = await auth.login({ email: body.email, password: body.password });
  return { ...login.user, role, token: login.token, email: body.email, password: body.password };
}
const templateFields = { title: 'Squat nguyên bản', category: 'Strength', description: 'Giữ lưng thẳng', duration_seconds: 120, calories_est: 20, level: 'beginner' };
async function fixture() {
  const [trainer, member] = await Promise.all([account('trainer'), account()]);
  const t = (await call('/api/trainer/templates', trainer.token, 'POST', templateFields)).body.template;
  const invite = (await call('/api/trainer/invites', trainer.token, 'POST')).body;
  assert.equal((await call('/api/trainer-links/accept', member.token, 'POST', { code: invite.invite_code })).status, 200);
  const student = (await call('/api/trainer/students', trainer.token)).body.students.find(s => s.user_id === member.user_id);
  return { trainer, member, template: t, link: student.link_id };
}
async function assign(f, id = randomUUID()) {
  const result = await call('/api/trainer/assignments', f.trainer.token, 'POST', { id, user_id: f.member.user_id, template_id: f.template.template_id, note: 'Học viên đọc ghi chú này.' });
  assert.equal(result.status, 201); return result.body.assignment;
}
test('TR-01/02 HTTP edits preserve assignment snapshots; historical templates archive; unused delete', async () => {
  const f = await fixture(), a = await assign(f);
  assert.equal((await call(`/api/trainer/templates/${f.template.template_id}`, f.trainer.token, 'PATCH', { title: 'Bản mới', description: 'Hướng dẫn mới', category: 'Cardio', duration_seconds: 180, calories_est: 30, level: 'advanced' })).status, 200);
  const inbox = await call('/api/trainer-links', f.member.token);
  assert.equal(inbox.body.assignments.find(x => x.id === a.id).template.title, templateFields.title);
  assert.equal((await call(`/api/trainer/templates/${f.template.template_id}`, f.trainer.token, 'DELETE')).body.archived, true);
  assert.equal(await db.collection('trainer_assignments').countDocuments({ id: a.id }), 1);
  const unused = (await call('/api/trainer/templates', f.trainer.token, 'POST', templateFields)).body.template;
  assert.equal((await call(`/api/trainer/templates/${unused.template_id}`, f.trainer.token, 'DELETE')).body.archived, false);
  assert.equal(await db.collection('workout_templates').countDocuments({ template_id: unused.template_id }), 0);
});
test('legacy assignment snapshots freeze transactionally before the first template edit', async () => {
  const f = await fixture(), a = await assign(f);
  await db.collection('trainer_assignments').updateOne({ id: a.id }, { $unset: { template_snapshot: '' } });
  assert.equal((await call(`/api/trainer/templates/${f.template.template_id}`, f.trainer.token, 'PATCH', { title: 'Edited legacy' })).status, 200);
  assert.equal((await db.collection('trainer_assignments').findOne({ id: a.id })).template_snapshot.title, templateFields.title);
});
test('TR-04 HTTP concurrent retries insert one assignment and reject reuse with different payload', async () => {
  const f = await fixture(), id = randomUUID();
  const body = { id, user_id: f.member.user_id, template_id: f.template.template_id, note: 'Retry note' };
  const results = await Promise.all(Array.from({ length: 5 }, () => call('/api/trainer/assignments', f.trainer.token, 'POST', body)));
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.equal(results.filter(r => r.status === 200 && r.body.replayed).length, 4);
  assert.equal(await db.collection('trainer_assignments').countDocuments({ id }), 1);
  assert.equal((await call('/api/trainer/assignments', f.trainer.token, 'POST', { ...body, note: 'Changed' })).status, 409);
});
test('Trainer A cannot access Trainer B student progress, template, cancellation or feedback', async () => {
  const f = await fixture(), outsider = await account('trainer'), a = await assign(f);
  for (const [path, method, body] of [
    [`/api/trainer/students/${f.member.user_id}/progress`, 'GET'],
    [`/api/trainer/templates/${f.template.template_id}`, 'PATCH', { title: 'stolen' }],
    [`/api/trainer/assignments/${a.id}/cancel`, 'POST', { reason: 'stolen' }],
    [`/api/trainer/assignments/${a.id}/feedback`, 'POST', { feedback: 'stolen' }],
  ]) assert.ok([403, 404].includes((await call(path, outsider.token, method, body)).status));
  assert.equal((await call('/api/trainer-links', outsider.token)).status, 403);
});
test('TR-03 cancel keeps other assignments, records history/reason and rejects member completion', async () => {
  const f = await fixture(), a = await assign(f), other = await assign(f);
  assert.equal((await call(`/api/trainer/assignments/${a.id}/cancel`, f.trainer.token, 'POST', { reason: '' })).status, 400);
  assert.equal((await call(`/api/trainer/assignments/${a.id}/cancel`, f.trainer.token, 'POST', { reason: 'Điều chỉnh giáo án' })).status, 200);
  assert.equal((await call(`/api/trainer-links/assignments/${a.id}/done`, f.member.token, 'POST')).status, 409);
  const row = await db.collection('trainer_assignments').findOne({ id: a.id });
  assert.equal(row.cancel_reason, 'Điều chỉnh giáo án'); assert.ok(row.cancelled_at instanceof Date);
  assert.deepEqual(row.status_history.map(x => x.status), ['assigned', 'cancelled']);
  assert.equal((await db.collection('trainer_assignments').findOne({ id: other.id })).status, 'assigned');
});
test('TR-05 disconnect ends consent, cancels pending and forbids new assignment', async () => {
  const f = await fixture(), a = await assign(f);
  assert.equal((await call(`/api/trainer/links/${f.link}/end`, f.trainer.token, 'POST')).status, 200);
  assert.equal((await db.collection('trainer_links').findOne({ link_id: f.link })).status, 'ended');
  assert.equal((await db.collection('trainer_assignments').findOne({ id: a.id })).status, 'cancelled');
  assert.equal((await call('/api/trainer/assignments', f.trainer.token, 'POST', { id: randomUUID(), user_id: f.member.user_id, template_id: f.template.template_id })).status, 403);
  assert.equal((await call(`/api/trainer/students/${f.member.user_id}/progress`, f.trainer.token)).status, 403);
});
test('TR-06 revoked and expired invites cannot establish consent', async () => {
  const trainer = await account('trainer'), member = await account();
  const first = (await call('/api/trainer/invites', trainer.token, 'POST')).body;
  assert.equal((await call(`/api/trainer/invites/${first.invite.link_id}/revoke`, trainer.token, 'POST')).status, 200);
  assert.equal((await call('/api/trainer-links/accept', member.token, 'POST', { code: first.invite_code })).status, 400);
  const second = (await call('/api/trainer/invites', trainer.token, 'POST')).body;
  await db.collection('trainer_links').updateOne({ link_id: second.invite.link_id }, { $set: { created_at: new Date(Date.now() - 86400001) } });
  assert.equal((await call('/api/trainer-links/accept', member.token, 'POST', { code: second.invite_code })).status, 400);
  const list = await call('/api/trainer/invites?status=expired&page_size=1', trainer.token);
  assert.equal(list.body.invites[0].display_status, 'expired'); assert.equal(list.body.total, 1);
});
test('TR-08/10 progress and feedback use persisted assignments and are visible to the right member', async () => {
  const f = await fixture(), a = await assign(f);
  assert.equal((await call(`/api/trainer-links/assignments/${a.id}/done`, f.member.token, 'POST')).status, 200);
  assert.equal((await call(`/api/trainer/assignments/${a.id}/feedback`, f.trainer.token, 'POST', { feedback: 'Kỹ thuật đã tốt hơn.' })).status, 200);
  const progress = await call(`/api/trainer/students/${f.member.user_id}/progress?page_size=1`, f.trainer.token);
  assert.equal(progress.body.summary.done, 1); assert.equal(progress.body.summary.total, 1);
  const inbox = (await call('/api/trainer-links', f.member.token)).body.assignments[0];
  assert.equal(inbox.feedback, 'Kỹ thuật đã tốt hơn.'); assert.equal(inbox.trainer_name, f.trainer.name);
  assert.equal(inbox.note, 'Học viên đọc ghi chú này.');
});
test('CH-01 admin revoke ends active/pending links, cancels assignments, revokes tokens and logs before/after role', async () => {
  const f = await fixture(), admin = await account('admin'), a = await assign(f);
  const invite = (await call('/api/trainer/invites', f.trainer.token, 'POST')).body;
  const change = await call(`/api/admin/accounts/${f.trainer.user_id}`, admin.token, 'PATCH', { role: 'user', note: 'Hết hợp đồng' });
  assert.equal(change.status, 200);
  assert.equal(await db.collection('trainer_links').countDocuments({ trainer_id: f.trainer.user_id, status: { $in: ['active', 'pending'] } }), 0);
  assert.equal((await db.collection('trainer_assignments').findOne({ id: a.id })).status, 'cancelled');
  assert.equal((await call('/api/trainer/templates', f.trainer.token)).status, 401);
  const log = await db.collection('admin_logs').findOne({ target_id: f.trainer.user_id, action: 'change_account_role' });
  assert.equal(log.admin_id, admin.user_id); assert.equal(log.previous_role, 'trainer'); assert.equal(log.new_role, 'user'); assert.equal(log.note, 'Hết hợp đồng'); assert.ok(log.created_at instanceof Date);
  assert.equal((await call(`/api/admin/accounts/${f.trainer.user_id}`, admin.token, 'PATCH', { role: 'trainer', note: 'Gia hạn hợp đồng' })).status, 200);
  assert.equal(await db.collection('trainer_links').countDocuments({ trainer_id: f.trainer.user_id, status: 'active' }), 0);
  assert.equal((await call('/api/trainer-links/accept', f.member.token, 'POST', { code: invite.invite_code })).status, 400);
});
test('CH-01 concurrent admin revocation and assignment never leave an active pending exercise', async () => {
  const f = await fixture(), admin = await account('admin');
  const results = await Promise.all([
    call('/api/trainer/assignments', f.trainer.token, 'POST', { id: randomUUID(), user_id: f.member.user_id, template_id: f.template.template_id }),
    call(`/api/admin/accounts/${f.trainer.user_id}`, admin.token, 'PATCH', { role: 'user', note: 'Concurrent revoke' }),
  ]);
  assert.equal(results[1].status, 200); assert.ok([201, 401, 403].includes(results[0].status));
  assert.equal(await db.collection('trainer_assignments').countDocuments({ trainer_id: f.trainer.user_id, status: 'assigned' }), 0);
  assert.equal(await db.collection('trainer_links').countDocuments({ trainer_id: f.trainer.user_id, status: 'active' }), 0);
});
test('AD-05 Premium revenue excludes Coin orders; failed/pending excluded; date ranges and detail enforced', async () => {
  const admin = await account('admin'), member = await account(), now = new Date('2026-11-05T08:00:00Z');
  const orders = [['premium_month', 49000, 'paid'], ['coins_200', 20000, 'paid'], ['premium_year', 399000, 'failed'], ['premium_month', 49000, 'pending']].map(([product, amount_vnd, status]) => ({
    order_id: randomUUID(), user_id: member.user_id, product, amount_vnd, status, txn_ref: randomUUID().replaceAll('-', ''), return_url: 'http://localhost:5173/',
    expires_at: new Date(+now + 900000), response_code: null, vnp_transaction_no: null, bank_code: null, paid_at: status === 'paid' ? now : null, created_at: now, updated_at: now,
  }));
  await db.collection('payment_orders').insertMany(orders);
  assert.equal((await call('/api/admin/revenue', member.token)).status, 403);
  const report = await call('/api/admin/revenue?from=2026-11-05&to=2026-11-05', admin.token);
  assert.equal(report.body.premium.amount_vnd, 49000); assert.equal(report.body.coins.amount_vnd, 20000); assert.equal(report.body.total.count, 2);
  assert.equal(report.body.excluded.failed.count, 1); assert.equal(report.body.excluded.pending.count, 1);
  assert.equal((await call('/api/admin/revenue?from=2026-11-06&to=2026-11-05', admin.token)).status, 400);
  for (const from of ['2026-02-30', '2026-02-30T08:00:00Z', '2026-11-05T08:00:00', '2026-11-05T24:00:00Z']) {
    assert.equal((await call('/api/admin/revenue?from=' + encodeURIComponent(from), admin.token)).status, 400);
  }
  assert.equal((await call('/api/admin/revenue?from=' + encodeURIComponent('2026-11-05T00:00:00+07:00'), admin.token)).status, 200);
  const list = await call('/api/admin/payments?status=paid&page_size=1&q=' + member.email, admin.token);
  assert.equal(list.body.total, 2); assert.equal(list.body.payments.length, 1);
  const detail = await call(`/api/admin/payments/${orders[0].order_id}`, admin.token);
  assert.equal(detail.status, 200); assert.equal(detail.body.payment.amount_vnd, 49000); assert.equal(detail.body.payment.txn_ref, undefined);
  assert.equal((await call(`/api/admin/payments/${orders[0].order_id}`, admin.token, 'PATCH', { status: 'paid' })).status, 404);
});
test('retired Admin reward catalog and redemption APIs are unavailable', async () => {
  const admin=await account('admin'), member=await account();
  for(const path of ['/api/admin/rewards','/api/admin/rewards/'+randomUUID(),'/api/admin/transactions']) assert.equal((await call(path,admin.token)).status,404);
  assert.equal((await call('/api/admin/rewards',admin.token,'POST',{})).status,404);
  assert.equal((await call('/api/rewards/'+randomUUID()+'/purchase',member.token,'POST',{})).status,404);
  assert.equal((await call('/api/admin/logs',admin.token,'DELETE')).status,404);
});
test('TR-09 server pagination passes 100 rows, rejects boundaries and returns empty page accurately', async () => {
  const trainer = await account('trainer'), now = new Date();
  await db.collection('workout_templates').insertMany(Array.from({ length: 125 }, (_, i) => ({ ...templateFields, title: `Paged ${String(i).padStart(3, '0')}`, template_id: randomUUID(), trainer_id: trainer.user_id, is_active: true, created_at: now, updated_at: now })));
  const result = await call('/api/trainer/templates?q=Paged&page=6&page_size=20&sort=title', trainer.token);
  assert.equal(result.body.total, 125); assert.equal(result.body.templates.length, 20); assert.equal(result.body.templates[0].title, 'Paged 100');
  assert.equal((await call('/api/trainer/templates?q=Paged&page=8&page_size=20', trainer.token)).body.templates.length, 0);
  for (const query of ['page=0', 'page_size=101', 'page[]=1', 'page_size[]=20', 'q[x]=bad', 'sort=password_hash']) assert.equal((await call('/api/trainer/templates?' + query, trainer.token)).status, 400);
  assert.equal((await call('/api/trainer/templates?q=no-result', trainer.token)).body.total, 0);
});
test('CH-02 unauthenticated, expired and revoked tokens cannot reach protected endpoints', async () => {
  const member = await account();
  assert.equal((await call('/api/profile')).status, 401);
  await db.collection('auth_sessions').updateOne({ token_hash: hashToken(member.token) }, { $set: { expires_at: new Date(Date.now() - 1) } });
  assert.equal((await call('/api/profile', member.token)).status, 401);
  const loggedIn = await auth.login({ email: member.email, password: member.password });
  assert.equal((await call('/api/auth/logout', loggedIn.token, 'POST')).status, 204);
  assert.equal((await call('/api/profile', loggedIn.token)).status, 401);
});
test('fitness additive migration plans without writes, preserves legacy data and refuses drift', async () => {
  const { collections } = require('../database/mongodb/schema');
  const { migrateFitnessPlatform } = require('../database/mongodb/migrations/fitness-platform');
  const legacy = client.db('platform_migration_test'); await initializeDatabase(legacy);
  const assignment = collections.find(c => c.name === 'trainer_assignments');
  const old = structuredClone(assignment.validator);
  for (const key of ['link_id', 'template_snapshot', 'cancelled_at', 'cancel_reason', 'feedback', 'feedback_at', 'status_history']) delete old.$jsonSchema.properties[key];
  await legacy.command({ collMod: 'trainer_assignments', validator: old });
  const before = (await legacy.listCollections({ name: 'trainer_assignments' }).toArray())[0].options;
  const plan = await migrateFitnessPlatform(legacy); assert.equal(plan.applied, false); assert.equal(plan.collections.find(c => c.name === 'trainer_assignments').needsMigration, true);
  assert.deepEqual((await legacy.listCollections({ name: 'trainer_assignments' }).toArray())[0].options, before);
  assert.equal((await migrateFitnessPlatform(legacy, { apply: true })).changed, true);
  assert.equal((await migrateFitnessPlatform(legacy, { apply: true })).changed, false);
  await legacy.command({ collMod: 'trainer_assignments', validator: {} });
  const drift = await migrateFitnessPlatform(legacy, { apply: true }); assert.equal(drift.applied, false); assert.ok(drift.issues.length);
});
test('fitness migration preserves the known narrow audit schema while widening deployed target compatibility', async () => {
  const { collections } = require('../database/mongodb/schema');
  const { migrateFitnessPlatform } = require('../database/mongodb/migrations/fitness-platform');
  const legacy = client.db('platform_narrow_audit_migration'); await initializeDatabase(legacy);
  const expected = collections.find(c => c.name === 'admin_logs');
  const old = structuredClone(expected.validator);
  delete old.$jsonSchema.properties.previous_role; delete old.$jsonSchema.properties.new_role;
  old.$jsonSchema.properties.target_type.enum = ['user', 'challenge', 'reward_item'];
  await legacy.command({ collMod: 'admin_logs', validator: old });
  const now = new Date();
  await legacy.collection('admin_logs').insertOne({ log_id: randomUUID(), admin_id: randomUUID(), action: 'lock_account', target_type: 'user', target_id: randomUUID(), note: 'Existing history', created_at: now, updated_at: now });
  const rows = await legacy.collection('admin_logs').find().toArray();
  assert.equal((await migrateFitnessPlatform(legacy)).collections.find(c => c.name === 'admin_logs').needsMigration, true);
  assert.equal((await migrateFitnessPlatform(legacy, { apply: true })).changed, true);
  assert.deepEqual(await legacy.collection('admin_logs').find().toArray(), rows);
  const [updated] = await legacy.listCollections({ name: 'admin_logs' }).toArray();
  assert.deepEqual(updated.options.validator, expected.validator);
});
test('operator role bootstrap cannot bypass transactional Trainer revocation', async () => {
  const { setOperatorRole } = require('../scripts/set-role');
  const f = await fixture(), assignment = await assign(f);
  await setOperatorRole(db, f.trainer.email, 'user');
  assert.equal((await db.collection('trainer_links').findOne({ link_id: f.link })).status, 'ended');
  assert.equal((await db.collection('trainer_assignments').findOne({ id: assignment.id })).status, 'cancelled');
  assert.equal((await db.collection('workout_templates').findOne({ template_id: f.template.template_id })).is_active, false);
  assert.equal((await call('/api/auth/me', f.trainer.token)).status, 401);
  const log = await db.collection('admin_logs').findOne({ action: 'set_role_user', target_id: f.trainer.user_id });
  assert.equal(log.previous_role, 'trainer'); assert.equal(log.new_role, 'user');
});
