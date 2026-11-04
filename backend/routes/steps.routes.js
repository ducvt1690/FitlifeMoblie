'use strict';
const express = require('express');
const { createStepsService } = require('../services/steps.service');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');
function createStepsRouter({ db }) {
  const router = express.Router();
  const service = createStepsService({ db });
  router.use(createRequireAuth({ db }), requireMember);
  router.get('/', asyncHandler(async (req, res) => res.json(await service.get(req.auth.user, req.query.date))));
  router.post('/', asyncHandler(async (req, res) => res.json(await service.add(req.auth.user, req.body))));
  return router;
}
module.exports = { createStepsRouter };
