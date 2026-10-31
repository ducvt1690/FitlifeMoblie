'use strict';
const express = require('express');
const { createQuestService } = require('../services/quest.service');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');
function createQuestRouter({ db }) {
  const router = express.Router();
  const service = createQuestService({ db });
  router.use(createRequireAuth({ db }), requireMember);
  router.get('/', asyncHandler(async (req, res) => res.json(await service.getToday(req.auth.user))));
  router.post('/checkin', asyncHandler(async (req, res) => res.json(await service.checkin(req.auth.user))));
  return router;
}
module.exports = { createQuestRouter };
