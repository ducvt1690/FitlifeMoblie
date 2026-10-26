'use strict';

const express = require('express');
const { randomBytes } = require('node:crypto');
const { verifyPassword } = require('../auth/password');
const { hashToken, readBearerToken, publicUser, createRequireAuth } = require('../auth/session');

// Keep trust proxy disabled unless a trusted reverse proxy is configured.
function createLoginRateLimiter({ windowMs = 15 * 60 * 1000, max = 20, maxKeys = 10000 } = {}) {
  if (![windowMs, max, maxKeys].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new Error('Invalid login rate limit configuration.');
  }
  const attempts = new Map();
  let sweepAt = 0;
  return (req, res, next) => {
    const now = Date.now();
    if (now >= sweepAt || attempts.size >= maxKeys) {
      for (const [key, entry] of attempts) {
        if (entry.resetAt <= now) attempts.delete(key);
      }
      sweepAt = now + 60000;
    }
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let entry = attempts.get(key);
    if (entry && entry.resetAt <= now) {
      attempts.delete(key);
      entry = undefined;
    }
    if (!entry) {
      // Do not evict active keys, which could reset another IP's limit.
      if (attempts.size >= maxKeys) {
        res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
        return res.status(429).json({ success: false, message: 'Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau.' });
      }
      entry = { count: 0, resetAt: now + windowMs };
      attempts.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return res.status(429).json({ success: false, message: 'Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau.' });
    }
    return next();
  };
}

function createAuthRouter({ db, sessionTtlSeconds = 7 * 24 * 60 * 60, loginRateLimit } = {}) {
  if (!db || !Number.isSafeInteger(sessionTtlSeconds) || sessionTtlSeconds < 1 || sessionTtlSeconds > 30 * 24 * 60 * 60) {
    throw new Error('Invalid authentication configuration.');
  }
  const router = express.Router();
  const requireAuth = createRequireAuth({ db });
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/login', createLoginRateLimiter(loginRateLimit), async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      if (typeof email !== 'string' || typeof password !== 'string'
        || email.length > 254 || password.length < 1 || Buffer.byteLength(password, 'utf8') > 1024) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập Email và Mật khẩu hợp lệ.' });
      }
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập Email và Mật khẩu hợp lệ.' });
      }
      const user = await db.collection('users').findOne({ email: cleanEmail });
      // Unknown accounts still incur bounded hashing. Never use plaintext fallback.
      const matches = await verifyPassword(password, user && user.password_hash);
      if (!user || !matches) {
        return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
      }
      if (user.is_active !== true) {
        return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa.' });
      }
      const token = randomBytes(32).toString('base64url');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + sessionTtlSeconds * 1000);
      await db.collection('auth_sessions').insertOne({
        token_hash: hashToken(token), user_id: user.user_id, created_at: now, expires_at: expiresAt,
      });
      return res.json({
        success: true, message: 'Đăng nhập thành công.', token, token_type: 'Bearer',
        expires_at: expiresAt.toISOString(), user: publicUser(user),
      });
    } catch (error) { return next(error); }
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ success: true, user: publicUser(req.auth.user) });
  });

  // Idempotent; revoke only this session, preserving other devices' sessions.
  router.post('/logout', async (req, res, next) => {
    try {
      const token = readBearerToken(req);
      if (!token) return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ.' });
      await db.collection('auth_sessions').deleteOne({ token_hash: hashToken(token) });
      return res.status(204).end();
    } catch (error) { return next(error); }
  });
  return router;
}

module.exports = { createAuthRouter, createLoginRateLimiter };
