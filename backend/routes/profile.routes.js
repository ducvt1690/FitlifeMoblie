'use strict';
const express = require('express');
const { createProfileService } = require('../services/profile.service');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');
function createProfileRouter({ db }) {
  const router = express.Router();
  const service = createProfileService({ db });
  router.use(createRequireAuth({ db }), requireMember);
  router.get('/', (req, res) => res.json({ success: true, profile: service.get(req.auth.user) }));
  router.patch('/', asyncHandler(async (req, res) => res.json({ success: true, profile: await service.update(req.auth.user, req.body) })));
  return router;
}
module.exports = { createProfileRouter };
