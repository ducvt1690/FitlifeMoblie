'use strict';
const { localDay } = require('../auth/registration');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { createQuestService } = require('./quest.service');
const fail = (status, message) => new HttpError(status, message);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function createWaterService({ db }) {
  const quests = createQuestService({ db });
  return {
    async list(user, requestedDate) {
      const today = localDay(new Date(), user.timezone);
      const date = requestedDate || today;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
        || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw fail(400, 'Ngày không hợp lệ.');
      const logs = await db.collection('water_logs').find({ user_id: user.user_id, log_date: date }, { projection: { _id: 0 } }).sort({ created_at: -1, log_id: 1 }).toArray();
      return { success: true, date, logs, total: logs.reduce((sum, row) => sum + row.amount, 0), target: user.target_water };
    },
    async create(member, body) {
      if (!body || Array.isArray(body) || Object.keys(body).some(key => !['log_id', 'amount'].includes(key))
        || typeof body.log_id !== 'string' || !UUID.test(body.log_id) || !Number.isInteger(body.amount) || body.amount < 1 || body.amount > 5000) {
        throw fail(400, 'Cần log_id UUID và amount nguyên từ 1 đến 5000 ml.');
      }
      const result = await transaction(db, async session => {
        // Serialize changes to this user's balance/profile and reject a concurrent account lock.
        const user = await db.collection('users').findOneAndUpdate(
          { user_id: member.user_id, is_active: true, role: 'user' }, { $set: { updated_at: new Date() } }, { session, returnDocument: 'after' });
        if (!user) throw fail(403, 'Tài khoản không còn khả dụng.');
        const existing = await db.collection('water_logs').findOne({ log_id: body.log_id }, { session, projection: { _id: 0 } });
        if (existing) {
          if (existing.user_id !== user.user_id || existing.amount !== body.amount) throw fail(409, 'log_id đã được sử dụng cho yêu cầu khác.');
          return { log: existing, replayed: true, reward_coins: 0, fit_coins: user.fit_coins };
        }
        const now = new Date(), day = localDay(now, user.timezone);
        const log = { log_id: body.log_id, user_id: user.user_id, amount: body.amount, log_date: day,
          log_time: new Intl.DateTimeFormat('en-GB', { timeZone: user.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now), created_at: now, updated_at: now };
        await db.collection('water_logs').insertOne(log, { session });
        const reward = await quests.rewardWater(user, day, now, session);
        delete log._id;
        return { log, replayed: false, reward_coins: reward, fit_coins: user.fit_coins + reward };
      });
      return result;
    },
  };
}
module.exports = { createWaterService };
