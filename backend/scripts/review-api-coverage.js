'use strict';

const fs = require('node:fs');
const path = require('node:path');
const collection = require('../api/review-api.postman_collection.json');
const normalize = p => p.replace(/\?.*/, '').replace('{{baseUrl}}', '').replace(/\{\{[^}]+\}\}|:[^/]+/g, ':id');
const prefixes = { admin: 'admin', auth: 'auth', bmi: 'bmi-records', challenge: 'challenges', chat: 'chat', coaching: 'coaching',
  exercise: 'exercises', meal: 'meal-logs', profile: 'profile', quest: 'quests', reward: 'rewards', stats: 'stats',
  trainer: 'trainer', water: 'water-logs', workout: 'workout-logs' };
const rows = [{ method: 'GET', endpoint: '/' }, { method: 'GET', endpoint: '/health' }];
for (const file of fs.readdirSync(path.join(__dirname, '../routes'))) {
  const source = fs.readFileSync(path.join(__dirname, '../routes', file), 'utf8');
  const name = file.split('.')[0];
  for (const [, method, suffix] of source.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)) {
    for (const prefix of name === 'daily-log' ? ['sleep-logs', 'mood-logs'] : [prefixes[name]]) {
      if (!prefix) throw new Error(`Unmapped router ${file}`);
      rows.push({ method: method.toUpperCase(), endpoint: '/api/' + prefix + (suffix === '/' ? '' : suffix) });
    }
  }
}
for (const row of rows) {
  row.matches = collection.item.filter(i => i.request.method === row.method && normalize(i.request.url) === normalize(row.endpoint)).length;
}
const output = path.resolve(__dirname, '../../docs/validation');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'API_COVERAGE.csv'), 'method,route,postman_requests\n' + rows.map(r => `${r.method},${r.endpoint},${r.matches}`).join('\n') + '\n');
const uncovered = rows.filter(r => !r.matches);
console.log(`Endpoint coverage: ${rows.length - uncovered.length}/${rows.length}. Assertions must be assessed separately.`);
if (uncovered.length) { console.error(uncovered); process.exitCode = 1; }
