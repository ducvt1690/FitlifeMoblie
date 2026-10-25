'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadEnvFile } = require('node:process');
const { MongoClient } = require('mongodb');
const { initializeDatabase, verifyDatabase } = require('../database');
const { seedCatalogs, seedDemo, DEMO_EMAIL } = require('../seed');

async function main() {
  const command = process.argv[2];
  if (!['init', 'seed', 'demo', 'verify'].includes(command)) {
    throw new Error('Use npm run db:init, db:seed, db:seed:demo or db:verify.');
  }
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) loadEnvFile(envPath);
  const uri = process.env.MONGODB_URI;
  const name = process.env.MONGODB_DB_NAME;
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri) || /[<>]/.test(uri)) {
    throw new Error('Set a real MONGODB_URI in backend/database/mongodb/.env.');
  }
  if (!name || !/^[a-zA-Z0-9_-]{1,63}$/.test(name) || ['admin', 'config', 'local'].includes(name)) {
    throw new Error('Set MONGODB_DB_NAME to an application database name, for example fitlife.');
  }
  // Do not log URI, database passwords, or document contents.
  const client = new MongoClient(uri, { appName: 'FitLifeDatabaseSetup', serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const db = client.db(name);
    await db.command({ ping: 1 });
    if (command === 'init') {
      await initializeDatabase(db);
      console.log(`Schema and indexes ready: ${name} (13 collections).`);
    } else if (command === 'seed') {
      await seedCatalogs(db);
      console.log('Catalog seed ready: 6 reward items, 3 challenges. Existing entries preserved.');
    } else if (command === 'demo') {
      const created = await seedDemo(db, client, process.env.FITLIFE_DEMO_PASSWORD);
      console.log(created ? `Demo data created: ${DEMO_EMAIL}.` : 'Demo already exists; no changes made.');
    } else {
      const report = await verifyDatabase(db);
      for (const [collection, count] of Object.entries(report.counts)) console.log(`${collection}: ${count}`);
      if (!report.ok) {
        for (const issue of report.issues) console.error(issue);
        process.exitCode = 1;
      } else {
        console.log('PASS: schemas, indexes, documents and references.');
      }
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  let message = String(error.message || error);
  if (process.env.MONGODB_URI) message = message.split(process.env.MONGODB_URI).join('[REDACTED_URI]');
  message = message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[REDACTED_URI]');
  if (process.env.FITLIFE_DEMO_PASSWORD) message = message.split(process.env.FITLIFE_DEMO_PASSWORD).join('[REDACTED_PASSWORD]');
  console.error(`Database operation failed: ${message}`);
  process.exitCode = 1;
});
