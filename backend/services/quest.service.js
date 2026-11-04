'use strict';
const { randomUUID } = require('node:crypto');
const { localDay } = require('../auth/registration');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { changeCoins } = require('../utils/coins');
const { addDays, isDate } = require('../utils/validate');
const templates = require('../database/mongodb/data/catalogs.json').quest_templates;
const STREAK_MIN_QUESTS = 5;

// Lock the member's document first, so concurrent rewards retry against a fresh balance.
async function lockMember(db, userId, session, now) {
  const user = await db.collection('users').findOneAndUpdate({ user_id: userId, is_active: true, role: 'user' },
    { $set: { updated_at: now } }, { session, returnDocument: 'after' });
  if (!user) throw new HttpError(403, 'Tài khoản không còn khả dụng.');
  return user;
}

// A stored streak is only current while its last day is today or yesterday.
const currentStreak = (user, today) => [today, addDays(today, -1)].includes(user.streak_last_date) ? user.streak_days : 0;

function createQuestService({ db }) {
  async function updateStreak(user, day, now, session) {
    const done = await db.collection('daily_quest_logs').countDocuments({ user_id: user.user_id, quest_date: day, is_completed: true }, { session });
    if (done < STREAK_MIN_QUESTS) return;
    const fresh = await db.collection('users').findOne({ user_id: user.user_id }, { session, projection: { streak_days: 1, streak_last_date: 1 } });
    if (fresh.streak_last_date === day) return;
    const streak = fresh.streak_last_date === addDays(day, -1) ? fresh.streak_days + 1 : 1;
    await db.collection('users').updateOne({ user_id: user.user_id },
      { $set: { streak_days: streak, streak_last_date: day, updated_at: now } }, { session });
  }

  async function rewardActivity(user, day, now, session, questKey) {
    for (const t of templates) await db.collection('daily_quest_logs').updateOne(
      { user_id: user.user_id, quest_date: day, quest_key: t.quest_key },
      { $setOnInsert: { ...t, quest_log_id: randomUUID(), user_id: user.user_id, quest_date: day,
        is_completed: false, completed_at: null, created_at: now, updated_at: now } }, { upsert: true, session });
    const changed = await db.collection('daily_quest_logs').updateOne(
      { user_id: user.user_id, quest_date: day, quest_key: questKey, is_completed: false },
      { $set: { is_completed: true, completed_at: now, updated_at: now } }, { session });
    const reward = changed.modifiedCount ? 10 : 0;
    if (reward) {
      await changeCoins(db, { userId: user.user_id, amount: reward, source: 'quest', refId: `${questKey}:${day}`, now, session });
      await updateStreak(user, day, now, session);
    }
    return reward;
  }

  // Undo a quest reward when the last log of that day is deleted. Throws 409 (rolling back the delete) if coins were spent.
  async function unrewardActivity(user, day, now, session, questKey, rewardName, logName) {
    const changed = await db.collection('daily_quest_logs').updateOne(
      { user_id: user.user_id, quest_date: day, quest_key: questKey, is_completed: true },
      { $set: { is_completed: false, completed_at: null, updated_at: now } }, { session });
    if (!changed.modifiedCount) return 0;
    const debit = await changeCoins(db, { userId: user.user_id, amount: -10, source: 'quest_refund', refId: `${questKey}:${day}`, now, session });
    if (debit === null) throw new HttpError(409, `Không đủ xu để hoàn tác phần thưởng ${rewardName}. ${logName} chưa bị xóa.`);
    return 10;
  }

  return {
    // Quests of today, or of a past day with ?date=YYYY-MM-DD (days without activity show all 7 as not done).
    async getToday(user, requestedDate) {
      const today = localDay(new Date(), user.timezone);
      const date = requestedDate ?? today;
      if (!isDate(date) || date > today) throw new HttpError(400, 'Ngày không hợp lệ hoặc ở tương lai. Dùng định dạng YYYY-MM-DD.');
      const quests = await db.collection('daily_quest_logs').find({ user_id: user.user_id, quest_date: date }, { projection: { _id: 0 } }).toArray();
      return { success: true, date, fit_coins: user.fit_coins, streak_days: currentStreak(user, today), streak_min_quests: STREAK_MIN_QUESTS,
        quests: templates.map(t => quests.find(q => q.quest_key === t.quest_key) || { ...t, quest_date: date, is_completed: false, completed_at: null }) };
    },
    async checkin(member) {
      return transaction(db, async session => {
        const now = new Date();
        const user = await lockMember(db, member.user_id, session, now);
        const reward = await rewardActivity(user, localDay(now, user.timezone), now, session, 'q_checkin');
        return { success: true, message: reward ? 'Điểm danh thành công.' : 'Hôm nay bạn đã điểm danh rồi.',
          reward_coins: reward, fit_coins: user.fit_coins + reward };
      });
    },
    rewardWater: (user, day, now, session) => rewardActivity(user, day, now, session, 'q_water'),
    rewardWorkout: (user, day, now, session) => rewardActivity(user, day, now, session, 'q_workout'),
    rewardMeal: (user, day, now, session) => rewardActivity(user, day, now, session, 'q_meal'),
    rewardSleep: (user, day, now, session) => rewardActivity(user, day, now, session, 'q_sleep'),
    rewardMood: (user, day, now, session) => rewardActivity(user, day, now, session, 'q_mood'),
    rewardChat: (user, day, now, session) => rewardActivity(user, day, now, session, 'q_chat'),
    unrewardMeal: (user, day, now, session) => unrewardActivity(user, day, now, session, 'q_meal', 'bữa ăn', 'Bữa ăn'),
    unrewardWater: (user, day, now, session) => unrewardActivity(user, day, now, session, 'q_water', 'uống nước', 'Log nước'),
    unrewardWorkout: (user, day, now, session) => unrewardActivity(user, day, now, session, 'q_workout', 'tập luyện', 'Buổi tập'),
  };
}
module.exports = { createQuestService, lockMember, currentStreak };
