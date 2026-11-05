'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../app');
// Router construction is synchronous. No MongoDB call occurs during inventory.
const app = createApp({ db: {} });
const collections = ['all-api', 'platform-regression'].map(name => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../api/${name}.postman_collection.json`), 'utf8')));
function requests(items) { return items.flatMap(i => i.item ? requests(i.item) : [i.request]); }
const postman = collections.flatMap(c => requests(c.item)).map(r => ({ method: r.method, path: (typeof r.url === 'string' ? r.url : r.url.raw).replace('{{baseUrl}}', '').split('?')[0] }));
const routes = [];
function access(route) {
  if (/^\/api\/auth\/(register|login|forgot-password|reset-password|logout)$/.test(route) || route.startsWith('/api/auth/register/')) return 'Public; rate limit; OTP/session theo thao tác';
  if (route.startsWith('/api/payments/vnpay/')) return 'Public callback; kiểm tra chữ ký HMAC';
  if (route.startsWith('/api/admin/')) return 'Bearer + admin';
  if (route.startsWith('/api/trainer/')) return 'Bearer + trainer + ownership/consent';
  if (route.startsWith('/api/exercises')) return 'Bearer; mọi role; catalog chung';
  if (route.startsWith('/api/auth/') || route === '/api/profile') return 'Bearer; tài khoản hiện tại';
  return 'Bearer + user + ownership';
}
for (const layer of app._router.stack) {
  if (layer.name !== 'router') continue;
  const prefix = layer.regexp.source.replaceAll('\\/', '/').split('/?')[0].slice(1);
  for (const entry of layer.handle.stack) {
    if (!entry.route) continue;
    const route = prefix + (entry.route.path === '/' ? '' : entry.route.path);
    for (const method of Object.keys(entry.route.methods)) {
      const pattern = new RegExp('^' + route.replace(/:[^/]+/g, '[^/]+') + '$');
      routes.push({ method: method.toUpperCase(), route, auth: access(route), postman: postman.some(r => r.method === method.toUpperCase() && pattern.test(r.path)) });
    }
  }
}
const covered = routes.filter(r => r.postman).length;
const doc = `# API Inventory — 05/11/2026

Sinh lại bằng \`node backend/scripts/build-api-inventory.js\` từ Express router thực tế, không chỉ root API banner. Có ${routes.length} endpoint nghiệp vụ, ${covered} endpoint có request trong hai Postman collection đã chạy. “Có Postman” là coverage đường dẫn/method; không có nghĩa mọi tổ hợp negative/boundary/race đã được kiểm thử. Các test HTTP/database riêng trong \`backend/test/\` bổ sung kiểm chứng nghiệp vụ.

Health: \`GET /health\` ping database; \`GET /\` thông tin dịch vụ. Lỗi JSON chuẩn \`{success:false,message}\`; 400 validation, 401 session thiếu/hết hạn/revoke, 403 sai quyền/consent, 404 resource ngoài scope/không tồn tại, 409 conflict, 429 rate limit, 503 hạ tầng/config không khả dụng. VNPay IPN có contract riêng RspCode, HTTP 200 là yêu cầu callback.

| Method | Endpoint | Authentication / authorization | Có request Postman |
|---|---|---|---|
${routes.map(r => `| ${r.method} | \`${r.route}\` | ${r.auth} | ${r.postman ? 'Có' : 'Chưa'} |`).join('\n')}

## DTO, validation và persistence

Nguồn chính xác: \`backend/routes/\`, \`backend/services/\`, \`backend/database/mongodb/schema.js\`. MongoDB validator strict kiểm tra cấu trúc cuối cùng; API allowlist cấm field lạ và scope owner từ session, không nhận quyền/xu từ frontend.

| Nhóm | Request/response và các quy tắc chính |
|---|---|
| Auth | Login email/password → token/user; đăng ký phải email-code → verify-email → verification_token; session opaque hash server, không có refresh JWT. Logout 204. |
| Profile | PATCH chỉ các trường hồ sơ được allowlist; response profile; target/BMI tính backend; transaction khi lưu BMI. |
| Trainer template | POST/PATCH title, description, category, duration_seconds, calories_est, level; PATCH thêm is_active; response template. DELETE xóa nếu chưa giao, archive khi có lịch sử. Snapshot không đổi theo template. |
| Trainer assignment | POST id(UUID), user_id, template_id, note; response assignment/replayed. Cùng id khác payload 409; client mới giữ id khi retry. Transaction khóa Trainer/link/template, kiểm tra consent. |
| Cancel/feedback | POST cancel {reason}; POST feedback {feedback}; chỉ Trainer sở hữu, cần active consent; status_history lưu actor/time/reason. Bài cancelled không done. |
| Trainer lists | q,page,page_size,status,sort tùy nhóm; response named array + page/page_size/total; sort allowlist. Students có link_id; progress có summary và assignment thật. |
| Invite/consent | Mã 8 ký tự, hạn 24 giờ theo quy tắc hiện có; revoke pending không dùng lại; accept kiểm tra role/is_active và unique active pair; end hủy bài chờ trong transaction. |
| Admin catalogs | Challenge: challenge_id,title,description,target_days,reward_coins,badge_icon,is_active. Reward: item_id,title,category,cost_coins,icon,is_available. UUID client dùng chống create trùng. Detail/search/pagination. |
| Admin account | PATCH role user/trainer, is_active, note. Không public elevate admin. Transaction revoke session/consent/assignments và audit old_role/new_role/reason. |
| Admin ledgers/log | page/page_size,q,status/product/user_id/from/to tùy danh mục; GET detail; không có endpoint Admin tự set paid. Logs lọc action/target_id/admin_id/from/to. |
| Revenue | from/to; cộng amount_vnd của payment_orders status paid theo paid_at, tách premium_month/year và coins_200/550. response currency,period,formula,premium,coins,other và excluded statuses. |
| Member logs/challenge/reward | UUID request khi tạo log/purchase; transaction cùng số dư/quest; purchase kiểm tra item is_available và số dư; không mua item đã ngừng bán. |
| Payment | order_id UUID, product server catalog, return_url allowlist; ký VNPay URL, callback signature/amount; credit đúng một lần transaction. Khi chưa cấu hình trả 503, không giả lập thành công. |

## Phạm vi kiểm thử

\`npm --prefix backend test\`: services + HTTP + MongoDB replica set, gồm owner isolation, role/session revoke, concurrent duplicate và rollback. \`npm --prefix backend run test:postman\`: collection có sẵn, database test riêng. \`npm run dev:integration\` rồi \`node backend/scripts/run-platform-postman.js\`: 68 request Trainer/Admin theo vòng đời, ghi log vào output/. Không chạy test thay đổi role/consent lên Atlas thật.
`;
fs.writeFileSync(path.resolve(__dirname, '../../API_INVENTORY.md'), doc);
fs.writeFileSync(path.resolve(__dirname, '../../output/fullstack-api-coverage.json'), JSON.stringify({ total: routes.length, postmanCovered: covered, routes }, null, 2));
console.log(`API inventory: ${routes.length} endpoints; ${covered} covered by saved Postman requests.`);
