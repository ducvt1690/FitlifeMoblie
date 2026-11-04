'use strict';
const express = require('express');
const { createPasswordResetService } = require('../services/password-reset.service');
const { createLoginRateLimiter } = require('../middleware/rate-limit');
const { asyncHandler } = require('../utils/async-handler');

// Public routes (no session): the user has forgotten the password.
function createPasswordResetRouter({ db, mailer }) {
  const router = express.Router();
  const service = createPasswordResetService({ db, mailer });
  router.post('/forgot-password', createLoginRateLimiter({ max: 5, message: 'Quá nhiều yêu cầu gửi mã. Vui lòng thử lại sau.' }),
    asyncHandler(async (req, res) => { res.set('Cache-Control', 'no-store'); res.json(await service.request(req.body)); }));
  router.post('/reset-password', createLoginRateLimiter({ message: 'Quá nhiều lần thử mã. Vui lòng thử lại sau.' }),
    asyncHandler(async (req, res) => { res.set('Cache-Control', 'no-store'); res.json(await service.reset(req.body)); }));
  return router;
}

module.exports = { createPasswordResetRouter };
