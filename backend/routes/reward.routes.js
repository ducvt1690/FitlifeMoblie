'use strict';
const express = require('express');
const { createRewardService } = require('../services/reward.service');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');
function createRewardRouter({ db }) {
  const router = express.Router();
  const service = createRewardService({ db });
  router.use(createRequireAuth({ db }), requireMember);
  router.get('/', asyncHandler(async (req, res) => res.json(await service.list(req.auth.user))));
  router.post('/:itemId/purchase', asyncHandler(async (req, res) => {
    const result = await service.purchase(req.auth.user, req.params.itemId, req.body);
    res.status(result.replayed ? 200 : 201).json(result);
  }));
  return router;
}
module.exports = { createRewardRouter };
