'use strict';

const { createHash } = require('node:crypto');

function hashToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function readBearerToken(req) {
  const header = req.get('authorization');
  if (typeof header !== 'string') return null;
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(header);
  return match ? match[1] : null;
}

function publicUser(user) {
  return {
    id: user.user_id, user_id: user.user_id, email: user.email, name: user.full_name, role: user.role,
    profile: {
      height: user.height, weight: user.weight, target_water: user.target_water,
      target_calories: user.target_calories, coins: user.fit_coins,
    },
  };
}

function createRequireAuth({ db }) {
  return async (req, res, next) => {
    try {
      const token = readBearerToken(req);
      if (!token) return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ.' });
      const tokenHash = hashToken(token);
      // TTL deletion is asynchronous: always enforce expiry in the lookup.
      const session = await db.collection('auth_sessions').findOne({
        token_hash: tokenHash, expires_at: { $gt: new Date() },
      });
      if (!session) return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
      const user = await db.collection('users').findOne({ user_id: session.user_id }, {
        projection: { password_hash: 0 },
      });
      if (!user) return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ.' });
      if (user.is_active !== true) return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa.' });
      req.auth = { user, session, tokenHash };
      return next();
    } catch (error) { return next(error); }
  };
}

module.exports = { hashToken, readBearerToken, publicUser, createRequireAuth };
