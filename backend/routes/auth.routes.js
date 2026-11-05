'use strict';
const express = require('express');
const { createEmailVerificationService } = require('../services/email-verification.service');
const { readBearerToken, publicUser } = require('../auth/session');
const { createAuthService } = require('../services/auth.service');
const { createSessionService } = require('../services/session.service');
const { createRequireAuth } = require('../middleware/require-auth');
const { createLoginRateLimiter } = require('../middleware/rate-limit');
const { asyncHandler } = require('../utils/async-handler');

function createAuthRouter({ db, sessionTtlSeconds, loginRateLimit, mailer } = {}) {
  const auth = createAuthService({ db, sessionTtlSeconds });
  const sessions = createSessionService({ db, sessionTtlSeconds });
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const verification = createEmailVerificationService({ db, mailer });
  router.post('/register/email-code', createLoginRateLimiter({ max: 5, message: 'Quá nhiều yêu cầu gửi mã. Vui lòng thử lại sau.' }),
    asyncHandler(async (req, res) => {
      try { res.json(await verification.send(req.body)); }
      catch (error) {
        if (error.httpStatus === 429) res.set('Retry-After', '60');
        throw error;
      }
    }));
  router.post('/register/verify-email', createLoginRateLimiter({ message: 'Quá nhiều lần thử mã. Vui lòng thử lại sau.' }),
    asyncHandler(async (req, res) => res.json(await verification.verify(req.body))));
  router.post('/register', createLoginRateLimiter({ message: 'Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau.' }),
    asyncHandler(async (req, res) => res.status(201).json(await auth.register(req.body))));
  router.post('/login', createLoginRateLimiter(loginRateLimit),
    asyncHandler(async (req, res) => res.json(await auth.login(req.body))));
  router.get('/me', createRequireAuth({ db }), (req, res) => res.json({ success: true, user: publicUser(req.auth.user) }));
  router.post('/change-password',
    createLoginRateLimiter({ message: 'Quá nhiều lần đổi mật khẩu. Vui lòng thử lại sau.' }),
    createRequireAuth({ db }),
    asyncHandler(async (req, res) => res.json(await auth.changePassword(req.auth, req.body))));
  router.post('/logout-all', createRequireAuth({ db }), asyncHandler(async (req, res) => {
    await sessions.revokeAll(req.auth.user.user_id);
    res.status(204).end();
  }));
  router.post('/logout', asyncHandler(async (req, res) => {
    await sessions.revoke(readBearerToken(req));
    res.status(204).end();
  }));
  return router;
}
module.exports = { createAuthRouter, createLoginRateLimiter };
