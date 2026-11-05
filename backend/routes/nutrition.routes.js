'use strict';
const express = require('express');
const { createNutritionService } = require('../services/nutrition.service');
const { createWorkoutPlanService } = require('../services/workout-plan.service');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');

function createNutritionRouter({ db, ai }) {
  const router = express.Router();
  const service = createNutritionService({ db, ai });
  router.use(createRequireAuth({ db }), requireMember);
  router.get('/today', asyncHandler(async (req, res) => res.json(await service.today(req.auth.user))));
  router.post('/parse', asyncHandler(async (req, res) => res.json(await service.parse(req.auth.user, req.body))));
  router.post('/parse-photo', asyncHandler(async (req, res) => res.json(await service.parsePhoto(req.auth.user, req.body))));
  router.post('/suggestions', asyncHandler(async (req, res) => res.status(201).json(await service.suggest(req.auth.user))));
  router.post('/suggestions/:suggestionId/accept', asyncHandler(async (req, res) => res.json(await service.acceptSuggestion(req.auth.user, req.params.suggestionId))));
  router.post('/suggestions/:suggestionId/eat', asyncHandler(async (req, res) => res.json(await service.eatSuggestion(req.auth.user, req.params.suggestionId))));
  router.put('/allergies', asyncHandler(async (req, res) => res.json(await service.setAllergies(req.auth.user, req.body))));
  router.put('/day', asyncHandler(async (req, res) => res.json(await service.setCompleted(req.auth.user, req.body))));
  return router;
}

function createWorkoutPlanRouter({ db, ai }) {
  const router = express.Router();
  const service = createWorkoutPlanService({ db, ai });
  router.use(createRequireAuth({ db }), requireMember);
  router.get('/options', (req, res) => res.json(service.options()));
  router.get('/today', asyncHandler(async (req, res) => res.json(await service.latest(req.auth.user))));
  router.post('/', asyncHandler(async (req, res) => res.status(201).json(await service.create(req.auth.user, req.body))));
  router.put('/:planId/items', asyncHandler(async (req, res) => res.json(await service.setDone(req.auth.user, req.params.planId, req.body))));
  router.post('/:planId/complete', asyncHandler(async (req, res) => res.json(await service.complete(req.auth.user, req.params.planId))));
  return router;
}

module.exports = { createNutritionRouter, createWorkoutPlanRouter };
