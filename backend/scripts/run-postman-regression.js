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
  const desktop = process.argv.includes('--desktop');
  const runTag = randomUUID().slice(0, 8);
  let replica, client, db, server;
  const reportDir = path.resolve(__dirname, '../postman');
  fs.mkdirSync(reportDir, { recursive: true });
  try {
    if (atlas) {
      const { loadConfig } = require('../config');
      const config = loadConfig();
      client = new MongoClient(config.uri, { serverSelectionTimeoutMS: 15000 });
      await client.connect(); db = client.db(config.databaseName);
      await db.command({ ping: 1 });
    } else {
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
    server = createApp({ db, logger: { error: name => console.error(name) } }).listen(desktop ? 5000 : 0, '127.0.0.1');
    await Promise.race([once(server, 'listening'), once(server, 'error').then(([error]) => Promise.reject(error))]);
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    console.log(`Postman target: ${baseUrl}; database: ${atlas ? 'MongoDB Atlas fitlife' : 'disposable MongoDB with catalog fixtures'}`);
    if (desktop) {
      console.log('Desktop test server ready. Run FitLife — ALL API (Run all). Ctrl+C stops this test server.');
      await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
      return;
    }
    const cli = process.env.FITLIFE_POSTMAN_CLI || path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WindowsApps/postman.exe');
    const child = spawn(cli, ['collection', 'run', path.resolve(__dirname, '../api/all-api.postman_collection.json'),
      '--env-var', `baseUrl=${baseUrl}`, '--env-var', `fitlifeRunTag=${runTag}`,
      '--no-report-events', '--timeout-request', '15000', '--timeout', '180000'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { log += chunk; process.stdout.write(chunk); });
    const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    fs.writeFileSync(path.join(reportDir, atlas ? 'all-api-atlas-run.txt' : 'all-api-local-run.txt'), log);
    process.exitCode = exitCode || 0;
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (atlas && db) {
      // Only remove users created with this invocation's unique run marker.
      const rows = await db.collection('users').find({ email: { $regex: '^postman-all-' + runTag + '-' } }, { projection: { user_id: 1 } }).toArray();
      for (const row of rows) {
        const session = client.startSession();
        try { await session.withTransaction(async () => {
          for (const name of ['water_logs', 'workout_logs', 'meal_logs', 'daily_quest_logs', 'auth_sessions', 'users']) {
            await db.collection(name).deleteMany({ user_id: row.user_id }, { session });
          }
        }); } finally { await session.endSession(); }
      }
      console.log(`Cleaned ${rows.length} test accounts from this run.`);
    }
    if (client) await client.close();
    if (replica) await replica.stop();
  }
}
main().catch(error => { console.error(`Postman regression failed (${error.name}).`); process.exitCode = 1; });
