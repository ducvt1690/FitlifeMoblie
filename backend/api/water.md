# API nhật ký uống nước

Lưu các lần uống nước vào `water_logs`. Mọi endpoint yêu cầu tài khoản role `user` đang hoạt động và header `Authorization: Bearer <token>`. Server lấy `user_id` và timezone từ tài khoản; FE không gửi hai trường này.

## Xem — `GET /api/water-logs`

Query `date` (`YYYY-MM-DD`) tùy chọn; mặc định là hôm nay theo timezone tài khoản.

HTTP `200`:

```json
{
  "success": true,
  "date": "2026-11-04",
  "logs": [
    { "log_id": "…uuid…", "user_id": "…", "amount": 250, "log_date": "2026-11-04", "log_time": "08:15",
      "created_at": "2026-11-04T01:15:00.000Z", "updated_at": "2026-11-04T01:15:00.000Z" }
  ],
  "total": 250,
  "target": 2275
}
```

`400` khi ngày sai định dạng hoặc không có thật (ví dụ `2026-02-30`).

## Thêm — `POST /api/water-logs`

```json
{ "log_id": "UUID do FE tạo", "amount": 250 }
```

- `amount`: số nguyên 1–5000 (ml).
- HTTP `201`: `{ "success": true, "log": {...}, "replayed": false, "reward_coins": 10, "fit_coins": 10 }`.
- Lần ghi đầu tiên trong ngày hoàn thành nhiệm vụ `q_water` và cộng `10` xu.
- Gửi lại **cùng `log_id` và cùng `amount`** (retry) trả `200` với `replayed: true`, không tạo bản ghi mới, không cộng xu.
- `409`: `log_id` đã dùng cho yêu cầu khác (khác `amount` hoặc của người khác).

## Xóa — `DELETE /api/water-logs/:logId`

```http
DELETE /api/water-logs/5f0c…-uuid
Authorization: Bearer <token>
```

HTTP `200`:

```json
{ "success": true, "deleted": true, "log_id": "5f0c…-uuid", "refund_coins": 10, "fit_coins": 0 }
```

- Chỉ xóa được log của chính mình; log của người khác hoặc không tồn tại trả `404`. `logId` không phải UUID trả `400`.
- Nếu còn log khác trong **cùng ngày**: giữ thưởng, `refund_coins: 0`.
- Nếu đây là **log cuối cùng** của ngày: nhiệm vụ `q_water` của ngày đó trở về chưa hoàn thành và trừ lại `10` xu (`refund_coins: 10`).
- `409`: người dùng đã tiêu số xu đó, không đủ `10` xu để trừ lại. Khi đó **log không bị xóa** (toàn bộ thao tác rollback).
- Xóa log không làm giảm chuỗi ngày (`streak_days`) đã tính, giống bữa ăn.

FE nên cập nhật số xu từ `fit_coins` trong response thay vì tự tính.
