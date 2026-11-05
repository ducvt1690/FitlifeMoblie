'use strict';

// Vercel entry: every request is rewritten here (vercel.json). The Atlas connection and the
// Express app are created once per warm instance and reused; server.js stays the local entry.
const { loadConfig } = require('../config');
const { connectDatabase } = require('../database/connection');
const { createApp } = require('../app');
const { createMailer } = require('../utils/mailer');

let ready;

function appInstance() {
  ready ??= (async () => {
    const config = loadConfig();
    const { db } = await connectDatabase(config);
    return createApp({ db, sessionTtlSeconds: config.sessionTtlSeconds, corsOrigins: config.corsOrigins, ai: config.ai,
      payments: config.payments, trustProxy: config.trustProxy, mailer: createMailer(config.mail) });
  })().catch((error) => {
    ready = undefined; // retry on the next request instead of caching the failure
    throw error;
  });
  return ready;
}

module.exports = async (req, res) => {
  let app;
  try {
    app = await appInstance();
  } catch (error) {
    // Never print the URI or raw driver errors.
    console.error(`Cannot start FitLife API (${error.name || 'Error'}). Check MongoDB configuration and Atlas network access.`);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ message: 'Máy chủ chưa kết nối được cơ sở dữ liệu. Thử lại sau ít phút.' }));
    return;
  }
  return app(req, res);
};
