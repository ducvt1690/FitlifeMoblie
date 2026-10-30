'use strict';

const { isDeepStrictEqual } = require('node:util');
const { collections } = require('../schema');

const users = collections.find(definition => definition.name === 'users');
const previousValidator = structuredClone(users.validator);
delete previousValidator.$jsonSchema.properties.date_of_birth;

function sameIndex(actual, expected) {
  return actual && isDeepStrictEqual(actual.key, expected.key)
    && Boolean(actual.unique) === Boolean(expected.unique)
    && isDeepStrictEqual(actual.partialFilterExpression, expected.partialFilterExpression);
}

async function inspect(db) {
  if (db.databaseName !== 'fitlife') throw new Error('Profile migration only accepts the fitlife database.');
  const report = {
    database: db.databaseName, collection: 'users', applied: false, changed: false,
    needsMigration: false, documentCount: 0, invalidDocuments: 0, issues: [],
  };
  const [metadata] = await db.listCollections({ name: 'users' }).toArray();
  if (!metadata) {
    report.issues.push('Missing users collection; initialize the database first.');
    return { report };
  }
  const current = metadata.options;
  const isPrevious = isDeepStrictEqual(current.validator, previousValidator);
  const isUpdated = isDeepStrictEqual(current.validator, users.validator);
  if (!isPrevious && !isUpdated) report.issues.push('users validator has unexpected changes; review schema drift before applying.');
  if (current.validationLevel !== users.validationLevel || current.validationAction !== users.validationAction) {
    report.issues.push('users validation must remain strict/error.');
  }
  const indexes = await db.collection('users').listIndexes().toArray();
  for (const expected of users.indexes) {
    if (!sameIndex(indexes.find(index => index.name === expected.name), expected)) {
      report.issues.push(`Missing or different users index: ${expected.name}.`);
    }
  }
  report.documentCount = await db.collection('users').countDocuments();
  report.invalidDocuments = await db.collection('users').countDocuments({ $nor: [users.validator] });
  if (report.invalidDocuments) report.issues.push('Existing users do not satisfy the updated validator; no documents were changed.');
  report.needsMigration = isPrevious && !isUpdated;
  return { report, metadata, indexes };
}

async function planProfileBirthDate(db) {
  return (await inspect(db)).report;
}

async function migrateProfileBirthDate(db, { apply = false } = {}) {
  const { report, metadata, indexes } = await inspect(db);
  if (!apply || report.issues.length || !report.needsMigration) return report;

  // Recheck immediately before collMod: never overwrite schema changes made
  // after the plan. This additive migration neither rewrites users nor guesses
  // missing birthdays, and it never runs the broader v2 migration/init commands.
  const [latest] = await db.listCollections({ name: 'users' }).toArray();
  if (!latest || !isDeepStrictEqual(latest.options, metadata.options)) {
    report.issues.push('users options changed while planning; rerun the plan.');
    return report;
  }
  await db.command({ collMod: 'users', validator: users.validator,
    validationLevel: users.validationLevel, validationAction: users.validationAction });
  report.applied = true;
  report.changed = true;
  report.needsMigration = false;

  const [updated] = await db.listCollections({ name: 'users' }).toArray();
  if (!updated || !isDeepStrictEqual(updated.options.validator, users.validator)
    || updated.options.validationLevel !== users.validationLevel
    || updated.options.validationAction !== users.validationAction) {
    report.issues.push('users validator verification failed after collMod.');
  }
  if (!isDeepStrictEqual(await db.collection('users').listIndexes().toArray(), indexes)) {
    report.issues.push('users indexes changed during migration; review concurrent index changes.');
  }
  return report;
}

module.exports = { migrateProfileBirthDate, planProfileBirthDate };
