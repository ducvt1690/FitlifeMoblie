'use strict';

const { localDay } = require('../auth/registration');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { currentWaterTarget } = require('../utils/water-target');
const { createQuestService } = require('./quest.service');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const INT32_MAX = 2147483647;
const fields = ['workout_id', 'title', 'category', 'duration_seconds', 'calories_burned'];
const fail = (status, message) => new HttpError(status, message);
const validText = (value, max) => typeof value === 'string'
  && value.trim().length > 0 && [...value.trim()].length <= max;
const validInt = (value, min) => Number.isInteger(value) && value >= min && value <= INT32_MAX;

function validateWorkout(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(key => !fields.includes(key))
    || typeof body.workout_id !== 'string' || !UUID.test(body.workout_id)
    || !validText(body.title, 150) || !validText(body.category, 50)
    || !validInt(body.duration_seconds, 1) || !validInt(body.calories_burned, 0)) {
    throw fail(400, 'Cần workout_id UUID, title (1–150 ký tự), category (1–50 ký tự), duration_seconds nguyên dương và calories_burned nguyên không âm; các số tối đa 2147483647.');
  }
  return { workout_id: body.workout_id, title: body.title.trim(), category: body.category.trim(),
    duration_seconds: body.duration_seconds, calories_burned: body.calories_burned };
}

function createWorkoutService({ db }) {
  const quests = createQuestService({ db });
  return {
    async list(user, requestedDate) {
      const date = requestedDate === undefined ? localDay(new Date(), user.timezone) : requestedDate;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
        || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
        throw fail(400, 'Ngày không hợp lệ. Dùng định dạng YYYY-MM-DD.');
      }
      const logs = await db.collection('workout_logs').find({
        user_id: user.user_id, workout_date: date,
      }, { projection: { _id: 0 } }).sort({ created_at: -1, workout_id: 1 }).toArray();
      return { success: true, date, logs,
        total_duration_seconds: logs.reduce((sum, log) => sum + log.duration_seconds, 0),
        total_calories_burned: logs.reduce((sum, log) => sum + log.calories_burned, 0) };
    },

    async create(member, body) {
      const input = validateWorkout(body);
      return transaction(db, async session => {
        // Lock this user's document before reading balances and granting rewards.
        // Concurrent workouts/profile changes then retry against a fresh snapshot.
        const now = new Date();
        const user = await db.collection('users').findOneAndUpdate({
          user_id: member.user_id, is_active: true, role: 'user',
        }, { $set: { updated_at: now } }, { session, returnDocument: 'after' });
        if (!user) throw fail(403, 'Tài khoản không còn khả dụng.');

        const existing = await db.collection('workout_logs').findOne({
          workout_id: input.workout_id,
        }, { session, projection: { _id: 0 } });
        if (existing) {
          if (existing.user_id !== user.user_id || fields.some(key => existing[key] !== input[key])) {
            throw fail(409, 'workout_id đã được sử dụng cho yêu cầu khác.');
          }
          return { log: existing, replayed: true, reward_coins: 0, fit_coins: user.fit_coins,
            target_water: await currentWaterTarget(db, user, { session, now }) };
        }

        const day = localDay(now, user.timezone);
        const log = { ...input, user_id: user.user_id, workout_date: day, created_at: now, updated_at: now };
        await db.collection('workout_logs').insertOne(log, { session });
        const reward = await quests.rewardWorkout(user, day, now, session);
        const targetWater = await currentWaterTarget(db, user, { session, now });
        await db.collection('users').updateOne({ user_id: user.user_id }, {
          $set: { target_water: targetWater, updated_at: now },
        }, { session });
        delete log._id;
        return { log, replayed: false, reward_coins: reward,
          fit_coins: user.fit_coins + reward, target_water: targetWater };
      });
    },
  };
}

module.exports = { createWorkoutService };
