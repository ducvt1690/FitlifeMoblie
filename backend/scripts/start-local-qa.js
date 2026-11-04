'use strict';

// Uses a disposable replica set only. Never reads .env or accepts an Atlas URI.
const {
  MongoMemoryReplSet
} = require('mongodb-memory-server');
const {
  MongoClient
} = require('mongodb');
const {
  randomUUID
} = require('node:crypto');
const {
  createApp
} = require('../app');
const {
  initializeDatabase
} = require('../database/mongodb/database');
const {
  initializeAuthSessions
} = require('../database/connection');
const {
  seedCatalogs
} = require('../database/mongodb/seed');
const {
  createAuthService
} = require('../services/auth.service');
async function start() {
  let replica,
    client,
    server,
    stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    if (server) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    if (client) await client.close();
    if (replica) await replica.stop();
  }
  try {
    const port = Number(process.env.FITLIFE_QA_PORT || 5500);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('FITLIFE_QA_PORT must be 1024–65535.');
    replica = await MongoMemoryReplSet.create({
      binary: {
        version: '8.2.6'
      },
      replSet: {
        count: 1
      }
    });
    client = await new MongoClient(replica.getUri()).connect();
    const db = client.db('fitlife_local_qa');
    await initializeDatabase(db);
    await initializeAuthSessions(db);
    await seedCatalogs(db);
    const now = new Date();
    await db.collection('exercises').insertMany(['A01', 'B02', 'C03'].map((id, i) => ({
      exercise_id: randomUUID(),
      source: 'exercisedb_v1',
      source_exercise_id: id,
      name: 'QA exercise ' + i,
      name_vi: 'Bài tập kiểm thử ' + i,
      gif_url: 'https://static.exercisedb.dev/media/01qpYSe.gif',
      body_parts: ['back'],
      equipments: ['bodyweight'],
      target_muscles: ['abdominals'],
      secondary_muscles: [],
      instructions: ['Exercise fixture for local QA only.'],
      is_active: true,
      synced_at: now,
      created_at: now,
      updated_at: now
    })));
    for (const role of ['user', 'trainer', 'admin']) {
      await createAuthService({
        db
      }).register({
        email: role + '@merge.example',
        password: 'Merge-smoke-test-2026!',
        full_name: 'Local QA ' + role,
        gender: 'male',
        age: 25,
        height: 170,
        weight: 65,
        activity_level: 'moderate',
        goal: 'maintain'
      });
      if (role !== 'user') await db.collection('users').updateOne({
        email: role + '@merge.example'
      }, {
        $set: {
          role
        }
      });
    }
    const origins = ['http://127.0.0.1:5175', 'http://localhost:5175', 'http://127.0.0.1:8085', 'http://localhost:8085'];
    server = await new Promise((resolve, reject) => {
      const s = createApp({
        db,
        corsOrigins: origins
      }).listen(port, '127.0.0.1', () => resolve(s));
      s.once('error', reject);
    });
    console.log(`Local QA API http://127.0.0.1:${port}; disposable MongoDB; external AI disabled.`);
    console.log('Synthetic accounts: user@merge.example, trainer@merge.example, admin@merge.example; password: Merge-smoke-test-2026!');
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop().catch(() => {
      process.exitCode = 1;
    }));
    return {
      db,
      server,
      stop
    };
  } catch (error) {
    await stop();
    throw error;
  }
}
if (require.main === module) start().catch(error => {
  console.error('Local QA startup failed:', error.message);
  process.exitCode = 1;
});
module.exports = {
  start
};
