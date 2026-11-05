'use strict';
const express = require('express');
const { createPaymentService } = require('../services/payment.service');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');

const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
// VNPay rejects IPv6 and loopback-mapped forms.
const clientIp = req => (req.ip || '127.0.0.1').replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');

function resultPage({ ok, title, detail, redirect }) {
  const link = redirect ? escapeHtml(redirect) : null;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>${link ? `<meta http-equiv="refresh" content="2;url=${link}">` : ''}
<style>body{font-family:system-ui,sans-serif;background:#f4f7f5;margin:0;display:grid;place-items:center;min-height:100vh}
main{background:#fff;border-radius:16px;padding:32px 24px;max-width:360px;text-align:center;box-shadow:0 4px 24px #0001}
h1{font-size:20px;color:${ok ? '#15803d' : '#b91c1c'}}a{display:inline-block;margin-top:16px;padding:12px 20px;border-radius:10px;background:#16a34a;color:#fff;text-decoration:none}</style>
</head><body><main><h1>${escapeHtml(title)}</h1>${detail ? `<p>${escapeHtml(detail)}</p>` : ''}
${link ? `<p>Đang quay lại FitLife…</p><a href="${link}">Quay lại ứng dụng</a>` : ''}</main></body></html>`;
}

function createPaymentRouter({ db, payments }) {
  const router = express.Router();
  const service = createPaymentService({ db, config: payments });
  // Public VNPay callbacks: authenticated by the HMAC signature, not by a session.
  router.get('/vnpay/ipn', asyncHandler(async (req, res) => res.json(await service.ipn(req.query))));
  router.get('/vnpay/return', asyncHandler(async (req, res) => {
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.type('html').send(resultPage(await service.browserReturn(req.query)));
  }));

  router.use(createRequireAuth({ db }), requireMember);
  router.get('/plans', asyncHandler(async (req, res) => res.json(await service.plans(req.auth.user))));
  router.get('/orders', asyncHandler(async (req, res) => res.json(await service.myOrders(req.auth.user, req.query.page))));
  router.get('/orders/:orderId', asyncHandler(async (req, res) => res.json(await service.order(req.auth.user, req.params.orderId))));
  router.post('/orders', asyncHandler(async (req, res) => res.status(201).json(await service.createOrder(req.auth.user, req.body, clientIp(req)))));
  router.post('/orders/:orderId/simulate', asyncHandler(async (req, res) => res.json(await service.simulate(req.auth.user, req.params.orderId, req.body))));
  return router;
}

module.exports = { createPaymentRouter };
