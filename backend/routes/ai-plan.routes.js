'use strict';

const express = require('express');
const { createAiPlanService } = require('../services/ai-plan.service');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');

function createAiPlanRouter({ db, aiPlans }) {
  const router = express.Router();
  const service = createAiPlanService({ db, aiPlans });
  router.use(createRequireAuth({ db }), requireMember);
  router.post('/', asyncHandler(async (req, res) => {
    const result = await service.create(req.auth.user, req.body);
    if (result.pending) res.set('Retry-After', '2');
    res.status(result.pending ? 202 : result.replayed ? 200 : 201).json(result);
  }));
  router.get('/', asyncHandler(async (req, res) => res.json(await service.list(req.auth.user, req.query))));
  router.get('/:planId', asyncHandler(async (req, res) => res.json(await service.get(req.auth.user, req.params.planId))));
  router.post('/:planId/meals/:index/log', asyncHandler(async (req, res) => {
    const result = await service.logMeal(req.auth.user, req.params.planId, req.params.index, req.body);
    res.status(result.replayed ? 200 : 201).json(result);
  }));
  router.post('/:planId/workouts/:day/start', asyncHandler(async (req, res) =>
    res.json(await service.startWorkout(req.auth.user, req.params.planId, req.params.day, req.body))));
  return router;
}

module.exports = { createAiPlanRouter };
