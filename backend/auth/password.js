'use strict';

const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const deriveKey = promisify(scrypt);
const DUMMY = {
  N: 16384, r: 8, p: 1,
  salt: '00000000000000000000000000000000',
  expected: Buffer.alloc(64),
};

function parseScryptHash(value) {
  if (typeof value !== 'string' || value.length > 1024) return null;
  const match = /^scrypt\$(\d{1,5})\$(\d{1,2})\$(\d{1,2})\$([0-9a-f]{32,128})\$([0-9a-f]{128})$/i.exec(value);
  if (!match) return null;
  const N = Number(match[1]);
  const r = Number(match[2]);
  const p = Number(match[3]);
  if (N < 16384 || N > 65536 || (N & (N - 1)) !== 0 || r < 1 || r > 8
    || p < 1 || p > 4 || N * r * p > 524288) return null;
  // The existing seed passes the hex salt as UTF-8 text, not decoded bytes.
  return { N, r, p, salt: match[4], expected: Buffer.from(match[5], 'hex') };
}

async function verifyPassword(password, storedHash) {
  const validPassword = typeof password === 'string' && password.length > 0
    && Buffer.byteLength(password, 'utf8') <= 1024;
  const parsed = parseScryptHash(storedHash);
  const parameters = parsed || DUMMY;
  const derived = await deriveKey(validPassword ? password : '', parameters.salt, 64, {
    N: parameters.N, r: parameters.r, p: parameters.p, maxmem: 96 * 1024 * 1024,
  });
  const equal = timingSafeEqual(derived, parameters.expected);
  return validPassword && parsed !== null && equal;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await deriveKey(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt}$${derived.toString('hex')}`;
}

module.exports = { verifyPassword, hashPassword };
