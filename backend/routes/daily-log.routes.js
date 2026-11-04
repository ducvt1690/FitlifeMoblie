'use strict';
const express = require('express');
const { createDailyLogService } = require('../services/daily-log.service');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');
function createDailyLogRouter({ db, kind }) {
  const router = express.Router();
  const service = createDailyLogService({ db, kind });
  router.use(createRequireAuth({ db }), requireMember);
  router.get('/', asyncHandler(async (req, res) => res.json(await service.get(req.auth.user, req.query.date))));
  router.put('/', asyncHandler(async (req, res) => res.json(await service.save(req.auth.user, req.body))));
  return router;
}
module.exports = { createDailyLogRouter };
