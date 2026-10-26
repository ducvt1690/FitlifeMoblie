'use strict';

const { isDeepStrictEqual } = require('node:util');
const { collections, references } = require('./schema');

async function initializeDatabase(db, { migrating = false } = {}) {
  const metadata = await db.listCollections().toArray();
  const existing = new Set(metadata.map((c) => c.name));
  // Never tighten an existing populated schema before migrating its documents.
  if (!migrating) {
    for (const definition of collections) {
      const actual = metadata.find((entry) => entry.name === definition.name);
      if (!actual) continue;
      if (!isDeepStrictEqual(actual.options.validator, definition.validator)
        && await db.collection(definition.name).countDocuments({}, { limit: 1 })) {
        throw new Error(`Existing data needs migration: ${definition.name}. Run db:migrate:plan, then db:migrate.`);
      }
      if (definition.name === 'user_challenges'
        && (await db.collection(definition.name).listIndexes().toArray()).some((entry) => entry.name === 'uq_user_challenge')) {
        throw new Error('Legacy challenge index needs db:migrate before db:init.');
      }
    }
  }
  for (const definition of collections) {
    const { name, validator, validationLevel, validationAction, indexes } = definition;
    const options = { validator, validationLevel, validationAction };
    if (existing.has(name)) {
      await db.command({ collMod: name, ...options });
    } else {
      await db.createCollection(name, options);
    }
    // Existing conflicting data/indexes cause a visible error; never drop or repair silently.
    await db.collection(name).createIndexes(indexes);
  }
}

async function verifyDatabase(db) {
  const issues = [];
  const counts = {};
  const actualCollections = await db.listCollections().toArray();
  for (const definition of collections) {
    const actual = actualCollections.find((c) => c.name === definition.name);
    if (!actual) {
      issues.push(`Missing collection: ${definition.name}`);
      continue;
    }
    if (!isDeepStrictEqual(actual.options.validator, definition.validator)
      || actual.options.validationLevel !== 'strict' || actual.options.validationAction !== 'error') {
      issues.push(`Validator differs: ${definition.name}`);
    }
    const coll = db.collection(definition.name);
    counts[definition.name] = await coll.countDocuments();
    const invalid = await coll.countDocuments({ $nor: [definition.validator] });
    if (invalid) issues.push(`Invalid documents: ${definition.name} (${invalid})`);
    const actualIndexes = await coll.listIndexes().toArray();
    for (const expected of definition.indexes) {
      const found = actualIndexes.find((entry) => entry.name === expected.name);
      if (!found || !isDeepStrictEqual(found.key, expected.key)
        || Boolean(found.unique) !== Boolean(expected.unique)
        || !isDeepStrictEqual(found.partialFilterExpression, expected.partialFilterExpression)) {
        issues.push(`Missing or different index: ${definition.name}.${expected.name}`);
      }
    }
  }

  // MongoDB has no foreign keys. This audit detects orphans, without modifying data.
  const present = new Set(actualCollections.map((entry) => entry.name));
  for (const reference of references) {
    if (!present.has(reference.from) || !present.has(reference.to)) continue;
    const [result] = await db.collection(reference.from).aggregate([
      { $lookup: {
        from: reference.to, localField: reference.field, foreignField: reference.target, as: '_references',
      } },
      { $match: { '_references.0': { $exists: false } } },
      { $count: 'count' },
    ]).toArray();
    if (result) issues.push(`Orphan references: ${reference.from}.${reference.field} (${result.count})`);
  }
  if (present.has('purchases') && present.has('reward_items')) {
    const [mismatch] = await db.collection('purchases').aggregate([
      { $lookup: { from: 'reward_items', localField: 'item_id', foreignField: 'item_id', as: '_item' } },
      { $unwind: '$_item' },
      { $match: { $expr: { $ne: ['$item_category', '$_item.category'] } } },
      { $count: 'count' },
    ]).toArray();
    if (mismatch) issues.push(`Purchase category differs from catalog (${mismatch.count})`);
  }
  async function reportMismatch(name, pipeline, label) {
    if (!present.has(name)) return;
    const [result] = await db.collection(name).aggregate([...pipeline, { $count: 'count' }]).toArray();
    if (result) issues.push(`${label} (${result.count})`);
  }
  if (present.has('users')) {
    await reportMismatch('workout_templates', [
      { $lookup: { from: 'users', localField: 'trainer_id', foreignField: 'user_id', as: '_trainer' } },
      { $match: { '_trainer.0.role': { $ne: 'trainer' } } },
    ], 'Template owner must be a trainer');
    await reportMismatch('trainer_assignments', [
      { $lookup: { from: 'users', localField: 'trainer_id', foreignField: 'user_id', as: '_trainer' } },
      { $lookup: { from: 'users', localField: 'user_id', foreignField: 'user_id', as: '_user' } },
      { $lookup: { from: 'workout_templates', localField: 'template_id', foreignField: 'template_id', as: '_template' } },
      { $match: { $or: [
        { '_trainer.0.role': { $ne: 'trainer' } }, { '_user.0.role': { $ne: 'user' } },
        { $expr: { $ne: [{ $arrayElemAt: ['$_template.trainer_id', 0] }, '$trainer_id'] } },
      ] } },
    ], 'Assignment role or template ownership mismatch');
  }
  if (present.has('ai_chat_sessions')) {
    await reportMismatch('ai_chat_messages', [
      { $lookup: { from: 'ai_chat_sessions', localField: 'session_id', foreignField: 'session_id', as: '_session' } },
      { $match: { $expr: { $ne: [{ $arrayElemAt: ['$_session.user_id', 0] }, '$user_id'] } } },
    ], 'Chat session ownership mismatch');
  }
  return { ok: issues.length === 0, counts, issues };
}

module.exports = { initializeDatabase, verifyDatabase };
