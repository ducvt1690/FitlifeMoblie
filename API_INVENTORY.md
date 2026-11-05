# API Inventory — 05/11/2026

Sinh lại bằng `node backend/scripts/build-api-inventory.js` từ Express router thực tế, không chỉ root API banner. Có 98 endpoint nghiệp vụ, 45 endpoint có request trong hai Postman collection đã chạy. “Có Postman” là coverage đường dẫn/method; không có nghĩa mọi tổ hợp negative/boundary/race đã được kiểm thử. Các test HTTP/database riêng trong `backend/test/` bổ sung kiểm chứng nghiệp vụ.

Health: `GET /health` ping database; `GET /` thông tin dịch vụ. Lỗi JSON chuẩn `{success:false,message}`; 400 validation, 401 session thiếu/hết hạn/revoke, 403 sai quyền/consent, 404 resource ngoài scope/không tồn tại, 409 conflict, 429 rate limit, 503 hạ tầng/config không khả dụng. VNPay IPN có contract riêng RspCode, HTTP 200 là yêu cầu callback.

| Method | Endpoint | Authentication / authorization | Có request Postman |
|---|---|---|---|
| POST | `/api/auth/register/email-code` | Public; rate limit; OTP/session theo thao tác | Có |
| POST | `/api/auth/register/verify-email` | Public; rate limit; OTP/session theo thao tác | Có |
| POST | `/api/auth/register` | Public; rate limit; OTP/session theo thao tác | Có |
| POST | `/api/auth/login` | Public; rate limit; OTP/session theo thao tác | Có |
| GET | `/api/auth/me` | Bearer; tài khoản hiện tại | Có |
| POST | `/api/auth/change-password` | Bearer; tài khoản hiện tại | Chưa |
| POST | `/api/auth/logout-all` | Bearer; tài khoản hiện tại | Chưa |
| POST | `/api/auth/logout` | Public; rate limit; OTP/session theo thao tác | Có |
| POST | `/api/auth/forgot-password` | Public; rate limit; OTP/session theo thao tác | Chưa |
| POST | `/api/auth/reset-password` | Public; rate limit; OTP/session theo thao tác | Chưa |
| GET | `/api/profile` | Bearer; tài khoản hiện tại | Có |
| PATCH | `/api/profile` | Bearer; tài khoản hiện tại | Có |
| GET | `/api/water-logs` | Bearer + user + ownership | Có |
| POST | `/api/water-logs` | Bearer + user + ownership | Có |
| DELETE | `/api/water-logs` | Bearer + user + ownership | Chưa |
| DELETE | `/api/water-logs/:logId` | Bearer + user + ownership | Chưa |
| GET | `/api/workout-logs` | Bearer + user + ownership | Có |
| POST | `/api/workout-logs` | Bearer + user + ownership | Có |
| DELETE | `/api/workout-logs/:workoutId` | Bearer + user + ownership | Chưa |
| GET | `/api/exercises` | Bearer; mọi role; catalog chung | Có |
| GET | `/api/exercises/:exerciseId` | Bearer; mọi role; catalog chung | Có |
| GET | `/api/meal-logs` | Bearer + user + ownership | Có |
| POST | `/api/meal-logs` | Bearer + user + ownership | Có |
| PATCH | `/api/meal-logs/:mealId` | Bearer + user + ownership | Có |
| DELETE | `/api/meal-logs/:mealId` | Bearer + user + ownership | Có |
| GET | `/api/quests` | Bearer + user + ownership | Có |
| POST | `/api/quests/checkin` | Bearer + user + ownership | Chưa |
| GET | `/api/sleep-logs` | Bearer + user + ownership | Chưa |
| PUT | `/api/sleep-logs` | Bearer + user + ownership | Chưa |
| GET | `/api/mood-logs` | Bearer + user + ownership | Chưa |
| PUT | `/api/mood-logs` | Bearer + user + ownership | Chưa |
| GET | `/api/bmi-records` | Bearer + user + ownership | Chưa |
| POST | `/api/bmi-records` | Bearer + user + ownership | Chưa |
| GET | `/api/challenges` | Bearer + user + ownership | Chưa |
| POST | `/api/challenges/:challengeId/join` | Bearer + user + ownership | Chưa |
| POST | `/api/challenges/:challengeId/leave` | Bearer + user + ownership | Chưa |
| POST | `/api/challenges/:challengeId/checkin` | Bearer + user + ownership | Chưa |
| GET | `/api/stats` | Bearer + user + ownership | Chưa |
| GET | `/api/stats/lifetime` | Bearer + user + ownership | Chưa |
| GET | `/api/chat/memory` | Bearer + user + ownership | Chưa |
| DELETE | `/api/chat/memory` | Bearer + user + ownership | Chưa |
| GET | `/api/chat/sessions` | Bearer + user + ownership | Chưa |
| GET | `/api/chat/sessions/:sessionId/messages` | Bearer + user + ownership | Chưa |
| DELETE | `/api/chat/sessions/:sessionId` | Bearer + user + ownership | Chưa |
| POST | `/api/chat/messages` | Bearer + user + ownership | Chưa |
| GET | `/api/nutrition/today` | Bearer + user + ownership | Chưa |
| POST | `/api/nutrition/parse` | Bearer + user + ownership | Chưa |
| POST | `/api/nutrition/parse-photo` | Bearer + user + ownership | Chưa |
| POST | `/api/nutrition/suggestions` | Bearer + user + ownership | Chưa |
| POST | `/api/nutrition/suggestions/:suggestionId/accept` | Bearer + user + ownership | Chưa |
| POST | `/api/nutrition/suggestions/:suggestionId/eat` | Bearer + user + ownership | Chưa |
| PUT | `/api/nutrition/allergies` | Bearer + user + ownership | Chưa |
| PUT | `/api/nutrition/day` | Bearer + user + ownership | Chưa |
| GET | `/api/workout-plans/options` | Bearer + user + ownership | Chưa |
| GET | `/api/workout-plans/today` | Bearer + user + ownership | Chưa |
| POST | `/api/workout-plans` | Bearer + user + ownership | Chưa |
| PUT | `/api/workout-plans/:planId/items` | Bearer + user + ownership | Chưa |
| POST | `/api/workout-plans/:planId/complete` | Bearer + user + ownership | Chưa |
| GET | `/api/admin/overview` | Bearer + admin | Có |
| GET | `/api/admin/accounts` | Bearer + admin | Chưa |
| PATCH | `/api/admin/accounts/:userId` | Bearer + admin | Có |
| GET | `/api/admin/challenges` | Bearer + admin | Có |
| POST | `/api/admin/challenges` | Bearer + admin | Có |
| PATCH | `/api/admin/challenges/:challengeId` | Bearer + admin | Có |
| GET | `/api/admin/payments` | Bearer + admin | Có |
| GET | `/api/admin/logs` | Bearer + admin | Có |
| GET | `/api/admin/revenue` | Bearer + admin | Có |
| GET | `/api/admin/challenges/:id` | Bearer + admin | Có |
| GET | `/api/admin/payments/:id` | Bearer + admin | Chưa |
| GET | `/api/admin/logs/:id` | Bearer + admin | Chưa |
| GET | `/api/payments/vnpay/ipn` | Public callback; kiểm tra chữ ký HMAC | Chưa |
| GET | `/api/payments/vnpay/return` | Public callback; kiểm tra chữ ký HMAC | Chưa |
| GET | `/api/payments/plans` | Bearer + user + ownership | Chưa |
| GET | `/api/payments/orders` | Bearer + user + ownership | Chưa |
| GET | `/api/payments/orders/:orderId` | Bearer + user + ownership | Chưa |
| POST | `/api/payments/orders` | Bearer + user + ownership | Chưa |
| POST | `/api/payments/orders/:orderId/simulate` | Bearer + user + ownership | Chưa |
| GET | `/api/steps-logs` | Bearer + user + ownership | Chưa |
| POST | `/api/steps-logs` | Bearer + user + ownership | Chưa |
| PUT | `/api/steps-logs/sensor` | Bearer + user + ownership | Chưa |
| POST | `/api/trainer/links/:id/end` | Bearer + trainer + ownership/consent | Có |
| GET | `/api/trainer/templates` | Bearer + trainer + ownership/consent | Có |
| POST | `/api/trainer/templates` | Bearer + trainer + ownership/consent | Có |
| PATCH | `/api/trainer/templates/:id` | Bearer + trainer + ownership/consent | Có |
| DELETE | `/api/trainer/templates/:id` | Bearer + trainer + ownership/consent | Có |
| GET | `/api/trainer/students` | Bearer + trainer + ownership/consent | Có |
| GET | `/api/trainer/students/:id/progress` | Bearer + trainer + ownership/consent | Có |
| GET | `/api/trainer/invites` | Bearer + trainer + ownership/consent | Có |
| POST | `/api/trainer/invites/:id/revoke` | Bearer + trainer + ownership/consent | Có |
| POST | `/api/trainer/invites` | Bearer + trainer + ownership/consent | Có |
| GET | `/api/trainer/assignments` | Bearer + trainer + ownership/consent | Có |
| POST | `/api/trainer/assignments` | Bearer + trainer + ownership/consent | Có |
| POST | `/api/trainer/assignments/:id/cancel` | Bearer + trainer + ownership/consent | Có |
| POST | `/api/trainer/assignments/:id/feedback` | Bearer + trainer + ownership/consent | Có |
| POST | `/api/trainer-links/:id/end` | Bearer + user + ownership | Chưa |
| GET | `/api/trainer-links` | Bearer + user + ownership | Có |
| POST | `/api/trainer-links/accept` | Bearer + user + ownership | Có |
| POST | `/api/trainer-links/assignments/:id/done` | Bearer + user + ownership | Có |

## DTO, validation và persistence

Nguồn chính xác: `backend/routes/`, `backend/services/`, `backend/database/mongodb/schema.js`. MongoDB validator strict kiểm tra cấu trúc cuối cùng; API allowlist cấm field lạ và scope owner từ session, không nhận quyền/xu từ frontend.

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

`npm --prefix backend test`: services + HTTP + MongoDB replica set, gồm owner isolation, role/session revoke, concurrent duplicate và rollback. `npm --prefix backend run test:postman`: collection có sẵn, database test riêng. `npm run dev:integration` rồi `node backend/scripts/run-platform-postman.js`: 68 request Trainer/Admin theo vòng đời, ghi log vào output/. Không chạy test thay đổi role/consent lên Atlas thật.
