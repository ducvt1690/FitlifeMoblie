'use strict';
const { randomUUID } = require('node:crypto');
const { localDay } = require('../auth/registration');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { isUuid } = require('../utils/validate');
const { lockMember } = require('./quest.service');
const fail = (status, message) => new HttpError(status, message);

function createChallengeService({ db }) {
  async function activeChallenge(challengeId, session) {
    if (!isUuid(challengeId)) throw fail(400, 'challenge_id không hợp lệ.');
    const challenge = await db.collection('challenges').findOne({ challenge_id: challengeId, is_active: true }, { session, projection: { _id: 0 } });
    if (!challenge) throw fail(404, 'Thử thách không tồn tại hoặc đã đóng.');
    return challenge;
  }

  return {
    // Active challenges with the member's current run and how many runs they finished.
    async list(user) {
      const today = localDay(new Date(), user.timezone);
      const [challenges, runs] = await Promise.all([
        db.collection('challenges').find({ is_active: true }, { projection: { _id: 0 } }).sort({ target_days: 1, title: 1 }).toArray(),
        db.collection('user_challenges').find({ user_id: user.user_id }, { projection: { _id: 0 } }).toArray(),
      ]);
      return { success: true, date: today, challenges: challenges.map(c => {
        const mine = runs.filter(r => r.challenge_id === c.challenge_id);
        const current = mine.find(r => !r.is_completed) || null;
        return { ...c, joined: !!current, current_progress: current?.current_progress ?? 0,
          checked_in_today: current?.last_checkin_date === today, completed_count: mine.filter(r => r.is_completed).length };
      }) };
    },

    async join(member, challengeId) {
      return transaction(db, async session => {
        const now = new Date();
        const user = await lockMember(db, member.user_id, session, now);
        const challenge = await activeChallenge(challengeId, session);
        if (await db.collection('user_challenges').findOne({ user_id: user.user_id, challenge_id: challenge.challenge_id, is_completed: false }, { session })) {
          throw fail(409, 'Bạn đang tham gia thử thách này.');
        }
        const run = { id: randomUUID(), user_id: user.user_id, challenge_id: challenge.challenge_id, current_progress: 0,
          is_completed: false, joined_at: now, last_checkin: null, created_at: now, updated_at: now };
        await db.collection('user_challenges').insertOne(run, { session });
        delete run._id;
        return { success: true, message: 'Đã tham gia thử thách.', run };
      });
    },

    // Progress counts distinct check-in days; the completion reward is paid once, in the same transaction.
    async checkin(member, challengeId) {
      return transaction(db, async session => {
        const now = new Date();
        const user = await lockMember(db, member.user_id, session, now);
        const challenge = await activeChallenge(challengeId, session);
        const day = localDay(now, user.timezone);
        const run = await db.collection('user_challenges').findOne({ user_id: user.user_id, challenge_id: challenge.challenge_id, is_completed: false }, { session });
        if (!run) throw fail(404, 'Bạn chưa tham gia thử thách này.');
        if (run.last_checkin_date === day) throw fail(409, 'Hôm nay bạn đã check-in thử thách này.');
        const progress = run.current_progress + 1;
        const completed = progress >= challenge.target_days;
        await db.collection('user_challenges').updateOne({ id: run.id }, { $set: { current_progress: progress, is_completed: completed,
          last_checkin: now, last_checkin_date: day, updated_at: now } }, { session });
        const reward = completed ? challenge.reward_coins : 0;
        if (reward) await db.collection('users').updateOne({ user_id: user.user_id }, { $inc: { fit_coins: reward } }, { session });
        return { success: true, message: completed ? `Hoàn thành thử thách! +${reward} xu.` : 'Check-in thành công.',
          current_progress: progress, target_days: challenge.target_days, is_completed: completed,
          reward_coins: reward, fit_coins: user.fit_coins + reward };
      });
    },
  };
}
module.exports = { createChallengeService };
