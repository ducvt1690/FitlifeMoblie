'use strict';
const { createHmac, timingSafeEqual } = require('node:crypto');

// VNPay 2.1.0 signs the sorted, form-encoded query (spaces as '+') with HMAC-SHA512.
const encode = value => encodeURIComponent(value).replace(/%20/g, '+');

function signedQuery(params) {
  return Object.keys(params).filter(key => params[key] !== undefined && params[key] !== '').sort()
    .map(key => `${encode(key)}=${encode(String(params[key]))}`).join('&');
}

const sign = (secret, query) => createHmac('sha512', secret).update(Buffer.from(query, 'utf8')).digest('hex');

function buildPaymentUrl({ payUrl, hashSecret }, params) {
  const query = signedQuery(params);
  return `${payUrl}?${query}&vnp_SecureHash=${sign(hashSecret, query)}`;
}

// Returns the vnp_* fields when the callback signature is valid, otherwise null.
function verifyCallback(hashSecret, query) {
  if (!query || typeof query.vnp_SecureHash !== 'string' || !/^[0-9a-f]{128}$/i.test(query.vnp_SecureHash)) return null;
  if (Object.entries(query).some(([key, value]) => key.startsWith('vnp_') && typeof value !== 'string')) return null;
  const fields = {};
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('vnp_') && key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType' && typeof value === 'string') fields[key] = value;
  }
  const expected = Buffer.from(sign(hashSecret, signedQuery(fields)), 'utf8');
  const actual = Buffer.from(query.vnp_SecureHash.toLowerCase(), 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? fields : null;
}

// VNPay expects yyyyMMddHHmmss in Vietnam time (GMT+7).
function vnTime(date) {
  const local = new Date(date.getTime() + 7 * 3600000);
  return local.toISOString().slice(0, 19).replace(/[-T:]/g, '');
}

module.exports = { buildPaymentUrl, verifyCallback, signedQuery, sign, vnTime };
