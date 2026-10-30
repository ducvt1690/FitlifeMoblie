'use strict';
const { randomUUID } = require('node:crypto');
const { localDay } = require('../auth/registration');
const templates = require('../database/mongodb/data/catalogs.json').quest_templates;
function createQuestService({ db }) {
  async function rewardActivity(user, day, now, session, questKey) {
    for (const t of templates) await db.collection('daily_quest_logs').updateOne(
      { user_id: user.user_id, quest_date: day, quest_key: t.quest_key },
      { $setOnInsert: { ...t, quest_log_id: randomUUID(), user_id: user.user_id, quest_date: day,
        is_completed: false, completed_at: null, created_at: now, updated_at: now } }, { upsert: true, session });
    const changed = await db.collection('daily_quest_logs').updateOne(
      { user_id: user.user_id, quest_date: day, quest_key: questKey, is_completed: false },
      { $set: { is_completed: true, completed_at: now, updated_at: now } }, { session });
    const reward = changed.modifiedCount ? 10 : 0;
    if (reward) await db.collection('users').updateOne({ user_id: user.user_id }, { $inc: { fit_coins: reward } }, { session });
    return reward;
  }
  return {
    async getToday(user) {
      const date = localDay(new Date(), user.timezone);
      const quests = await db.collection('daily_quest_logs').find({ user_id: user.user_id, quest_date: date }, { projection: { _id: 0 } }).toArray();
      return { success: true, date, quests: templates.map(t => quests.find(q => q.quest_key === t.quest_key) || { ...t, quest_date: date, is_completed: false, completed_at: null }) };
    },
    rewardWater: (user, day, now, session) => rewardActivity(user, day, now, session, 'q_water'),
    rewardWorkout: (user, day, now, session) => rewardActivity(user, day, now, session, 'q_workout'),
  };
}
module.exports = { createQuestService };
