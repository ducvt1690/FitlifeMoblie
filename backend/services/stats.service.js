'use strict';
const { localDay } = require('../auth/registration');
const { HttpError } = require('../utils/http-error');
const { addDays } = require('../utils/validate');
const { currentStreak } = require('./quest.service');

// Sum one numeric field per day for the member's logs in the date range.
async function sumByDay(db, collection, dateField, user, days, sums) {
  const rows = await db.collection(collection).aggregate([
    { $match: { user_id: user.user_id, [dateField]: { $in: days } } },
    { $group: { _id: `$${dateField}`, count: { $sum: 1 },
      ...Object.fromEntries(Object.entries(sums).map(([name, field]) => [name, { $sum: `$${field}` }])) } },
  ]).toArray();
  return new Map(rows.map(row => [row._id, row]));
}

function createStatsService({ db }) {
  return {
    async summary(user, requestedDays) {
      const length = requestedDays === undefined ? 7 : Number(requestedDays);
      if (!Number.isInteger(length) || length < 1 || length > 31) throw new HttpError(400, 'days phải là số nguyên từ 1 đến 31.');
      const today = localDay(new Date(), user.timezone);
      const days = Array.from({ length }, (_, i) => addDays(today, i - length + 1));
      const [water, meals, workouts, quests, sleep, mood] = await Promise.all([
        sumByDay(db, 'water_logs', 'log_date', user, days, { ml: 'amount' }),
        sumByDay(db, 'meal_logs', 'meal_date', user, days, { calories: 'calories', protein: 'protein', carbs: 'carbs', fat: 'fat' }),
        sumByDay(db, 'workout_logs', 'workout_date', user, days, { seconds: 'duration_seconds', burned: 'calories_burned' }),
        db.collection('daily_quest_logs').aggregate([
          { $match: { user_id: user.user_id, quest_date: { $in: days }, is_completed: true } },
          { $group: { _id: '$quest_date', done: { $sum: 1 } } },
        ]).toArray().then(rows => new Map(rows.map(r => [r._id, r.done]))),
        db.collection('sleep_logs').find({ user_id: user.user_id, sleep_date: { $in: days } }).toArray()
          .then(rows => new Map(rows.map(r => [r.sleep_date, r]))),
        db.collection('mood_logs').find({ user_id: user.user_id, mood_date: { $in: days } }).toArray()
          .then(rows => new Map(rows.map(r => [r.mood_date, r]))),
      ]);
      return { success: true, today, streak_days: currentStreak(user, today), fit_coins: user.fit_coins,
        target_water: user.target_water, target_calories: user.target_calories,
        days: days.map(date => ({
          date,
          water_ml: water.get(date)?.ml ?? 0,
          calories: meals.get(date)?.calories ?? 0,
          protein: meals.get(date)?.protein ?? 0,
          carbs: meals.get(date)?.carbs ?? 0,
          fat: meals.get(date)?.fat ?? 0,
          meal_count: meals.get(date)?.count ?? 0,
          workout_seconds: workouts.get(date)?.seconds ?? 0,
          calories_burned: workouts.get(date)?.burned ?? 0,
          workout_count: workouts.get(date)?.count ?? 0,
          sleep_hours: sleep.get(date)?.hours ?? null,
          sleep_quality: sleep.get(date)?.quality ?? null,
          mood_label: mood.get(date)?.mood_label ?? null,
          quests_done: quests.get(date) ?? 0,
        })) };
    },

    // Everything since sign-up for the profile page: totals, records, the longest run of training days and recent sessions.
    async lifetime(user) {
      const logs = db.collection('workout_logs');
      const [[totals], days, recent, longest, hottest] = await Promise.all([
        logs.aggregate([{ $match: { user_id: user.user_id } },
          { $group: { _id: null, workouts: { $sum: 1 }, seconds: { $sum: '$duration_seconds' }, burned: { $sum: '$calories_burned' } } }]).toArray(),
        logs.distinct('workout_date', { user_id: user.user_id }),
        logs.find({ user_id: user.user_id }, { projection: { _id: 0, workout_id: 1, title: 1, workout_date: 1, duration_seconds: 1, calories_burned: 1 } })
          .sort({ workout_date: -1, created_at: -1 }).limit(10).toArray(),
        logs.find({ user_id: user.user_id }, { projection: { _id: 0, title: 1, workout_date: 1, duration_seconds: 1 } }).sort({ duration_seconds: -1 }).limit(1).next(),
        logs.find({ user_id: user.user_id }, { projection: { _id: 0, title: 1, workout_date: 1, calories_burned: 1 } }).sort({ calories_burned: -1 }).limit(1).next(),
      ]);
      let best = 0;
      let run = 0;
      days.sort().forEach((d, i, all) => { run = i && addDays(all[i - 1], 1) === d ? run + 1 : 1; best = Math.max(best, run); });
      return { success: true, member_since: user.created_at ?? null, workouts: totals?.workouts ?? 0,
        minutes: Math.round((totals?.seconds ?? 0) / 60), calories_burned: Math.round(totals?.burned ?? 0), active_days: days.length,
        streak_days: user.streak_days ?? 0, best_streak: best, records: { longest, hottest }, recent };
    },
  };
}
module.exports = { createStatsService };
