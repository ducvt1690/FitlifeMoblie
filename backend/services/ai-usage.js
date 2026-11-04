'use strict';
const { localDay } = require('../auth/registration');
const { HttpError } = require('../utils/http-error');
const { membershipOf } = require('./payment.service');

// Daily AI limits per plan. Admins change them with PUT /api/admin/settings/ai-limits (app_settings "ai_limits");
// these defaults apply until then. chat counts AI Coach questions per rolling 24 h; the other kinds count per local day.
const DEFAULT_AI_LIMITS = {
  free: { chat: 10, workout_plan: 5, meal_ai: 5 },
  premium: { chat: 200, workout_plan: 50, meal_ai: 50 },
};
// Kept for older imports: the meal/plan limits before they were configurable.
const AI_DAILY_LIMIT = { free: DEFAULT_AI_LIMITS.free.meal_ai, premium: DEFAULT_AI_LIMITS.premium.meal_ai };

async function aiLimits(db, session) {
  const row = await db.collection('app_settings').findOne({ name: 'ai_limits' }, { session, projection: { _id: 0 } });
  return { free: { ...DEFAULT_AI_LIMITS.free, ...row?.free }, premium: { ...DEFAULT_AI_LIMITS.premium, ...row?.premium } };
}

// kind: 'meal_ai' (meal parsing and meal ideas) or 'workout_plan'.
async function aiQuota(db, user, kind = 'meal_ai') {
  const premium = (await membershipOf(db, user.user_id)).premium;
  const day = localDay(new Date(), user.timezone);
  const [row, limits] = await Promise.all([
    db.collection('ai_usage').findOne({ user_id: user.user_id, day, kind }),
    aiLimits(db),
  ]);
  return { premium, day, kind, used: row?.count ?? 0, limit: (premium ? limits.premium : limits.free)[kind] };
}

// Runs fn only when the member still has calls of this kind left today; counts the call only if it succeeds.
async function withAiQuota(db, user, fn, kind = 'meal_ai') {
  const quota = await aiQuota(db, user, kind);
  if (quota.used >= quota.limit) {
    const premiumLimit = (await aiLimits(db)).premium[kind];
    throw new HttpError(402, quota.premium ? `Bạn đã dùng hết ${quota.limit} lượt AI hôm nay.`
      : `Gói miễn phí có ${quota.limit} lượt AI mỗi ngày. Nâng cấp Premium để có ${premiumLimit} lượt.`);
  }
  const result = await fn();
  await db.collection('ai_usage').updateOne({ user_id: user.user_id, day: quota.day, kind },
    { $inc: { count: 1 }, $set: { updated_at: new Date() } }, { upsert: true });
  return result;
}

module.exports = { AI_DAILY_LIMIT, DEFAULT_AI_LIMITS, aiLimits, aiQuota, withAiQuota };
