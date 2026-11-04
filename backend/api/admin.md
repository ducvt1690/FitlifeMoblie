# API quản trị (admin)

Mọi endpoint cần `Authorization: Bearer <token>` của tài khoản **role `admin` đang hoạt động**; user nhận `403`. Danh sách có phân trang dùng `?page=` (mặc định 1, 20 dòng/trang) và trả `{ page, page_size, total }`. Bộ lọc ngày `from`/`to` có dạng `YYYY-MM-DD`, tính theo **giờ Việt Nam**, gồm cả hai đầu. Tham số sai định dạng trả `400`.

Mọi thao tác ghi đều lưu vào `admin_logs`. Các thao tác nhạy cảm (khóa/mở khóa, cấp quyền admin, cấp/thu hồi Premium, cộng/trừ xu, xóa dữ liệu AI, hoàn tiền, đổi hạn mức AI) **bắt buộc** gửi `note` (lý do, 1–500 ký tự), thiếu thì `400`.

Admin không thay đổi được chính mình hay admin khác (`409`). Muốn hạ quyền một admin: dùng `scripts/set-role.js` trên máy chủ.

## Tổng quan và thống kê

- `GET /api/admin/overview` → số tài khoản theo vai trò, bị khóa, người dùng mới 7 ngày, đổi thưởng 7 ngày, tổng lượt đổi thưởng (`purchases_total`), thử thách/vật phẩm đang mở, đơn VNPay đã trả, doanh thu, số Premium, 8 thao tác quản trị gần nhất.
- `GET /api/admin/analytics?range=7d|30d|90d` (mặc định `30d`) → mỗi ngày một dòng (ngày không có dữ liệu vẫn có dòng số 0):

```json
{
  "success": true, "range": "7d", "timezone": "Asia/Ho_Chi_Minh", "from": "2026-10-30", "to": "2026-11-05",
  "days": [{ "date": "2026-11-05", "revenue_premium_vnd": 49000, "revenue_coins_vnd": 20000, "signups": 3,
             "dau": 12, "workouts": 8, "meals": 20, "ai_messages": 15 }],
  "totals": { "revenue_premium_vnd": 448000, "revenue_coins_vnd": 70000, "signups": 21, "workouts": 50, "meals": 130, "ai_messages": 90 },
  "conversion": { "new_premium_members": 4, "free_members_at_start": 180, "rate": 0.0222 }
}
```

  - Doanh thu tính theo ngày `paid_at` của đơn `paid` (đơn đã hoàn tiền không tính). `revenue_premium_vnd`: gói Premium; `revenue_coins_vnd`: gói xu.
  - `dau`: số người trong ngày có ghi nước, buổi tập, bữa ăn, bước chân hoặc hỏi AI Coach.
  - `conversion`: số người **lần đầu** mua Premium trong khoảng ÷ số thành viên chưa từng mua Premium lúc đầu khoảng.
- `GET /api/admin/stats?days=7|30|90` → tên cũ, trả cùng dữ liệu như `analytics`.

## Tài khoản

- `GET /api/admin/accounts?q=&role=user|admin&status=active|locked&plan=premium|free` → tìm theo email/tên; mỗi dòng có `premium`, `premium_until`.
- `GET /api/admin/accounts/:userId` → chi tiết một tài khoản (`404` nếu không có):
  - `account`: email, tên, role, trạng thái, timezone, streak, ngày tạo.
  - `profile`: giới tính, tuổi, ngày sinh, chiều cao, cân nặng, BMI, mục tiêu, mức vận động, mục tiêu calo/nước, dị ứng.
  - `membership`: `plan` (`free`/`premium`), `premium_until`, 20 đơn thanh toán gần nhất.
  - `activity_30d`: số buổi tập và số phút, số bữa ăn, ml nước, bước chân, số câu hỏi AI, nhiệm vụ hoàn thành, thử thách đang tham gia, huy hiệu, kỷ lục.
  - `ai`: `chat` (đã dùng trong 24 giờ), `meal_ai`, `workout_plan` (đã dùng hôm nay), mỗi loại có `limit`, `remaining`.
  - `wallet`: `fit_coins` và 20 dòng sổ xu gần nhất.
  - `sessions`: số phiên còn hạn, lần đăng nhập gần nhất.
  - Không bao giờ trả mật khẩu, token hay **nội dung** tin nhắn AI.
- `PATCH /api/admin/accounts/:userId` body `{ is_active?, role?: "admin", note }`:
  - `is_active: false/true` → khóa/mở khóa (`lock_account` / `unlock_account`). Khóa sẽ đăng xuất mọi thiết bị.
  - `role: "admin"` → cấp quyền admin (`grant_admin`), đăng xuất mọi thiết bị của người đó. Chỉ nhận giá trị `"admin"`.
- `POST /api/admin/accounts/:userId/logout-all` body tùy chọn `{ note }` → buộc đăng xuất mọi thiết bị, trả `{ revoked_sessions }`. Tài khoản vẫn đăng nhập lại được. `POST .../logout` là tên cũ, vẫn dùng được.
- `POST /api/admin/accounts/:userId/premium` body `{ days: 1–3650, note }` → cấp Premium. Đang có Premium thì cộng tiếp từ ngày hết hạn hiện tại. Trả `{ premium_until }`. Hạn mức AI đổi theo ngay.
- `DELETE /api/admin/accounts/:userId/premium` body `{ note }` → thu hồi Premium ngay (`premium_until = now`). Không có Premium đang hiệu lực: `409`.
- `POST /api/admin/accounts/:userId/coins` body `{ amount: số nguyên khác 0 (−1 000 000..1 000 000), note }` → cộng (dương) hoặc trừ (âm) xu. Trừ quá số dư: `409`, không đổi gì. Trả `{ fit_coins }`. Ghi sổ xu nguồn `admin`.
- `DELETE /api/admin/accounts/:userId/chat` body `{ note }` → xóa toàn bộ hội thoại AI Coach và trí nhớ AI của người dùng (theo yêu cầu của họ). Lượt AI đã dùng trong ngày vẫn giữ.

## Thử thách

- `GET /api/admin/challenges` → mọi thử thách kèm `joined` (đang tham gia) và `completed`.
- `GET /api/admin/challenges/:challengeId?status=active|completed` → thông tin thử thách, `summary { active, completed }`, danh sách người tham gia (phân trang).
- `POST /api/admin/challenges` body `{ challenge_id: UUID, title, description, target_days 1–365, reward_coins, badge_icon, is_active }` → `201`; gửi lại cùng ID trả `replayed`.
- `PATCH /api/admin/challenges/:challengeId` → sửa một phần, kèm `note` tùy chọn.
  - Khi còn người đang chơi, đổi `target_days` hoặc `reward_coins` trả `409`. Tên, mô tả, biểu tượng vẫn sửa được.
  - `is_active: false` chỉ ngừng nhận người mới; người đang chơi vẫn check-in tiếp.

## Vật phẩm đổi thưởng

- `GET /api/admin/rewards` → mọi vật phẩm kèm `sold` (số lượt đổi) và tổng `coins`.
- `POST /api/admin/rewards` body `{ item_id: UUID, title, category: badge|theme|voucher, cost_coins, icon, is_available }`.
- `PATCH /api/admin/rewards/:itemId` → sửa một phần, kèm `note` tùy chọn.

## Sổ xu (giao dịch xu)

- `GET /api/admin/transactions?user_id=&source=&from=&to=` → mọi lần `fit_coins` thay đổi, mới nhất trước: `amount` (+/−), `balance_after`, `source`, `ref_id`, `note`, email, tên. Với `source=purchase` có thêm `item_id`, `item_title`.
- `source`: `quest`, `quest_refund` (xóa log làm mất nhiệm vụ), `challenge`, `purchase`, `payment`, `payment_refund`, `admin`.
- Sổ xu bắt đầu từ bản cập nhật này; số dư có từ trước không có dòng mở đầu.

## Thanh toán VNPay

- `GET /api/admin/payments?status=pending|paid|failed|expired|refunded&user_id=&product=&from=&to=` → đơn VNPay (lọc ngày theo `created_at`).
  - `expired`: đơn còn `pending` nhưng đã quá 15 phút thanh toán (trường `status` trong kết quả cũng hiển thị `expired`). `pending`: đơn còn trong hạn.
  - `product`: `premium_month`, `premium_year`, `coins_200`, `coins_550`.
- `GET /api/admin/payments/:orderId` → toàn bộ đơn, gồm `txn_ref` (vnp_TxnRef) và `vnp_response` (các trường VNPay gửi về, không có chữ ký), thông tin người dùng và gói.
- `GET /api/admin/payments/export?from=&to=&status=&product=` → tải file CSV (UTF-8 có BOM, mở được bằng Excel) để đối soát với cổng VNPay. `from`, `to` bắt buộc, tối đa 366 ngày. Cột: `order_id, vnp_TxnRef, email, product, amount_vnd, status, response_code, vnp_transaction_no, bank_code, created_at, paid_at, refunded_at`.
- `POST /api/admin/payments/:orderId/refund` body `{ note }` → đánh dấu đơn `paid` là `refunded` (tiền hoàn thủ công trên cổng VNPay). Đơn không ở trạng thái `paid`: `409`. Hệ thống thu hồi những gì đơn đã cho:
  - Premium: trừ số ngày của gói, nhưng không lùi về trước thời điểm hiện tại.
  - Xu: trừ số xu của gói, tối đa bằng số dư hiện có (không âm).
  - Trả `{ revoked_premium_days, revoked_coins, coins_not_recovered }`. Ghi log `refund_payment`.

## Cài đặt hạn mức AI

- `GET /api/admin/settings/ai-limits` → `{ limits: { free, premium }, defaults }`. Mỗi gói có `chat` (câu hỏi AI Coach / 24 giờ), `workout_plan`, `meal_ai` (lượt / ngày).
- `PUT /api/admin/settings/ai-limits` body `{ free?: { chat?, workout_plan?, meal_ai? }, premium?: {...}, note }` → mỗi giá trị là số nguyên 0–100 000; chỉ gửi phần muốn đổi. Áp dụng ngay cho mọi người dùng. Ghi log `update_ai_limits`.
- Mặc định: Free `chat 10, workout_plan 5, meal_ai 5`; Premium `chat 200, workout_plan 50, meal_ai 50`. Lịch tập AI vẫn chỉ dành cho Premium.

## Thư viện bài tập

- `GET /api/admin/exercises?q=&body_part=&status=active|hidden` → tìm theo tên (Anh/Việt), lọc nhóm cơ, trạng thái.
- `POST /api/admin/exercises` body `{ exercise_id: UUID, name_vi, body_parts[], target_muscles[], equipments[], gif_url (https), instructions_vi[], name?, description_vi?, body_parts_vi?, target_muscles_vi?, equipments_vi?, tips_vi?, rest_seconds? (0–600), note? }` → `201`; gửi lại cùng ID trả `200` với `replayed: true`. Bài tập tạo mới có `source: "admin"` và hiện ngay trong `GET /api/exercises`.
- `PATCH /api/admin/exercises/:exerciseId` → sửa một phần các trường trên và `is_active` (ẩn/hiện). Bài bị ẩn không còn trong danh sách của người dùng. Log: `create_exercise`, `update_exercise`, `hide_exercise`, `show_exercise`.

## Nhật ký quản trị

- `GET /api/admin/logs?action=&target_type=user|challenge|reward_item|payment|exercise|setting&target_id=&admin_id=&from=&to=` → chỉ đọc. Ví dụ mọi thao tác trên một tài khoản: `?target_type=user&target_id=<user_id>`.

## Chưa có ở backend

- Ảnh đại diện (avatar): backend chưa lưu ảnh người dùng.

Kiểm thử: `node --test test/admin.test.js test/roles.test.js`. Sau khi cập nhật cần chạy `npm run db:init` trong `database/mongodb` để tạo `coin_transactions`, `app_settings` và cập nhật validator.
