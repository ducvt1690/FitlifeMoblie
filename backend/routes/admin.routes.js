'use strict';
const express = require('express');
const { createAdminService } = require('../services/admin.service');
const { createRequireAuth, requireRole } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');
function createAdminRouter({ db }) {
  const router = express.Router();
  const service = createAdminService({ db });
  const admin = req => req.auth.user;
  router.use(createRequireAuth({ db }), requireRole('admin'));
  router.get('/overview', asyncHandler(async (req, res) => res.json(await service.overview())));
  router.get('/stats', asyncHandler(async (req, res) => res.json(await service.stats(req.query.days))));
  router.get('/accounts', asyncHandler(async (req, res) => res.json(await service.accounts(req.query))));
  router.get('/accounts/:userId', asyncHandler(async (req, res) => res.json(await service.accountDetail(req.params.userId))));
  router.post('/accounts/:userId/logout', asyncHandler(async (req, res) => res.json(await service.forceLogout(admin(req), req.params.userId, req.body))));
  router.patch('/accounts/:userId', asyncHandler(async (req, res) => res.json(await service.updateAccount(admin(req), req.params.userId, req.body))));
  router.get('/challenges', asyncHandler(async (req, res) => res.json(await service.listChallenges())));
  router.get('/challenges/:challengeId', asyncHandler(async (req, res) => res.json(await service.challengeDetail(req.params.challengeId, req.query))));
  router.post('/challenges', asyncHandler(async (req, res) => res.status(201).json(await service.createChallenge(admin(req), req.body))));
  router.patch('/challenges/:challengeId', asyncHandler(async (req, res) => res.json(await service.updateChallenge(admin(req), req.params.challengeId, req.body))));
  router.get('/rewards', asyncHandler(async (req, res) => res.json(await service.listRewards())));
  router.post('/rewards', asyncHandler(async (req, res) => res.status(201).json(await service.createReward(admin(req), req.body))));
  router.patch('/rewards/:itemId', asyncHandler(async (req, res) => res.json(await service.updateReward(admin(req), req.params.itemId, req.body))));
  router.get('/transactions', asyncHandler(async (req, res) => res.json(await service.transactions(req.query))));
  router.get('/payments', asyncHandler(async (req, res) => res.json(await service.payments(req.query))));
  router.get('/logs', asyncHandler(async (req, res) => res.json(await service.logs(req.query))));
  return router;
}
module.exports = { createAdminRouter };
