'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { BSON } = require('mongodb');
const { collections, references } = require('./schema');
const { initializeDatabase, verifyDatabase } = require('./database');

const V3_FIELDS = {
  users: ['revision'], sleep_logs: ['revision'], mood_logs: ['revision'], bmi_history: ['revision'],
  workout_templates: ['revision'], challenges: ['revision'], reward_items: ['revision'],
  workout_logs: ['assignment_id'],
  trainer_assignments: ['revision', 'connection_id', 'template_snapshot', 'snapshot_origin',
    'cancelled_at', 'cancelled_by', 'cancellation_reason'],
  user_challenges: ['revision', 'target_days_snapshot', 'reward_coins_snapshot', 'snapshot_origin', 'completed_at', 'rewarded_at'],
  purchases: ['item_title_snapshot'],
};
const V3_COLLECTIONS = ['trainer_connections', 'challenge_checkins', 'request_operations', 'admin_audit_logs', 'user_inventory'];
const auxiliary = (name) => V3_COLLECTIONS.includes(name) || /^__fitlife_v[12]_[a-z_]+$/.test(name)
  || ['__fitlife_migrations', 'archived_daily_quest_logs'].includes(name);
const digest = (value) => createHash('sha256').update(BSON.EJSON.stringify(value, { relaxed: false })).digest('hex');
async function snapshot(db) {
  const result = [];
  for (const meta of (await db.listCollections().toArray()).sort((a, b) => a.name.localeCompare(b.name))) {
    result.push({ name: meta.name, options: meta.options,
      indexes: await db.collection(meta.name).listIndexes().toArray(),
      documents: await db.collection(meta.name).find().sort({ _id: 1 }).toArray() });
  }
  return result;
}
const strip = (name, row) => Object.fromEntries(Object.entries(row).filter(([field]) => !(V3_FIELDS[name] || []).includes(field)));

async function planSimplification(db) {
  if (db.databaseName !== 'fitlife') throw new Error('Simplification only accepts the fitlife database.');
  const original = await snapshot(db);
  const source = new Map(original.map((entry) => [entry.name, entry]));
  const issues = [];
  const target = {};
  for (const def of collections) {
    if (!source.has(def.name)) { issues.push(`Missing core collection: ${def.name}`); continue; }
    const allowed = new Set(Object.keys(def.validator.$jsonSchema.properties));
    target[def.name] = source.get(def.name).documents.map((row) => strip(def.name, row));
    if (target[def.name].some((row) => Object.keys(row).some((field) => !allowed.has(field)))) {
      issues.push(`Unknown fields require manual review: ${def.name}`);
    }
  }
  for (const entry of original) {
    if (collections.some((def) => def.name === entry.name) || entry.name === 'auth_sessions') continue;
    if (!auxiliary(entry.name)) issues.push(`Unexpected collection: ${entry.name}`);
    if (V3_COLLECTIONS.includes(entry.name) && entry.name !== 'user_inventory' && entry.documents.length) {
      issues.push(`V3 collection has real activity; map it before removing: ${entry.name}`);
    }
  }
  const purchases = new Map((target.purchases || []).map((row) => [row.purchase_id, row]));
  for (const row of source.get('user_inventory')?.documents || []) {
    const purchase = purchases.get(row.purchase_id);
    if (row.status !== 'owned' || !purchase || purchase.user_id !== row.user_id
      || purchase.item_id !== row.item_id || purchase.item_category !== row.item_category) {
      issues.push('Inventory contains usage state or ownership without a matching purchase; review before removing.');
    }
  }
  for (const ref of references) {
    const keys = new Set((target[ref.to] || []).map((row) => row[ref.target]));
    if ((target[ref.from] || []).some((row) => !keys.has(row[ref.field]))) issues.push(`Orphan reference: ${ref.from}.${ref.field}`);
  }
  return { original, target, issues: [...new Set(issues)],
    removeCollections: original.filter((entry) => auxiliary(entry.name)).map((entry) => entry.name),
    retainedDocuments: Object.values(target).reduce((sum, rows) => sum + rows.length, 0),
    removedFieldValues: original.reduce((sum, entry) => sum + entry.documents.reduce((total, row) => total
      + (V3_FIELDS[entry.name] || []).filter((field) => Object.hasOwn(row, field)).length, 0), 0) };
}

async function simplifyDatabase(db, client, { apply = false, backupDirectory, deleteDemo = false } = {}) {
  const plan = await planSimplification(db);
  const report = { database: 'fitlife', applied: false, issues: plan.issues,
    coreCollections: collections.length, removeCollections: plan.removeCollections,
    retainedDocuments: plan.retainedDocuments, removedFieldValues: plan.removedFieldValues };
  if (!apply || plan.issues.length) return report;
  if (!backupDirectory || !path.isAbsolute(backupDirectory)) throw new Error('An absolute local backup directory is required.');
  const backup = path.join(backupDirectory, new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID());
  fs.mkdirSync(backup, { recursive: true });
  const databaseNames = (await client.db('admin').admin().listDatabases({ nameOnly: true })).databases.map((entry) => entry.name);
  const demo = deleteDemo && databaseNames.includes('fitlife_demo') ? await snapshot(client.db('fitlife_demo')) : null;
  function save(name, contents) {
    const file = path.join(backup, `${name}.ejson`);
    const encoded = BSON.EJSON.stringify(contents, { relaxed: false });
    fs.writeFileSync(file, encoded, { flag: 'wx', mode: 0o600 });
    // Round-trip and verify BSON types, document values, validators and indexes.
    const decoded = BSON.EJSON.parse(fs.readFileSync(file, 'utf8'), { relaxed: true });
    if (digest(decoded) !== digest(contents)) throw new Error('Local backup verification failed. No deletion performed.');
    return { filename: path.basename(file), sha256: digest(contents) };
  }
  const backups = [save('fitlife', plan.original)];
  if (demo) backups.push(save('fitlife_demo', demo));
  fs.writeFileSync(path.join(backup, 'manifest.json'), JSON.stringify({ database: 'fitlife', backups, createdAt: new Date().toISOString() }, null, 2));
  // Stop writers for this operation. Reject changes since the captured snapshot.
  if (digest(await snapshot(db)) !== digest(plan.original)) throw new Error('Database changed during backup. Retry with writers stopped.');
  // Validate every target document/index in temporary collections before modifying live data.
  const staged = [];
  try {
    for (const def of collections) {
      const name = `__fitlife_compact_check_${randomUUID().replaceAll('-', '')}`;
      await db.createCollection(name, { validator: def.validator, validationLevel: 'strict', validationAction: 'error' });
      staged.push(name); await db.collection(name).createIndexes(def.indexes);
      if (plan.target[def.name].length) await db.collection(name).insertMany(plan.target[def.name]);
    }
  } finally { for (const name of staged) await db.collection(name).drop(); }
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const def of collections) {
        const source = plan.original.find((entry) => entry.name === def.name).documents;
        const current = await db.collection(def.name).find({}, { session }).sort({ _id: 1 }).toArray();
        if (!isDeepStrictEqual(current, source)) throw new Error(`Concurrent writer: ${def.name}. No data committed.`);
        const unset = Object.fromEntries((V3_FIELDS[def.name] || []).map((field) => [field, '']));
        if (Object.keys(unset).length) await db.collection(def.name).updateMany({}, { $unset: unset }, { session });
      }
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally { await session.endSession(); }
  // Validator/index DDL follows the transaction. Full local backup survives failures.
  await initializeDatabase(db, { migrating: true });
  for (const [name, index] of [['workout_logs', 'uq_workout_assignment'], ['purchases', 'uq_user_theme']]) {
    if ((await db.collection(name).listIndexes().toArray()).some((entry) => entry.name === index)) await db.collection(name).dropIndex(index);
  }
  const audit = await verifyDatabase(db);
  if (!audit.ok) throw new Error(`Target audit failed; local backup retained: ${audit.issues.join('; ')}`);
  for (const def of collections) {
    const current = await db.collection(def.name).find().sort({ _id: 1 }).toArray();
    if (!isDeepStrictEqual(current, plan.target[def.name])) throw new Error(`Preservation check failed: ${def.name}`);
  }
  // Remove only named, snapshotted auxiliaries; abort if any gained new data.
  for (const name of plan.removeCollections) {
    const before = plan.original.find((entry) => entry.name === name);
    const current = await db.collection(name).find().sort({ _id: 1 }).toArray();
    if (digest(current) !== digest(before.documents)) throw new Error(`Auxiliary changed: ${name}. Not deleted.`);
    await db.collection(name).drop();
  }
  if (demo) {
    if (digest(await snapshot(client.db('fitlife_demo'))) !== digest(demo)) throw new Error('Demo changed since backup. Not deleted.');
    await client.db('fitlife_demo').dropDatabase();
  }
  const names = (await db.listCollections().toArray()).map((entry) => entry.name).sort();
  const allowed = new Set([...collections.map((entry) => entry.name), 'auth_sessions']);
  if (names.some((name) => !allowed.has(name))) throw new Error('Unexpected collections remain after simplification.');
  const result = { ...report, applied: true, backupDirectory: backup, audit,
    deletedDemoDatabase: !!demo, visibleCollections: names, preservedCoreDocuments: plan.retainedDocuments };
  fs.writeFileSync(path.join(backup, 'result.json'), JSON.stringify(result, null, 2));
  return result;
}
module.exports = { V3_FIELDS, planSimplification, simplifyDatabase };
