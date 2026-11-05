'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { normalizeExercise, POPULAR_SOURCE_IDS } = require('../database/mongodb/scripts/import-exercisedb-v1');
const { NAME_VI, INSTRUCTIONS_VI, BODY_VI, EQUIPMENT_VI, MUSCLE_VI } = require('../database/mongodb/scripts/localize-vietnamese');
const { ensureExerciseCollection } = require('../database/mongodb/exercise-catalog');
const { transaction } = require('../database/transaction');

const CACHE_PATH = path.resolve(__dirname, '../database/mongodb/data/demo-exercises.json');
// Match the candidate groups in workout-plan.service.js; cached metadata remains in the source language.
const FOCUS = {
  push: { parts: ['chest', 'shoulders', 'upper arms'], skip: 'biceps' },
  pull: { parts: ['back', 'upper arms'], skip: 'triceps' },
  legs: { parts: ['upper legs', 'lower legs', 'waist'] },
  upper: { parts: ['chest', 'back', 'shoulders', 'upper arms'] },
  lower: { parts: ['upper legs', 'lower legs', 'waist'] },
  full: { parts: ['chest', 'back', 'shoulders', 'upper arms', 'upper legs', 'lower legs', 'waist'] },
};
const FIXTURE_SOURCE_IDS = ['QA0', 'QA1', 'QA2'];

function validText(value, maximum) {
  return typeof value === 'string' && value.trim().length > 0 && [...value].length <= maximum;
}

function validateCatalog(catalog, now) {
  const rows = Array.isArray(catalog) ? catalog : catalog?.exercises;
  const wanted = new Set(POPULAR_SOURCE_IDS);
  if (!Array.isArray(rows) || rows.length !== wanted.size) {
    throw new Error(`Demo exercise cache must contain exactly ${wanted.size} selected source records.`);
  }
  const ids = new Set();
  const exercises = rows.map(row => {
    if (!row || !wanted.has(row.exerciseId) || ids.has(row.exerciseId)) {
      throw new Error('Demo exercise cache has an unexpected or duplicated source ID.');
    }
    ids.add(row.exerciseId);
    const exercise = normalizeExercise(row, now);
    if (!validText(exercise.name, 200) || !validText(exercise.gif_url, 1000)) {
      throw new Error(`Demo exercise cache has invalid text or media: ${row.exerciseId}.`);
    }
    let media;
    try { media = new URL(exercise.gif_url); } catch { /* rejected below */ }
    if (media?.protocol !== 'https:') throw new Error('Demo exercise media must use an HTTPS URL.');
    for (const field of ['body_parts', 'equipments', 'target_muscles', 'secondary_muscles', 'instructions']) {
      const rawField = { body_parts: 'bodyParts', equipments: 'equipments', target_muscles: 'targetMuscles',
        secondary_muscles: 'secondaryMuscles', instructions: 'instructions' }[field];
      const maximumItems = field === 'instructions' ? 50 : 20;
      const maximumLength = field === 'instructions' ? 2000 : 100;
      // Do not silently trim invalid raw metadata out of a supposedly complete cache.
      if (!Array.isArray(row[rawField]) || row[rawField].length !== exercise[field].length
        || exercise[field].length > maximumItems || exercise[field].some(value => !validText(value, maximumLength))) {
        throw new Error(`Demo exercise cache has invalid ${rawField}: ${row.exerciseId}.`);
      }
      if (['body_parts', 'equipments', 'target_muscles'].includes(field) && !exercise[field].length) {
        throw new Error(`Demo exercise cache is missing ${rawField}: ${row.exerciseId}.`);
      }
    }
    return exercise;
  });
  if (ids.size !== wanted.size) throw new Error('Demo exercise cache is incomplete.');
  const coverage = Object.fromEntries(Object.entries(FOCUS).map(([focus, rule]) => [focus,
    exercises.filter(exercise => exercise.body_parts.some(part => rule.parts.includes(part))
      && (!rule.skip || !exercise.target_muscles.includes(rule.skip))).length,
  ]));
  if (Object.values(coverage).some(count => count === 0)) {
    throw new Error('Demo exercise cache does not cover every workout focus.');
  }
  return { exercises, coverage };
}

function translate(values, dictionary) {
  return values.map(value => dictionary[value.toLowerCase()] || value);
}

async function prepareDemoExercises(db, { catalog, now = new Date() } = {}) {
  // Validate every record and every focus before schema/index writes or data changes.
  const source = catalog ?? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  const { exercises, coverage } = validateCatalog(source, now);
  await ensureExerciseCollection(db);
  return transaction(db, async session => {
    const operations = exercises.map(exercise => {
      const sourceId = exercise.source_exercise_id;
      const localized = {
        ...(NAME_VI[sourceId] ? { name_vi: NAME_VI[sourceId] } : {}),
        ...(INSTRUCTIONS_VI[sourceId] ? { instructions_vi: INSTRUCTIONS_VI[sourceId] } : {}),
        body_parts_vi: translate(exercise.body_parts, BODY_VI),
        equipments_vi: translate(exercise.equipments, EQUIPMENT_VI),
        target_muscles_vi: translate(exercise.target_muscles, MUSCLE_VI),
        secondary_muscles_vi: translate(exercise.secondary_muscles, MUSCLE_VI),
      };
      return { updateOne: {
        filter: { source: exercise.source, source_exercise_id: sourceId },
        update: {
          $set: { ...exercise, ...localized },
          $setOnInsert: { exercise_id: randomUUID(), created_at: now },
        },
        upsert: true,
      } };
    });
    const imported = await db.collection('exercises').bulkWrite(operations, { ordered: true, session });
    // Old plans may still refer to these UUIDs, so keep the documents and only stop offering them.
    const fixtures = await db.collection('exercises').updateMany({ source: 'exercisedb_v1',
      source_exercise_id: { $in: FIXTURE_SOURCE_IDS }, is_active: true },
    { $set: { is_active: false, updated_at: now } }, { session });
    return { selected: exercises.length, inserted: imported.upsertedCount, updated: imported.matchedCount,
      deactivatedFixtures: fixtures.modifiedCount, coverage };
  });
}

module.exports = { CACHE_PATH, prepareDemoExercises, validateCatalog };
