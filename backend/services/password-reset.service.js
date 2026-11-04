'use strict';
const { randomInt, randomUUID, createHash, timingSafeEqual } = require('node:crypto');
const { hashPassword } = require('../auth/password');
const { normalizeEmail } = require('../auth/registration');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { isPlainBody } = require('../utils/validate');

const CODE_TTL_MS = 10 * 60 * 1000;   // Mã có hiệu lực 10 phút
const RESEND_AFTER_MS = 60 * 1000;    // Tối đa 1 email mỗi phút cho một tài khoản
const MAX_ATTEMPTS = 5;               // Nhập sai 5 lần thì mã bị khóa
const SENT = 'Nếu email đã đăng ký, mã xác nhận gồm 6 chữ số đã được gửi. Mã có hiệu lực trong 10 phút.';
const INVALID = 'Mã xác nhận không đúng hoặc đã hết hạn.';

// Same rule as registration: 8+ characters, not only spaces, at most 1024 bytes.
const isNewPassword = value => typeof value === 'string' && [...value].length >= 8
  && Buffer.byteLength(value, 'utf8') <= 1024 && value.trim().length > 0;
// Hash with reset_id so the same 6 digits in two requests never share a digest.
const hashCode = (resetId, code) => createHash('sha256').update(`${resetId}:${code}`, 'utf8').digest('hex');

function createPasswordResetService({ db, mailer }) {
  const resets = () => db.collection('password_resets');
  return {
    // Bước 1: gửi mã. Luôn trả cùng một câu để không lộ email nào đã đăng ký.
    async request(body) {
      if (!mailer?.configured) throw new HttpError(503, 'Chức năng quên mật khẩu chưa được cấu hình email.');
      const email = isPlainBody(body, ['email']) ? normalizeEmail(body.email) : null;
      if (!email) throw new HttpError(400, 'Email không hợp lệ.');
      const user = await db.collection('users').findOne({ email, is_active: true }, { projection: { user_id: 1, password_hash: 1 } });
      if (!user?.password_hash) return { success: true, message: SENT };
      const now = new Date();
      const latest = await resets().findOne({ user_id: user.user_id, used_at: null }, { sort: { created_at: -1 } });
      if (latest && now - latest.created_at < RESEND_AFTER_MS) return { success: true, message: SENT };
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      const resetId = randomUUID();
      // A new code replaces every unused older code.
      await resets().deleteMany({ user_id: user.user_id, used_at: null });
      await resets().insertOne({ reset_id: resetId, user_id: user.user_id, code_hash: hashCode(resetId, code), attempts: 0,
        expires_at: new Date(now.getTime() + CODE_TTL_MS), used_at: null, created_at: now, updated_at: now });
      try {
        await mailer.send({ to: email, subject: 'FitLife - Mã đặt lại mật khẩu',
          text: `Mã đặt lại mật khẩu FitLife của bạn là: ${code}\nMã có hiệu lực trong 10 phút.\nNếu bạn không yêu cầu, hãy bỏ qua email này.` });
      } catch {
        await resets().deleteOne({ reset_id: resetId });
        throw new HttpError(503, 'Không gửi được email lúc này. Vui lòng thử lại sau.');
      }
      return { success: true, message: SENT };
    },

    // Bước 2: nhập mã + mật khẩu mới.
    async reset(body) {
      if (!isPlainBody(body, ['email', 'code', 'new_password']) || typeof body.code !== 'string'
        || !/^\d{6}$/.test(body.code) || !isNewPassword(body.new_password)) {
        throw new HttpError(400, 'Cần email, code gồm 6 chữ số và new_password (tối thiểu 8 ký tự).');
      }
      const email = normalizeEmail(body.email);
      if (!email) throw new HttpError(400, 'Email không hợp lệ.');
      const user = await db.collection('users').findOne({ email, is_active: true }, { projection: { user_id: 1 } });
      if (!user) throw new HttpError(400, INVALID);
      const now = new Date();
      // Count the attempt BEFORE comparing, so parallel guesses still stop at 5.
      const reset = await resets().findOneAndUpdate(
        { user_id: user.user_id, used_at: null, expires_at: { $gt: now }, attempts: { $lt: MAX_ATTEMPTS } },
        { $inc: { attempts: 1 }, $set: { updated_at: now } },
        { sort: { created_at: -1 }, returnDocument: 'after' });
      if (!reset) throw new HttpError(400, INVALID);
      const matches = timingSafeEqual(Buffer.from(reset.code_hash, 'hex'), Buffer.from(hashCode(reset.reset_id, body.code), 'hex'));
      if (!matches) throw new HttpError(400, INVALID);
      const passwordHash = await hashPassword(body.new_password);
      await transaction(db, async session => {
        const done = new Date();
        // used_at filter: a code can reset the password only once, even with two parallel requests.
        const used = await resets().updateOne({ reset_id: reset.reset_id, used_at: null },
          { $set: { used_at: done, updated_at: done } }, { session });
        if (!used.modifiedCount) throw new HttpError(400, INVALID);
        await db.collection('users').updateOne({ user_id: user.user_id },
          { $set: { password_hash: passwordHash, updated_at: done } }, { session });
        // Sign out every device: whoever held an old session loses it.
        await db.collection('auth_sessions').deleteMany({ user_id: user.user_id }, { session });
      });
      return { success: true, message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.' };
    },
  };
}

module.exports = { createPasswordResetService };
