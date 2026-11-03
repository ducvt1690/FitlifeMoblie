'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const { MongoClient } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../app');
const { initializeDatabase } = require('../database/mongodb/database');
const { initializeAuthSessions } = require('../database/connection');
const { createAuthService } = require('../services/auth.service');

async function main() {
  // This runner never loads .env or accepts a production database URI.
  let replica, client, server;
  const reportDir = path.resolve(__dirname, '../postman/review');
  fs.mkdirSync(reportDir, { recursive: true });
  try {
    replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
    client = new MongoClient(replica.getUri());
    await client.connect();
    const db = client.db('fitlife_review_test');
    await initializeDatabase(db);
    await initializeAuthSessions(db);
    const now = new Date();
    await db.collection('exercises').insertMany(['A01', 'B02', 'c03'].map((id, i) => ({
      exercise_id: randomUUID(), source: 'exercisedb_v1', source_exercise_id: id, name: `exercise fixture ${i}`,
      name_vi: `Bài tập kiểm thử ${i}`, gif_url: 'https://static.exercisedb.dev/media/01qpYSe.gif', body_parts: ['back'],
      equipments: ['bodyweight'], target_muscles: ['abdominals'], secondary_muscles: [], instructions: ['Fixture'],
      is_active: true, synced_at: now, created_at: now, updated_at: now,
    })));
    const variables = { reviewPassword: 'Review-' + randomUUID(), reviewMissingToken: 'missing' };
    const auth = createAuthService({ db });
    for (const role of ['Trainer', 'Admin', 'Other']) {
      const email = `${role.toLowerCase()}-${randomUUID()}@fitlife.example`;
      const account = await auth.register({ email, password: variables.reviewPassword, full_name: `Review ${role}`,
        gender: 'male', age: 23, height: 170, weight: 65, activity_level: 'moderate', goal: 'maintain', timezone: 'Asia/Ho_Chi_Minh' });
      if (role !== 'Other') await db.collection('users').updateOne({ email }, { $set: { role: role.toLowerCase() } });
      variables[`review${role}Email`] = email;
      variables[`review${role}Id`] = account.user.user_id;
    }
    // More than 100 purchases exposes ownership computed from a truncated history.
    const themeId = randomUUID(), voucherId = randomUUID();
    variables.reviewOldThemeId = themeId;
    await db.collection('reward_items').insertMany([
      { item_id: themeId, title: 'Old theme', category: 'theme', cost_coins: 0, icon: 'star', is_available: true, created_at: now, updated_at: now },
      { item_id: voucherId, title: 'Repeat voucher', category: 'voucher', cost_coins: 0, icon: 'star', is_available: true, created_at: now, updated_at: now },
    ]);
    await db.collection('purchases').insertMany(Array.from({ length: 102 }, (_, i) => ({
      purchase_id: randomUUID(), user_id: variables.reviewOtherId, item_id: i === 0 ? themeId : voucherId,
      item_category: i === 0 ? 'theme' : 'voucher', spent_coins: 0,
      purchased_at: new Date(now.getTime() - (102 - i) * 1000), created_at: now, updated_at: now,
    })));
    server = createApp({ db }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    variables.baseUrl = `http://127.0.0.1:${server.address().port}`;
    console.log('Review target: disposable MongoDB; external AI disabled.');
    const cli = process.env.FITLIFE_POSTMAN_CLI || path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WindowsApps/postman.exe');
    const args = ['collection', 'run', path.resolve(__dirname, '../api/review-api.postman_collection.json'), '--no-report-events', '--timeout-request', '15000', '--timeout', '180000'];
    for (const [key, value] of Object.entries(variables)) args.push('--env-var', `${key}=${value}`);
    const child = spawn(cli, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { log += chunk; process.stdout.write(chunk); });
    const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    fs.writeFileSync(path.join(reportDir, 'postman-review-run.txt'), log);
    process.exitCode = exitCode || 0;
  } finally {
    if (server) { server.closeIdleConnections(); await new Promise(resolve => server.close(resolve)); }
    if (client) await client.close();
    if (replica) await replica.stop();
  }
}
main().catch(error => { console.error(`Review failed (${error.name}): ${error.message}`); process.exitCode = 1; });
