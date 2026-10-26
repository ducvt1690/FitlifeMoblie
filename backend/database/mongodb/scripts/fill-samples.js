'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadEnvFile } = require('node:process');
const { MongoClient } = require('mongodb');
const { verifyDatabase } = require('../database');
const { collections } = require('../schema');
const { planSampleData, applySampleData } = require('../sample-data');

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--apply'].includes(arg))) throw new Error('Usage: node scripts/fill-samples.js [--apply]');
  loadEnvFile(path.resolve(__dirname, '..', '.env'));
  const database = process.env.MONGODB_DB_NAME;
  if (!['fitlife', 'fitlife_demo'].includes(database)) throw new Error('Expected fitlife or fitlife_demo database.');
  const client = new MongoClient(process.env.MONGODB_URI, {
    appName: 'FitLifeCompassSampleData', serverSelectionTimeoutMS: 15000,
  });
  try {
    await client.connect();
    const db = client.db(database);
    const before = await verifyDatabase(db);
    if (!before.ok) throw new Error(`Existing database audit failed: ${before.issues.join('; ')}`);
    const plan = await planSampleData(db, process.env.FITLIFE_DEMO_PASSWORD);
    const report = { database, version: plan.version, fixtureDate: plan.fixtureDate,
      applied: false, beforeCounts: plan.beforeCounts, afterCounts: plan.afterCounts,
      additions: Object.fromEntries(collections.map(({ name }) => [name, plan.documents[name]?.length || 0])),
      insertedIds: Object.fromEntries(collections.map(({ name, id }) => [name,
        (plan.documents[name] || []).map((row) => row[id])])),
    };
    if (args.includes('--apply')) {
      const directory = path.resolve(__dirname, '..', '.tools', 'sample-data-reports');
      fs.mkdirSync(directory, { recursive: true });
      const filename = path.join(directory, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      // No URI, credentials, hashes or message contents are written to the report.
      fs.writeFileSync(filename, JSON.stringify(report, null, 2));
      await applySampleData(db, client, plan);
      const after = await verifyDatabase(db);
      report.applied = true;
      report.audit = { ok: after.ok, counts: after.counts, issues: after.issues };
      fs.writeFileSync(filename, JSON.stringify(report, null, 2));
      if (!after.ok) throw new Error(`Post-insert audit failed: ${after.issues.join('; ')}`);
    }
    console.log(JSON.stringify({ ...report, insertedIds: undefined }, null, 2));
  } finally { await client.close(); }
}

main().catch((error) => {
  let message = String(error.message || error);
  for (const value of [process.env.MONGODB_URI, process.env.FITLIFE_DEMO_PASSWORD]) {
    if (value) message = message.split(value).join('[REDACTED]');
  }
  console.error(message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[REDACTED_URI]'));
  process.exitCode = 1;
});
