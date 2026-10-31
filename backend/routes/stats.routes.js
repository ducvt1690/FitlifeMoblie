'use strict';
const express = require('express');
const { createStatsService } = require('../services/stats.service');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');
function createStatsRouter({ db }) {
  const router = express.Router();
  const service = createStatsService({ db });
  router.use(createRequireAuth({ db }), requireMember);
  router.get('/', asyncHandler(async (req, res) => res.json(await service.summary(req.auth.user, req.query.days))));
  return router;
}
module.exports = { createStatsRouter };
