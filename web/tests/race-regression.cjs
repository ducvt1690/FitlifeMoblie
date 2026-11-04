const assert = require('node:assert/strict');
const {
  chromium,
  expect
} = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({
    channel: process.env.FITLIFE_BROWSER_CHANNEL || 'msedge',
    headless: true
  });
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:5175/login');
    await page.getByLabel('Email', {
      exact: true
    }).fill('admin@merge.example');
    await page.getByLabel('Mật khẩu', {
      exact: true
    }).fill('Merge-smoke-test-2026!');
    await page.getByRole('button', {
      name: 'Đăng nhập',
      exact: true
    }).click();
    await page.waitForURL('**/admin');
    await page.goto('http://127.0.0.1:5175/admin/accounts');
    await page.getByPlaceholder('Tìm theo email hoặc tên').waitFor();
    let release, ready;
    const gate = new Promise(r => {
        release = r;
      }),
      started = new Promise(r => {
        ready = r;
      });
    await page.route('**/api/admin/accounts*', async route => {
      if (new URL(route.request().url()).searchParams.get('q') === 'slow-empty') {
        const response = await route.fetch();
        ready();
        await gate;
        await route.fulfill({
          response
        });
      } else await route.continue();
    });
    const input = page.getByPlaceholder('Tìm theo email hoặc tên');
    await input.fill('slow-empty');
    await page.getByRole('button', {
      name: 'Tìm',
      exact: true
    }).click();
    await started;
    await input.fill('user@merge.example');
    await page.getByRole('button', {
      name: 'Tìm',
      exact: true
    }).click();
    await expect(page.getByText('user@merge.example', {
      exact: true
    })).toBeVisible();
    const oldResponse = page.waitForResponse(r => r.url().includes('q=slow-empty'));
    release();
    await oldResponse;
    await page.waitForTimeout(250); // Let React process the deliberately late response.
    await expect(page.getByText('user@merge.example', {
      exact: true
    })).toBeVisible();
    console.log('PASS web search keeps the latest result when an older response arrives last.');
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e.message);
  process.exitCode = 1;
});
