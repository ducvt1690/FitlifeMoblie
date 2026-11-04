# API quản trị (admin)

Mọi endpoint cần `Authorization: Bearer <token>` của tài khoản **role `admin` đang hoạt động**; user nhận `403`. Danh sách có phân trang dùng `?page=` (mặc định 1, 20 dòng/trang) và trả `{ page, page_size, total }`. Mọi thao tác ghi đều được lưu vào `admin_logs`.

Nguyên tắc riêng tư: admin quản lý tài khoản, danh mục và vận hành. API admin **không** trả chỉ số cơ thể, nội dung nhật ký sức khỏe hay nội dung chat AI của người dùng; chỉ trả số lượng tổng hợp.

## Tổng quan và thống kê

- `GET /api/admin/overview` → số tài khoản theo vai trò, bị khóa, người dùng mới 7 ngày, đổi thưởng 7 ngày, thử thách/vật phẩm đang mở, đơn VNPay đã trả, doanh thu, số Premium, 8 thao tác quản trị gần nhất.
- `GET /api/admin/stats?days=30` (1–90) → chuỗi theo ngày (giờ Việt Nam) để vẽ biểu đồ:

```json
{
  "success": true, "timezone": "Asia/Ho_Chi_Minh", "from": "2026-10-07", "to": "2026-11-05",
  "days": [{ "date": "2026-11-05", "new_users": 3, "active_members": 12, "purchases": 4, "coins_spent": 150, "paid_orders": 1, "revenue_vnd": 49000 }],
  "totals": { "new_users": 40, "purchases": 55, "coins_spent": 2100, "paid_orders": 6, "revenue_vnd": 494000 }
}
```

`active_members`: số người có ghi ít nhất một nhật ký nước/tập/bữa ăn/ngủ/tâm trạng trong ngày đó. Ngày không có dữ liệu vẫn có dòng với số 0.

## Tài khoản

- `GET /api/admin/accounts?q=&role=user|admin&status=active|locked` → tìm theo email/tên, lọc, phân trang.
- `GET /api/admin/accounts/:userId` → chi tiết hỗ trợ một tài khoản:
  - `account`: email, tên, role, trạng thái, timezone, xu, streak hiện tại, ngày tạo.
  - `activity_30d`: **số lượng** log nước/tập/bữa ăn/ngủ/tâm trạng, số câu hỏi AI, số nhiệm vụ hoàn thành trong 30 ngày.
  - `sessions`: số phiên còn hạn, lần đăng nhập gần nhất. `purchases`, `payments`, `membership` (Premium).
  - `404` nếu không có tài khoản.
- `PATCH /api/admin/accounts/:userId` body `{ is_active, note? }` → khóa/mở khóa tài khoản. Không sửa được admin hay chính mình (`409`).
- `POST /api/admin/accounts/:userId/logout` body tùy chọn `{ note }` → **buộc đăng xuất mọi thiết bị** (ví dụ người dùng báo mất điện thoại). Trả `{ revoked_sessions }`. Tài khoản vẫn đăng nhập lại được bình thường; muốn chặn thì dùng khóa tài khoản. Không áp dụng cho admin hoặc chính mình (`409`).

## Thử thách

- `GET /api/admin/challenges` → mọi thử thách kèm `joined` (đang tham gia) và `completed`.
- `GET /api/admin/challenges/:challengeId?status=active|completed` → thông tin thử thách, `summary { active, completed }` và danh sách người tham gia (email, tên, tiến độ, ngày tham gia, lần check-in gần nhất), phân trang.
- `POST /api/admin/challenges` body `{ challenge_id: UUID, title, description, target_days 1–365, reward_coins, badge_icon, is_active }` → `201`; gửi lại cùng ID trả `replayed`.
- `PATCH /api/admin/challenges/:challengeId` → sửa một phần, kèm `note` tùy chọn.

## Vật phẩm đổi thưởng

- `GET /api/admin/rewards` → mọi vật phẩm kèm `sold` và tổng `coins`.
- `POST /api/admin/rewards` body `{ item_id: UUID, title, category: badge|theme|voucher, cost_coins, icon, is_available }`.
- `PATCH /api/admin/rewards/:itemId` → sửa một phần, kèm `note` tùy chọn.

## Giao dịch, thanh toán và nhật ký quản trị

- `GET /api/admin/transactions?user_id=&item_id=` → lịch sử đổi thưởng (email, tên, vật phẩm, số xu), lọc theo người dùng hoặc vật phẩm.
- `GET /api/admin/payments?status=pending|paid|failed&user_id=` → đơn VNPay.
- `GET /api/admin/logs?action=&target_type=user|challenge|reward_item&target_id=&admin_id=` → nhật ký thao tác quản trị. Ví dụ xem mọi thao tác trên một tài khoản: `?target_type=user&target_id=<user_id>`.

Tham số lọc sai định dạng trả `400`. Kiểm thử: `node --test test/admin.test.js test/roles.test.js`.
