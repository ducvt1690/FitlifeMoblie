'use strict';
const { randomUUID } = require('node:crypto');
const { localDay } = require('../auth/registration');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { isDate, isText, isPlainBody } = require('../utils/validate');
const { createQuestService, lockMember } = require('./quest.service');

const SLEEP_QUALITIES = ['Sâu', 'Bình thường', 'Chập chờn'];

// Sleep and mood allow one record per user/day: a same-day save updates it and keeps its UUID.
const kinds = {
  sleep: {
    collection: 'sleep_logs', id: 'sleep_id', dateField: 'sleep_date', reward: 'rewardSleep',
    parse(body) {
      if (!isPlainBody(body, ['hours', 'quality']) || typeof body.hours !== 'number' || !Number.isFinite(body.hours)
        || body.hours < 0 || body.hours > 24 || !SLEEP_QUALITIES.includes(body.quality)) {
        throw new HttpError(400, `Cần hours từ 0 đến 24 và quality là một trong: ${SLEEP_QUALITIES.join(', ')}.`);
      }
      return { hours: Math.round(body.hours * 10) / 10, quality: body.quality };
    },
  },
  mood: {
    collection: 'mood_logs', id: 'mood_id', dateField: 'mood_date', reward: 'rewardMood',
    parse(body) {
      if (!isPlainBody(body, ['mood_label', 'note']) || !isText(body.mood_label, 50)
        || (body.note !== undefined && (typeof body.note !== 'string' || [...body.note.trim()].length > 2000))) {
        throw new HttpError(400, 'Cần mood_label (1–50 ký tự) và note tùy chọn tối đa 2000 ký tự.');
      }
      return { mood_label: body.mood_label.trim(), note: (body.note ?? '').trim() };
    },
  },
};

function createDailyLogService({ db, kind }) {
  const spec = kinds[kind];
  const quests = createQuestService({ db });
  return {
    async get(user, requestedDate) {
      const date = requestedDate ?? localDay(new Date(), user.timezone);
      if (!isDate(date)) throw new HttpError(400, 'Ngày không hợp lệ. Dùng định dạng YYYY-MM-DD.');
      const log = await db.collection(spec.collection).findOne({ user_id: user.user_id, [spec.dateField]: date }, { projection: { _id: 0 } });
      return { success: true, date, log };
    },
    async save(member, body) {
      const input = spec.parse(body);
      return transaction(db, async session => {
        const now = new Date();
        const user = await lockMember(db, member.user_id, session, now);
        const day = localDay(now, user.timezone);
        await db.collection(spec.collection).updateOne({ user_id: user.user_id, [spec.dateField]: day }, {
          $set: { ...input, updated_at: now },
          $setOnInsert: { [spec.id]: randomUUID(), user_id: user.user_id, [spec.dateField]: day, created_at: now },
        }, { upsert: true, session });
        const log = await db.collection(spec.collection).findOne({ user_id: user.user_id, [spec.dateField]: day }, { session, projection: { _id: 0 } });
        const reward = await quests[spec.reward](user, day, now, session);
        return { success: true, log, reward_coins: reward, fit_coins: user.fit_coins + reward };
      });
    },
  };
}

module.exports = { createDailyLogService, SLEEP_QUALITIES };
