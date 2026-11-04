'use strict';
const express = require('express');
const { readBearerToken, publicUser } = require('../auth/session');
const { createAuthService } = require('../services/auth.service');
const { createSessionService } = require('../services/session.service');
const { createRequireAuth } = require('../middleware/require-auth');
const { createLoginRateLimiter } = require('../middleware/rate-limit');
const { asyncHandler } = require('../utils/async-handler');

function createAuthRouter({ db, sessionTtlSeconds, loginRateLimit } = {}) {
  const auth = createAuthService({ db, sessionTtlSeconds });
  const sessions = createSessionService({ db, sessionTtlSeconds });
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.post('/register', createLoginRateLimiter({ message: 'Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau.' }),
    asyncHandler(async (req, res) => res.status(201).json(await auth.register(req.body))));
  router.post('/login', createLoginRateLimiter(loginRateLimit),
    asyncHandler(async (req, res) => res.json(await auth.login(req.body))));
  router.get('/me', createRequireAuth({ db }), (req, res) => res.json({ success: true, user: publicUser(req.auth.user) }));
  router.post('/logout', asyncHandler(async (req, res) => {
    await sessions.revoke(readBearerToken(req));
    res.status(204).end();
  }));
  return router;
}
module.exports = { createAuthRouter, createLoginRateLimiter };
