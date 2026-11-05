'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { loadEnvFile } = require('node:process');
const { MongoClient } = require('mongodb');
const { migrateFitnessPlatform } = require('../migrations/fitness-platform');
async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => a !== '--apply') || args.length > 1) throw new Error('Use db:fitness:plan or db:fitness:apply.');
  // Use the database-specific environment when present, then fill missing values
  // from the same backend environment used by server.js. Existing process values win.
  for (const envFile of [path.resolve(__dirname, '..', '.env'), path.resolve(__dirname, '..', '..', '..', '.env')]) {
    if (fs.existsSync(envFile)) loadEnvFile(envFile);
  }
  if (!process.env.MONGODB_URI || !/^mongodb(?:\+srv)?:\/\//.test(process.env.MONGODB_URI)) throw new Error('Set MONGODB_URI.');
  if (process.env.MONGODB_DB_NAME !== 'fitlife') throw new Error('MONGODB_DB_NAME must be fitlife.');
  const client = new MongoClient(process.env.MONGODB_URI, { appName: 'FitLifeAdditiveSchemaMigration', serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const result = await migrateFitnessPlatform(client.db('fitlife'), { apply: args.includes('--apply') });
    console.log(JSON.stringify(result, null, 2));
    if (result.issues.length) process.exitCode = 1;
  } finally { await client.close(); }
}
main().catch(error => { console.error(`Fitness migration failed (${error.name || 'Error'}). Review the plan and database access.`); process.exitCode = 1; });
