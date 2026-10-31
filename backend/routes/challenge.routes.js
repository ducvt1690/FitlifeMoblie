'use strict';
const express = require('express');
const { createChallengeService } = require('../services/challenge.service');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');
function createChallengeRouter({ db }) {
  const router = express.Router();
  const service = createChallengeService({ db });
  router.use(createRequireAuth({ db }), requireMember);
  router.get('/', asyncHandler(async (req, res) => res.json(await service.list(req.auth.user))));
  router.post('/:challengeId/join', asyncHandler(async (req, res) => res.status(201).json(await service.join(req.auth.user, req.params.challengeId))));
  router.post('/:challengeId/checkin', asyncHandler(async (req, res) => res.json(await service.checkin(req.auth.user, req.params.challengeId))));
  return router;
}
module.exports = { createChallengeRouter };
