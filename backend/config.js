'use strict';
const { aiConfig } = require('./services/ai.client');
const { loadPaymentConfig } = require('./utils/payment-config');

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { DEFAULT_SESSION_TTL_SECONDS } = require('./auth/session');
const { parseCorsOrigins } = require('./utils/cors-options');

function readEnv(file) {
  return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
}

function environmentValues(env) {
  return {
    ...readEnv(path.join(__dirname, 'database', 'mongodb', '.env')),
    ...readEnv(path.join(__dirname, '.env')),
    ...env,
  };
}

function loadAiConfig(env = process.env) {
  return aiConfig(environmentValues(env));
}

function loadConfig(env = process.env) {
  // Process environment wins, then backend/.env, then the existing Atlas setup.
  // Never print these objects: they can contain database credentials.
  const values = environmentValues(env);
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
    corsOrigins: parseCorsOrigins(values.CORS_ORIGINS),
    port: integerOption('PORT', 5000, 1, 65535),
    sessionTtlSeconds: integerOption('AUTH_SESSION_TTL_SECONDS', DEFAULT_SESSION_TTL_SECONDS, 60, DEFAULT_SESSION_TTL_SECONDS),
    // Optional: without a key, AI Coach answers with built-in rules from the member's logs.
    ai: aiConfig(values),
    // Optional VNPay sandbox. Without both keys the payment API answers 503.
    payments: loadPaymentConfig(values),
    trustProxy: values.TRUST_PROXY === '1',
    // SMTP is required for registration email verification. Password-reset dev logging remains separate.
    mail: {
      host: values.SMTP_HOST || '', port: integerOption('SMTP_PORT', 587, 1, 65535),
      user: values.SMTP_USER || '', pass: values.SMTP_PASS || '', from: values.MAIL_FROM || '',
      production: values.NODE_ENV === 'production',
    },
  };
}

module.exports = { loadConfig, loadAiConfig };
