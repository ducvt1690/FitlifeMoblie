'use strict';
const { randomUUID } = require('node:crypto');
const { verifyPassword, hashPassword } = require('../auth/password');
const { DEFAULT_SESSION_TTL_SECONDS, publicUser } = require('../auth/session');
const { validateRegistration, validateProfile, localDay } = require('../auth/registration');
const { createSessionService } = require('./session.service');
const { calculateTargets } = require('../utils/health-targets');
const { currentWaterTarget } = require('../utils/water-target');
const { withCurrentAge } = require('../utils/birth-date');
const { HttpError } = require('../utils/http-error');
const { quest_templates: questTemplates } = require('../database/mongodb/data/catalogs.json');

async function registerUser(db, input, sessions) {
  const { password, ...profile } = input;
  // Hashing happens outside the transaction so retries do not repeat expensive work.
  const passwordHash = await hashPassword(password);
  const now = new Date();
  // Hashing can cross local midnight: use one server instant for age, targets,
  // quest day and session creation, rather than retaining yesterday's age.
  const currentProfile = validateProfile({ ...profile,
    age: profile.date_of_birth === undefined ? profile.age : undefined }, now);
  if (!currentProfile) throw new HttpError(400, 'Ngày sinh hoặc thông tin hồ sơ không hợp lệ.');
  const stamp = { created_at: now, updated_at: now };
  const user = {
    ...currentProfile, email: profile.email, user_id: randomUUID(), password_hash: passwordHash,
    role: 'user', is_active: true, fit_coins: 0, streak_days: 0,
    ...calculateTargets(currentProfile, now), ...stamp,
  };
  const questDate = localDay(now, profile.timezone);
  const quests = questTemplates.map((quest) => ({
    ...quest, quest_log_id: randomUUID(), user_id: user.user_id, quest_date: questDate,
    is_completed: false, completed_at: null, ...stamp,
  }));
  const session = db.client.startSession();
  let issuedSession;
  try {
    await session.withTransaction(async () => {
      await db.collection('users').insertOne(user, { session });
      await db.collection('daily_quest_logs').insertMany(quests, { session });
      issuedSession = await sessions.create(user.user_id, { session, now });
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally {
    await session.endSession();
  }
  return {
    success: true, message: 'Đăng ký thành công.', ...issuedSession, user: publicUser(user),
  };
}


function createAuthService({ db, sessionTtlSeconds = DEFAULT_SESSION_TTL_SECONDS }) {
  const sessions = createSessionService({ db, sessionTtlSeconds });
  return {
    async register(body) {
      const input = validateRegistration(body);
      if (!input) throw new HttpError(400, 'Thông tin đăng ký không hợp lệ hoặc có trường không được phép.');
      if (await db.collection('users').findOne({ email: input.email }, { projection: { _id: 1 } })) {
        throw new HttpError(409, 'Email đã được đăng ký.');
      }
      try { return await registerUser(db, input, sessions); }
      catch (error) {
        if (error.code === 11000 && error.keyPattern?.email === 1) throw new HttpError(409, 'Email đã được đăng ký.');
        throw error;
      }
    },
    async login(body) {
      const { email, password } = body || {};
      if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254
        || password.length < 1 || Buffer.byteLength(password, 'utf8') > 1024) {
        throw new HttpError(400, 'Vui lòng nhập Email và Mật khẩu hợp lệ.');
      }
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new HttpError(400, 'Vui lòng nhập Email và Mật khẩu hợp lệ.');
      }
      let user = await db.collection('users').findOne({ email: cleanEmail });
      const matches = await verifyPassword(password, user && user.password_hash);
      if (!user || !matches) throw new HttpError(401, 'Email hoặc mật khẩu không chính xác.');
      if (user.is_active !== true) throw new HttpError(403, 'Tài khoản đã bị khóa.');
      const now = new Date();
      user = withCurrentAge(user, now);
      if (user.date_of_birth !== undefined) user.target_calories = calculateTargets(user, now).target_calories;
      if (user.role === 'user') user.target_water = await currentWaterTarget(db, user, { now });
      return { success: true, message: 'Đăng nhập thành công.', ...await sessions.create(user.user_id), user: publicUser(user) };
    },
  };
}
module.exports = { createAuthService };
