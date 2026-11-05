import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const { MongoClient } = require('mongodb');
const { createAuthService } = require('./services/auth.service');
const verifyFixture = require('./test/verified-registration');
const runtime = JSON.parse(fs.readFileSync(new URL('../../output/integration-runtime.local.json', import.meta.url), 'utf8'));
if (runtime.database !== 'fitlife_integration_test') throw new Error('Disposable integration API required.');

test.describe.serial('Web → shared API → MongoDB', () => {
  let client, db, trainer, member, admin, pages = {}, contexts = [], templateId, challengeId, rewardId;
  const tag = randomUUID().slice(0, 7), password = `E2e-test-${randomUUID()}`;
  const title = `E2E Strength ${tag}`, editedTitle = `${title} edited`;
  test.beforeAll(async ({ browser }) => {
    client = new MongoClient(runtime.uri); await client.connect(); db = client.db(runtime.database);
    const auth = createAuthService({ db });
    const accounts = {};
    for (const role of ['trainer', 'user', 'admin']) {
      const body = { email: `e2e-${role}-${tag}@fitlife.example`, password, confirm_password: password, full_name: `E2E ${role} ${tag}`, gender: 'male', age: 28, height: 175, weight: 72, activity_level: 'moderate', goal: 'maintain', timezone: 'Asia/Ho_Chi_Minh' };
      const registered = await auth.register(await verifyFixture(db, body));
      if (role !== 'user') await db.collection('users').updateOne({ user_id: registered.user.user_id }, { $set: { role } });
      accounts[role] = { ...body, user_id: registered.user.user_id };
      const context = await browser.newContext(); contexts.push(context); const page = await context.newPage(); pages[role] = page;
      await page.goto('/login'); await page.getByRole('textbox', { name: 'Email', exact: true }).fill(body.email);
      await page.getByRole('textbox', { name: 'Mật khẩu', exact: true }).fill(password); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(role === 'user' ? '/member$' : `/${role}$`));
    }
    trainer = accounts.trainer; member = accounts.user; admin = accounts.admin;
  });
  test.afterAll(async () => { for (const c of contexts) await c.close(); if (client) await client.close(); });

  test('login, role routing, template create/edit/search retain persisted fields', async () => {
    const p = pages.trainer;
    await p.goto('/admin/accounts'); await expect(p).toHaveURL(/\/trainer$/);
    await p.goto('/trainer/templates'); await p.getByRole('button', { name: 'Tạo mẫu bài tập', exact: true }).click();
    const d = p.getByRole('dialog');
    await d.getByLabel('Tên bài tập', { exact: true }).fill(title); await d.getByLabel('Hướng dẫn', { exact: true }).fill('Slow controlled repetitions.');
    await d.getByLabel('Nhóm bài tập', { exact: true }).fill('Strength'); await d.getByLabel('Thời lượng (giây)', { exact: true }).fill('600');
    await d.getByLabel('Calo ước tính (kcal)', { exact: true }).fill('50'); await d.getByRole('button', { name: 'Lưu mẫu bài tập' }).click();
    await expect(d).not.toBeVisible(); await p.getByRole('textbox', { name: 'Tìm kiếm', exact: true }).fill(title);
    const row = p.getByRole('row').filter({ hasText: title }); await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
    await d.getByLabel('Tên bài tập', { exact: true }).fill(editedTitle); await d.getByLabel('Thời lượng (giây)', { exact: true }).fill('900');
    await d.getByRole('button', { name: 'Lưu mẫu bài tập' }).click(); await expect(d).not.toBeVisible();
    const saved = await db.collection('workout_templates').findOne({ title: editedTitle, trainer_id: trainer.user_id });
    expect(saved.duration_seconds).toBe(900); templateId = saved.template_id;
    await p.getByRole('combobox', { name: 'Sắp xếp', exact: true }).selectOption('title');
    await expect(row).toHaveCount(1); await p.screenshot({ path: '../output/playwright/trainer-desktop.png', fullPage: true });
  });

  async function connect() {
    const p = pages.trainer, m = pages.user;
    await p.goto('/trainer/invites'); await p.getByRole('button', { name: 'Tạo mã mời', exact: true }).click();
    await expect(p.locator('.invite-code strong')).toBeVisible(); const code = await p.locator('.invite-code strong').innerText();
    await m.goto('/member/assignments'); await m.getByRole('button', { name: 'Kết nối huấn luyện viên', exact: true }).click();
    const d = m.getByRole('dialog'); await d.getByLabel('Mã mời 8 ký tự').fill(code); await d.getByRole('button', { name: 'Đồng ý và kết nối' }).click();
    await expect(d).not.toBeVisible(); await expect(m.locator('.connection-list')).toContainText(trainer.full_name);
  }
  async function assign(note) {
    const p = pages.trainer; await p.goto('/trainer/assignments'); await p.getByRole('button', { name: 'Giao bài tập', exact: true }).click();
    const d = p.getByRole('dialog');
    await d.getByRole('combobox', { name: 'Học viên', exact: true }).selectOption(member.user_id);
    await d.getByRole('combobox', { name: 'Mẫu bài tập', exact: true }).selectOption(templateId);
    await d.getByLabel('Ghi chú cho học viên').fill(note); await d.getByRole('button', { name: 'Giao bài tập', exact: true }).click();
    await expect(d).not.toBeVisible();
    return db.collection('trainer_assignments').findOne({ trainer_id: trainer.user_id, note });
  }
  test('consent, single cancellation, member completion and feedback persist', async () => {
    await connect(); const first = await assign(`Cancel note ${tag}`); expect(first.template_snapshot.title).toBe(editedTitle);
    const p = pages.trainer, m = pages.user;
    const firstRow = p.getByRole('row').filter({ hasText: `Cancel note ${tag}` }); await firstRow.getByRole('button', { name: 'Hủy bài', exact: true }).click();
    const d = p.getByRole('dialog'); await d.getByLabel('Lý do hủy').fill(`Reschedule ${tag}`); await d.getByRole('button', { name: 'Xác nhận hủy bài' }).click(); await expect(d).not.toBeVisible();
    expect((await db.collection('trainer_assignments').findOne({ id: first.id })).cancel_reason).toBe(`Reschedule ${tag}`);
    const second = await assign(`Complete note ${tag}`);
    await m.reload(); const card = m.locator('article.assignment').filter({ hasText: `Complete note ${tag}` });
    await card.getByRole('button', { name: 'Đánh dấu hoàn thành' }).click(); await m.getByRole('dialog').getByRole('button', { name: 'Xác nhận hoàn thành' }).click();
    await expect(card).toContainText('Hoàn thành'); await expect.poll(async () => (await db.collection('trainer_assignments').findOne({ id: second.id })).status).toBe('done');
    await p.reload(); await p.getByRole('row').filter({ hasText: `Complete note ${tag}` }).getByRole('button', { name: 'Phản hồi', exact: true }).click();
    await d.getByLabel('Phản hồi cho học viên').fill(`Feedback ${tag}`); await d.getByRole('button', { name: 'Gửi phản hồi' }).click(); await expect(d).not.toBeVisible();
    await m.reload(); await expect(m.locator('article.assignment').filter({ hasText: `Complete note ${tag}` })).toContainText(`Feedback ${tag}`);
    await p.goto(`/trainer/progress?user_id=${member.user_id}`); await expect(p.locator('.metrics')).toContainText('Hoàn thành');
  });

  test('disconnect cancels pending exercises without deleting history', async () => {
    const pending = await assign(`Disconnect note ${tag}`), p = pages.trainer;
    await p.goto('/trainer/students'); await p.getByRole('row').filter({ hasText: member.full_name }).getByRole('button', { name: 'Ngắt kết nối', exact: true }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Ngắt kết nối', exact: true }).click(); await expect(p.getByRole('dialog')).not.toBeVisible();
    expect(await db.collection('trainer_links').countDocuments({ trainer_id: trainer.user_id, user_id: member.user_id, status: 'active' })).toBe(0);
    expect((await db.collection('trainer_assignments').findOne({ id: pending.id })).status).toBe('cancelled');
    expect(await db.collection('trainer_assignments').countDocuments({ trainer_id: trainer.user_id })).toBe(3);
  });

  test('admin creates/edits/deactivates challenges; redemption navigation is absent', async () => {
    const p = pages.admin; await p.goto('/admin/challenges'); await p.getByRole('button', { name: 'Tạo thử thách', exact: true }).click(); const d = p.getByRole('dialog');
    for (const [label, value] of [['Tên thử thách', `E2E challenge ${tag}`], ['Mô tả', 'Build a repeatable habit.'], ['Số ngày mục tiêu', '5'], ['Xu thưởng', '20'], ['Tên biểu tượng', 'fitness']]) await d.getByLabel(label, { exact: true }).fill(value);
    await d.getByRole('button', { name: 'Lưu thử thách' }).click(); await expect(d).not.toBeVisible();
    challengeId = (await db.collection('challenges').findOne({ title: `E2E challenge ${tag}` })).challenge_id;
    await p.getByRole('row').filter({ hasText: `E2E challenge ${tag}` }).getByRole('button', { name: 'Chi tiết / chỉnh sửa' }).click();
    await d.getByLabel('Tên thử thách', { exact: true }).fill(`E2E challenge edited ${tag}`); await d.getByRole('button', { name: 'Lưu thử thách' }).click(); await expect(d).not.toBeVisible();
    await p.getByRole('row').filter({ hasText: `E2E challenge edited ${tag}` }).getByRole('button', { name: 'Ngừng hoạt động' }).click();
    await d.getByRole('button', { name: 'Xác nhận', exact: true }).click(); await expect(d).not.toBeVisible();
    expect((await db.collection('challenges').findOne({ challenge_id: challengeId })).is_active).toBe(false);
    await expect(p.getByRole('navigation', {name:'Điều hướng chính'})).not.toContainText('Đổi quà');
    await expect(p.getByRole('navigation', {name:'Điều hướng chính'})).not.toContainText('Phần thưởng');
    await pages.user.goto('/member');
    await expect(pages.user.getByRole('navigation', {name:'Điều hướng chính'})).not.toContainText('Đổi quà');
  });

  test('admin read-only payment/revenue/log pages and responsive member profile render', async () => {
    const p = pages.admin;
    for (const [route, heading] of [['payments', 'Thanh toán'], ['logs', 'Nhật ký quản trị'], ['revenue', 'Doanh thu']]) {
      await p.goto(`/admin/${route}`); await expect(p.getByRole('heading', { name: heading, exact: true })).toBeVisible(); await expect(p.getByRole('alert')).toHaveCount(0);
    }
    await expect(p.locator('.metrics')).toContainText('Doanh thu Premium'); await expect(p.locator('.metrics')).toContainText('Tiền mua Coin');
    await p.screenshot({ path: '../output/playwright/admin-revenue.png', fullPage: true });
    const m = pages.user; await m.setViewportSize({ width: 390, height: 844 }); await m.goto('/member/profile'); await expect(m.getByRole('heading', { name: 'Hồ sơ & cài đặt' })).toBeVisible();
    expect(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await m.screenshot({ path: '../output/playwright/member-mobile-web.png', fullPage: true });
  });

  test('member workout, meal, water and Coach use real existing APIs', async () => {
    const p = pages.user; await p.setViewportSize({ width: 1440, height: 960 });
    await p.goto('/member/workouts'); await p.getByRole('button', { name: 'Ghi lại buổi tập', exact: true }).click(); const d = p.getByRole('dialog');
    await d.getByLabel('Tên buổi tập').fill(`E2E workout ${tag}`); await d.getByLabel('Nhóm bài tập').fill('Strength');
    await d.getByLabel('Thời lượng (giây)').fill('600'); await d.getByLabel('Calo đã đốt (kcal)').fill('80'); await d.getByRole('button', { name: 'Lưu buổi tập' }).click(); await expect(d).not.toBeVisible();
    expect(await db.collection('workout_logs').countDocuments({ user_id: member.user_id, title: `E2E workout ${tag}` })).toBe(1);
    await p.goto('/member/nutrition'); await p.getByRole('button', { name: 'Ghi lại bữa ăn' }).click();
    for (const [label, value] of [['Tên bữa ăn', `E2E meal ${tag}`], ['Năng lượng (kcal)', '500'], ['Protein (g)', '25'], ['Carbs (g)', '60'], ['Chất béo (g)', '15']]) await d.getByLabel(label, { exact: true }).fill(value);
    await d.getByRole('button', { name: 'Lưu bữa ăn' }).click(); await expect(d).not.toBeVisible();
    expect(await db.collection('meal_logs').countDocuments({ user_id: member.user_id, meal_name: `E2E meal ${tag}` })).toBe(1);
    await p.goto('/member/wellbeing'); await p.getByRole('button', { name: 'Cập nhật nước uống' }).click(); await d.getByLabel('Thêm nước uống (ml)').fill('250'); await d.getByRole('button', { name: 'Lưu nhật ký' }).click(); await expect(d).not.toBeVisible();
    expect(await db.collection('water_logs').countDocuments({ user_id: member.user_id, amount: 250 })).toBe(1);
    await p.goto('/member/coach'); await p.getByLabel('Tin nhắn cho Coach').fill('Xin chào'); await p.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await expect(p.locator('.messages')).toContainText('Xin chào');
    expect(await db.collection('ai_chat_messages').countDocuments({ user_id: member.user_id, sender: 'user', content: 'Xin chào' })).toBe(1);
    await p.goto('/member/progress'); await expect(p.getByRole('alert')).toHaveCount(0); await expect(p.locator('.metrics')).toContainText('10');
  });

  test('admin revoke signs out live Trainer tab and regrant requires fresh consent', async () => {
    await connect(); await assign(`Revoke note ${tag}`);
    const p = pages.admin, tr = pages.trainer; await p.goto('/admin/accounts'); await p.getByRole('textbox', { name: 'Tìm kiếm', exact: true }).fill(trainer.email);
    await p.getByRole('row').filter({ hasText: trainer.email }).getByRole('button', { name: 'Quản lý quyền' }).click(); const d = p.getByRole('dialog');
    await d.getByRole('combobox', { name: 'Vai trò', exact: true }).selectOption('user'); await d.getByLabel('Lý do thay đổi').fill(`E2E revoke ${tag}`); await d.getByRole('button', { name: 'Xác nhận thay đổi' }).click(); await expect(d).not.toBeVisible();
    await tr.reload(); await expect(tr).toHaveURL(/\/login$/); await expect(tr.getByRole('textbox', { name: 'Email', exact: true })).toBeVisible();
    expect(await db.collection('trainer_links').countDocuments({ trainer_id: trainer.user_id, status: 'active' })).toBe(0);
    expect(await db.collection('trainer_assignments').countDocuments({ trainer_id: trainer.user_id, status: 'assigned' })).toBe(0);
    expect(await db.collection('auth_sessions').countDocuments({ user_id: trainer.user_id })).toBe(0);
    const audit = await db.collection('admin_logs').findOne({ target_id: trainer.user_id, action: 'change_account_role', note: `E2E revoke ${tag}` }); expect(audit.previous_role).toBe('trainer'); expect(audit.new_role).toBe('user'); expect(audit.admin_id).toBe(admin.user_id);
    await p.getByRole('row').filter({ hasText: trainer.email }).getByRole('button', { name: 'Quản lý quyền' }).click(); await d.getByRole('combobox', { name: 'Vai trò', exact: true }).selectOption('trainer'); await d.getByLabel('Lý do thay đổi').fill(`E2E regrant ${tag}`); await d.getByRole('button', { name: 'Xác nhận thay đổi' }).click(); await expect(d).not.toBeVisible();
    expect(await db.collection('trainer_links').countDocuments({ trainer_id: trainer.user_id, status: 'active' })).toBe(0);
    await pages.user.setViewportSize({ width: 1440, height: 960 }); await pages.user.goto('/member/profile'); await pages.user.getByRole('button', { name: 'Đăng xuất tất cả thiết bị' }).click(); await pages.user.getByRole('dialog').getByRole('button', { name: 'Đăng xuất tất cả', exact: true }).click(); await expect(pages.user).toHaveURL(/\/login$/);
  });
});
