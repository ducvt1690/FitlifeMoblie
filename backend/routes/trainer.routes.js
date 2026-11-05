'use strict';
const express = require('express');
const { createTrainerService } = require('../services/trainer.service');
const { createRequireAuth, requireRole, requireMember } = require('../middleware/require-auth');
const { createLoginRateLimiter } = require('../middleware/rate-limit');
const { asyncHandler } = require('../utils/async-handler');
function createTrainerRouter({ db }) {
  const r = express.Router(),
    s = createTrainerService({ db });
  r.use(createRequireAuth({ db }), requireRole('trainer'));
  r.post(
    '/links/:id/end',
    asyncHandler(async (q, p) => p.json(await s.end(q.auth.user, q.params.id))),
  );
  r.get(
    '/templates',
    asyncHandler(async (q, p) => p.json(await s.templates(q.auth.user, q.query))),
  );
  r.post(
    '/templates',
    asyncHandler(async (q, p) => p.status(201).json(await s.createTemplate(q.auth.user, q.body))),
  );
  r.patch(
    '/templates/:id',
    asyncHandler(async (q, p) => p.json(await s.updateTemplate(q.auth.user, q.params.id, q.body))),
  );
  r.delete('/templates/:id', asyncHandler(async (q, p) => p.json(await s.deleteTemplate(q.auth.user, q.params.id))));
  r.get(
    '/students',
    asyncHandler(async (q, p) => p.json(await s.students(q.auth.user, q.query))),
  );
  r.get('/students/:id/progress', asyncHandler(async (q, p) => p.json(await s.progress(q.auth.user, q.params.id, q.query))));
  r.get('/invites', asyncHandler(async (q, p) => p.json(await s.invites(q.auth.user, q.query))));
  r.post('/invites/:id/revoke', asyncHandler(async (q, p) => p.json(await s.revokeInvite(q.auth.user, q.params.id))));
  r.post(
    '/invites',
    createLoginRateLimiter({ max: 10 }),
    asyncHandler(async (q, p) => p.status(201).json(await s.invite(q.auth.user))),
  );
  r.get(
    '/assignments',
    asyncHandler(async (q, p) => p.json(await s.assignments(q.auth.user, q.query))),
  );
  r.post(
    '/assignments',
    asyncHandler(async (q, p) => { const result = await s.assign(q.auth.user, q.body); p.status(result.replayed ? 200 : 201).json(result); }),
  );
  r.post('/assignments/:id/cancel', asyncHandler(async (q, p) => p.json(await s.cancel(q.auth.user, q.params.id, q.body))));
  r.post('/assignments/:id/feedback', asyncHandler(async (q, p) => p.json(await s.feedback(q.auth.user, q.params.id, q.body))));
  return r;
}
function createTrainerMemberRouter({ db }) {
  const r = express.Router(),
    s = createTrainerService({ db });
  r.use(createRequireAuth({ db }), requireMember);
  r.post(
    '/:id/end',
    asyncHandler(async (q, p) => p.json(await s.end(q.auth.user, q.params.id))),
  );
  r.get(
    '/',
    asyncHandler(async (q, p) => p.json(await s.member(q.auth.user, q.query))),
  );
  r.post(
    '/accept',
    createLoginRateLimiter({ max: 10 }),
    asyncHandler(async (q, p) => p.json(await s.accept(q.auth.user, q.body))),
  );
  r.post(
    '/assignments/:id/done',
    asyncHandler(async (q, p) => p.json(await s.done(q.auth.user, q.params.id))),
  );
  return r;
}
module.exports = { createTrainerRouter, createTrainerMemberRouter };
