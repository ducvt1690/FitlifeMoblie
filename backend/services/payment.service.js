'use strict';
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { isUuid, isPlainBody } = require('../utils/validate');
const { readPage } = require('../utils/fields');
const { buildPaymentUrl, verifyCallback, vnTime } = require('../utils/vnpay');
const { lockMember } = require('./quest.service');
const { changeCoins } = require('../utils/coins');

const fail = (status, message) => new HttpError(status, message);
const PAGE_SIZE = 20;
const ORDER_TTL_MS = 15 * 60000;
const DAY_MS = 86400000;
// Prices live on the server only; the client sends a product key.
const PRODUCTS = {
  premium_month: { title: 'Premium 1 tháng', amount_vnd: 49000, premium_days: 30, coins: 100 },
  premium_year: { title: 'Premium 12 tháng', amount_vnd: 399000, premium_days: 365, coins: 1500 },
  coins_200: { title: 'Gói 200 xu', amount_vnd: 20000, premium_days: 0, coins: 200 },
  coins_550: { title: 'Gói 550 xu', amount_vnd: 50000, premium_days: 0, coins: 550 },
};
const PUBLIC_ORDER = { _id: 0, txn_ref: 0, return_url: 0, vnp_response: 0 };

async function membershipOf(db, userId, session) {
  const row = await db.collection('memberships').findOne({ user_id: userId }, { session });
  const until = row?.premium_until ?? null;
  return { premium: !!until && until > new Date(), premium_until: until };
}

function createPaymentService({ db, config = {} }) {
  const orders = () => db.collection('payment_orders');
  const configured = () => !!(config.tmnCode && config.hashSecret);
  const requireConfigured = () => { if (!configured()) throw fail(503, 'Thanh toán VNPay chưa được cấu hình trên máy chủ.'); };

  // App deep links (fitlife://, exp:// in Expo Go) or a page of the configured website.
  function readReturnUrl(value) {
    const fallback = `${config.webAppUrl}/app/premium`;
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || value.length > 500) throw fail(400, 'return_url không hợp lệ.');
    if (/^(fitlife|exps?):\/\/[^\s]*$/.test(value)) return value;
    if (config.webAppUrl && (value === config.webAppUrl || value.startsWith(`${config.webAppUrl}/`))) return value;
    throw fail(400, 'return_url phải là đường dẫn của ứng dụng FitLife.');
  }

  // Credit the order once. Shared by the IPN and the browser return so either can arrive first.
  async function settle(query) {
    const fields = verifyCallback(config.hashSecret, query);
    if (!fields) return { RspCode: '97', Message: 'Invalid signature' };
    return transaction(db, async session => {
      const order = await orders().findOne({ txn_ref: fields.vnp_TxnRef }, { session });
      if (!order) return { RspCode: '01', Message: 'Order not found' };
      if (Number(fields.vnp_Amount) !== order.amount_vnd * 100) return { RspCode: '04', Message: 'Invalid amount', order };
      if (order.status !== 'pending') return { RspCode: '02', Message: 'Order already confirmed', order };
      const now = new Date();
      const paid = fields.vnp_ResponseCode === '00' && fields.vnp_TransactionStatus === '00';
      const update = { status: paid ? 'paid' : 'failed', response_code: fields.vnp_ResponseCode ?? null,
        vnp_transaction_no: fields.vnp_TransactionNo ?? null, bank_code: fields.vnp_BankCode ?? null,
        // Signed callback fields without vnp_SecureHash, kept for admin reconciliation.
        vnp_response: fields, paid_at: paid ? now : null, updated_at: now };
      // The status filter makes a concurrent duplicate callback a no-op.
      const result = await orders().updateOne({ order_id: order.order_id, status: 'pending' }, { $set: update }, { session });
      if (!result.modifiedCount) return { RspCode: '02', Message: 'Order already confirmed', order };
      if (paid) {
        const product = PRODUCTS[order.product];
        // Money was taken, so credit even if the account was locked meanwhile.
        if (product.coins) await changeCoins(db, { userId: order.user_id, amount: product.coins, source: 'payment', refId: order.order_id, now, session });
        if (product.premium_days) {
          const { premium_until: current } = await membershipOf(db, order.user_id, session);
          const start = current && current > now ? current : now;
          const until = new Date(start.getTime() + product.premium_days * DAY_MS);
          await db.collection('memberships').updateOne({ user_id: order.user_id },
            { $set: { premium_until: until, updated_at: now }, $setOnInsert: { user_id: order.user_id, created_at: now } }, { upsert: true, session });
        }
      }
      return { RspCode: '00', Message: 'Confirm Success', order: { ...order, ...update } };
    });
  }

  return {
    PRODUCTS,
    configured,
    membership: (userId) => membershipOf(db, userId),

    async plans(user) {
      return { success: true, configured: configured(), membership: await membershipOf(db, user.user_id),
        plans: Object.entries(PRODUCTS).map(([product, p]) => ({ product, ...p })) };
    },

    // The client sends order_id so a retried request reuses the same order and payment link.
    async createOrder(member, body, ip) {
      requireConfigured();
      if (!isPlainBody(body, ['order_id', 'product', 'return_url']) || !isUuid(body.order_id)) throw fail(400, 'Cần order_id UUID.');
      const product = PRODUCTS[body.product];
      if (!Object.hasOwn(PRODUCTS, body.product)) throw fail(400, `product phải là một trong: ${Object.keys(PRODUCTS).join(', ')}.`);
      const returnUrl = readReturnUrl(body.return_url);
      const order = await transaction(db, async session => {
        const now = new Date();
        const user = await lockMember(db, member.user_id, session, now);
        const existing = await orders().findOne({ order_id: body.order_id }, { session });
        if (existing) {
          if (existing.user_id !== user.user_id || existing.product !== body.product) throw fail(409, 'order_id đã được sử dụng cho yêu cầu khác.');
          if (existing.status !== 'pending' || existing.expires_at <= now) throw fail(409, 'Đơn này đã kết thúc. Hãy tạo đơn mới.');
          return existing;
        }
        const created = { order_id: body.order_id, user_id: user.user_id, product: body.product, amount_vnd: product.amount_vnd,
          status: 'pending', txn_ref: body.order_id.replace(/-/g, ''), return_url: returnUrl,
          expires_at: new Date(now.getTime() + ORDER_TTL_MS), response_code: null, vnp_transaction_no: null, bank_code: null,
          paid_at: null, created_at: now, updated_at: now };
        await orders().insertOne(created, { session });
        return created;
      });
      const payment_url = buildPaymentUrl(config, {
        vnp_Version: '2.1.0', vnp_Command: 'pay', vnp_TmnCode: config.tmnCode, vnp_Amount: order.amount_vnd * 100,
        vnp_CurrCode: 'VND', vnp_TxnRef: order.txn_ref, vnp_OrderInfo: `FitLife ${order.product} ${order.txn_ref}`,
        vnp_OrderType: 'other', vnp_Locale: 'vn', vnp_ReturnUrl: `${config.publicApiUrl}/api/payments/vnpay/return`,
        vnp_IpAddr: ip, vnp_CreateDate: vnTime(order.created_at), vnp_ExpireDate: vnTime(order.expires_at),
      });
      const { _id, txn_ref, return_url, ...pub } = order;
      return { success: true, order: pub, payment_url };
    },

    async myOrders(user, page) {
      const current = readPage(page);
      const filter = { user_id: user.user_id };
      const [rows, total] = await Promise.all([
        orders().find(filter, { projection: PUBLIC_ORDER }).sort({ created_at: -1 }).skip((current - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
        orders().countDocuments(filter),
      ]);
      return { success: true, orders: rows, page: current, page_size: PAGE_SIZE, total };
    },

    async order(user, orderId) {
      if (!isUuid(orderId)) throw fail(400, 'order_id không hợp lệ.');
      const order = await orders().findOne({ order_id: orderId, user_id: user.user_id }, { projection: PUBLIC_ORDER });
      if (!order) throw fail(404, 'Không tìm thấy đơn thanh toán.');
      return { success: true, order, membership: await membershipOf(db, user.user_id) };
    },

    // VNPay server-to-server call: always answer 200 with its RspCode contract.
    async ipn(query) {
      if (!configured()) return { RspCode: '99', Message: 'Not configured' };
      const { RspCode, Message } = await settle(query);
      return { RspCode, Message };
    },

    // Browser redirect after paying. Settles too, so local development works without a public IPN URL.
    async browserReturn(query) {
      if (!configured()) return { ok: false, title: 'Thanh toán chưa được cấu hình', redirect: null };
      const result = await settle(query);
      const order = result.order ?? null;
      if (!order) return { ok: false, title: 'Không xác minh được giao dịch', redirect: null };
      const status = (await orders().findOne({ order_id: order.order_id }))?.status ?? order.status;
      const ok = status === 'paid';
      const sep = order.return_url.includes('?') ? '&' : '?';
      return { ok, title: ok ? 'Thanh toán thành công' : 'Thanh toán chưa thành công',
        detail: `${PRODUCTS[order.product].title} · ${order.amount_vnd.toLocaleString('vi-VN')}đ`,
        redirect: `${order.return_url}${sep}order=${order.order_id}&status=${status}` };
    },
  };
}

module.exports = { createPaymentService, membershipOf, PRODUCTS };
