'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const { MongoClient } = require('mongodb');
const { createApp } = require('../app');
const { initializeDatabase } = require('../database/mongodb/database');
const { initializeAuthSessions } = require('../database/connection');

async function main() {
  const atlas = process.argv.includes('--atlas');
  if (atlas) {
    console.error('Atlas registration now requires email verification. Use api/registration.postman_collection.json with Gmail SMTP; automatic mailbox fixtures are allowed only on disposable local MongoDB.');
    process.exitCode = 1;
    return;
  }
  const desktop = process.argv.includes('--desktop');
  const runTag = randomUUID().slice(0, 8);
  let replica, client, db, server, mailbox;
  const reportDir = path.resolve(__dirname, '../postman');
  fs.mkdirSync(reportDir, { recursive: true });
  try {
    {
      const { MongoMemoryReplSet } = require('mongodb-memory-server');
      replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
      client = new MongoClient(replica.getUri()); await client.connect();
      db = client.db('fitlife_postman_test');
      await initializeDatabase(db); await initializeAuthSessions(db);
      // These fixtures establish routing/pagination. They do not claim to verify
      // the live ExerciseDB catalog or its media availability.
      const now = new Date();
      await db.collection('exercises').insertMany(['A01', 'B02', 'c03'].map((id, index) => ({
        exercise_id: randomUUID(), source: 'exercisedb_v1', source_exercise_id: id,
        name: 'exercise fixture ' + index, name_vi: 'Bài tập kiểm thử ' + index,
        gif_url: 'https://static.exercisedb.dev/media/01qpYSe.gif', body_parts: ['back'],
        equipments: ['bodyweight'], target_muscles: ['abdominals'], secondary_muscles: [],
        instructions: ['Test fixture'], is_active: true, synced_at: now, created_at: now, updated_at: now,
      })));
    }
    mailbox = await require('./postman-test-mailbox').startTestMailbox();
    server = createApp({ db, mailer: mailbox.mailer, logger: { error: name => console.error(name) } })
      .listen(desktop ? 5000 : 0, '127.0.0.1');
    await Promise.race([once(server, 'listening'), once(server, 'error').then(([error]) => Promise.reject(error))]);
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const collection = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../api/all-api.postman_collection.json'), 'utf8'));
    collection.info.name = 'FitLife — API + Email OTP (local test)';
    collection.variable = [
      { key: 'baseUrl', value: baseUrl, type: 'string' },
      { key: 'testMailboxUrl', value: mailbox.url, type: 'string' },
      { key: 'testMailboxKey', value: mailbox.key, type: 'string' },
    ];
    const localCollection = path.join(reportDir, 'local-email-otp.postman_collection.json');
    fs.writeFileSync(localCollection, JSON.stringify(collection, null, 2));
    console.log(`Postman target: ${baseUrl}; database: disposable MongoDB with catalog fixtures`);
    if (desktop) {
      console.log(`Desktop test server ready. Import ${localCollection}. Email is captured in a disposable test mailbox, not sent via Gmail. Ctrl+C stops this test server.`);
      await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
      return;
    }
    const cli = process.env.FITLIFE_POSTMAN_CLI || path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WindowsApps/postman.exe');
    const child = spawn(cli, ['collection', 'run', localCollection,
      '--env-var', `baseUrl=${baseUrl}`, '--env-var', `fitlifeRunTag=${runTag}`,
      '--no-report-events', '--timeout-request', '15000', '--timeout', '180000'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { log += chunk; process.stdout.write(chunk); });
    const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    fs.writeFileSync(path.join(reportDir, 'all-api-local-run.txt'), log);
    process.exitCode = exitCode || 0;
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mailbox) await mailbox.close();
    if (client) await client.close();
    if (replica) await replica.stop();
  }
}
main().catch(error => { console.error(`Postman regression failed (${error.name}).`); process.exitCode = 1; });
