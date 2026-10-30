'use strict';
const { randomBytes } = require('node:crypto');
const { DEFAULT_SESSION_TTL_SECONDS, hashToken } = require('../auth/session');
const { HttpError } = require('../utils/http-error');
const { currentWaterTarget } = require('../utils/water-target');
const { withCurrentAge } = require('../utils/birth-date');
const { calculateTargets } = require('../utils/health-targets');

function createSessionService({ db, sessionTtlSeconds = DEFAULT_SESSION_TTL_SECONDS }) {
  if (!db || !Number.isSafeInteger(sessionTtlSeconds) || sessionTtlSeconds < 1 || sessionTtlSeconds > DEFAULT_SESSION_TTL_SECONDS) {
    throw new Error('Invalid authentication configuration.');
  }
  return {
    async create(userId, { session, now = new Date() } = {}) {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(now.getTime() + sessionTtlSeconds * 1000);
      await db.collection('auth_sessions').insertOne({
        token_hash: hashToken(token), user_id: userId, created_at: now, expires_at: expiresAt,
      }, { session });
      return { token, token_type: 'Bearer', expires_at: expiresAt.toISOString() };
    },
    async authenticate(token) {
      if (!token) throw new HttpError(401, 'Phiên đăng nhập không hợp lệ.');
      const tokenHash = hashToken(token), now = new Date();
      // Expiry is enforced immediately, independently of MongoDB TTL cleanup.
      const session = await db.collection('auth_sessions').findOne({
        token_hash: tokenHash, expires_at: { $gt: now },
        created_at: { $gt: new Date(now.getTime() - DEFAULT_SESSION_TTL_SECONDS * 1000) },
      });
      if (!session) throw new HttpError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
      let user = await db.collection('users').findOne({ user_id: session.user_id }, { projection: { password_hash: 0 } });
      if (!user) throw new HttpError(401, 'Phiên đăng nhập không hợp lệ.');
      if (user.is_active !== true) throw new HttpError(403, 'Tài khoản đã bị khóa.');
      user = withCurrentAge(user, now);
      if (user.date_of_birth !== undefined) user.target_calories = calculateTargets(user, now).target_calories;
      if (user.role === 'user') user.target_water = await currentWaterTarget(db, user, { now });
      return { user, session, tokenHash };
    },
    async revoke(token) {
      if (!token) throw new HttpError(401, 'Phiên đăng nhập không hợp lệ.');
      await db.collection('auth_sessions').deleteOne({ token_hash: hashToken(token) });
    },
  };
}
module.exports = { createSessionService };
