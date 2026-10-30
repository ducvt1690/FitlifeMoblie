'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadEnvFile } = require('node:process');
const { MongoClient } = require('mongodb');
const { migrateProfileBirthDate } = require('../migrations/profile-birth-date');

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => arg !== '--apply')) {
    throw new Error('Use db:profile:plan or db:profile:apply.');
  }
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) loadEnvFile(envPath);
  const uri = process.env.MONGODB_URI;
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri) || /[<>]/.test(uri)) {
    throw new Error('Set a real MONGODB_URI in backend/database/mongodb/.env.');
  }
  if (process.env.MONGODB_DB_NAME !== 'fitlife') throw new Error('MONGODB_DB_NAME must be fitlife.');
  const client = new MongoClient(uri, { appName: 'FitLifeProfileSchemaMigration', serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const report = await migrateProfileBirthDate(client.db('fitlife'), { apply: args.includes('--apply') });
    console.log(JSON.stringify(report, null, 2));
    if (report.issues.length) process.exitCode = 1;
  } finally { await client.close(); }
}

main().catch(error => {
  // Driver errors may contain a credential, URI or query: report only the type.
  console.error(`Profile schema migration failed (${error.name || 'Error'}). Check configuration, database access and schema plan.`);
  process.exitCode = 1;
});
