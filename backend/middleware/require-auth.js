'use strict';
const { readBearerToken } = require('../auth/session');
const { createSessionService } = require('../services/session.service');
function createRequireAuth({ db }) {
  const sessions = createSessionService({ db });
  return async (req, res, next) => {
    try { req.auth = await sessions.authenticate(readBearerToken(req)); next(); }
    catch (error) { next(error); }
  };
}
function requireMember(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (req.auth.user.role !== 'user') return res.status(403).json({ success: false, message: 'Chức năng này dành cho tài khoản user.' });
  next();
}
module.exports = { createRequireAuth, requireMember };
