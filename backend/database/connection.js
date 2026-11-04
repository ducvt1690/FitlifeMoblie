'use strict';

const { MongoClient } = require('mongodb');
const { isDeepStrictEqual } = require('node:util');

const sessionValidator = {
  $jsonSchema: {
    bsonType: 'object',
    additionalProperties: false,
    required: ['token_hash', 'user_id', 'created_at', 'expires_at'],
    properties: {
      _id: { bsonType: 'objectId' },
      token_hash: { bsonType: 'string', pattern: '^[0-9a-f]{64}$' },
      user_id: { bsonType: 'string', minLength: 1, maxLength: 128 },
      created_at: { bsonType: 'date' },
      expires_at: { bsonType: 'date' },
    },
  },
};

async function initializeAuthSessions(db) {
  try {
    await db.createCollection('auth_sessions', {
      validator: sessionValidator, validationLevel: 'strict', validationAction: 'error',
    });
  } catch (error) {
    if (error.code !== 48) throw error;
  }
  const [metadata] = await db.listCollections({ name: 'auth_sessions' }).toArray();
  if (!metadata || !isDeepStrictEqual(metadata.options.validator, sessionValidator)
    || metadata.options.validationLevel !== 'strict' || metadata.options.validationAction !== 'error') {
    throw new Error('auth_sessions schema differs; review it before starting the API.');
  }
  await db.collection('auth_sessions').createIndexes([
    { key: { token_hash: 1 }, name: 'uq_auth_token_hash', unique: true },
    { key: { expires_at: 1 }, name: 'ttl_auth_session_expiry', expireAfterSeconds: 0 },
    { key: { user_id: 1 }, name: 'by_auth_session_user' },
  ]);
}

async function connectDatabase({ uri, databaseName }) {
  const client = new MongoClient(uri, {
    appName: 'FitLifeAuthAPI', serverSelectionTimeoutMS: 15000,
  });
  try {
    await client.connect();
    const db = client.db(databaseName);
    await db.command({ ping: 1 });
    const [users] = await db.listCollections({ name: 'users' }).toArray();
    if (!users) throw new Error('Missing users collection. Initialize the FitLife database first.');
    await initializeAuthSessions(db);
    return { client, db };
  } catch (error) {
    await client.close();
    throw error;
  }
}

module.exports = { connectDatabase, initializeAuthSessions };
