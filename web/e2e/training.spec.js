import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const { MongoClient } = require('mongodb');
const { createAuthService } = require('./services/auth.service');
const { prepareDemoExercises } = require('./scripts/prepare-demo-exercises');
const verifyFixture = require('./test/verified-registration');
const runtime = JSON.parse(fs.readFileSync(new URL('../../output/integration-runtime.local.json', import.meta.url), 'utf8'));
if (runtime.database !== 'fitlife_integration_test') throw new Error('Disposable integration database required.');

test.describe.serial('Existing exercise catalog, plans and body metrics', () => {
  let client, db, member;
  const password = `Training-test-${randomUUID()}`;
  test.beforeAll(async () => {
    client = new MongoClient(runtime.uri); await client.connect(); db = client.db(runtime.database);
    // Import the project's real cached ExerciseDB records only into the disposable database.
    // No production or Atlas connection is read by this suite.
    await prepareDemoExercises(db);
    const body = { email: `training-${randomUUID()}@fitlife.example`, password, confirm_password: password,
      full_name: 'Training browser test', gender: 'female', age: 28, height: 165, weight: 60,
      activity_level: 'moderate', goal: 'maintain', timezone: 'Asia/Ho_Chi_Minh' };
    const result = await createAuthService({ db }).register(await verifyFixture(db, body));
    member = { ...body, user_id: result.user.user_id };
  });
  test.beforeEach(async ({ page }) => {
    await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill(member.email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await expect(page).toHaveURL(/\/member$/);
  });
  test.afterAll(async () => { await client?.close(); });

  test('catalog cursor next/previous, search and persisted exercise details', async ({ page }) => {
    await page.goto('/member/exercises');
    await expect(page.getByRole('heading', { name: 'Thư viện bài tập', exact: true })).toBeVisible();
    const rows = page.locator('tbody tr'); await expect(rows).toHaveCount(20);
    const first = await rows.first().locator('td').first().innerText();
    await page.getByRole('button', { name: 'Trang sau', exact: true }).click(); await expect(page).toHaveURL(/after=/);
    await expect(rows.first().locator('td').first()).not.toHaveText(first);
    await page.getByRole('button', { name: 'Trang trước', exact: true }).click(); await expect(rows.first().locator('td').first()).toHaveText(first);
    const record = await db.collection('exercises').findOne({ source: 'exercisedb_v1', is_active: true, name: 'Cable Crossover' });
    expect(record).toBeTruthy(); await page.getByRole('textbox', { name: 'Tìm kiếm', exact: true }).fill('Cable Crossover');
    await expect(rows).toHaveCount(1); await rows.first().getByRole('button', { name: 'Xem hướng dẫn', exact: true }).click();
    const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
    await expect(dialog.locator('ol li')).toHaveCount((record.instructions_vi || record.instructions).length);
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click(); await expect(dialog).not.toBeVisible();
    await page.getByRole('textbox', { name: 'Tìm kiếm', exact: true }).fill(`no-such-exercise-${randomUUID()}`);
    await expect(page.getByRole('heading', { name: 'Chưa có dữ liệu', exact: true })).toBeVisible();
  });

  test('guided plan uses server options, saves item completion and records one workout', async ({ page }) => {
    await page.goto('/member/plans'); await page.getByRole('button', { name: 'Tạo lịch tập', exact: true }).click();
    const d = page.getByRole('dialog'); await d.getByRole('combobox', { name: 'Lịch chia nhóm cơ' }).selectOption('full_body');
    await d.getByLabel('Thời gian mong muốn (phút)', { exact: true }).fill('15');
    await d.getByLabel('Mong muốn riêng', { exact: true }).fill('Tập vừa sức và kiểm soát động tác.');
    await d.getByRole('button', { name: 'Tạo lịch tập', exact: true }).click(); await expect(d).not.toBeVisible();
    const plan = await db.collection('workout_plans').findOne({ user_id: member.user_id });
    expect(plan.split).toBe('full_body'); expect(plan.focus).toBe('full'); expect(plan.items.length).toBeGreaterThan(0);
    await expect(page.locator('tbody tr')).toHaveCount(plan.items.length);
    await page.getByRole('checkbox').first().check();
    await expect.poll(async () => (await db.collection('workout_plans').findOne({ plan_id: plan.plan_id })).done_items.length).toBe(1);
    await page.getByRole('button', { name: 'Hoàn thành buổi tập', exact: true }).click();
    await d.getByRole('button', { name: 'Xác nhận hoàn thành', exact: true }).click(); await expect(d).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Buổi tập đã hoàn thành', exact: true })).toBeDisabled();
    expect((await db.collection('workout_plans').findOne({ plan_id: plan.plan_id })).status).toBe('done');
    expect(await db.collection('workout_logs').countDocuments({ workout_id: plan.plan_id, user_id: member.user_id })).toBe(1);
  });

  test('BMI recording uses server profile calculation and updates same-day history', async ({ page }) => {
    await page.goto('/member/bmi'); await expect(page.getByRole('heading', { name: 'Chỉ số cơ thể', exact: true })).toBeVisible();
    await expect(page.locator('.metrics')).toContainText('22,04');
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Ghi nhận BMI hôm nay', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận ghi nhận', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(page.locator('tbody tr')).toHaveCount(1);
    }
    const records = await db.collection('bmi_history').find({ user_id: member.user_id }).toArray();
    expect(records).toHaveLength(1); expect(records[0].weight).toBe(60); expect(records[0].height).toBe(165); expect(records[0].bmi_value).toBe(22.04);
  });
  test('compact navigation opens, routes and closes without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Mở điều hướng', exact: true }).click();
    await expect(page.locator('#main-sidebar')).not.toHaveAttribute('inert', '');
    await page.getByRole('link', { name: 'Chỉ số cơ thể', exact: true }).click();
    await expect(page).toHaveURL(/\/member\/bmi$/);
    await expect(page.locator('#main-sidebar')).toHaveAttribute('inert', '');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Mở điều hướng', exact: true }).click();
    await page.getByRole('button', { name: 'Đóng điều hướng', exact: true }).click();
    await expect(page.locator('#main-sidebar')).toHaveAttribute('inert', '');
    await page.screenshot({ path: '../output/playwright/member-bmi-mobile.png', fullPage: true });
  });
});
