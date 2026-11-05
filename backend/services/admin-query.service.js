'use strict';
const { HttpError } = require('../utils/http-error');
const { isUuid } = require('../utils/validate');
const { listQuery, dates, pageRows } = require('../utils/list-query');
const { PRODUCTS, SIMULATION_BANK } = require('./payment.service');
const fail = (status, message) => new HttpError(status, message);
function createAdminQueries({ db }) {
  const coll = name => db.collection(name);
  async function joinedPage(name, key, filter, query, projection, lookups, searchFields, sorts) {
    const p = listQuery(query, sorts);
    const sort = { ...p.sort, ['order_id']: 1 };
    delete sort._id;
    const base = [{ $match: filter }, ...lookups.map(l => ({ $lookup: l })), { $project: { _id: 0, ...projection } },
      ...(p.regex ? [{ $match: { $or: searchFields.map(f => ({ [f]: p.regex })) } }] : [])];
    const [result] = await coll(name).aggregate([...base, { $facet: {
      rows: [{ $sort: sort }, { $skip: p.skip }, { $limit: p.page_size }], count: [{ $count: 'total' }],
    } }]).toArray();
    return { success: true, [key]: result.rows, page: p.page, page_size: p.page_size, total: result.count[0]?.total || 0 };
  }
  function accountFilter(query) {
    if (query.user_id && (typeof query.user_id !== 'string' || query.user_id.length > 128)) throw fail(400, 'user_id không hợp lệ.');
    return query.user_id ? { user_id: query.user_id } : {};
  }
  return {
    async listChallenges(query = {}) {
      const p = listQuery(query), filter = {};
      if (p.regex) filter.$or = [{ title: p.regex }, { description: p.regex }];
      if (query.status) { if (!['active', 'inactive'].includes(query.status)) throw fail(400, 'status phải là active hoặc inactive.'); filter.is_active = query.status === 'active'; }
      const result = await pageRows(coll('challenges'), 'challenges', filter, query);
      const runs = await coll('user_challenges').aggregate([{ $match: { challenge_id: { $in: result.challenges.map(c => c.challenge_id) } } }, { $group: { _id: '$challenge_id',
        joined: { $sum: { $cond: ['$is_completed', 0, 1] } }, completed: { $sum: { $cond: ['$is_completed', 1, 0] } } } }]).toArray();
      result.challenges = result.challenges.map(c => ({ ...c, joined: runs.find(r => r._id === c.challenge_id)?.joined || 0, completed: runs.find(r => r._id === c.challenge_id)?.completed || 0 }));
      return result;
    },
    async detail(name, id) {
      const spec = { challenges: ['challenges', 'challenge_id', 'item'],
        payments: ['payment_orders', 'order_id', 'payment'],
        logs: ['admin_logs', 'log_id', 'log'] }[name];
      if (!spec || !isUuid(id)) throw fail(400, 'Mã tài nguyên không hợp lệ.');
      const row = await coll(spec[0]).findOne({ [spec[1]]: id }, { projection: { _id: 0, ...(name === 'payments' ? { txn_ref: 0, return_url: 0 } : {}) } });
      if (!row) throw fail(404, 'Không tìm thấy tài nguyên.');
      if (row.user_id) {
        const person = await coll('users').findOne({ user_id: row.user_id }, { projection: { email: 1, full_name: 1 } });
        row.email = person?.email || ''; row.full_name = person?.full_name || '';
      }
      if (name === 'payments') row.simulated = row.bank_code === SIMULATION_BANK;
      return { success: true, [spec[2]]: row };
    },
    async payments(query = {}) {
      const filter = { ...dates(query, 'created_at'), ...accountFilter(query) };
      if (query.status) { if (!['pending', 'paid', 'failed'].includes(query.status)) throw fail(400, 'status phải là pending, paid hoặc failed.'); filter.status = query.status; }
      if (query.product) { if (!Object.hasOwn(PRODUCTS, query.product)) throw fail(400, 'product không hợp lệ.'); filter.product = query.product; }
      const result = await joinedPage('payment_orders', 'payments', filter, query,
        { order_id: 1, user_id: 1, product: 1, amount_vnd: 1, status: 1, response_code: 1, vnp_transaction_no: 1, bank_code: 1, created_at: 1, paid_at: 1,
          email: { $first: '$user.email' }, full_name: { $first: '$user.full_name' } },
        [{ from: 'users', localField: 'user_id', foreignField: 'user_id', as: 'user' }], ['email', 'full_name', 'order_id'], ['created_at', 'paid_at', 'amount_vnd']);
      result.payments = result.payments.map(row => ({...row,simulated:row.bank_code===SIMULATION_BANK}));
      return result;
    },
    async logs(query = {}) {
      if (typeof query !== 'object') query = { page: query };
      const p = listQuery(query, ['created_at', 'action']), filter = { ...dates(query, 'created_at') };
      for (const key of ['action', 'target_id', 'admin_id']) {
        if (query[key]) { if (typeof query[key] !== 'string' || query[key].length > 128) throw fail(400, key + ' không hợp lệ.'); filter[key] = query[key]; }
      }
      if (query.user_id) filter.target_id = accountFilter(query).user_id;
      if (p.regex) filter.$or = [{ note: p.regex }, { action: p.regex }, { target_id: p.regex }];
      const result = await pageRows(coll('admin_logs'), 'logs', filter, query, ['created_at', 'action']);
      const admins = await coll('users').find({ user_id: { $in: result.logs.map(l => l.admin_id) } }, { projection: { full_name: 1, user_id: 1 } }).toArray();
      result.logs = result.logs.map(l => ({ ...l, admin_name: admins.find(a => a.user_id === l.admin_id)?.full_name || '' }));
      return result;
    },
    async revenue(query = {}) {
      const dateFilter = dates(query, 'paid_at');
      const rows = await coll('payment_orders').aggregate([{ $match: { status: 'paid', bank_code: { $ne: SIMULATION_BANK }, ...dateFilter } },
        { $group: { _id: '$product', amount_vnd: { $sum: '$amount_vnd' }, count: { $sum: 1 } } }]).toArray();
      const result = { success: true, currency: 'VND', timezone: 'UTC', period: { from: dateFilter.paid_at?.$gte || null, to: dateFilter.paid_at?.$lte || null },
        formula: 'SUM(amount_vnd) WHERE status = paid AND bank_code != FITLIFE_SIMULATION AND paid_at within period; Premium and Coin products grouped separately.',
        premium: { amount_vnd: 0, count: 0 }, coins: { amount_vnd: 0, count: 0 }, other: { amount_vnd: 0, count: 0 } };
      for (const row of rows) {
        const kind = PRODUCTS[row._id]?.premium_days > 0 ? 'premium' : PRODUCTS[row._id]?.coins > 0 ? 'coins' : 'other';
        result[kind].amount_vnd += row.amount_vnd; result[kind].count += row.count;
      }
      const statuses = await coll('payment_orders').aggregate([{ $match: { status: { $ne: 'paid' }, bank_code: { $ne: SIMULATION_BANK }, ...dates(query, 'created_at') } }, { $group: { _id: '$status', count: { $sum: 1 }, amount_vnd: { $sum: '$amount_vnd' } } }]).toArray();
      result.excluded = { pending: { count: 0, amount_vnd: 0 }, failed: { count: 0, amount_vnd: 0 }, refunded: null, cancelled: null };
      statuses.forEach(s => { result.excluded[s._id] = { count: s.count, amount_vnd: s.amount_vnd }; });
      result.excluded.simulated = { count: await coll('payment_orders').countDocuments({bank_code:SIMULATION_BANK,...dates(query,'created_at')}) };
      result.refund_policy = 'The existing model has no refund/cancel operation; these values are unavailable.';
      result.total = { amount_vnd: result.premium.amount_vnd + result.coins.amount_vnd + result.other.amount_vnd, count: result.premium.count + result.coins.count + result.other.count };
      return result;
    },
  };
}
module.exports = { createAdminQueries };
