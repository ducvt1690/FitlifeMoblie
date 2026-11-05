'use strict';
const { randomInt, randomUUID, randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const { normalizeEmail } = require('../auth/registration');
const { isPlainBody } = require('../utils/validate');
const { HttpError } = require('../utils/http-error');
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const digest = value => createHash('sha256').update(value).digest('hex');
function createEmailVerificationService({ db, mailer }) {
  const rows = () => db.collection('registration_email_verifications');
  return {
    async send(body) {
      const email = isPlainBody(body, ['email']) && normalizeEmail(body.email);
      if (!email) throw new HttpError(400, 'Email không hợp lệ.');
      if (!mailer?.smtp) throw new HttpError(503, 'Chưa cấu hình SMTP gửi email xác minh.');
      if (await db.collection('users').findOne({ email })) throw new HttpError(409, 'Email đã được đăng ký.');
      const now = new Date();
      const nonce = randomUUID();
      const code = String(randomInt(1000000)).padStart(6, '0');
      try {
        // The unique _id makes this cooldown atomic, including parallel requests.
        await rows().updateOne({ _id: email, sent_at: { $lte: new Date(now - RESEND_MS) } }, {
          $set: { nonce, code_hash: digest(nonce + ':' + code), attempts: 0, sent_at: now,
            expires_at: new Date(+now + CODE_TTL_MS), token_hash: null, ready: false },
        }, { upsert: true });
      } catch (error) {
        if (error.code === 11000) throw new HttpError(429, 'Vui lòng chờ 60 giây trước khi gửi lại mã.');
        throw error;
      }
      try {
        await mailer.send({ to: email, subject: 'FitLife - Xác minh email đăng ký',
          text: `Mã xác minh email FitLife: ${code}\nCó hiệu lực 10 phút. Không chia sẻ mã này.` });
        await rows().updateOne({ _id: email, nonce }, { $set: { ready: true } });
      } catch {
        // Never remove a newer code if another request has replaced this one.
        await rows().deleteOne({ _id: email, nonce });
        throw new HttpError(503, 'Không gửi được email. Vui lòng thử lại.');
      }
      return { success: true, expires_in: 600, resend_after: 60, message: 'Đã gửi mã xác minh đến email.' };
    },
    async verify(body) {
      const email = isPlainBody(body, ['email', 'code']) && normalizeEmail(body.email);
      if (!email || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) throw new HttpError(400, 'Cần email và mã 6 chữ số.');
      // Reserve an attempt before comparison so parallel guesses cannot bypass the cap.
      const row = await rows().findOneAndUpdate({ _id: email, ready: true, token_hash: null,
        attempts: { $lt: MAX_ATTEMPTS }, expires_at: { $gt: new Date() } }, { $inc: { attempts: 1 } }, { returnDocument: 'after' });
      if (!row || !timingSafeEqual(Buffer.from(row.code_hash, 'hex'), Buffer.from(digest(row.nonce + ':' + body.code), 'hex'))) {
        throw new HttpError(400, 'Mã không đúng, đã dùng hoặc hết hạn.');
      }
      const token = randomBytes(32).toString('base64url');
      const changed = await rows().updateOne({ _id: email, nonce: row.nonce, ready: true, token_hash: null,
        expires_at: { $gt: new Date() } }, { $set: { token_hash: digest(token), ready: false, expires_at: new Date(Date.now() + CODE_TTL_MS) },
        $unset: { code_hash: '' } });
      if (!changed.modifiedCount) throw new HttpError(400, 'Mã đã dùng hoặc hết hạn.');
      return { success: true, verification_token: token, expires_in: 600 };
    },
  };
}
module.exports = { createEmailVerificationService };
