'use strict';
function loadPaymentConfig(values) {
  const environment = values.VNP_ENV || 'sandbox';
  const simulation = values.PAYMENT_SIMULATION === '1';
  if (simulation && (values.NODE_ENV === 'production' || environment === 'production')) throw new Error('Payment simulation is disabled in production.');
  if (!['sandbox', 'production'].includes(environment)) throw new Error('VNP_ENV must be sandbox or production.');
  const payUrl = values.VNP_PAY_URL || (environment === 'sandbox' ? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html' : 'https://pay.vnpay.vn/vpcpay.html');
  const gateway = new URL(payUrl);
  const host = environment === 'sandbox' ? 'sandbox.vnpayment.vn' : 'pay.vnpay.vn';
  if (gateway.protocol !== 'https:' || gateway.hostname !== host || gateway.username || gateway.password || gateway.search || gateway.hash || gateway.port) throw new Error('VNP_PAY_URL does not match VNP_ENV.');
  const tmnCode = (values.VNP_TMN_CODE || '').trim(), hashSecret = (values.VNP_HASH_SECRET || '').trim();
  if (Boolean(tmnCode) !== Boolean(hashSecret)) throw new Error('Configure both VNP_TMN_CODE and VNP_HASH_SECRET.');
  function baseUrl(value, label) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error(`Invalid ${label}.`);
    return value.replace(/\/+$/, '');
  }
  return { environment, simulation, tmnCode, hashSecret, payUrl,
    publicApiUrl: baseUrl(values.PUBLIC_API_URL || `http://localhost:${values.PORT || 5000}`, 'PUBLIC_API_URL'),
    webAppUrl: baseUrl(values.WEB_APP_URL || 'http://localhost:5173', 'WEB_APP_URL') };
}
module.exports = { loadPaymentConfig };
