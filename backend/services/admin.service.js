'use strict';
const { randomUUID } = require('node:crypto');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { isUuid, addDays, isDate, isText, isPlainBody } = require('../utils/validate');
const { PRODUCTS } = require('./payment.service');
const { AI_KINDS } = require('../database/mongodb/schema');
const { localDay } = require('../auth/registration');
const { currentStreak } = require('./quest.service');
const { withLiveTargets } = require('./session.service');
const { createStatsService } = require('./stats.service');
const { aiLimits, aiQuota, DEFAULT_AI_LIMITS } = require('./ai-usage');
const { calculateBmi } = require('../utils/bmi');
const { changeCoins } = require('../utils/coins');
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
const reasonRule = [rules.text(500), 'Cần nhập lý do (note), tối đa 500 ký tự.'];
// Admin dashboards bucket days in the business timezone (Vietnam).
const ADMIN_TZ = 'Asia/Ho_Chi_Minh';
const LOG_TARGETS = ['user', 'challenge', 'reward_item', 'payment', 'exercise', 'setting'];
const DAY_MS = 86400000;
// Sensitive actions must say why (doc: "Thao tác nhạy cảm bắt buộc nhập ghi chú").
const AI_LIMITS_ID = '00000000-0000-4000-8000-00000000a111';
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'expired', 'refunded'];
const COIN_SOURCES = ['quest', 'quest_refund', 'challenge', 'purchase', 'payment', 'payment_refund', 'admin'];
// Vietnam business days [from, to] -> created_at style range. Both optional; from must not be after to.
function readDayRange(from, to, maxDays = 3660) {
  const f = optional(from, isDate, 'from phải có dạng YYYY-MM-DD.');
  const t = optional(to, isDate, 'to phải có dạng YYYY-MM-DD.');
  if (f && t && f > t) throw fail(400, 'from phải trước hoặc bằng to.');
  if (f && t && (Date.parse(t) - Date.parse(f)) / DAY_MS + 1 > maxDays) throw fail(400, `Khoảng ngày tối đa ${maxDays} ngày.`);
  const range = {};
  if (f) range.$gte = new Date(`${f}T00:00:00+07:00`);
  if (t) range.$lt = new Date(Date.parse(`${t}T00:00:00+07:00`) + DAY_MS);
  return Object.keys(range).length ? range : null;
}
// CSV cell: quoted when needed; cells starting with = + - @ are prefixed so spreadsheets do not run them as formulas.
const csvCell = value => {
  let text = value instanceof Date ? value.toISOString() : String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const textList = (maxItems, maxLength) => value => (Array.isArray(value) && value.length <= maxItems
  && value.every(item => isText(item, maxLength)) ? value.map(item => item.trim()) : undefined);
const httpsUrl = value => (typeof value === 'string' && value.length <= 1000 && /^https:\/\/\S+$/.test(value) ? value : undefined);
const exerciseSpec = {
  name: [rules.text(200), 'name cần 1–200 ký tự.'],
  name_vi: [rules.text(200), 'name_vi cần 1–200 ký tự.'],
  description_vi: [rules.note(600), 'description_vi tối đa 600 ký tự.'],
  body_parts: [textList(20, 100), 'body_parts là danh sách 1–20 nhóm (mỗi mục tối đa 100 ký tự).'],
  target_muscles: [textList(20, 100), 'target_muscles là danh sách tối đa 20 mục.'],
  equipments: [textList(20, 100), 'equipments là danh sách tối đa 20 mục.'],
  body_parts_vi: [textList(20, 100), 'body_parts_vi là danh sách tối đa 20 mục.'],
  target_muscles_vi: [textList(20, 100), 'target_muscles_vi là danh sách tối đa 20 mục.'],
  equipments_vi: [textList(20, 100), 'equipments_vi là danh sách tối đa 20 mục.'],
  instructions_vi: [textList(50, 2000), 'instructions_vi là danh sách tối đa 50 bước.'],
  tips_vi: [textList(10, 500), 'tips_vi là danh sách tối đa 10 mẹo.'],
  gif_url: [httpsUrl, 'gif_url phải là đường dẫn https.'],
  rest_seconds: [rules.int(0, 600), 'rest_seconds phải từ 0 đến 600.'],
  is_active: [rules.bool(), 'is_active phải là true/false.'],
};
const EXERCISE_REQUIRED = ['name_vi', 'body_parts', 'target_muscles', 'equipments', 'gif_url', 'instructions_vi'];
const requireNote = note => { if (!note) throw fail(400, 'Cần nhập lý do (note) cho thao tác này.'); return note; };
const readUserId = value => {
  if (typeof value !== 'string' || !value || value.length > 128) throw fail(400, 'user_id không hợp lệ.');
  return value;
};
const optional = (value, check, message) => {
  if (value === undefined) return undefined;
  if (!check(value)) throw fail(400, message);
  return value;
};

// Lock the admin row so admin actions serialize and a just-locked admin cannot keep acting.
async function lockAdmin(db, adminId, session, now) {
  const admin = await db.collection('users').findOneAndUpdate({ user_id: adminId, role: 'admin', is_active: true },
    { $set: { updated_at: now } }, { session, returnDocument: 'after' });
  if (!admin) throw fail(403, 'Tài khoản quản trị không còn khả dụng.');
  return admin;
}

async function writeLog(db, admin, action, targetType, targetId, note, now, session) {
  await db.collection('admin_logs').insertOne({ log_id: randomUUID(), admin_id: admin.user_id, action, target_type: targetType,
    target_id: targetId, note: [...(note ?? '')].slice(0, 500).join(''), created_at: now, updated_at: now }, { session });
}

function createAdminService({ db }) {
  const users = () => db.collection('users');
  // Target of an account action: must exist and must not be an admin (admins cannot change other admins).
  async function member(userId, session) {
    const target = await users().findOne({ user_id: userId }, { session, projection: { _id: 0, user_id: 1, role: 1, fit_coins: 1 } });
    if (!target) throw fail(404, 'Không tìm thấy tài khoản.');
    if (target.role === 'admin') throw fail(409, 'Không thể thay đổi tài khoản quản trị viên.');
    return target;
  }
  function paymentFilter({ status, userId, product, from, to }) {
    const filter = {};
    const now = new Date();
    optional(status, value => PAYMENT_STATUSES.includes(value), `status phải là một trong: ${PAYMENT_STATUSES.join(', ')}.`);
    if (status === 'expired') Object.assign(filter, { status: 'pending', expires_at: { $lte: now } });
    else if (status === 'pending') Object.assign(filter, { status: 'pending', expires_at: { $gt: now } });
    else if (status) filter.status = status;
    if (userId !== undefined) filter.user_id = readUserId(userId);
    if (product !== undefined) filter.product = optional(product, value => Object.hasOwn(PRODUCTS, value), `product phải là một trong: ${Object.keys(PRODUCTS).join(', ')}.`);
    const range = readDayRange(from, to);
    if (range) filter.created_at = range;
    return filter;
  }
  const withDisplayStatus = now => row => ({ ...row, status: row.status === 'pending' && row.expires_at <= now ? 'expired' : row.status });

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
      const [roles, locked, newUsers, purchases, activeChallenges, availableRewards, purchasesTotal, recentLogs, paid, premium] = await Promise.all([
        users().aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]).toArray(),
        users().countDocuments({ is_active: false }),
        users().countDocuments({ created_at: { $gte: weekAgo } }),
        db.collection('purchases').aggregate([{ $match: { purchased_at: { $gte: weekAgo } } },
          { $group: { _id: null, count: { $sum: 1 }, coins: { $sum: '$spent_coins' } } }]).toArray(),
        db.collection('challenges').countDocuments({ is_active: true }),
        db.collection('reward_items').countDocuments({ is_available: true }),
        db.collection('purchases').countDocuments(),
        service.logs({ page: 1 }).then(result => result.logs.slice(0, 8)),
        db.collection('payment_orders').aggregate([{ $match: { status: 'paid' } },
          { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$amount_vnd' } } }]).toArray(),
        db.collection('memberships').countDocuments({ premium_until: { $gt: new Date() } }),
      ]);
      const byRole = Object.fromEntries(roles.map(row => [row._id, row.count]));
      return { success: true, counts: {
        users: byRole.user ?? 0, admins: byRole.admin ?? 0, locked,
        new_users_7d: newUsers, purchases_7d: purchases[0]?.count ?? 0, coins_spent_7d: purchases[0]?.coins ?? 0,
        active_challenges: activeChallenges, available_rewards: availableRewards, purchases_total: purchasesTotal,
        paid_orders: paid[0]?.count ?? 0, revenue_vnd: paid[0]?.revenue ?? 0, premium_members: premium,
      }, recent_logs: recentLogs };
    },

    // Accounts with their plan. ?q= (email/name) &role=user|admin &status=active|locked &plan=premium|free &page=
    async accounts({ q, role, status, plan, page }) {
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
      optional(plan, value => ['premium', 'free'].includes(value), 'plan phải là premium hoặc free.');
      const current = readPage(page);
      const now = new Date();
      const withPlan = [{ $match: filter },
        { $lookup: { from: 'memberships', localField: 'user_id', foreignField: 'user_id', as: 'membership' } },
        { $addFields: { premium_until: { $ifNull: [{ $first: '$membership.premium_until' }, null] } } },
        { $addFields: { premium: { $gt: ['$premium_until', now] } } },
        ...(plan ? [{ $match: { premium: plan === 'premium' } }] : [])];
      const [rows, count] = await Promise.all([
        users().aggregate([...withPlan, { $sort: { created_at: -1, user_id: 1 } }, { $skip: (current - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE },
          { $project: { ...ACCOUNT_FIELDS, premium: 1, premium_until: 1 } }]).toArray(),
        users().aggregate([...withPlan, { $count: 'total' }]).toArray(),
      ]);
      return { success: true, accounts: rows, page: current, page_size: PAGE_SIZE, total: count[0]?.total ?? 0 };
    },

    // Lock/unlock a member, or promote a member to admin. A reason (note) is required.
    // Admins cannot change themselves or another admin (409); demoting an admin is done with scripts/set-role.js.
    async updateAccount(admin, userId, body) {
      const { note, ...changes } = readFields(body, {
        is_active: [rules.bool(), 'is_active phải là true/false.'],
        role: [rules.oneOf('admin'), 'Chỉ có thể cấp quyền admin: role phải là "admin".'],
        note: noteRule,
      }, { partial: true });
      if (!Object.keys(changes).length) throw fail(400, 'Không có thay đổi nào.');
      if (userId === admin.user_id) throw fail(409, 'Không thể tự thay đổi tài khoản của mình.');
      requireNote(note);
      return transaction(db, async session => {
        const now = new Date();
        await lockAdmin(db, admin.user_id, session, now);
        const target = await users().findOne({ user_id: userId }, { session, projection: ACCOUNT_FIELDS });
        if (!target) throw fail(404, 'Không tìm thấy tài khoản.');
        if (target.role === 'admin') throw fail(409, 'Không thể thay đổi tài khoản quản trị viên.');
        const account = await users().findOneAndUpdate({ user_id: userId }, { $set: { ...changes, updated_at: now } },
          { session, returnDocument: 'after', projection: ACCOUNT_FIELDS });
        // A locked account or a new role starts from a fresh login: end every session now.
        if (changes.is_active === false || changes.role) await db.collection('auth_sessions').deleteMany({ user_id: userId }, { session });
        if (changes.is_active !== undefined && changes.is_active !== target.is_active) {
          await writeLog(db, admin, changes.is_active ? 'unlock_account' : 'lock_account', 'user', userId, note, now, session);
        }
        if (changes.role) await writeLog(db, admin, 'grant_admin', 'user', userId, note, now, session);
        return { success: true, message: 'Đã cập nhật tài khoản.', account };
      });
    },

    // Admin support view of one account. Passwords, tokens and AI message contents are never returned.
    async accountDetail(userId) {
      readUserId(userId);
      const stored = await users().findOne({ user_id: userId }, { projection: { _id: 0, password_hash: 0 } });
      if (!stored) throw fail(404, 'Không tìm thấy tài khoản.');
      const user = stored.role === 'user' ? await withLiveTargets(db, stored) : stored;
      const now = new Date();
      const since = new Date(now.getTime() - 30 * DAY_MS);
      const today = localDay(now, user.timezone || ADMIN_TZ);
      const fromDay = addDays(today, -29);
      const sum = (name, field, match) => db.collection(name).aggregate([{ $match: { user_id: userId, ...match } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: `$${field}` } } }]).toArray().then(rows => rows[0] ?? { count: 0, total: 0 });
      const [workouts, meals, water, steps, chats, quests, chatUsed, limits, mealAi, planAi, runs, badges, records,
        nutrition, membership, orders, coins, sessions, lastSession] = await Promise.all([
        sum('workout_logs', 'duration_seconds', { workout_date: { $gte: fromDay } }),
        sum('meal_logs', 'calories', { meal_date: { $gte: fromDay } }),
        sum('water_logs', 'amount', { log_date: { $gte: fromDay } }),
        sum('steps_logs', 'steps', { step_date: { $gte: fromDay } }),
        db.collection('ai_chat_messages').countDocuments({ user_id: userId, sender: 'user', created_at: { $gte: since } }),
        db.collection('daily_quest_logs').countDocuments({ user_id: userId, is_completed: true, completed_at: { $gte: since } }),
        db.collection('ai_question_usage').countDocuments({ user_id: userId, created_at: { $gte: new Date(now.getTime() - DAY_MS) } }),
        aiLimits(db),
        aiQuota(db, user, 'meal_ai'),
        aiQuota(db, user, 'workout_plan'),
        db.collection('user_challenges').aggregate([{ $match: { user_id: userId, is_completed: false } },
          { $lookup: { from: 'challenges', localField: 'challenge_id', foreignField: 'challenge_id', as: 'c' } },
          { $project: { _id: 0, challenge_id: 1, current_progress: 1, joined_at: 1, last_checkin_date: 1,
            title: { $first: '$c.title' }, target_days: { $first: '$c.target_days' } } }]).toArray(),
        db.collection('purchases').aggregate([{ $match: { user_id: userId, item_category: 'badge' } },
          { $lookup: { from: 'reward_items', localField: 'item_id', foreignField: 'item_id', as: 'i' } },
          { $project: { _id: 0, item_id: 1, purchased_at: 1, title: { $first: '$i.title' }, icon: { $first: '$i.icon' } } }]).toArray(),
        user.role === 'user' ? createStatsService({ db }).lifetime(user) : null,
        db.collection('nutrition_profiles').findOne({ user_id: userId }, { projection: { _id: 0, allergies: 1 } }),
        db.collection('memberships').findOne({ user_id: userId }, { projection: { _id: 0, premium_until: 1 } }),
        db.collection('payment_orders').find({ user_id: userId }, { projection: { _id: 0, order_id: 1, product: 1, amount_vnd: 1, status: 1,
          created_at: 1, paid_at: 1, refunded_at: 1 } }).sort({ created_at: -1 }).limit(20).toArray(),
        db.collection('coin_transactions').find({ user_id: userId }, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(20).toArray(),
        db.collection('auth_sessions').countDocuments({ user_id: userId, expires_at: { $gt: now } }),
        db.collection('auth_sessions').find({ user_id: userId }, { projection: { _id: 0, created_at: 1 } }).sort({ created_at: -1 }).limit(1).toArray(),
      ]);
      const premiumUntil = membership?.premium_until ?? null;
      const premium = !!premiumUntil && premiumUntil > now;
      const plan = premium ? limits.premium : limits.free;
      const hasBody = typeof user.weight === 'number' && typeof user.height === 'number';
      return { success: true,
        account: { user_id: user.user_id, email: user.email, full_name: user.full_name, role: user.role, is_active: user.is_active,
          timezone: user.timezone, created_at: user.created_at, updated_at: user.updated_at,
          streak_days: currentStreak(user, today) },
        profile: { gender: user.gender ?? null, age: user.age ?? null, date_of_birth: user.date_of_birth ?? null,
          height: user.height ?? null, weight: user.weight ?? null, ...(hasBody ? calculateBmi(user.weight, user.height) : { bmi_value: null, bmi_status: null }),
          goal: user.goal ?? null, activity_level: user.activity_level ?? null,
          target_calories: user.target_calories ?? null, target_water: user.target_water ?? null, allergies: nutrition?.allergies ?? [] },
        membership: { plan: premium ? 'premium' : 'free', premium, premium_until: premiumUntil, orders },
        activity_30d: { from: fromDay, to: today,
          workouts: workouts.count, workout_minutes: Math.round(workouts.total / 60), meals: meals.count,
          water_ml: water.total, steps: steps.total, ai_questions: chats, quests_completed: quests,
          challenges: runs, badges, records: records ? { best_streak: records.best_streak, longest: records.records.longest,
            hottest: records.records.hottest, total_workouts: records.workouts } : null },
        ai: {
          chat: { used_24h: chatUsed, limit: plan.chat, remaining: Math.max(plan.chat - chatUsed, 0) },
          meal_ai: { used_today: mealAi.used, limit: mealAi.limit, remaining: Math.max(mealAi.limit - mealAi.used, 0) },
          workout_plan: { used_today: planAi.used, limit: planAi.limit, remaining: Math.max(planAi.limit - planAi.used, 0) },
        },
        wallet: { fit_coins: user.fit_coins ?? 0, transactions: coins },
        sessions: { active: sessions, last_login_at: lastSession[0]?.created_at ?? null } };
    },

    // Sign a member out of every device (e.g. stolen phone). Recorded in admin_logs.
    async forceLogout(admin, userId, body) {
      readUserId(userId);
      const { note } = body && Object.keys(body).length ? readFields(body, { note: noteRule }) : {};
      if (userId === admin.user_id) throw fail(409, 'Không thể tự buộc đăng xuất; hãy dùng đăng xuất mọi thiết bị.');
      return transaction(db, async session => {
        const now = new Date();
        await lockAdmin(db, admin.user_id, session, now);
        const target = await member(userId, session);
        const removed = await db.collection('auth_sessions').deleteMany({ user_id: target.user_id }, { session });
        await writeLog(db, admin, 'force_logout', 'user', userId, note || `Thu hồi ${removed.deletedCount} phiên`, now, session);
        return { success: true, message: 'Đã đăng xuất tài khoản khỏi mọi thiết bị.', revoked_sessions: removed.deletedCount };
      });
    },

    // Grant Premium for N days: extends the current end date, or starts today if it already ended.
    async grantPremium(admin, userId, body) {
      readUserId(userId);
      const { days, note } = readFields(body, { days: [rules.int(1, 3650), 'days phải là số nguyên từ 1 đến 3650.'], note: reasonRule });
      requireNote(note);
      if (userId === admin.user_id) throw fail(409, 'Không thể tự thay đổi tài khoản của mình.');
      return transaction(db, async session => {
        const now = new Date();
        await lockAdmin(db, admin.user_id, session, now);
        await member(userId, session);
        const current = (await db.collection('memberships').findOne({ user_id: userId }, { session }))?.premium_until;
        const start = current && current > now ? current : now;
        const until = new Date(start.getTime() + days * DAY_MS);
        await db.collection('memberships').updateOne({ user_id: userId },
          { $set: { premium_until: until, updated_at: now }, $setOnInsert: { user_id: userId, created_at: now } }, { upsert: true, session });
        await writeLog(db, admin, 'grant_premium', 'user', userId, `+${days} ngày: ${note}`, now, session);
        return { success: true, message: `Đã cấp Premium ${days} ngày.`, premium: true, premium_until: until };
      });
    },

    // Revoke Premium now (premium_until = now).
    async revokePremium(admin, userId, body) {
      readUserId(userId);
      const { note } = readFields(body ?? {}, { note: reasonRule });
      requireNote(note);
      if (userId === admin.user_id) throw fail(409, 'Không thể tự thay đổi tài khoản của mình.');
      return transaction(db, async session => {
        const now = new Date();
        await lockAdmin(db, admin.user_id, session, now);
        await member(userId, session);
        const changed = await db.collection('memberships').updateOne({ user_id: userId, premium_until: { $gt: now } },
          { $set: { premium_until: now, updated_at: now } }, { session });
        if (!changed.modifiedCount) throw fail(409, 'Tài khoản đang không có Premium.');
        await writeLog(db, admin, 'revoke_premium', 'user', userId, note, now, session);
        return { success: true, message: 'Đã thu hồi Premium.', premium: false, premium_until: now };
      });
    },

    // Add (amount > 0) or remove (amount < 0) coins. The balance never goes below 0; written to coin_transactions.
    async adjustCoins(admin, userId, body) {
      readUserId(userId);
      const { amount, note } = readFields(body, { amount: [rules.int(-1000000, 1000000), 'amount phải là số nguyên từ -1000000 đến 1000000.'], note: reasonRule });
      if (amount === 0) throw fail(400, 'amount phải khác 0.');
      requireNote(note);
      if (userId === admin.user_id) throw fail(409, 'Không thể tự thay đổi tài khoản của mình.');
      return transaction(db, async session => {
        const now = new Date();
        await lockAdmin(db, admin.user_id, session, now);
        const target = await member(userId, session);
        const balance = await changeCoins(db, { userId, amount, source: 'admin', refId: admin.user_id, note, now, session });
        if (balance === null) throw fail(409, `Số dư không đủ: tài khoản có ${target.fit_coins} xu, không thể trừ ${-amount} xu.`);
        await writeLog(db, admin, 'adjust_coins', 'user', userId, `${amount > 0 ? '+' : ''}${amount} xu: ${note}`, now, session);
        return { success: true, message: amount > 0 ? `Đã cộng ${amount} xu.` : `Đã trừ ${-amount} xu.`, fit_coins: balance };
      });
    },

    // Delete a member's AI chat history and AI Coach memory (user request). The AI quota counters are kept.
    async deleteAiData(admin, userId, body) {
      readUserId(userId);
      const { note } = readFields(body ?? {}, { note: reasonRule });
      requireNote(note);
      if (userId === admin.user_id) throw fail(409, 'Không thể tự thay đổi tài khoản của mình.');
      return transaction(db, async session => {
        const now = new Date();
        await lockAdmin(db, admin.user_id, session, now);
        await member(userId, session);
        // One operation at a time: operations inside a transaction must not run concurrently.
        const messages = await db.collection('ai_chat_messages').deleteMany({ user_id: userId }, { session });
        const chats = await db.collection('ai_chat_sessions').deleteMany({ user_id: userId }, { session });
        const memory = await db.collection('coach_memory').deleteMany({ user_id: userId }, { session });
        await writeLog(db, admin, 'delete_ai_data', 'user', userId, note, now, session);
        return { success: true, message: 'Đã xóa lịch sử chat và trí nhớ AI.',
          deleted: { messages: messages.deletedCount, sessions: chats.deletedCount, memory: memory.deletedCount } };
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

    // System-wide coin ledger (every change of fit_coins). ?user_id= &source= &from= &to= &page=
    async transactions({ page, user_id: userId, source, from, to } = {}) {
      const current = readPage(page);
      const filter = {};
      if (userId !== undefined) filter.user_id = readUserId(userId);
      if (source !== undefined) filter.source = optional(source, value => COIN_SOURCES.includes(value), `source phải là một trong: ${COIN_SOURCES.join(', ')}.`);
      const range = readDayRange(from, to);
      if (range) filter.created_at = range;
      const [rows, total] = await Promise.all([
        db.collection('coin_transactions').aggregate([
          { $match: filter }, { $sort: { created_at: -1, tx_id: 1 } }, { $skip: (current - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE },
          { $lookup: { from: 'users', localField: 'user_id', foreignField: 'user_id', as: 'user' } },
          { $lookup: { from: 'purchases', localField: 'ref_id', foreignField: 'purchase_id', as: 'purchase' } },
          { $lookup: { from: 'reward_items', localField: 'purchase.item_id', foreignField: 'item_id', as: 'item' } },
          { $project: { _id: 0, tx_id: 1, user_id: 1, amount: 1, balance_after: 1, source: 1, ref_id: 1, note: 1, created_at: 1,
            email: { $first: '$user.email' }, full_name: { $first: '$user.full_name' },
            item_id: { $first: '$purchase.item_id' }, item_title: { $first: '$item.title' } } },
        ]).toArray(),
        db.collection('coin_transactions').countDocuments(filter),
      ]);
      return { success: true, transactions: rows, page: current, page_size: PAGE_SIZE, total };
    },

    // VNPay orders. ?status=pending|paid|failed|expired|refunded &user_id= &product= &from= &to= &page=
    // "expired" = still pending after its 15-minute payment window.
    async payments({ status, page, user_id: userId, product, from, to } = {}) {
      const current = readPage(page);
      const filter = paymentFilter({ status, userId, product, from, to });
      const [rows, total] = await Promise.all([
        db.collection('payment_orders').aggregate([
          { $match: filter }, { $sort: { created_at: -1 } }, { $skip: (current - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE },
          { $lookup: { from: 'users', localField: 'user_id', foreignField: 'user_id', as: 'user' } },
          { $project: { _id: 0, order_id: 1, user_id: 1, product: 1, amount_vnd: 1, status: 1, response_code: 1, expires_at: 1,
            vnp_transaction_no: 1, bank_code: 1, created_at: 1, paid_at: 1, refunded_at: 1,
            email: { $first: '$user.email' }, full_name: { $first: '$user.full_name' } } },
        ]).toArray(),
        db.collection('payment_orders').countDocuments(filter),
      ]);
      const now = new Date();
      return { success: true, payments: rows.map(withDisplayStatus(now)), page: current, page_size: PAGE_SIZE, total };
    },

    // One order with the signed VNPay callback fields (vnp_SecureHash is never stored).
    async paymentDetail(orderId) {
      if (!isUuid(orderId)) throw fail(400, 'order_id không hợp lệ.');
      const order = await db.collection('payment_orders').findOne({ order_id: orderId }, { projection: { _id: 0, return_url: 0 } });
      if (!order) throw fail(404, 'Không tìm thấy đơn thanh toán.');
      const user = await users().findOne({ user_id: order.user_id }, { projection: { _id: 0, user_id: 1, email: 1, full_name: 1 } });
      const product = PRODUCTS[order.product];
      return { success: true, order: withDisplayStatus(new Date())({ ...order, vnp_response: order.vnp_response ?? null }), user,
        product: product ? { product: order.product, ...product } : null };
    },

    // CSV of orders in [from, to] (both required, at most 366 days) for reconciliation with the VNPay portal.
    async exportPayments({ from, to, status, product } = {}) {
      if (from === undefined || to === undefined) throw fail(400, 'Cần from và to (YYYY-MM-DD).');
      readDayRange(from, to, 366);
      const filter = paymentFilter({ status, product, from, to });
      const rows = await db.collection('payment_orders').aggregate([
        { $match: filter }, { $sort: { created_at: 1 } }, { $limit: 50000 },
        { $lookup: { from: 'users', localField: 'user_id', foreignField: 'user_id', as: 'user' } },
        { $project: { _id: 0, order_id: 1, txn_ref: 1, product: 1, amount_vnd: 1, status: 1, expires_at: 1, response_code: 1,
          vnp_transaction_no: 1, bank_code: 1, created_at: 1, paid_at: 1, refunded_at: 1, email: { $first: '$user.email' } } },
      ]).toArray();
      const columns = ['order_id', 'vnp_TxnRef', 'email', 'product', 'amount_vnd', 'status', 'response_code', 'vnp_transaction_no',
        'bank_code', 'created_at', 'paid_at', 'refunded_at'];
      const now = new Date();
      const lines = rows.map(withDisplayStatus(now)).map(row => [row.order_id, row.txn_ref, row.email, row.product, row.amount_vnd, row.status,
        row.response_code, row.vnp_transaction_no, row.bank_code, row.created_at, row.paid_at, row.refunded_at].map(csvCell).join(','));
      return { filename: `fitlife-payments-${from}-to-${to}.csv`, csv: `﻿${[columns.join(','), ...lines].join('\r\n')}\r\n`, count: rows.length };
    },

    // Mark a paid order refunded (the money is returned manually on the VNPay portal) and take back what it gave:
    // the Premium days (never before now) and the coins still in the wallet (never below 0).
    async refundPayment(admin, orderId, body) {
      if (!isUuid(orderId)) throw fail(400, 'order_id không hợp lệ.');
      const { note } = readFields(body ?? {}, { note: reasonRule });
      return transaction(db, async session => {
        const now = new Date();
        await lockAdmin(db, admin.user_id, session, now);
        const order = await db.collection('payment_orders').findOne({ order_id: orderId }, { session });
        if (!order) throw fail(404, 'Không tìm thấy đơn thanh toán.');
        if (order.status !== 'paid') throw fail(409, 'Chỉ hoàn tiền được đơn đã thanh toán.');
        await db.collection('payment_orders').updateOne({ order_id: orderId, status: 'paid' },
          { $set: { status: 'refunded', refunded_at: now, refund_note: note, updated_at: now } }, { session });
        const product = PRODUCTS[order.product] ?? { premium_days: 0, coins: 0 };
        let revokedDays = 0;
        if (product.premium_days) {
          const until = (await db.collection('memberships').findOne({ user_id: order.user_id }, { session }))?.premium_until;
          if (until && until > now) {
            const next = new Date(Math.max(now.getTime(), until.getTime() - product.premium_days * DAY_MS));
            revokedDays = Math.round((until.getTime() - next.getTime()) / DAY_MS);
            await db.collection('memberships').updateOne({ user_id: order.user_id }, { $set: { premium_until: next, updated_at: now } }, { session });
          }
        }
        let revokedCoins = 0;
        if (product.coins) {
          const balance = (await users().findOne({ user_id: order.user_id }, { session, projection: { fit_coins: 1 } }))?.fit_coins ?? 0;
          revokedCoins = Math.min(product.coins, balance);
          if (revokedCoins) {
            await changeCoins(db, { userId: order.user_id, amount: -revokedCoins, source: 'payment_refund', refId: orderId, note, now, session });
          }
        }
        await writeLog(db, admin, 'refund_payment', 'payment', orderId,
          `${note} (thu hồi ${revokedDays} ngày Premium, ${revokedCoins} xu)`, now, session);
        return { success: true, message: 'Đã đánh dấu hoàn tiền.', revoked_premium_days: revokedDays, revoked_coins: revokedCoins,
          coins_not_recovered: (product.coins ?? 0) - revokedCoins };
      });
    },

    // Dashboard charts per Vietnam day for ?range=7d|30d|90d (default 30d).
    async analytics(range = '30d') {
      const days = { '7d': 7, '30d': 30, '90d': 90 }[range];
      if (!days) throw fail(400, 'range phải là 7d, 30d hoặc 90d.');
      const today = localDay(new Date(), ADMIN_TZ);
      const first = addDays(today, -(days - 1));
      const since = new Date(`${first}T00:00:00+07:00`);
      const byDay = field => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: ADMIN_TZ } });
      const perDay = (name, field, match = {}) => db.collection(name).aggregate([{ $match: { [field]: { $gte: first }, ...match } },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } }]).toArray();
      const PREMIUM = Object.keys(PRODUCTS).filter(key => PRODUCTS[key].premium_days);
      const [revenue, signups, active, workouts, meals, aiMessages, firstPremium, members] = await Promise.all([
        db.collection('payment_orders').aggregate([{ $match: { status: 'paid', paid_at: { $gte: since } } },
          { $group: { _id: { day: byDay('$paid_at'), premium: { $in: ['$product', PREMIUM] } }, amount: { $sum: '$amount_vnd' }, count: { $sum: 1 } } }]).toArray(),
        users().aggregate([{ $match: { created_at: { $gte: since } } }, { $group: { _id: byDay('$created_at'), count: { $sum: 1 } } }]).toArray(),
        // DAU: a member who logged a workout, meal, water or steps, or asked the AI Coach, that day.
        db.collection('workout_logs').aggregate([
          { $match: { workout_date: { $gte: first } } }, { $project: { _id: 0, user_id: 1, day: '$workout_date' } },
          ...[['meal_logs', 'meal_date'], ['water_logs', 'log_date'], ['steps_logs', 'step_date']].map(([coll, field]) => ({ $unionWith: { coll,
            pipeline: [{ $match: { [field]: { $gte: first } } }, { $project: { _id: 0, user_id: 1, day: `$${field}` } }] } })),
          { $unionWith: { coll: 'ai_chat_messages', pipeline: [{ $match: { sender: 'user', created_at: { $gte: since } } },
            { $project: { _id: 0, user_id: 1, day: byDay('$created_at') } }] } },
          { $group: { _id: { day: '$day', user_id: '$user_id' } } }, { $group: { _id: '$_id.day', count: { $sum: 1 } } },
        ]).toArray(),
        perDay('workout_logs', 'workout_date'),
        perDay('meal_logs', 'meal_date'),
        db.collection('ai_chat_messages').aggregate([{ $match: { sender: 'user', created_at: { $gte: since } } },
          { $group: { _id: byDay('$created_at'), count: { $sum: 1 } } }]).toArray(),
        db.collection('payment_orders').aggregate([{ $match: { status: 'paid', product: { $in: PREMIUM } } },
          { $group: { _id: '$user_id', first: { $min: '$paid_at' } } }]).toArray(),
        users().countDocuments({ role: 'user' }),
      ]);
      const map = rows => new Map(rows.map(row => [row._id, row.count]));
      const [s, a, w, m, c] = [signups, active, workouts, meals, aiMessages].map(map);
      const series = Array.from({ length: days }, (_, index) => {
        const day = addDays(first, index);
        const money = premium => revenue.find(row => row._id.day === day && row._id.premium === premium)?.amount ?? 0;
        return { date: day, revenue_premium_vnd: money(true), revenue_coins_vnd: money(false), signups: s.get(day) ?? 0,
          dau: a.get(day) ?? 0, workouts: w.get(day) ?? 0, meals: m.get(day) ?? 0, ai_messages: c.get(day) ?? 0 };
      });
      const total = key => series.reduce((sum, row) => sum + row[key], 0);
      // Conversion: members whose FIRST paid Premium order is in the range ÷ members who were still Free when it began.
      const converted = firstPremium.filter(row => row.first >= since).length;
      const premiumBefore = firstPremium.filter(row => row.first < since).length;
      const freeAtStart = Math.max(members - premiumBefore, 0);
      return { success: true, range, timezone: ADMIN_TZ, from: first, to: today, days: series,
        totals: { revenue_premium_vnd: total('revenue_premium_vnd'), revenue_coins_vnd: total('revenue_coins_vnd'), signups: total('signups'),
          workouts: total('workouts'), meals: total('meals'), ai_messages: total('ai_messages') },
        conversion: { new_premium_members: converted, free_members_at_start: freeAtStart,
          rate: freeAtStart ? Math.round((converted / freeAtStart) * 10000) / 10000 : 0 } };
    },

    // AI daily limits per plan: chat (per rolling 24 h), workout_plan and meal_ai (per local day).
    async getAiLimits() {
      return { success: true, limits: await aiLimits(db), defaults: DEFAULT_AI_LIMITS, kinds: AI_KINDS };
    },
    async updateAiLimits(admin, body) {
      if (!isPlainBody(body, ['free', 'premium', 'note'])) throw fail(400, 'Chỉ gửi free, premium và note.');
      const note = readFields({ note: body.note }, { note: reasonRule }).note;
      if (body.free === undefined && body.premium === undefined) throw fail(400, 'Không có thay đổi nào.');
      const next = await aiLimits(db);
      for (const plan of ['free', 'premium']) {
        if (body[plan] === undefined) continue;
        if (!isPlainBody(body[plan], AI_KINDS)) throw fail(400, `${plan} chỉ gồm: ${AI_KINDS.join(', ')}.`);
        for (const [kind, value] of Object.entries(body[plan])) {
          if (!Number.isInteger(value) || value < 0 || value > 100000) throw fail(400, `${plan}.${kind} phải là số nguyên từ 0 đến 100000.`);
          next[plan][kind] = value;
        }
      }
      return transaction(db, async session => {
        const now = new Date();
        await lockAdmin(db, admin.user_id, session, now);
        await db.collection('app_settings').updateOne({ name: 'ai_limits' },
          { $set: { free: next.free, premium: next.premium, updated_at: now }, $setOnInsert: { setting_id: AI_LIMITS_ID, name: 'ai_limits', created_at: now } },
          { upsert: true, session });
        await writeLog(db, admin, 'update_ai_limits', 'setting', 'ai_limits', `${note} ${JSON.stringify(next)}`.slice(0, 500), now, session);
        return { success: true, message: 'Đã cập nhật hạn mức AI.', limits: next };
      });
    },

    // Exercise catalog. ?q= (name/name_vi) &body_part= &status=active|hidden &page=
    async exercises({ q, body_part: bodyPart, status, page } = {}) {
      const current = readPage(page);
      const filter = {};
      if (q !== undefined) {
        if (typeof q !== 'string' || q.length > 100) throw fail(400, 'Từ khóa tối đa 100 ký tự.');
        if (q.trim()) filter.$or = [{ name: { $regex: escapeRegex(q.trim()), $options: 'i' } }, { name_vi: { $regex: escapeRegex(q.trim()), $options: 'i' } }];
      }
      if (bodyPart !== undefined) filter.body_parts = optional(bodyPart, value => isText(value, 100), 'body_part không hợp lệ.');
      if (status !== undefined) filter.is_active = optional(status, value => ['active', 'hidden'].includes(value), 'status phải là active hoặc hidden.') === 'active';
      const projection = { _id: 0, exercise_id: 1, source: 1, name: 1, name_vi: 1, body_parts: 1, body_parts_vi: 1, target_muscles: 1,
        target_muscles_vi: 1, equipments: 1, equipments_vi: 1, gif_url: 1, rest_seconds: 1, is_active: 1, updated_at: 1 };
      const [rows, total] = await Promise.all([
        db.collection('exercises').find(filter, { projection }).sort({ name: 1, exercise_id: 1 }).skip((current - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
        db.collection('exercises').countDocuments(filter),
      ]);
      return { success: true, exercises: rows, page: current, page_size: PAGE_SIZE, total };
    },
    async createExercise(admin, body) {
      const { exercise_id: exerciseId, ...rest } = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
      if (!isUuid(exerciseId)) throw fail(400, 'Cần exercise_id UUID.');
      const { note, ...input } = readFields(rest, { ...exerciseSpec, note: noteRule }, { partial: true });
      const missing = EXERCISE_REQUIRED.filter(key => input[key] === undefined || (Array.isArray(input[key]) && !input[key].length));
      if (missing.length) throw fail(400, `Thiếu: ${missing.join(', ')}.`);
      return transaction(db, async session => {
        const now = new Date();
        await lockAdmin(db, admin.user_id, session, now);
        const existing = await db.collection('exercises').findOne({ exercise_id: exerciseId }, { session, projection: { _id: 0 } });
        if (existing) return { success: true, replayed: true, exercise: existing };
        const exercise = { exercise_id: exerciseId, source: 'admin', source_exercise_id: exerciseId, name: input.name ?? input.name_vi,
          secondary_muscles: [], instructions: input.instructions_vi, is_active: true, ...input, synced_at: now, created_at: now, updated_at: now };
        await db.collection('exercises').insertOne(exercise, { session });
        delete exercise._id;
        await writeLog(db, admin, 'create_exercise', 'exercise', exerciseId, note || exercise.name_vi, now, session);
        return { success: true, replayed: false, message: 'Đã tạo bài tập.', exercise };
      });
    },
    async updateExercise(admin, exerciseId, body) {
      if (!isUuid(exerciseId)) throw fail(400, 'exercise_id không hợp lệ.');
      const { note, ...changes } = readFields(body, { ...exerciseSpec, note: noteRule }, { partial: true });
      if (!Object.keys(changes).length) throw fail(400, 'Không có thay đổi nào.');
      for (const key of ['body_parts', 'target_muscles', 'equipments', 'instructions_vi']) {
        if (Array.isArray(changes[key]) && !changes[key].length) throw fail(400, `${key} không được để trống.`);
      }
      return transaction(db, async session => {
        const now = new Date();
        await lockAdmin(db, admin.user_id, session, now);
        const exercise = await db.collection('exercises').findOneAndUpdate({ exercise_id: exerciseId }, { $set: { ...changes, updated_at: now } },
          { session, returnDocument: 'after', projection: { _id: 0 } });
        if (!exercise) throw fail(404, 'Không tìm thấy bài tập.');
        await writeLog(db, admin, changes.is_active === false ? 'hide_exercise' : changes.is_active === true ? 'show_exercise' : 'update_exercise',
          'exercise', exerciseId, note || Object.keys(changes).join(', '), now, session);
        return { success: true, message: 'Đã cập nhật bài tập.', exercise };
      });
    },

    // Admin audit trail (read-only). ?action= &target_type= &target_id= &admin_id= &from= &to= &page=
    async logs({ page, action, target_type: targetType, target_id: targetId, admin_id: adminId, from, to } = {}) {
      const current = readPage(page);
      const filter = {};
      if (action !== undefined) filter.action = optional(action, value => typeof value === 'string' && /^[a-z_]{1,50}$/.test(value), 'action không hợp lệ.');
      if (targetType !== undefined) filter.target_type = optional(targetType, value => LOG_TARGETS.includes(value), `target_type phải là một trong: ${LOG_TARGETS.join(', ')}.`);
      if (targetId !== undefined) filter.target_id = readUserId(targetId);
      if (adminId !== undefined) filter.admin_id = readUserId(adminId);
      const range = readDayRange(from, to);
      if (range) filter.created_at = range;
      const [rows, total] = await Promise.all([
        db.collection('admin_logs').aggregate([
          { $match: filter }, { $sort: { created_at: -1 } }, { $skip: (current - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE },
          { $lookup: { from: 'users', localField: 'admin_id', foreignField: 'user_id', as: 'admin' } },
          { $project: { _id: 0, log_id: 1, admin_id: 1, action: 1, target_type: 1, target_id: 1, note: 1, created_at: 1,
            admin_name: { $first: '$admin.full_name' }, admin_email: { $first: '$admin.email' } } },
        ]).toArray(),
        db.collection('admin_logs').countDocuments(filter),
      ]);
      return { success: true, logs: rows, page: current, page_size: PAGE_SIZE, total };
    },
  };
  return service;
}
module.exports = { createAdminService };
