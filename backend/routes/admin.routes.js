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
  router.get('/accounts', asyncHandler(async (req, res) => res.json(await service.accounts(req.query))));
  router.patch('/accounts/:userId', asyncHandler(async (req, res) => res.json(await service.updateAccount(admin(req), req.params.userId, req.body))));
  router.get('/challenges', asyncHandler(async (req, res) => res.json(await service.listChallenges(req.query))));
  router.post('/challenges', asyncHandler(async (req, res) => res.status(201).json(await service.createChallenge(admin(req), req.body))));
  router.patch('/challenges/:challengeId', asyncHandler(async (req, res) => res.json(await service.updateChallenge(admin(req), req.params.challengeId, req.body))));
  router.get('/payments', asyncHandler(async (req, res) => res.json(await service.payments(req.query))));
  router.get('/logs', asyncHandler(async (req, res) => res.json(await service.logs(req.query))));
  router.get('/revenue', asyncHandler(async (req, res) => res.json(await service.revenue(req.query))));
  for (const name of ['challenges', 'payments', 'logs']) {
    router.get(`/${name}/:id`, asyncHandler(async (req, res) => res.json(await service.detail(name, req.params.id))));
  }
  return router;
}
module.exports = { createAdminRouter };
