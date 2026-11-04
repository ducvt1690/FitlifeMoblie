'use strict';

const express = require('express');
const { createMealService } = require('../services/meal.service');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');

function createMealRouter({ db }) {
  const router = express.Router();
  const service = createMealService({ db });
  router.use(createRequireAuth({ db }), requireMember);
  router.get('/', asyncHandler(async (req, res) => res.json(await service.list(req.auth.user, req.query.date))));
  router.post('/', asyncHandler(async (req, res) => {
    const result = await service.create(req.auth.user, req.body);
    res.status(result.replayed ? 200 : 201).json({ success: true, ...result });
  }));
  router.patch('/:mealId', asyncHandler(async (req, res) => res.json({ success: true, meal: await service.update(req.auth.user, req.params.mealId, req.body) })));
  router.delete('/:mealId', asyncHandler(async (req, res) => { await service.remove(req.auth.user, req.params.mealId); res.status(204).end(); }));
  return router;
}

module.exports = { createMealRouter };
