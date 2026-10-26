'use strict';

const { isDeepStrictEqual } = require('node:util');
const { collections, references, QUEST_KEYS } = require('../schema');
const { demoId, localDate } = require('../seed');
const { initializeDatabase, verifyDatabase } = require('../database');
const catalogs = require('../data/catalogs.json');

const MIGRATION_ID = 'v2_roles_trainer_sessions';
const JOURNAL = '__fitlife_migrations';
const backupName = (name) => `__fitlife_v1_${name}`;
const checkName = (name) => `__fitlife_v2_check_${name}`;

// Recalculate stored values for the v1->v2 data conversion only.
// Application onboarding/profile logic is intentionally outside this package.
function migratedTargets(profile, hasWorkout) {
  const factors = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
  const offsets = { lose: -500, maintain: 0, gain: 400 };
  const { gender, age, height, weight, activity_level, goal } = profile;
  if (!['male', 'female'].includes(gender) || !Number.isInteger(age) || age < 5 || age > 100
    || !Number.isFinite(height) || height < 80 || height > 250
    || !Number.isFinite(weight) || weight < 25 || weight > 300
    || !Object.hasOwn(factors, activity_level) || !Object.hasOwn(offsets, goal)) {
    throw new Error('Invalid legacy profile for target migration.');
  }
  const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
  return {
    target_water: Math.round(Math.min(weight * 35, 4000)) + (hasWorkout ? 350 : 0),
    target_calories: Math.max(gender === 'female' ? 1200 : 1500,
      Math.round(bmr * factors[activity_level] + offsets[goal])),
  };
}

async function planMigration(db, now = new Date()) {
  const metadata = await db.listCollections().toArray();
  const present = new Set(metadata.map((entry) => entry.name));
  const journal = present.has(JOURNAL) ? await db.collection(JOURNAL).findOne({ _id: MIGRATION_ID }) : null;
  if (journal?.status === 'complete') return { alreadyApplied: true, issues: [], summary: {} };
  if (journal) throw new Error('An unfinished migration journal exists. Inspect it before retrying; backups are preserved.');
  const documents = {};
  const originals = {};
  for (const definition of collections) {
    const rows = present.has(definition.name) ? await db.collection(definition.name).find().toArray() : [];
    originals[definition.name] = rows;
    documents[definition.name] = rows.map((row) => ({ ...row }));
  }
  const users = new Map(documents.users.map((user) => [user.user_id, user]));
  const issues = [];
  const archive = [];
  for (const user of documents.users) {
    const before = { ...user };
    user.role ??= 'user';
    user.is_active ??= true;
    user.timezone ||= 'Asia/Ho_Chi_Minh';
    try {
      const date = localDate(now, user.timezone);
      const workoutToday = documents.workout_logs.some((row) => row.user_id === user.user_id && row.workout_date === date);
      Object.assign(user, migratedTargets(user, workoutToday));
    } catch { issues.push(`Cannot calculate targets/timezone for user ${user.user_id}`); }
    if (!isDeepStrictEqual(before, user)) user.updated_at = now;
    // Historical coins and streak counters are preserved; no retroactive rewards.
  }
  documents.daily_quest_logs = documents.daily_quest_logs.filter((quest) => {
    if (['q_weight', 'q_bowel'].includes(quest.quest_key)) {
      archive.push({ ...quest, migration_id: MIGRATION_ID, archived_at: now });
      return false;
    }
    if (quest.quest_key === 'q_meals') { quest.quest_key = 'q_meal'; quest.updated_at = now; }
    if (!QUEST_KEYS.includes(quest.quest_key)) issues.push(`Unknown legacy quest ${quest.quest_log_id}`);
    if (quest.reward_coins !== 10) issues.push(`Non-standard reward for quest ${quest.quest_log_id}; manual review required`);
    return true;
  });
  for (const user of documents.users.filter((entry) => entry.role === 'user')) {
    let date;
    try { date = localDate(now, user.timezone); } catch { continue; }
    for (const template of catalogs.quest_templates) {
      if (!documents.daily_quest_logs.some((quest) => quest.user_id === user.user_id
        && quest.quest_date === date && quest.quest_key === template.quest_key)) {
        documents.daily_quest_logs.push({
          quest_log_id: demoId(`migration-v2:${user.user_id}:${date}:${template.quest_key}`),
          user_id: user.user_id, ...template, quest_date: date, is_completed: false,
          completed_at: null, extra_value: '', created_at: now, updated_at: now,
        });
      }
    }
  }
  const sessions = new Map(documents.ai_chat_sessions.map((entry) => [entry.session_id, entry]));
  for (const message of documents.ai_chat_messages) {
    if (message.session_id) continue;
    message.session_id = demoId(`legacy-chat:${message.user_id}`);
    let session = sessions.get(message.session_id);
    if (!session) {
      session = { session_id: message.session_id, user_id: message.user_id, title: 'Hội thoại từ database v1',
        created_at: message.created_at, updated_at: message.updated_at };
      sessions.set(session.session_id, session);
    }
    if (message.created_at < session.created_at) session.created_at = message.created_at;
    if (message.updated_at > session.updated_at) session.updated_at = message.updated_at;
  }
  documents.ai_chat_sessions = [...sessions.values()];

  // Detect all new uniqueness conflicts without deleting/merging user history.
  for (const definition of collections) {
    for (const index of definition.indexes.filter((entry) => entry.unique)) {
      const seen = new Set();
      for (const row of documents[definition.name]) {
        if (index.partialFilterExpression
          && !Object.entries(index.partialFilterExpression).every(([key, value]) => row[key] === value)) continue;
        const key = JSON.stringify(Object.keys(index.key).map((field) => row[field]));
        if (seen.has(key)) issues.push(`Duplicate documents prevent index ${definition.name}.${index.name}`);
        seen.add(key);
      }
    }
    for (const row of documents[definition.name]) {
      if (definition.name !== 'users' && row.user_id && !users.has(row.user_id)) {
        issues.push(`Orphan user reference in ${definition.name}`);
      }
    }
  }
  for (const reference of references) {
    const targets = new Set(documents[reference.to].map((row) => row[reference.target]));
    if (documents[reference.from].some((row) => !targets.has(row[reference.field]))) {
      issues.push(`Missing reference ${reference.from}.${reference.field}`);
    }
  }
  const templates = new Map(documents.workout_templates.map((row) => [row.template_id, row]));
  const items = new Map(documents.reward_items.map((row) => [row.item_id, row]));
  if (documents.workout_templates.some((row) => users.get(row.trainer_id)?.role !== 'trainer')) {
    issues.push('Template owner must be a trainer');
  }
  if (documents.trainer_assignments.some((row) => users.get(row.trainer_id)?.role !== 'trainer'
    || users.get(row.user_id)?.role !== 'user' || templates.get(row.template_id)?.trainer_id !== row.trainer_id)) {
    issues.push('Assignment role or template ownership mismatch');
  }
  if (documents.ai_chat_messages.some((row) => sessions.get(row.session_id)?.user_id !== row.user_id)) {
    issues.push('Chat session ownership mismatch');
  }
  if (documents.purchases.some((row) => items.get(row.item_id)?.category !== row.item_category)) {
    issues.push('Purchase category mismatch');
  }
  const summary = Object.fromEntries(collections.map((entry) => [entry.name, {
    before: originals[entry.name].length, after: documents[entry.name].length,
    changed: documents[entry.name].filter((row) => !isDeepStrictEqual(row,
      originals[entry.name].find((old) => old[entry.id] === row[entry.id]))).length,
  }]));
  return { alreadyApplied: false, issues: [...new Set(issues)], summary, archive,
    documents, originals, metadata: metadata.filter((entry) => collections.some((def) => def.name === entry.name)) };
}

async function migrateDatabase(db, client, { apply = false, now = new Date() } = {}) {
  const plan = await planMigration(db, now);
  const report = { alreadyApplied: plan.alreadyApplied, issues: plan.issues, summary: plan.summary,
    archivedQuests: plan.archive?.length || 0, applied: false };
  if (plan.alreadyApplied || !apply || plan.issues.length) return report;

  // Validate transformed documents and new unique indexes in isolated temporary
  // collections before touching existing schemas or data.
  const temporary = [];
  const existingNames = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((entry) => entry.name));
  for (const definition of collections) {
    if (existingNames.has(checkName(definition.name)) || existingNames.has(backupName(definition.name))) {
      throw new Error('Migration staging/backup name already exists. Review it; nothing was overwritten.');
    }
  }
  try {
    for (const definition of collections) {
      const name = checkName(definition.name);
      await db.createCollection(name, { validator: definition.validator, validationLevel: 'strict', validationAction: 'error' });
      temporary.push(name);
      await db.collection(name).createIndexes(definition.indexes);
      if (plan.documents[definition.name].length) await db.collection(name).insertMany(plan.documents[definition.name]);
    }
  } finally {
    for (const name of temporary) await db.collection(name).drop();
  }

  // Maintenance window required: callers must stop API/sync writers for migration.
  // Preserve original documents plus validators/index metadata before all updates.
  const savedMetadata = [];
  for (const metadata of plan.metadata) {
    const indexes = await db.collection(metadata.name).listIndexes().toArray();
    savedMetadata.push({ name: metadata.name, options: metadata.options, indexes });
    await db.createCollection(backupName(metadata.name));
    const rows = plan.originals[metadata.name];
    if (rows.length) await db.collection(backupName(metadata.name)).insertMany(rows);
  }
  await db.collection(JOURNAL).insertOne({ _id: MIGRATION_ID, status: 'backed_up',
    created_at: now, backup_prefix: '__fitlife_v1_', metadata: savedMetadata });
  for (const definition of collections) {
    if (!existingNames.has(definition.name)) await db.createCollection(definition.name);
  }
  if (!existingNames.has('archived_daily_quest_logs')) await db.createCollection('archived_daily_quest_logs');
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const definition of collections) {
        for (const document of plan.documents[definition.name]) {
          await db.collection(definition.name).replaceOne({ [definition.id]: document[definition.id] }, document,
            { upsert: true, session, bypassDocumentValidation: true });
        }
      }
      for (const quest of plan.archive) {
        await db.collection('archived_daily_quest_logs').insertOne(quest, { session });
        await db.collection('daily_quest_logs').deleteOne({ quest_log_id: quest.quest_log_id }, { session });
      }
      await db.collection(JOURNAL).updateOne({ _id: MIGRATION_ID }, { $set: { status: 'data_migrated' } }, { session });
    });
  } finally { await session.endSession(); }

  // Only this explicitly superseded index is removed. Other extra indexes survive.
  if ((await db.collection('user_challenges').listIndexes().toArray()).some((entry) => entry.name === 'uq_user_challenge')) {
    await db.collection('user_challenges').dropIndex('uq_user_challenge');
  }
  await initializeDatabase(db, { migrating: true });
  const audit = await verifyDatabase(db);
  if (!audit.ok) throw new Error(`Migration audit failed: ${audit.issues.join('; ')}. Original backups are preserved.`);
  await db.collection(JOURNAL).updateOne({ _id: MIGRATION_ID }, { $set: { status: 'complete', completed_at: new Date() } });
  return { ...report, applied: true, audit };
}

module.exports = { planMigration, migrateDatabase, MIGRATION_ID, JOURNAL, backupName };
