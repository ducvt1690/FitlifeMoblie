const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: process.env.FITLIFE_BROWSER_CHANNEL || 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], responses = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) responses.push(r.status()); });
  const base = process.env.FITLIFE_WEB_URL || 'http://127.0.0.1:5175';
  const out = path.resolve(__dirname, '../../qa-artifacts'); fs.mkdirSync(out, { recursive: true });
  try {
    for (const [role, area, count] of [['user', '/app', 10], ['trainer', '/trainer', 4], ['admin', '/admin', 5]]) {
      await page.goto(base + '/login');
      await page.getByLabel('Email', { exact: true }).fill(role + '@merge.example');
      await page.getByLabel('Mật khẩu', { exact: true }).fill('Merge-smoke-test-2026!');
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL(base + area);
      await page.waitForLoadState('networkidle');
      const links = await page.locator('.sidebar-nav a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href'))); assert.equal(links.length, count);
      for (const href of links) {
        await page.locator(`.sidebar-nav a[href="${href}"]`).click(); await page.waitForURL(base + href); await page.waitForLoadState('networkidle');
        await expect(page.locator('main h1')).toBeVisible(); assert.equal(await page.locator('.alert-error').count(), 0, href);
      }
      results.push({ role, pages: count, status: 'PASS' });
      if (role === 'user') {
        await page.goto(base + '/app'); await page.waitForLoadState('networkidle');
        for (const width of [375, 768, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Overflow at ' + width);
          await page.screenshot({ path: path.join(out, `web-${width}.png`), fullPage: true });
        }
      }
      await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click(); await page.waitForURL(base + '/login');
      await page.goto(base + area); await page.waitForURL(base + '/login');
    }
    assert.deepEqual(errors, []); assert.deepEqual(responses, []);
    const report = { results, runtimeErrors: errors, failedApi: responses, responsive: [375, 768, 1440] };
    fs.writeFileSync(path.join(out, 'roles-smoke.json'), JSON.stringify(report, null, 2)); console.log('PASS all 3 roles, 19 pages, logout guards and 3 viewport widths.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
