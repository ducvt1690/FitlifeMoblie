'use strict';

const express = require('express');
const cors = require('cors');
const { createAuthRouter } = require('./routes/auth.routes');

function createApp({ db, sessionTtlSeconds = 604800, logger = console }) {
  if (!db) throw new Error('A connected MongoDB database is required.');
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    if (req.path.startsWith('/api/auth')) res.set('Cache-Control', 'no-store');
    next();
  });
  const parseJSON = express.json({ limit: '16kb' });
  app.use((req, res, next) => {
    parseJSON(req, res, (error) => {
      if (!error) return next();
      // Only parser errors can set these client statuses. Never expose the
      // parser's raw error: it may contain the submitted login credentials.
      const messages = {
        400: 'JSON hoặc nội dung nén không hợp lệ.',
        413: 'Nội dung yêu cầu quá lớn.',
        415: 'Charset hoặc encoding của yêu cầu không được hỗ trợ.',
      };
      if (Object.hasOwn(messages, error.status)) {
        return res.status(error.status).json({ success: false, message: messages[error.status] });
      }
      return next(error);
    });
  });
  app.get('/', (req, res) => {
    res.json({
      status: 'online', project: 'FitLife Health & MMA API', version: '2.0.0',
      endpoints: { auth: ['POST /api/auth/login', 'POST /api/auth/logout', 'GET /api/auth/me'] },
    });
  });
  app.get('/health', async (req, res, next) => {
    try {
      await db.command({ ping: 1 });
      res.json({ status: 'ok', database: 'connected' });
    } catch (error) { next(error); }
  });
  app.use('/api/auth', createAuthRouter({ db, sessionTtlSeconds }));
  // Legacy JSON routes are not mounted on the Atlas-backed authentication API.
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint không tồn tại.' });
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const unavailable = /^(MongoNetwork|MongoServerSelection|MongoTopologyClosed|MongoNotConnected)/.test(error.name || '');
    // Driver errors can contain credentials or query data; log only the type.
    logger.error?.('API request failed:', error.name || 'Error');
    return res.status(unavailable ? 503 : 500).json({
      success: false,
      message: unavailable ? 'Tạm thời không kết nối được database.' : 'Không thể xử lý yêu cầu lúc này.',
    });
  });
  return app;
}

module.exports = { createApp };
