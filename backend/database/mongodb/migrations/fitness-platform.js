'use strict';
const { isDeepStrictEqual } = require('node:util');
const { collections } = require('../schema');
const added = {
  trainer_assignments: ['link_id', 'template_snapshot', 'cancelled_at', 'cancel_reason', 'feedback', 'feedback_at', 'status_history'],
  admin_logs: ['previous_role', 'new_role'],
};
// This is an additive validator migration. Existing documents remain valid and are never rewritten.
// Legacy assignment snapshots are frozen transactionally before the first edit of their template.
async function migrateFitnessPlatform(db, { apply = false } = {}) {
  const report = { database: db.databaseName, applied: false, changed: false, collections: [], issues: [] };
  const changes = [];
  for (const [name, fields] of Object.entries(added)) {
    const definition = collections.find(c => c.name === name);
    const previous = structuredClone(definition.validator);
    fields.forEach(field => delete previous.$jsonSchema.properties[field]);
    const [actual] = await db.listCollections({ name }).toArray();
    if (!actual) { report.issues.push(`Missing collection: ${name}. Initialize a new database separately.`); continue; }
    const current = isDeepStrictEqual(actual.options.validator, definition.validator);
    const knownPrevious = [previous];
    if (name === 'admin_logs') {
      // Earlier local schemas used a narrower enum than the deployed Atlas schema.
      // Both known variants can be widened without invalidating existing documents.
      const narrow = structuredClone(previous);
      narrow.$jsonSchema.properties.target_type.enum = ['user', 'challenge', 'reward_item'];
      knownPrevious.push(narrow);
      const narrowWithRoleAudit = structuredClone(definition.validator);
      narrowWithRoleAudit.$jsonSchema.properties.target_type.enum = ['user', 'challenge', 'reward_item'];
      knownPrevious.push(narrowWithRoleAudit);
    }
    const legacy = knownPrevious.some(validator => isDeepStrictEqual(actual.options.validator, validator));
    if ((!current && !legacy) || actual.options.validationLevel !== 'strict' || actual.options.validationAction !== 'error') report.issues.push(`Unexpected schema drift: ${name}.`);
    const invalid = await db.collection(name).countDocuments({ $nor: [definition.validator] });
    if (invalid) report.issues.push(`Existing documents fail the additive validator: ${name} (${invalid}).`);
    report.collections.push({ name, documents: await db.collection(name).countDocuments(), invalid, needsMigration: legacy && !current });
    if (legacy && !current) changes.push({ name, definition, actual });
  }
  async function countMismatch(name, pipeline) {
    const [result] = await db.collection(name).aggregate([...pipeline, { $count: 'count' }]).toArray();
    return result?.count || 0;
  }
  report.compatibility = {
    active_templates_without_trainer_role: await countMismatch('workout_templates', [
      { $match: { is_active: true } }, { $lookup: { from: 'users', localField: 'trainer_id', foreignField: 'user_id', as: 'trainer' } },
      { $match: { 'trainer.0.role': { $ne: 'trainer' } } },
    ]),
    active_consents_without_trainer_role: await countMismatch('trainer_links', [
      { $match: { status: 'active' } }, { $lookup: { from: 'users', localField: 'trainer_id', foreignField: 'user_id', as: 'trainer' } },
      { $match: { 'trainer.0.role': { $ne: 'trainer' } } },
    ]),
    legacy_assignments_without_snapshot: await db.collection('trainer_assignments').countDocuments({ template_snapshot: { $exists: false } }),
    assignments_without_source_template: await countMismatch('trainer_assignments', [
      { $lookup: { from: 'workout_templates', localField: 'template_id', foreignField: 'template_id', as: 'template' } },
      { $match: { 'template.0': { $exists: false } } },
    ]),
  };
  if (report.compatibility.active_templates_without_trainer_role) report.issues.push('Active templates belong to accounts without the Trainer role; review existing revocation history before migration.');
  if (report.compatibility.active_consents_without_trainer_role) report.issues.push('Active consents remain for accounts without the Trainer role; review existing revocation history before migration.');
  if (report.compatibility.assignments_without_source_template) report.issues.push('Assignments reference missing templates; their original instructions cannot be reconstructed automatically.');
  if (!apply || report.issues.length) return report;
  // Check every planned option before the first mutation, so drift stops the whole operation.
  for (const change of changes) {
    const [latest] = await db.listCollections({ name: change.name }).toArray();
    if (!latest || !isDeepStrictEqual(latest.options, change.actual.options)) report.issues.push(`Options changed while planning: ${change.name}.`);
  }
  if (report.issues.length) return report;
  for (const { name, definition } of changes) {
    await db.command({ collMod: name, validator: definition.validator, validationLevel: 'strict', validationAction: 'error' });
    const [latest] = await db.listCollections({ name }).toArray();
    if (!isDeepStrictEqual(latest.options.validator, definition.validator)) throw new Error(`Validator verification failed: ${name}.`);
  }
  report.applied = true; report.changed = changes.length > 0;
  report.collections.forEach(c => { c.needsMigration = false; });
  return report;
}
module.exports = { migrateFitnessPlatform };
