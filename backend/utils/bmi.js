'use strict';
const { randomUUID } = require('node:crypto');

// Classification uses the unrounded value; the stored value is rounded to 2 decimals.
function calculateBmi(weight, height) {
  const raw = weight / ((height / 100) ** 2);
  const bmi_status = raw < 18.5 ? 'Thiếu cân' : raw < 23 ? 'Cân đối' : raw < 25 ? 'Thừa cân nhẹ' : 'Tiền béo phì / Béo phì';
  return { bmi_value: Math.round(raw * 100) / 100, bmi_status };
}

// One record per user/day; a same-day update keeps the original record_id.
async function upsertBmi(db, user, day, now, session) {
  const { bmi_value, bmi_status } = calculateBmi(user.weight, user.height);
  await db.collection('bmi_history').updateOne({ user_id: user.user_id, record_date: day }, {
    $set: { weight: user.weight, height: user.height, bmi_value, bmi_status, updated_at: now },
    $setOnInsert: { record_id: randomUUID(), user_id: user.user_id, record_date: day, created_at: now },
  }, { upsert: true, session });
  return db.collection('bmi_history').findOne({ user_id: user.user_id, record_date: day }, { session, projection: { _id: 0 } });
}

module.exports = { calculateBmi, upsertBmi };
