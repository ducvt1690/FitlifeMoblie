// Optional smoke after running native integration; independent of the portable E2E suite.
import { chromium, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const { MongoClient } = require('mongodb');
const { createSessionService } = require('./services/session.service');
const runtime = JSON.parse(fs.readFileSync(new URL('../../output/integration-runtime.local.json', import.meta.url), 'utf8'));
const native = JSON.parse(fs.readFileSync(new URL('../../output/mobile-native-test-result.json', import.meta.url), 'utf8'));
if (runtime.database !== 'fitlife_integration_test') throw new Error('Disposable integration database required.');
const client = new MongoClient(runtime.uri);
let browser, sessionService, token;
try {
  await client.connect();
  const row = await client.db(runtime.database).collection('workout_templates').findOne({ template_id: native.template_id, trainer_id: runtime.accounts.trainer.user_id });
  if (!row) throw new Error('Native-created template is absent from the current disposable database. Run native integration first.');
  // Authenticated test setup through the real session service. Login UI is verified by the
  // portable E2E suite; this smoke specifically checks the cross-platform persisted record.
  sessionService = createSessionService({ db: client.db(runtime.database) });
  ({ token } = await sessionService.create(runtime.accounts.trainer.user_id));
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.addInitScript(value => sessionStorage.setItem('fitlife.web.session', value), token);
  const webUrl = process.env.FITLIFE_WEB_URL || 'http://localhost:5173';
  await page.goto(`${webUrl}/trainer/templates`);
  const loaded = page.waitForResponse(r => r.url().includes('/api/trainer/templates?q=') && r.status() === 200);
  await page.getByRole('textbox', { name: 'Tìm kiếm', exact: true }).fill(row.title);
  const response = await (await loaded).json();
  const shared = response.templates.find(t => t.template_id === native.template_id);
  expect(shared?.title).toBe(row.title);
  expect(shared?.duration_seconds).toBe(row.duration_seconds);
  const visible = page.getByRole('row').filter({ hasText: row.title });
  await expect(visible).toHaveCount(1); await expect(visible).toContainText(`${new Intl.NumberFormat('vi-VN').format(row.duration_seconds)} giây`);
  const screenshot = new URL('../../output/playwright/web-native-template-sync.png', import.meta.url);
  await page.screenshot({ path: fileURLToPath(screenshot), fullPage: true });
  const result = { passed: true, source: 'Android emulator / Expo Go native UI', observed: 'Standalone Web trainer template table and API response', template_id: row.template_id, title: shared.title, duration_seconds: shared.duration_seconds, same_database: runtime.database };
  fs.writeFileSync(new URL('../../output/web-native-sync-result.json', import.meta.url), JSON.stringify(result, null, 2));
  console.log('PASS: Native-created template appears in standalone Web with the same ID, title and duration.');
} finally {
  await browser?.close(); if (token) await sessionService.revoke(token); await client.close();
}
