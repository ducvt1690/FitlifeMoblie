'use strict';

const express = require('express');
const { createExerciseService } = require('../services/exercise.service');
const { createRequireAuth } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');

function createExerciseRouter({ db }) {
  const router = express.Router();
  const service = createExerciseService({ db });
  router.use(createRequireAuth({ db }));
  router.get('/', asyncHandler(async (req, res) => res.json(await service.list(req.query))));
  router.get('/:exerciseId', asyncHandler(async (req, res) => res.json(await service.get(req.params.exerciseId))));
  return router;
}

module.exports = { createExerciseRouter };
