'use strict';
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { isUuid, isPlainBody } = require('../utils/validate');
const { lockMember } = require('./quest.service');
const fail = (status, message) => new HttpError(status, message);
// Badges and themes are owned once; vouchers can be bought repeatedly.
const ONE_TIME = ['badge', 'theme'];

function createRewardService({ db }) {
  return {
    async list(user) {
      const [items, purchases] = await Promise.all([
        db.collection('reward_items').find({ is_available: true }, { projection: { _id: 0 } }).sort({ cost_coins: 1, title: 1 }).toArray(),
        db.collection('purchases').find({ user_id: user.user_id }, { projection: { _id: 0 } }).sort({ purchased_at: -1 }).limit(100).toArray(),
      ]);
      const owned = new Set(purchases.filter(p => ONE_TIME.includes(p.item_category)).map(p => p.item_id));
      return { success: true, fit_coins: user.fit_coins,
        items: items.map(item => ({ ...item, owned: owned.has(item.item_id) })), purchases };
    },

    // The client sends a purchase_id so a retried request never debits twice.
    async purchase(member, itemId, body) {
      if (!isUuid(itemId)) throw fail(400, 'item_id không hợp lệ.');
      if (!isPlainBody(body, ['purchase_id']) || !isUuid(body.purchase_id)) throw fail(400, 'Cần purchase_id UUID.');
      return transaction(db, async session => {
        const now = new Date();
        const user = await lockMember(db, member.user_id, session, now);
        const existing = await db.collection('purchases').findOne({ purchase_id: body.purchase_id }, { session, projection: { _id: 0 } });
        if (existing) {
          if (existing.user_id !== user.user_id || existing.item_id !== itemId) throw fail(409, 'purchase_id đã được sử dụng cho yêu cầu khác.');
          return { success: true, replayed: true, purchase: existing, fit_coins: user.fit_coins };
        }
        const item = await db.collection('reward_items').findOne({ item_id: itemId, is_available: true }, { session });
        if (!item) throw fail(404, 'Vật phẩm không tồn tại hoặc đã ngừng bán.');
        if (ONE_TIME.includes(item.category)
          && await db.collection('purchases').findOne({ user_id: user.user_id, item_id: itemId }, { session })) {
          throw fail(409, 'Bạn đã sở hữu vật phẩm này.');
        }
        if (user.fit_coins < item.cost_coins) throw fail(409, `Không đủ xu. Cần ${item.cost_coins} xu, bạn có ${user.fit_coins} xu.`);
        // Skip free items: $inc by -0 would store fit_coins as a double and fail the int validator.
        if (item.cost_coins > 0) await db.collection('users').updateOne({ user_id: user.user_id }, { $inc: { fit_coins: -item.cost_coins } }, { session });
        const purchase = { purchase_id: body.purchase_id, user_id: user.user_id, item_id: item.item_id, item_category: item.category,
          spent_coins: item.cost_coins, purchased_at: now, created_at: now, updated_at: now };
        await db.collection('purchases').insertOne(purchase, { session });
        delete purchase._id;
        return { success: true, replayed: false, message: `Đã đổi "${item.title}".`, purchase, fit_coins: user.fit_coins - item.cost_coins };
      });
    },
  };
}
module.exports = { createRewardService };
