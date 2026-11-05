'use strict';

const { isDeepStrictEqual } = require('node:util');

const validator = {
  $jsonSchema: {
    bsonType: 'object', additionalProperties: false,
    required: ['_id', 'nonce', 'attempts', 'sent_at', 'expires_at', 'token_hash', 'ready'],
    properties: {
      _id: { bsonType: 'string', minLength: 3, maxLength: 100 },
      nonce: { bsonType: 'string', minLength: 36, maxLength: 36 },
      attempts: { bsonType: 'int', minimum: 0, maximum: 5 },
      sent_at: { bsonType: 'date' },
      expires_at: { bsonType: 'date' },
      token_hash: { bsonType: ['string', 'null'], pattern: '^[0-9a-f]{64}$' },
      code_hash: { bsonType: 'string', pattern: '^[0-9a-f]{64}$' },
      ready: { bsonType: 'bool' },
    },
    oneOf: [
      { properties: { token_hash: { bsonType: 'null' } }, required: ['code_hash'] },
      { properties: { token_hash: { bsonType: 'string' }, ready: { enum: [false] } } },
    ],
  },
};

async function initializeEmailVerification(db) {
  const name = 'registration_email_verifications';
  try {
    await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' });
  } catch (error) { if (error.code !== 48) throw error; }
  const [metadata] = await db.listCollections({ name }).toArray();
  if (!metadata || !isDeepStrictEqual(metadata.options.validator, validator)
    || metadata.options.validationLevel !== 'strict' || metadata.options.validationAction !== 'error') {
    throw new Error('registration_email_verifications schema differs; review it before starting the API.');
  }
  await db.collection(name).createIndex({ expires_at: 1 }, { name: 'ttl_registration_email_expiry', expireAfterSeconds: 0 });
}

module.exports = { initializeEmailVerification };
