'use strict';
const { randomUUID } = require('node:crypto');

// The only way to change users.fit_coins: updates the balance and writes one coin_transactions row
// in the same session. A debit never takes the balance below 0: it returns null and changes nothing.
async function changeCoins(db, { userId, amount, source, refId = null, note = '', now = new Date(), session }) {
  if (!Number.isInteger(amount) || amount === 0) throw new Error('Coin amount must be a non-zero integer.');
  const filter = { user_id: userId, ...(amount < 0 ? { fit_coins: { $gte: -amount } } : {}) };
  const user = await db.collection('users').findOneAndUpdate(filter,
    { $inc: { fit_coins: amount }, $set: { updated_at: now } }, { session, returnDocument: 'after', projection: { fit_coins: 1 } });
  if (!user) return null;
  await db.collection('coin_transactions').insertOne({ tx_id: randomUUID(), user_id: userId, amount, balance_after: user.fit_coins,
    source, ref_id: refId, note, created_at: now, updated_at: now }, { session });
  return user.fit_coins;
}

module.exports = { changeCoins };
