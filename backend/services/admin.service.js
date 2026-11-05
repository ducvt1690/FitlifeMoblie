'use strict';
const { randomUUID } = require('node:crypto');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { isUuid } = require('../utils/validate');
const { rules, readFields, escapeRegex } = require('../utils/fields');
const { listQuery } = require('../utils/list-query');

const { SIMULATION_BANK } = require('./payment.service');
const { cancelPending } = require('./trainer.service');

const fail = (status, message) => new HttpError(status, message);

const ACCOUNT_FIELDS = { _id: 0, user_id: 1, email: 1, full_name: 1, role: 1, is_active: 1, fit_coins: 1, streak_days: 1, created_at: 1 };

const challengeSpec = {
  title: [rules.text(150), 'Tên thử thách cần 1–150 ký tự.'],
  description: [rules.text(2000), 'Mô tả cần 1–2000 ký tự.'],
  target_days: [rules.int(1, 365), 'Số ngày phải từ 1 đến 365.'],
  reward_coins: [rules.int(0, 100000), 'Thưởng phải từ 0 đến 100000 xu.'],
  badge_icon: [rules.text(100), 'Biểu tượng cần 1–100 ký tự.'],
  is_active: [rules.bool(), 'is_active phải là true/false.'],
};
const noteRule = [rules.note(500), 'Lý do tối đa 500 ký tự.'];

// Lock the admin row so admin actions serialize and a just-locked admin cannot keep acting.
async function lockAdmin(db, adminId, session, now) {
  const admin = await db.collection('users').findOneAndUpdate({ user_id: adminId, role: 'admin', is_active: true },
    { $set: { updated_at: now } }, { session, returnDocument: 'after' });
  if (!admin) throw fail(403, 'Tài khoản quản trị không còn khả dụng.');
  return admin;
}

async function writeLog(db, admin, action, targetType, targetId, note, now, session, details = {}) {
  await db.collection('admin_logs').insertOne({ log_id: randomUUID(), admin_id: admin.user_id, action, target_type: targetType,
    target_id: targetId, note: note ?? '', created_at: now, updated_at: now, ...details }, { session });
}

function createAdminService({ db }) {
  const users = () => db.collection('users');

  // Shared validation, transaction and audit for challenge management.
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

  const service = {
    async overview() {
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const [roles, locked, newUsers, activeChallenges, recentLogs, paid, premium] = await Promise.all([
        users().aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]).toArray(),
        users().countDocuments({ is_active: false }),
        users().countDocuments({ created_at: { $gte: weekAgo } }),
        db.collection('challenges').countDocuments({ is_active: true }),
        service.logs(1).then(result => result.logs.slice(0, 8)),
        db.collection('payment_orders').aggregate([{ $match: { status: 'paid', bank_code: { $ne: SIMULATION_BANK } } },
          { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$amount_vnd' } } }]).toArray(),
        db.collection('memberships').countDocuments({ premium_until: { $gt: new Date() } }),
      ]);
      const byRole = Object.fromEntries(roles.map(row => [row._id, row.count]));
      const revenue = await service.revenue();
      return { success: true, counts: {
        users: byRole.user ?? 0, trainers: byRole.trainer ?? 0, admins: byRole.admin ?? 0, locked,
        new_users_7d: newUsers,
        active_challenges: activeChallenges,
        paid_orders: paid[0]?.count ?? 0, revenue_vnd: paid[0]?.revenue ?? 0, total_revenue_vnd: paid[0]?.revenue ?? 0,
        premium_revenue_vnd: revenue.premium.amount_vnd, coin_revenue_vnd: revenue.coins.amount_vnd, premium_members: premium,
      }, revenue, recent_logs: recentLogs };
    },

    async accounts({ q, role, status, page, page_size, sort } = {}) {
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
      const paging = listQuery({ page, page_size, sort }, ['created_at', 'full_name', 'email']);
      const [rows, total] = await Promise.all([
        users().find(filter, { projection: ACCOUNT_FIELDS }).sort(paging.sort)
          .skip(paging.skip).limit(paging.page_size).toArray(),
        users().countDocuments(filter),
      ]);
      return { success: true, accounts: rows, page: paging.page, page_size: paging.page_size, total };
    },

    // Lock and unlock member accounts. Admin accounts are managed outside the UI.
    async updateAccount(admin, userId, body) {
      const { note, ...changes } = readFields(body, {
        is_active: [rules.bool(), 'is_active phải là true/false.'],
        role: [rules.oneOf('user', 'trainer'), 'Chỉ chuyển giữa user và trainer.'],
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
        if (roleChanged && !note) throw fail(400, 'Cần lý do khi thay đổi quyền tài khoản.');
        const account = await users().findOneAndUpdate({ user_id: userId }, { $set: { ...changes, updated_at: now } },
          { session, returnDocument: 'after', projection: ACCOUNT_FIELDS });
        // Role transitions invalidate granted consents. A temporary lock keeps the existing
        // relationship policy; session removal below blocks access until the account is unlocked.
        // Re-granting a role never restores consent: the member must accept a fresh invite.
        if (roleChanged) {
          await db.collection('trainer_links').updateMany({
            $or: [{ trainer_id: userId }, { user_id: userId }], status: { $in: ['active', 'pending'] },
          }, { $set: { status: 'ended', ended_at: now, updated_at: now } }, { session });
          await cancelPending(db, { $or: [{ trainer_id: userId }, { user_id: userId }] },
            note || 'Quyền tài khoản hoặc kết nối đã bị thu hồi.', now, session, admin.user_id);
          if (target.role === 'trainer') await db.collection('workout_templates').updateMany({ trainer_id: userId, is_active: true },
            { $set: { is_active: false, updated_at: now } }, { session });
        }
        // Old tokens are rejected anyway once is_active is false; deleting them ends the sessions right away.
        if (changes.is_active === false || (changes.role !== undefined && changes.role !== target.role)) await db.collection('auth_sessions').deleteMany({ user_id: userId }, { session });
        if (changes.is_active !== undefined && changes.is_active !== target.is_active) {
          await writeLog(db, admin, changes.is_active ? 'unlock_account' : 'lock_account', 'user', userId, note, now, session);
        }
        if (changes.role !== undefined && changes.role !== target.role) {
          await writeLog(db, admin, 'change_account_role', 'user', userId, note || 'Không cung cấp lý do.', now, session,
            { previous_role: target.role, new_role: changes.role });
        }
        return { success: true, message: 'Đã cập nhật tài khoản.', account };
      });
    },

    createChallenge: challenges.create,
    updateChallenge: challenges.update,
  };
  return Object.assign(service, require('./admin-query.service').createAdminQueries({ db }));
}
module.exports = { createAdminService };
