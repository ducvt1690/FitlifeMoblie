import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['json', { outputFile: '../output/playwright/fullstack-results.json' }]],
  outputDir: '../output/playwright/test-artifacts',
  use: { baseURL: process.env.FITLIFE_WEB_URL || 'http://localhost:5173', channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', viewport: { width: 1440, height: 960 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
