'use strict';
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const integration = process.argv.includes('--integration');
  const api = integration ? JSON.parse(fs.readFileSync(path.resolve(__dirname, '../output/integration-runtime.local.json'), 'utf8')).apiUrl : `http://localhost:${require('../backend/config').loadConfig().port}`;
  const targets = [
    ['api', `${api}/health`, r => r.json()],
    ['web', 'http://localhost:5173', async r => ({ status: r.status })],
    ['expo', 'http://localhost:8081/status', r => r.text()],
  ];
  const checks = await Promise.all(targets.map(async ([service, url, body]) => {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(10000) }); const result = await body(response); return { service, url, ok: response.ok, result }; }
    catch (e) { return { service, url, ok: false, error: e.name }; }
  }));
  const report = { checked_at: new Date().toISOString(), mode: integration ? 'disposable integration database' : 'configured database', scope: 'Service availability only. Shared client API binding is verified separately by Web E2E and native tests.', ok: checks.every(c => c.ok), checks };
  console.log(JSON.stringify(report, null, 2));
  const output = path.resolve(__dirname, '../output'); fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, `fullstack-${integration ? 'integration' : 'configured'}-health.json`), JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
main().catch(e => { console.error(`Stack verification failed (${e.name}).`); process.exitCode = 1; });
