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
  router.get('/analytics', asyncHandler(async (req, res) => res.json(await service.analytics(req.query.range))));
  // Old name kept for existing clients: ?days=7|30|90.
  router.get('/stats', asyncHandler(async (req, res) => res.json(await service.analytics(req.query.days === undefined ? undefined : `${req.query.days}d`))));
  router.get('/accounts', asyncHandler(async (req, res) => res.json(await service.accounts(req.query))));
  router.get('/accounts/:userId', asyncHandler(async (req, res) => res.json(await service.accountDetail(req.params.userId))));
  const logoutAll = asyncHandler(async (req, res) => res.json(await service.forceLogout(admin(req), req.params.userId, req.body)));
  router.post('/accounts/:userId/logout-all', logoutAll);
  router.post('/accounts/:userId/logout', logoutAll);
  router.post('/accounts/:userId/premium', asyncHandler(async (req, res) => res.json(await service.grantPremium(admin(req), req.params.userId, req.body))));
  router.delete('/accounts/:userId/premium', asyncHandler(async (req, res) => res.json(await service.revokePremium(admin(req), req.params.userId, req.body))));
  router.post('/accounts/:userId/coins', asyncHandler(async (req, res) => res.json(await service.adjustCoins(admin(req), req.params.userId, req.body))));
  router.delete('/accounts/:userId/chat', asyncHandler(async (req, res) => res.json(await service.deleteAiData(admin(req), req.params.userId, req.body))));
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
  router.get('/payments/export', asyncHandler(async (req, res) => {
    const { filename, csv } = await service.exportPayments(req.query);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` }).send(csv);
  }));
  router.get('/payments/:orderId', asyncHandler(async (req, res) => res.json(await service.paymentDetail(req.params.orderId))));
  router.post('/payments/:orderId/refund', asyncHandler(async (req, res) => res.json(await service.refundPayment(admin(req), req.params.orderId, req.body))));
  router.get('/settings/ai-limits', asyncHandler(async (req, res) => res.json(await service.getAiLimits())));
  router.put('/settings/ai-limits', asyncHandler(async (req, res) => res.json(await service.updateAiLimits(admin(req), req.body))));
  router.get('/exercises', asyncHandler(async (req, res) => res.json(await service.exercises(req.query))));
  router.post('/exercises', asyncHandler(async (req, res) => {
    const result = await service.createExercise(admin(req), req.body);
    res.status(result.replayed ? 200 : 201).json(result);
  }));
  router.patch('/exercises/:exerciseId', asyncHandler(async (req, res) => res.json(await service.updateExercise(admin(req), req.params.exerciseId, req.body))));
  router.get('/logs', asyncHandler(async (req, res) => res.json(await service.logs(req.query))));
  return router;
}
module.exports = { createAdminRouter };
