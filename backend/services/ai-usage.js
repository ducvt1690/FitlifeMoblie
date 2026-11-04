'use strict';
const { localDay } = require('../auth/registration');
const { HttpError } = require('../utils/http-error');
const { membershipOf } = require('./payment.service');

// AI calls per local day for meal parsing, meal ideas and workout plans. AI Coach chat has its own limit.
const AI_DAILY_LIMIT = { free: 5, premium: 50 };

async function aiQuota(db, user) {
  const premium = (await membershipOf(db, user.user_id)).premium;
  const day = localDay(new Date(), user.timezone);
  const row = await db.collection('ai_usage').findOne({ user_id: user.user_id, day });
  const limit = premium ? AI_DAILY_LIMIT.premium : AI_DAILY_LIMIT.free;
  return { premium, day, used: row?.count ?? 0, limit };
}

// Runs fn only when the member still has AI calls left today; counts the call only if it succeeds.
async function withAiQuota(db, user, fn) {
  const quota = await aiQuota(db, user);
  if (quota.used >= quota.limit) {
    throw new HttpError(402, quota.premium ? `Bạn đã dùng hết ${quota.limit} lượt AI hôm nay.`
      : `Gói miễn phí có ${quota.limit} lượt AI mỗi ngày. Nâng cấp Premium để có ${AI_DAILY_LIMIT.premium} lượt.`);
  }
  const result = await fn();
  await db.collection('ai_usage').updateOne({ user_id: user.user_id, day: quota.day },
    { $inc: { count: 1 }, $set: { updated_at: new Date() } }, { upsert: true });
  return result;
}

module.exports = { AI_DAILY_LIMIT, aiQuota, withAiQuota };
