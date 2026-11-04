'use strict';

const { createHash } = require('node:crypto');
const DEFAULT_SESSION_TTL_SECONDS = 12 * 60 * 60;

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

module.exports = { DEFAULT_SESSION_TTL_SECONDS, hashToken, readBearerToken, publicUser };
