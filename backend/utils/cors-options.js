'use strict';

const { HttpError } = require('./http-error');
const DEFAULT_CORS_ORIGINS = ['http://localhost:8081', 'http://127.0.0.1:8081'];

function parseCorsOrigins(value) {
  if (value === undefined) return [...DEFAULT_CORS_ORIGINS];
  if (typeof value !== 'string') throw new Error('CORS_ORIGINS must contain comma-separated HTTP origins.');
  return [...new Set(value.split(',').map(origin => origin.trim()).filter(Boolean).map(origin => {
    let url;
    try { url = new URL(origin); } catch { throw new Error('Invalid origin in CORS_ORIGINS.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || origin.replace(/\/$/, '') !== url.origin) throw new Error('Invalid origin in CORS_ORIGINS.');
    return url.origin;
  }))];
}

function corsOptions(origins = DEFAULT_CORS_ORIGINS) {
  const allowed = new Set(parseCorsOrigins(origins.join(',')));
  return {
    exposedHeaders: ['Retry-After'],
    origin(origin, callback) {
      // Postman and native Expo requests normally have no Origin header.
      // They still need the same bearer session and ownership checks.
      if (!origin || allowed.has(origin)) return callback(null, true);
      callback(new HttpError(403, 'Origin không được phép truy cập API.'));
    },
  };
}

module.exports = { DEFAULT_CORS_ORIGINS, parseCorsOrigins, corsOptions };
