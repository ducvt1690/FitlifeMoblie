'use strict';

const { localDay } = require('../auth/registration');
const { calculateTargets } = require('./health-targets');

// Derive the daily bonus from actual logs, so it never accumulates or survives
// into a day without a workout. Reads also correct an older cached user target.
async function currentWaterTarget(db, user, { session, now = new Date() } = {}) {
  const workout = await db.collection('workout_logs').findOne({
    user_id: user.user_id, workout_date: localDay(now, user.timezone),
  }, { session, projection: { _id: 1 } });
  return calculateTargets(user).target_water + (workout ? 350 : 0);
}

module.exports = { currentWaterTarget };
