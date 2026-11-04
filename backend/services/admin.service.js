'use strict';
const { randomUUID } = require('node:crypto');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { isUuid } = require('../utils/validate');
const { rules, readFields, escapeRegex, readPage } = require('../utils/fields');
const { cancelOpenAssignments } = require('./trainer.service');
const fail = (status, message) => new HttpError(status, message);

const PAGE_SIZE = 20;
const ACCOUNT_FIELDS = { _id: 0, user_id: 1, email: 1, full_name: 1, role: 1, is_active: 1, fit_coins: 1, streak_days: 1, created_at: 1 };

const challengeSpec = {
  title: [rules.text(150), 'Tên thử thách cần 1–150 ký tự.'],
  description: [rules.text(2000), 'Mô tả cần 1–2000 ký tự.'],
  target_days: [rules.int(1, 365), 'Số ngày phải từ 1 đến 365.'],
  reward_coins: [rules.int(0, 100000), 'Thưởng phải từ 0 đến 100000 xu.'],
  badge_icon: [rules.text(100), 'Biểu tượng cần 1–100 ký tự.'],
  is_active: [rules.bool(), 'is_active phải là true/false.'],
};
const rewardSpec = {
  title: [rules.text(100), 'Tên vật phẩm cần 1–100 ký tự.'],
  category: [rules.oneOf('badge', 'theme', 'voucher'), 'Loại phải là badge, theme hoặc voucher.'],
  cost_coins: [rules.int(0, 100000), 'Giá phải từ 0 đến 100000 xu.'],
  icon: [rules.text(100), 'Biểu tượng cần 1–100 ký tự.'],
  is_available: [rules.bool(), 'is_available phải là true/false.'],
};
const noteRule = [rules.note(500), 'Lý do tối đa 500 ký tự.'];

// Lock the admin row so admin actions serialize and a just-locked admin cannot keep acting.
async function lockAdmin(db, adminId, session, now) {
  const admin = await db.collection('users').findOneAndUpdate({ user_id: adminId, role: 'admin', is_active: true },
    { $set: { updated_at: now } }, { session, returnDocument: 'after' });
  if (!admin) throw fail(403, 'Tài khoản quản trị không còn khả dụng.');
  return admin;
}

async function writeLog(db, admin, action, targetType, targetId, note, now, session) {
  await db.collection('admin_logs').insertOne({ log_id: randomUUID(), admin_id: admin.user_id, action, target_type: targetType,
    target_id: targetId, note: note ?? '', created_at: now, updated_at: now }, { session });
}

function createAdminService({ db }) {
  const users = () => db.collection('users');

  // Shared create/update for the two catalogs admins own: challenges and reward items.
  function catalog({ name, id, spec, target, label }) {
    const coll = () => db.collection(name);
    return {
      async create(admin, body) {
        const { [id]: itemId, ...rest } = body ?? {};
        if (!isUuid(itemId)) throw fail(400, `Cần ${id} UUID.`);
        const input = readFields(rest, spec);
        return transaction(db, async session => {
          const now = new Date();
          await lockAdmin(db, admin.user_id, session, now);
          const existing = await coll().findOne({ [id]: itemId }, { session, projection: { _id: 0 } });
          if (existing) return { success: true, replayed: true, item: existing };
          const item = { [id]: itemId, ...input, created_at: now, updated_at: now };
          await coll().insertOne(item, { session });
          delete item._id;
          await writeLog(db, admin, `create_${target}`, target, itemId, input.title, now, session);
          return { success: true, replayed: false, message: `Đã tạo ${label}.`, item };
        });
      },
      async update(admin, itemId, body) {
        if (!isUuid(itemId)) throw fail(400, `${id} không hợp lệ.`);
        const { note, ...changes } = readFields(body, { ...spec, note: noteRule }, { partial: true });
        if (!Object.keys(changes).length) throw fail(400, 'Không có thay đổi nào.');
        return transaction(db, async session => {
          const now = new Date();
          await lockAdmin(db, admin.user_id, session, now);
          const item = await coll().findOneAndUpdate({ [id]: itemId }, { $set: { ...changes, updated_at: now } },
            { session, returnDocument: 'after', projection: { _id: 0 } });
          if (!item) throw fail(404, `Không tìm thấy ${label}.`);
          await writeLog(db, admin, `update_${target}`, target, itemId, note || Object.keys(changes).join(', '), now, session);
          return { success: true, message: `Đã cập nhật ${label}.`, item };
        });
      },
    };
  }

  const challenges = catalog({ name: 'challenges', id: 'challenge_id', spec: challengeSpec, target: 'challenge', label: 'thử thách' });
  const rewards = catalog({ name: 'reward_items', id: 'item_id', spec: rewardSpec, target: 'reward_item', label: 'vật phẩm' });

  const service = {
    async overview() {
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const [roles, locked, newUsers, purchases, activeChallenges, availableRewards, activeLinks, recentLogs, paid, premium] = await Promise.all([
        users().aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]).toArray(),
        users().countDocuments({ is_active: false }),
        users().countDocuments({ created_at: { $gte: weekAgo } }),
        db.collection('purchases').aggregate([{ $match: { purchased_at: { $gte: weekAgo } } },
          { $group: { _id: null, count: { $sum: 1 }, coins: { $sum: '$spent_coins' } } }]).toArray(),
        db.collection('challenges').countDocuments({ is_active: true }),
        db.collection('reward_items').countDocuments({ is_available: true }),
        db.collection('trainer_links').countDocuments({ status: 'active' }),
        service.logs(1).then(result => result.logs.slice(0, 8)),
        db.collection('payment_orders').aggregate([{ $match: { status: 'paid' } },
          { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$amount_vnd' } } }]).toArray(),
        db.collection('memberships').countDocuments({ premium_until: { $gt: new Date() } }),
      ]);
      const byRole = Object.fromEntries(roles.map(row => [row._id, row.count]));
      return { success: true, counts: {
        users: byRole.user ?? 0, trainers: byRole.trainer ?? 0, admins: byRole.admin ?? 0, locked,
        new_users_7d: newUsers, purchases_7d: purchases[0]?.count ?? 0, coins_spent_7d: purchases[0]?.coins ?? 0,
        active_challenges: activeChallenges, available_rewards: availableRewards, active_trainer_links: activeLinks,
        paid_orders: paid[0]?.count ?? 0, revenue_vnd: paid[0]?.revenue ?? 0, premium_members: premium,
      }, recent_logs: recentLogs };
    },

    async accounts({ q, role, status, page }) {
      const filter = {};
      if (q !== undefined) {
        if (typeof q !== 'string' || q.length > 100) throw fail(400, 'Từ khóa tối đa 100 ký tự.');
        if (q.trim()) filter.$or = [{ email: { $regex: escapeRegex(q.trim().toLowerCase()) } },
          { full_name: { $regex: escapeRegex(q.trim()), $options: 'i' } }];
      }
      if (role !== undefined) {
        if (!['user', 'trainer', 'admin'].includes(role)) throw fail(400, 'role không hợp lệ.');
        filter.role = role;
      }
      if (status !== undefined) {
        if (!['active', 'locked'].includes(status)) throw fail(400, 'status phải là active hoặc locked.');
        filter.is_active = status === 'active';
      }
      const current = readPage(page);
      const [rows, total] = await Promise.all([
        users().find(filter, { projection: ACCOUNT_FIELDS }).sort({ created_at: -1, user_id: 1 })
          .skip((current - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
        users().countDocuments(filter),
      ]);
      return { success: true, accounts: rows, page: current, page_size: PAGE_SIZE, total };
    },

    // Lock/unlock and grant/revoke the trainer role. Admin accounts are managed outside the UI.
    async updateAccount(admin, userId, body) {
      const { note, ...changes } = readFields(body, {
        is_active: [rules.bool(), 'is_active phải là true/false.'],
        role: [rules.oneOf('user', 'trainer'), 'Chỉ đổi được giữa user và trainer.'],
        note: noteRule,
      }, { partial: true });
      if (!Object.keys(changes).length) throw fail(400, 'Không có thay đổi nào.');
      if (userId === admin.user_id) throw fail(409, 'Không thể tự thay đổi tài khoản của mình.');
      return transaction(db, async session => {
        const now = new Date();
        await lockAdmin(db, admin.user_id, session, now);
        const target = await users().findOne({ user_id: userId }, { session, projection: ACCOUNT_FIELDS });
        if (!target) throw fail(404, 'Không tìm thấy tài khoản.');
        if (target.role === 'admin') throw fail(409, 'Không thể thay đổi tài khoản quản trị viên.');
        const roleChanged = changes.role !== undefined && changes.role !== target.role;
        // Leaving the trainer role ends that trainer's links, open work and templates; becoming one ends links as a member.
        if (roleChanged) {
          const side = target.role === 'trainer' ? 'trainer_id' : 'user_id';
          await db.collection('trainer_links').updateMany({ [side]: userId, status: { $in: ['pending', 'active'] } },
            { $set: { status: 'ended', ended_at: now, updated_at: now } }, { session });
          await cancelOpenAssignments(db, { [side]: userId }, now, session);
          if (target.role === 'trainer') {
            await db.collection('workout_templates').updateMany({ trainer_id: userId, is_active: true },
              { $set: { is_active: false, updated_at: now } }, { session });
          }
        }
        const account = await users().findOneAndUpdate({ user_id: userId }, { $set: { ...changes, updated_at: now } },
          { session, returnDocument: 'after', projection: ACCOUNT_FIELDS });
        // Old tokens are rejected anyway once is_active is false; deleting them also ends role-scoped sessions.
        if (changes.is_active === false || roleChanged) await db.collection('auth_sessions').deleteMany({ user_id: userId }, { session });
        if (changes.is_active !== undefined && changes.is_active !== target.is_active) {
          await writeLog(db, admin, changes.is_active ? 'unlock_account' : 'lock_account', 'user', userId, note, now, session);
        }
        if (roleChanged) await writeLog(db, admin, `set_role_${changes.role}`, 'user', userId, note, now, session);
        return { success: true, message: 'Đã cập nhật tài khoản.', account };
      });
    },

    async listChallenges() {
      const [rows, runs] = await Promise.all([
        db.collection('challenges').find({}, { projection: { _id: 0 } }).sort({ is_active: -1, target_days: 1, title: 1 }).toArray(),
        db.collection('user_challenges').aggregate([{ $group: { _id: '$challenge_id',
          joined: { $sum: { $cond: ['$is_completed', 0, 1] } }, completed: { $sum: { $cond: ['$is_completed', 1, 0] } } } }]).toArray(),
      ]);
      const byId = new Map(runs.map(row => [row._id, row]));
      return { success: true, challenges: rows.map(c => ({ ...c, joined: byId.get(c.challenge_id)?.joined ?? 0, completed: byId.get(c.challenge_id)?.completed ?? 0 })) };
    },
    createChallenge: challenges.create,
    updateChallenge: challenges.update,

    async listRewards() {
      const [rows, sales] = await Promise.all([
        db.collection('reward_items').find({}, { projection: { _id: 0 } }).sort({ is_available: -1, cost_coins: 1, title: 1 }).toArray(),
        db.collection('purchases').aggregate([{ $group: { _id: '$item_id', count: { $sum: 1 }, coins: { $sum: '$spent_coins' } } }]).toArray(),
      ]);
      const byId = new Map(sales.map(row => [row._id, row]));
      return { success: true, items: rows.map(item => ({ ...item, sold: byId.get(item.item_id)?.count ?? 0, coins: byId.get(item.item_id)?.coins ?? 0 })) };
    },
    createReward: rewards.create,
    updateReward: rewards.update,

    async transactions(page) {
      const current = readPage(page);
      const [rows, total] = await Promise.all([
        db.collection('purchases').aggregate([
          { $sort: { purchased_at: -1 } }, { $skip: (current - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE },
          { $lookup: { from: 'users', localField: 'user_id', foreignField: 'user_id', as: 'user' } },
          { $lookup: { from: 'reward_items', localField: 'item_id', foreignField: 'item_id', as: 'item' } },
          { $project: { _id: 0, purchase_id: 1, user_id: 1, item_id: 1, item_category: 1, spent_coins: 1, purchased_at: 1,
            email: { $first: '$user.email' }, full_name: { $first: '$user.full_name' }, item_title: { $first: '$item.title' } } },
        ]).toArray(),
        db.collection('purchases').countDocuments(),
      ]);
      return { success: true, transactions: rows, page: current, page_size: PAGE_SIZE, total };
    },

    async payments({ status, page }) {
      const current = readPage(page);
      if (status !== undefined && !['pending', 'paid', 'failed'].includes(status)) throw fail(400, 'status phải là pending, paid hoặc failed.');
      const filter = status ? { status } : {};
      const [rows, total] = await Promise.all([
        db.collection('payment_orders').aggregate([
          { $match: filter }, { $sort: { created_at: -1 } }, { $skip: (current - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE },
          { $lookup: { from: 'users', localField: 'user_id', foreignField: 'user_id', as: 'user' } },
          { $project: { _id: 0, order_id: 1, user_id: 1, product: 1, amount_vnd: 1, status: 1, response_code: 1,
            vnp_transaction_no: 1, bank_code: 1, created_at: 1, paid_at: 1,
            email: { $first: '$user.email' }, full_name: { $first: '$user.full_name' } } },
        ]).toArray(),
        db.collection('payment_orders').countDocuments(filter),
      ]);
      return { success: true, payments: rows, page: current, page_size: PAGE_SIZE, total };
    },

    async logs(page) {
      const current = readPage(page);
      const [rows, total] = await Promise.all([
        db.collection('admin_logs').aggregate([
          { $sort: { created_at: -1 } }, { $skip: (current - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE },
          { $lookup: { from: 'users', localField: 'admin_id', foreignField: 'user_id', as: 'admin' } },
          { $project: { _id: 0, log_id: 1, action: 1, target_type: 1, target_id: 1, note: 1, created_at: 1, admin_name: { $first: '$admin.full_name' } } },
        ]).toArray(),
        db.collection('admin_logs').countDocuments(),
      ]);
      return { success: true, logs: rows, page: current, page_size: PAGE_SIZE, total };
    },
  };
  return service;
}
module.exports = { createAdminService };
