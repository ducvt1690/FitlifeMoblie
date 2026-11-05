'use strict';
// Fixture for unrelated business tests. Email OTP itself is exercised over HTTP
// in email-verification.test.js, without this helper.
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { validateRegistration } = require('../auth/registration');
const tokens = new Map();
module.exports = async function verifiedRegistration(db, body) {
  const valid = validateRegistration(body);
  if (!valid || body.verification_token !== undefined) return body;
  if (!tokens.has(valid.email)) tokens.set(valid.email, randomBytes(32).toString('base64url'));
  const token = tokens.get(valid.email);
  await db.collection('registration_email_verifications').updateOne({ _id: valid.email }, {
    $setOnInsert: { nonce: randomUUID(), attempts: 1, ready: false, sent_at: new Date(),
      token_hash: createHash('sha256').update(token).digest('hex'), expires_at: new Date(Date.now() + 600000) },
  }, { upsert: true });
  return { ...body, verification_token: token };
};
