'use strict';

const express = require('express');
const { createWorkoutService } = require('../services/workout.service');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');

function createWorkoutRouter({ db }) {
  const router = express.Router();
  const service = createWorkoutService({ db });
  router.use(createRequireAuth({ db }), requireMember);
  router.get('/', asyncHandler(async (req, res) => res.json(await service.list(req.auth.user, req.query.date))));
  router.post('/', asyncHandler(async (req, res) => {
    const result = await service.create(req.auth.user, req.body);
    res.status(result.replayed ? 200 : 201).json({ success: true, ...result });
  }));
  return router;
}

module.exports = { createWorkoutRouter };
