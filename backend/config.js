'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

function readEnv(file) {
  return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
}

function loadConfig(env = process.env) {
  // Process environment wins, then backend/.env, then the existing Atlas setup.
  // Never print these objects: they can contain database credentials.
  const values = {
    ...readEnv(path.join(__dirname, 'database', 'mongodb', '.env')),
    ...readEnv(path.join(__dirname, '.env')),
    ...env,
  };
  const uri = values.MONGODB_URI;
  const databaseName = values.MONGODB_DB_NAME;
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri) || /[<>]/.test(uri)) {
    throw new Error('Configure MONGODB_URI in backend/.env or database/mongodb/.env.');
  }
  if (databaseName !== 'fitlife') {
    throw new Error('MONGODB_DB_NAME must be fitlife.');
  }
  function integerOption(key, fallback, minimum, maximum) {
    const value = values[key] === undefined ? fallback : Number(values[key]);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`Invalid ${key}. Expected integer ${minimum}-${maximum}.`);
    }
    return value;
  }
  return {
    uri,
    databaseName,
    port: integerOption('PORT', 5000, 1, 65535),
    sessionTtlSeconds: integerOption('AUTH_SESSION_TTL_SECONDS', 604800, 60, 2592000),
  };
}

module.exports = { loadConfig };
