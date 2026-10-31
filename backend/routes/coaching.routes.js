'use strict';
const express = require('express');
const { createCoachingService } = require('../services/coaching.service');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');
function createCoachingRouter({ db }) {
  const router = express.Router();
  const service = createCoachingService({ db });
  router.use(createRequireAuth({ db }), requireMember);
  router.get('/', asyncHandler(async (req, res) => res.json(await service.overview(req.auth.user))));
  router.post('/links', asyncHandler(async (req, res) => res.status(201).json(await service.accept(req.auth.user, req.body))));
  router.delete('/links/:linkId', asyncHandler(async (req, res) => res.json(await service.endLink(req.auth.user, req.params.linkId))));
  router.post('/assignments/:id/complete', asyncHandler(async (req, res) => res.json(await service.complete(req.auth.user, req.params.id))));
  router.post('/assignments/:id/decline', asyncHandler(async (req, res) => res.json(await service.decline(req.auth.user, req.params.id))));
  return router;
}
module.exports = { createCoachingRouter };
