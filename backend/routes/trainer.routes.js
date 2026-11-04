'use strict';
const express = require('express');
const { createTrainerService } = require('../services/trainer.service');
const { createRequireAuth, requireRole } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');
function createTrainerRouter({ db }) {
  const router = express.Router();
  const service = createTrainerService({ db });
  const trainer = req => req.auth.user;
  router.use(createRequireAuth({ db }), requireRole('trainer'));
  router.get('/overview', asyncHandler(async (req, res) => res.json(await service.overview(trainer(req)))));
  router.get('/links', asyncHandler(async (req, res) => res.json(await service.listLinks(trainer(req)))));
  router.post('/links', asyncHandler(async (req, res) => res.status(201).json(await service.createInvite(trainer(req)))));
  router.delete('/links/:linkId', asyncHandler(async (req, res) => res.json(await service.endLink(trainer(req), req.params.linkId))));
  router.get('/templates', asyncHandler(async (req, res) => res.json(await service.listTemplates(trainer(req)))));
  router.post('/templates', asyncHandler(async (req, res) => res.status(201).json(await service.createTemplate(trainer(req), req.body))));
  router.patch('/templates/:templateId', asyncHandler(async (req, res) => res.json(await service.updateTemplate(trainer(req), req.params.templateId, req.body))));
  router.get('/assignments', asyncHandler(async (req, res) => res.json(await service.listAssignments(trainer(req), req.query.status))));
  router.post('/assignments', asyncHandler(async (req, res) => res.status(201).json(await service.assign(trainer(req), req.body))));
  router.post('/assignments/:id/cancel', asyncHandler(async (req, res) => res.json(await service.cancelAssignment(trainer(req), req.params.id))));
  router.get('/students/:userId', asyncHandler(async (req, res) => res.json(await service.student(trainer(req), req.params.userId, req.query.days))));
  return router;
}
module.exports = { createTrainerRouter };
