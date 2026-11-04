'use strict';

// Keep trust proxy disabled unless a trusted reverse proxy is configured.
function createLoginRateLimiter({ windowMs = 15 * 60 * 1000, max = 20, maxKeys = 10000,
  message = 'Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau.' } = {}) {
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
        return res.status(429).json({ success: false, message });
      }
      entry = { count: 0, resetAt: now + windowMs };
      attempts.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return res.status(429).json({ success: false, message });
    }
    return next();
  };
}


module.exports = { createLoginRateLimiter };
