'use strict';

const { isDeepStrictEqual } = require('node:util');
const { collections } = require('./schema');

const definition = collections.find(entry => entry.name === 'exercises');
if (!definition) throw new Error('Exercise schema is missing.');

async function ensureExerciseCollection(db) {
  const [metadata] = await db.listCollections({ name: definition.name }).toArray();
  if (!metadata) {
    await db.createCollection(definition.name, {
      validator: definition.validator,
      validationLevel: definition.validationLevel,
      validationAction: definition.validationAction,
    });
  } else if (!isDeepStrictEqual(metadata.options.validator, definition.validator)
    || metadata.options.validationLevel !== definition.validationLevel
    || metadata.options.validationAction !== definition.validationAction) {
    const count = await db.collection(definition.name).countDocuments({}, { limit: 1 });
    if (count) throw new Error('Existing exercises collection has a different schema; review it before importing.');
    await db.command({ collMod: definition.name, validator: definition.validator,
      validationLevel: definition.validationLevel, validationAction: definition.validationAction });
  }
  await db.collection(definition.name).createIndexes(definition.indexes);
  return definition;
}

module.exports = { definition, ensureExerciseCollection };
