'use strict';
const { validateProfile, normalizeEmail, localDay } = require('../auth/registration');
const { withCurrentAge } = require('../utils/birth-date');
const { calculateTargets } = require('../utils/health-targets');
const { currentWaterTarget } = require('../utils/water-target');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { upsertBmi } = require('../utils/bmi');
const fail = (status, message) => new HttpError(status, message);
const profileFields = ['full_name', 'gender', 'age', 'height', 'weight', 'activity_level', 'goal'];
const editableFields = ['email', 'date_of_birth', ...profileFields];
function publicProfile(user, now = new Date()) {
  const current = withCurrentAge(user, now);
  return { ...Object.fromEntries(['user_id', 'email', 'role', ...profileFields, 'timezone', 'target_water',
    'target_calories', 'fit_coins', 'streak_days'].map(key => [key, current[key]])),
    date_of_birth: user.date_of_birth ?? null,
    ...(user.date_of_birth === undefined ? {} : { target_calories: calculateTargets(current, now).target_calories }) };
}

function createProfileService({ db }) {
  return {
    get(user) { return publicProfile(user); },
    async update(user, body) {
      if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length
        || Object.keys(body).some(key => !editableFields.includes(key))) {
        throw fail(400, 'Chỉ được cập nhật thông tin hồ sơ; không gửi role, xu, timezone hoặc mục tiêu tự tính.');
      }
      const email = Object.hasOwn(body, 'email') ? normalizeEmail(body.email) : undefined;
      if (email === null) throw fail(400, 'Email không hợp lệ.');
      try {
        return await transaction(db, async session => {
          const current = await db.collection('users').findOne({ user_id: user.user_id, is_active: true, role: 'user' }, { session });
          if (!current) throw fail(403, 'Tài khoản không còn khả dụng.');
          const now = new Date();
          const input = { ...Object.fromEntries(['timezone', ...profileFields].map(key => [key, current[key]])),
            ...(current.date_of_birth === undefined ? {} : { date_of_birth: current.date_of_birth }), ...body };
          // A saved age is a cache. Derive it again when a birthday exists, unless
          // the caller explicitly supplied age and needs consistency validation.
          if (input.date_of_birth !== undefined && !Object.hasOwn(body, 'age')) delete input.age;
          const valid = validateProfile(input, now);
          if (!valid) throw fail(400, 'Thông tin hồ sơ không hợp lệ.');
          const update = Object.fromEntries(profileFields.map(key => [key, valid[key]]));
          if (valid.date_of_birth !== undefined) update.date_of_birth = valid.date_of_birth;
          if (email !== undefined) update.email = email;
          Object.assign(update, calculateTargets(valid, now), { updated_at: now });
          update.target_water = await currentWaterTarget(db, { ...current, ...valid }, { session, now });
          await db.collection('users').updateOne({ user_id: current.user_id }, { $set: update }, { session });
          // A body/height change is also today's BMI history entry.
          if (update.weight !== current.weight || update.height !== current.height) {
            await upsertBmi(db, { ...current, ...update }, localDay(now, current.timezone), now, session);
          }
          return publicProfile({ ...current, ...update }, now);
        });
      } catch (error) {
        if (error.code === 11000 && error.keyPattern?.email === 1) throw fail(409, 'Email đã được đăng ký.');
        throw error;
      }
    },
  };
}
module.exports = { createProfileService };
