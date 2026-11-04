'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { DEFAULT_SESSION_TTL_SECONDS } = require('./auth/session');
const { parseCorsOrigins } = require('./utils/cors-options');

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
    corsOrigins: parseCorsOrigins(values.CORS_ORIGINS),
    port: integerOption('PORT', 5000, 1, 65535),
    sessionTtlSeconds: integerOption('AUTH_SESSION_TTL_SECONDS', DEFAULT_SESSION_TTL_SECONDS, 60, DEFAULT_SESSION_TTL_SECONDS),
    // Optional: without a key, AI Coach answers with built-in rules from the member's logs.
    ai: { apiKey: values.ANTHROPIC_API_KEY || '', model: values.AI_MODEL || 'claude-sonnet-5' },
    aiPlans: { geminiKey: values.GEMINI_API_KEY || '', groqKey: values.GROQ_API_KEY || '',
      model: values.GEMINI_MODEL || 'gemini-3.5-flash-lite' },
    // Optional VNPay sandbox. Without both keys the payment API answers 503.
    payments: {
      tmnCode: values.VNP_TMN_CODE || '',
      hashSecret: values.VNP_HASH_SECRET || '',
      payUrl: values.VNP_PAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      publicApiUrl: (values.PUBLIC_API_URL || `http://localhost:${values.PORT || 5000}`).replace(/\/+$/, ''),
      webAppUrl: (values.WEB_APP_URL || 'http://localhost:5173').replace(/\/+$/, ''),
    },
    trustProxy: values.TRUST_PROXY === '1',
  };
}

module.exports = { loadConfig };
