'use strict';

// Explicit test harness. Never opens configured Atlas or replaces the real API.
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { initializeDatabase } = require('../database/mongodb/database');
const { initializeAuthSessions } = require('../database/connection');
const { seedCatalogs } = require('../database/mongodb/seed');
const { createAuthService } = require('../services/auth.service');
const { createApp } = require('../app');

async function main() {
  let replica, client, server;
  const metadataPath = path.resolve(__dirname, '../../output/integration-runtime.local.json');
  try {
    replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
    client = new MongoClient(replica.getUri());
    await client.connect();
    const db = client.db('fitlife_integration_test');
    await initializeDatabase(db);
    await initializeAuthSessions(db);
    await seedCatalogs(db);
    const password = `Test-${randomBytes(12).toString('hex')}`;
    const accounts = {};
    const auth = createAuthService({ db });
    for (const role of ['user', 'trainer', 'admin']) {
      const body = { email: `${role}@fitlife.example`, password, confirm_password: password, full_name: `Integration ${role}`,
        gender: 'male', age: 28, height: 175, weight: 72, activity_level: 'moderate', goal: 'maintain', timezone: 'Asia/Ho_Chi_Minh' };
      const registered = await auth.register(await require('../test/verified-registration')(db, body));
      if (role !== 'user') await db.collection('users').updateOne({ user_id: registered.user.user_id }, { $set: { role } });
      accounts[role] = { email: body.email, password, user_id: registered.user.user_id };
    }
    const port = Number(process.env.FITLIFE_TEST_API_PORT || 5500);
    server = createApp({ db, corsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8081', 'http://127.0.0.1:8081'] }).listen(port, '0.0.0.0');
    await once(server, 'listening');
    fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
    fs.writeFileSync(metadataPath, JSON.stringify({ apiUrl: `http://127.0.0.1:${port}`, database: db.databaseName, uri: replica.getUri(), accounts }, null, 2));
    console.log(`Integration API ready: http://localhost:${port}. Test credentials: output/integration-runtime.local.json (disposable only).`);
    await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (client) await client.close();
    if (replica) await replica.stop();
    if (fs.existsSync(metadataPath)) fs.unlinkSync(metadataPath);
  }
}
main().catch(error => { console.error(`Integration API failed: ${error.name}: ${error.message}`); process.exitCode = 1; });
