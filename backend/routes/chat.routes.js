'use strict';
const express = require('express');
const { createChatService } = require('../services/chat.service');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');
function createChatRouter({ db, ai }) {
  const router = express.Router();
  const service = createChatService({ db, ai });
  router.use(createRequireAuth({ db }), requireMember);
  router.get('/memory', asyncHandler(async (req, res) => res.json(await service.memory(req.auth.user))));
  router.delete('/memory', asyncHandler(async (req, res) => res.json(await service.clearMemory(req.auth.user))));
  router.get('/sessions', asyncHandler(async (req, res) => res.json(await service.sessions(req.auth.user))));
  router.get('/sessions/:sessionId/messages', asyncHandler(async (req, res) => res.json(await service.messages(req.auth.user, req.params.sessionId))));
  router.delete('/sessions/:sessionId', asyncHandler(async (req, res) => res.json(await service.remove(req.auth.user, req.params.sessionId))));
  router.post('/messages', asyncHandler(async (req, res) => {
    const result = await service.send(req.auth.user, req.body);
    res.status(result.replayed ? 200 : 201).json(result);
  }));
  return router;
}
module.exports = { createChatRouter };
