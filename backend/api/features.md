# API giấc ngủ, tâm trạng, BMI, điểm danh, thử thách, đổi thưởng, thống kê và AI Coach

Tất cả endpoint cần `Authorization: Bearer <token>` của tài khoản role `user`. Ngày nghiệp vụ tính theo `users.timezone`. Mọi thao tác cộng/trừ xu chạy trong transaction; client không bao giờ gửi số xu hay trạng thái nhiệm vụ.

## Nhiệm vụ, điểm danh và chuỗi ngày

- `GET /api/quests` → `{ date, fit_coins, streak_days, streak_min_quests: 5, quests[7] }`.
- `POST /api/quests/checkin` → hoàn thành `q_checkin`, `+10` xu một lần/ngày; gọi lại trả `reward_coins: 0`.
- Khi hoàn thành nhiệm vụ thứ 5/7 trong ngày, `streak_days` tăng 1 (một lần/ngày). Bỏ một ngày thì bắt đầu lại từ 1. `streak_days` trả về là 0 nếu ngày tăng gần nhất không phải hôm nay hoặc hôm qua.

## Giấc ngủ và tâm trạng (một bản ghi/ngày)

- `GET /api/sleep-logs?date=YYYY-MM-DD` → `{ date, log | null }`.
- `PUT /api/sleep-logs` body `{ hours: 0–24, quality: "Sâu" | "Bình thường" | "Chập chờn" }`.
- `GET /api/mood-logs?date=...`, `PUT /api/mood-logs` body `{ mood_label: 1–50 ký tự, note?: 0–2000 ký tự }`.

Lưu lại trong cùng ngày sẽ cập nhật bản ghi cũ và giữ nguyên `sleep_id`/`mood_id`. Lần lưu đầu tiên trong ngày hoàn thành `q_sleep`/`q_mood` (`+10` xu).

## BMI

- `GET /api/bmi-records?limit=30` → `{ current: { weight, height, bmi_value, bmi_status }, records[] }` (mới nhất trước).
- `POST /api/bmi-records` → lưu BMI hôm nay từ hồ sơ hiện tại; body bị bỏ qua.
- `PATCH /api/profile` có đổi `weight`/`height` cũng tự lưu BMI hôm nay. Một bản ghi/ngày, giữ `record_id`.

## Thử thách

- `GET /api/challenges` → thử thách đang mở, kèm `joined`, `current_progress`, `checked_in_today`, `completed_count` của bạn.
- `POST /api/challenges/:challengeId/join` → `201`; đang tham gia rồi → `409`.
- `POST /api/challenges/:challengeId/checkin` → `current_progress + 1`, tối đa 1 lần/ngày (`409` nếu lặp). Đủ `target_days` thì hoàn thành và cộng `reward_coins` một lần; có thể tham gia lượt mới sau đó.

## Đổi thưởng

- `GET /api/rewards` → `{ fit_coins, items[] (có owned), purchases[] }`.
- `POST /api/rewards/:itemId/purchase` body `{ purchase_id: UUID }`. Gửi lại cùng `purchase_id` trả `200 replayed` và không trừ xu lần nữa. Badge/theme chỉ mua một lần (`409`); voucher mua lặp được; thiếu xu → `409`.

## Thống kê

- `GET /api/stats?days=7` (1–31) → mỗi ngày: `water_ml, calories, protein, carbs, fat, meal_count, workout_seconds, calories_burned, workout_count, sleep_hours, sleep_quality, mood_label, quests_done`, kèm `target_water`, `target_calories`, `streak_days`.

## AI Coach

- `POST /api/chat/messages` body `{ session_id: UUID, message_id: UUID, content: 1–4000 ký tự }` → `201 { message, reply, reward_coins }`. Session tự tạo ở tin nhắn đầu tiên. Tin nhắn đầu tiên trong ngày hoàn thành `q_chat`.
- `GET /api/chat/sessions`, `GET /api/chat/sessions/:sessionId/messages` — chỉ chủ session đọc được (`404` với người khác).
- Có `ANTHROPIC_API_KEY` trong `backend/.env` thì trả lời bằng Claude (`AI_MODEL`, mặc định `claude-sonnet-5`). Không có key hoặc gọi lỗi thì dùng coach theo quy tắc dựa trên số liệu hôm nay (`ai_engine: "fitlife-rules"`).

Kiểm thử: `node --test test/features.test.js`.
