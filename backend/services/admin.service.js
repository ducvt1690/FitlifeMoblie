'use strict';
const { randomUUID } = require('node:crypto');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { isUuid, addDays } = require('../utils/validate');
const { localDay } = require('../auth/registration');
const { currentStreak } = require('./quest.service');
const { rules, readFields, escapeRegex, readPage } = require('../utils/fields');
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
// Admin dashboards bucket days in the business timezone (Vietnam).
const ADMIN_TZ = 'Asia/Ho_Chi_Minh';
const LOG_TARGETS = ['user', 'challenge', 'reward_item'];
const readUserId = value => {
  if (typeof value !== 'string' || !value || value.length > 128) throw fail(400, 'user_id không hợp lệ.');
  return value;
};
const optional = (value, check, message) => {
  if (value === undefined) return undefined;
  if (!check(value)) throw fail(400, message);
  return value;
};
// Daily log collections and their business-day field, used for "active users" and per-account activity.
const ACTIVITY = [['water_logs', 'log_date'], ['workout_logs', 'workout_date'], ['meal_logs', 'meal_date'],
  ['sleep_logs', 'sleep_date'], ['mood_logs', 'mood_date']];

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
  function catalog({ name, id, spec, target, label, guard }) {
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
          if (guard) await guard(itemId, changes, session);
          const item = await coll().findOneAndUpdate({ [id]: itemId }, { $set: { ...changes, updated_at: now } },
            { session, returnDocument: 'after', projection: { _id: 0 } });
          if (!item) throw fail(404, `Không tìm thấy ${label}.`);
          await writeLog(db, admin, `update_${target}`, target, itemId, note || Object.keys(changes).join(', '), now, session);
          return { success: true, message: `Đã cập nhật ${label}.`, item };
        });
      },
    };
  }

  // Members who already joined keep the rules they joined under: while a run is open,
  // the number of days and the reward cannot change. Title, description, icon and closing stay editable.
  async function guardChallengeRules(challengeId, changes, session) {
    if (changes.target_days === undefined && changes.reward_coins === undefined) return;
    const current = await db.collection('challenges').findOne({ challenge_id: challengeId }, { session, projection: { _id: 0, target_days: 1, reward_coins: 1 } });
    if (!current) return;
    const rulesChange = (changes.target_days !== undefined && changes.target_days !== current.target_days)
      || (changes.reward_coins !== undefined && changes.reward_coins !== current.reward_coins);
    if (!rulesChange) return;
    const running = await db.collection('user_challenges').countDocuments({ challenge_id: challengeId, is_completed: false }, { session });
    if (running) {
      throw fail(409, `Đang có ${running} người tham gia nên không thể đổi số ngày hoặc phần thưởng. Hãy tắt thử thách này và tạo thử thách mới.`);
    }
  }
  const challenges = catalog({ name: 'challenges', id: 'challenge_id', spec: challengeSpec, target: 'challenge', label: 'thử thách',
    guard: guardChallengeRules });
  const rewards = catalog({ name: 'reward_items', id: 'item_id', spec: rewardSpec, target: 'reward_item', label: 'vật phẩm' });

  const service = {
    async overview() {
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const [roles, locked, newUsers, purchases, activeChallenges, availableRewards, recentLogs, paid, premium] = await Promise.all([
        users().aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]).toArray(),
        users().countDocuments({ is_active: false }),
        users().countDocuments({ created_at: { $gte: weekAgo } }),
        db.collection('purchases').aggregate([{ $match: { purchased_at: { $gte: weekAgo } } },
          { $group: { _id: null, count: { $sum: 1 }, coins: { $sum: '$spent_coins' } } }]).toArray(),
        db.collection('challenges').countDocuments({ is_active: true }),
        db.collection('reward_items').countDocuments({ is_available: true }),
        service.logs({ page: 1 }).then(result => result.logs.slice(0, 8)),
        db.collection('payment_orders').aggregate([{ $match: { status: 'paid' } },
          { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$amount_vnd' } } }]).toArray(),
        db.collection('memberships').countDocuments({ premium_until: { $gt: new Date() } }),
      ]);
      const byRole = Object.fromEntries(roles.map(row => [row._id, row.count]));
      return { success: true, counts: {
        users: byRole.user ?? 0, admins: byRole.admin ?? 0, locked,
        new_users_7d: newUsers, purchases_7d: purchases[0]?.count ?? 0, coins_spent_7d: purchases[0]?.coins ?? 0,
        active_challenges: activeChallenges, available_rewards: availableRewards,
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
        if (!['user', 'admin'].includes(role)) throw fail(400, 'role không hợp lệ.');
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

    // Lock and unlock member accounts. Admin accounts are managed outside the UI.
    async updateAccount(admin, userId, body) {
      const { note, ...changes } = readFields(body, {
        is_active: [rules.bool(), 'is_active phải là true/false.'],
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
        const account = await users().findOneAndUpdate({ user_id: userId }, { $set: { ...changes, updated_at: now } },
          { session, returnDocument: 'after', projection: ACCOUNT_FIELDS });
        // Old tokens are rejected anyway once is_active is false; deleting them ends the sessions right away.
        if (changes.is_active === false) await db.collection('auth_sessions').deleteMany({ user_id: userId }, { session });
        if (changes.is_active !== undefined && changes.is_active !== target.is_active) {
          await writeLog(db, admin, changes.is_active ? 'unlock_account' : 'lock_account', 'user', userId, note, now, session);
        }
        return { success: true, message: 'Đã cập nhật tài khoản.', account };
      });
    },

    // Support view of one account: status, balances and 30-day activity COUNTS.
    // Body metrics, log contents and private chats are intentionally not returned.
    async accountDetail(userId) {
      readUserId(userId);
      const user = await users().findOne({ user_id: userId }, { projection: { _id: 0, password_hash: 0 } });
      if (!user) throw fail(404, 'Không tìm thấy tài khoản.');
      const now = new Date();
      const since = new Date(now.getTime() - 30 * 86400000);
      const recent = (name, extra = {}) => db.collection(name).countDocuments({ user_id: userId, created_at: { $gte: since }, ...extra });
      const [water, workouts, meals, sleep, mood, chats, quests, purchases, paid, membership, sessions, lastSession] = await Promise.all([
        ...ACTIVITY.map(([name]) => recent(name)),
        recent('ai_chat_messages', { sender: 'user' }),
        db.collection('daily_quest_logs').countDocuments({ user_id: userId, is_completed: true, completed_at: { $gte: since } }),
        db.collection('purchases').aggregate([{ $match: { user_id: userId } },
          { $group: { _id: null, count: { $sum: 1 }, coins: { $sum: '$spent_coins' } } }]).toArray(),
        db.collection('payment_orders').aggregate([{ $match: { user_id: userId, status: 'paid' } },
          { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount_vnd' } } }]).toArray(),
        db.collection('memberships').findOne({ user_id: userId }, { projection: { _id: 0, premium_until: 1 } }),
        db.collection('auth_sessions').countDocuments({ user_id: userId, expires_at: { $gt: now } }),
        db.collection('auth_sessions').find({ user_id: userId }, { projection: { _id: 0, created_at: 1 } }).sort({ created_at: -1 }).limit(1).toArray(),
      ]);
      const premiumUntil = membership?.premium_until ?? null;
      return { success: true,
        account: { user_id: user.user_id, email: user.email, full_name: user.full_name, role: user.role, is_active: user.is_active,
          timezone: user.timezone, fit_coins: user.fit_coins,
          streak_days: currentStreak(user, localDay(now, user.timezone || ADMIN_TZ)),
          created_at: user.created_at, updated_at: user.updated_at },
        activity_30d: { water_logs: water, workout_logs: workouts, meal_logs: meals, sleep_logs: sleep, mood_logs: mood,
          chat_questions: chats, quests_completed: quests },
        sessions: { active: sessions, last_login_at: lastSession[0]?.created_at ?? null },
        purchases: { count: purchases[0]?.count ?? 0, coins_spent: purchases[0]?.coins ?? 0 },
        payments: { paid_orders: paid[0]?.count ?? 0, amount_vnd: paid[0]?.amount ?? 0 },
        membership: { premium: !!premiumUntil && premiumUntil > now, premium_until: premiumUntil } };
    },

    // Sign a member out of every device (e.g. stolen phone). Recorded in admin_logs.
    async forceLogout(admin, userId, body) {
      readUserId(userId);
      const { note } = body && Object.keys(body).length ? readFields(body, { note: noteRule }) : {};
      if (userId === admin.user_id) throw fail(409, 'Không thể tự buộc đăng xuất; hãy dùng đăng xuất mọi thiết bị.');
      return transaction(db, async session => {
        const now = new Date();
        await lockAdmin(db, admin.user_id, session, now);
        const target = await users().findOne({ user_id: userId }, { session, projection: { _id: 0, role: 1 } });
        if (!target) throw fail(404, 'Không tìm thấy tài khoản.');
        if (target.role === 'admin') throw fail(409, 'Không thể buộc đăng xuất tài khoản quản trị viên.');
        const removed = await db.collection('auth_sessions').deleteMany({ user_id: userId }, { session });
        await writeLog(db, admin, 'force_logout', 'user', userId, note || `Thu hồi ${removed.deletedCount} phiên`, now, session);
        return { success: true, message: 'Đã đăng xuất tài khoản khỏi mọi thiết bị.', revoked_sessions: removed.deletedCount };
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
    // Participants of one challenge with progress; ?status=active|completed, paged.
    async challengeDetail(challengeId, { status, page } = {}) {
      if (!isUuid(challengeId)) throw fail(400, 'challenge_id không hợp lệ.');
      optional(status, value => ['active', 'completed'].includes(value), 'status phải là active hoặc completed.');
      const challenge = await db.collection('challenges').findOne({ challenge_id: challengeId }, { projection: { _id: 0 } });
      if (!challenge) throw fail(404, 'Không tìm thấy thử thách.');
      const current = readPage(page);
      const filter = { challenge_id: challengeId, ...(status ? { is_completed: status === 'completed' } : {}) };
      const [rows, total, summary] = await Promise.all([
        db.collection('user_challenges').aggregate([
          { $match: filter }, { $sort: { updated_at: -1, id: 1 } }, { $skip: (current - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE },
          { $lookup: { from: 'users', localField: 'user_id', foreignField: 'user_id', as: 'user' } },
          { $project: { _id: 0, id: 1, user_id: 1, current_progress: 1, is_completed: 1, joined_at: 1, last_checkin: 1,
            last_checkin_date: 1, email: { $first: '$user.email' }, full_name: { $first: '$user.full_name' } } },
        ]).toArray(),
        db.collection('user_challenges').countDocuments(filter),
        db.collection('user_challenges').aggregate([{ $match: { challenge_id: challengeId } },
          { $group: { _id: '$is_completed', count: { $sum: 1 } } }]).toArray(),
      ]);
      const counts = Object.fromEntries(summary.map(row => [row._id ? 'completed' : 'active', row.count]));
      return { success: true, challenge, summary: { active: counts.active ?? 0, completed: counts.completed ?? 0 },
        participants: rows, page: current, page_size: PAGE_SIZE, total };
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

    // Reward purchases; optional ?user_id= and ?item_id= filters.
    async transactions({ page, user_id: userId, item_id: itemId } = {}) {
      const current = readPage(page);
      const filter = {};
      if (userId !== undefined) filter.user_id = readUserId(userId);
      if (itemId !== undefined) filter.item_id = optional(itemId, isUuid, 'item_id không hợp lệ.');
      const [rows, total] = await Promise.all([
        db.collection('purchases').aggregate([
          { $match: filter }, { $sort: { purchased_at: -1 } }, { $skip: (current - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE },
          { $lookup: { from: 'users', localField: 'user_id', foreignField: 'user_id', as: 'user' } },
          { $lookup: { from: 'reward_items', localField: 'item_id', foreignField: 'item_id', as: 'item' } },
          { $project: { _id: 0, purchase_id: 1, user_id: 1, item_id: 1, item_category: 1, spent_coins: 1, purchased_at: 1,
            email: { $first: '$user.email' }, full_name: { $first: '$user.full_name' }, item_title: { $first: '$item.title' } } },
        ]).toArray(),
        db.collection('purchases').countDocuments(filter),
      ]);
      return { success: true, transactions: rows, page: current, page_size: PAGE_SIZE, total };
    },

    // VNPay orders; optional ?status= and ?user_id= filters.
    async payments({ status, page, user_id: userId } = {}) {
      const current = readPage(page);
      if (status !== undefined && !['pending', 'paid', 'failed'].includes(status)) throw fail(400, 'status phải là pending, paid hoặc failed.');
      const filter = status ? { status } : {};
      if (userId !== undefined) filter.user_id = readUserId(userId);
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

    // Daily series for dashboard charts (Vietnam days): new users, active members, reward purchases, VNPay revenue.
    async stats(daysParam) {
      const days = daysParam === undefined ? 30 : Number(daysParam);
      if (!Number.isInteger(days) || days < 1 || days > 90) throw fail(400, 'days phải là số nguyên từ 1 đến 90.');
      const today = localDay(new Date(), ADMIN_TZ);
      const first = addDays(today, -(days - 1));
      const since = new Date(`${first}T00:00:00+07:00`);
      const byDay = field => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: ADMIN_TZ } });
      const [firstLog, firstField] = ACTIVITY[0];
      const [newUsers, active, purchases, revenue] = await Promise.all([
        users().aggregate([{ $match: { created_at: { $gte: since } } },
          { $group: { _id: byDay('$created_at'), count: { $sum: 1 } } }]).toArray(),
        // A member is active on a day when they wrote any health log for that business day.
        db.collection(firstLog).aggregate([
          { $match: { [firstField]: { $gte: first } } }, { $project: { _id: 0, user_id: 1, day: `$${firstField}` } },
          ...ACTIVITY.slice(1).map(([name, field]) => ({ $unionWith: { coll: name, pipeline: [
            { $match: { [field]: { $gte: first } } }, { $project: { _id: 0, user_id: 1, day: `$${field}` } }] } })),
          { $group: { _id: { day: '$day', user_id: '$user_id' } } },
          { $group: { _id: '$_id.day', count: { $sum: 1 } } },
        ]).toArray(),
        db.collection('purchases').aggregate([{ $match: { purchased_at: { $gte: since } } },
          { $group: { _id: byDay('$purchased_at'), count: { $sum: 1 }, coins: { $sum: '$spent_coins' } } }]).toArray(),
        db.collection('payment_orders').aggregate([{ $match: { status: 'paid', paid_at: { $gte: since } } },
          { $group: { _id: byDay('$paid_at'), count: { $sum: 1 }, amount: { $sum: '$amount_vnd' } } }]).toArray(),
      ]);
      const [u, a, p, r] = [newUsers, active, purchases, revenue].map(rows => new Map(rows.map(row => [row._id, row])));
      const series = Array.from({ length: days }, (_, index) => {
        const day = addDays(first, index);
        return { date: day, new_users: u.get(day)?.count ?? 0, active_members: a.get(day)?.count ?? 0,
          purchases: p.get(day)?.count ?? 0, coins_spent: p.get(day)?.coins ?? 0,
          paid_orders: r.get(day)?.count ?? 0, revenue_vnd: r.get(day)?.amount ?? 0 };
      });
      const sum = key => series.reduce((total, row) => total + row[key], 0);
      return { success: true, timezone: ADMIN_TZ, from: first, to: today, days: series,
        totals: { new_users: sum('new_users'), purchases: sum('purchases'), coins_spent: sum('coins_spent'),
          paid_orders: sum('paid_orders'), revenue_vnd: sum('revenue_vnd') } };
    },

    // Admin audit trail; optional ?action=, ?target_type=, ?target_id=, ?admin_id= filters.
    async logs({ page, action, target_type: targetType, target_id: targetId, admin_id: adminId } = {}) {
      const current = readPage(page);
      const filter = {};
      if (action !== undefined) filter.action = optional(action, value => typeof value === 'string' && /^[a-z_]{1,50}$/.test(value), 'action không hợp lệ.');
      if (targetType !== undefined) filter.target_type = optional(targetType, value => LOG_TARGETS.includes(value), `target_type phải là một trong: ${LOG_TARGETS.join(', ')}.`);
      if (targetId !== undefined) filter.target_id = readUserId(targetId);
      if (adminId !== undefined) filter.admin_id = readUserId(adminId);
      const [rows, total] = await Promise.all([
        db.collection('admin_logs').aggregate([
          { $match: filter }, { $sort: { created_at: -1 } }, { $skip: (current - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE },
          { $lookup: { from: 'users', localField: 'admin_id', foreignField: 'user_id', as: 'admin' } },
          { $project: { _id: 0, log_id: 1, action: 1, target_type: 1, target_id: 1, note: 1, created_at: 1, admin_name: { $first: '$admin.full_name' } } },
        ]).toArray(),
        db.collection('admin_logs').countDocuments(filter),
      ]);
      return { success: true, logs: rows, page: current, page_size: PAGE_SIZE, total };
    },
  };
  return service;
}
module.exports = { createAdminService };
