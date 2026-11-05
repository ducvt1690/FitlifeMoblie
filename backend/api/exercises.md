# ExerciseDB V1 trong MongoDB

FitLife đồng bộ dữ liệu ExerciseDB V1 vào collection `fitlife.exercises`. FE và trainer đọc qua backend; FE không gọi ExerciseDB trực tiếp.

## Dữ liệu khi chạy demo

`output/playwright/run-demo.cjs` nạp 30 bài thật từ bản cache ExerciseDB tại `database/mongodb/data/demo-exercises.json`, có tên và hướng dẫn hiển thị tiếng Việt. Cache ghi nguồn và thời điểm tải; demo khởi động không phụ thuộc việc gọi mạng lại. Bộ bài phủ Push/Pull/Legs, Upper/Lower và Full body.

Helper `backend/scripts/prepare-demo-exercises.js` kiểm tra đủ nguồn/nhóm cơ rồi upsert trong transaction, giữ UUID để lịch cũ vẫn tham chiếu được. Chỉ ba bài QA cũ được đánh dấu ngừng dùng trong lịch mới, không xóa lịch hay tài khoản hiện có. Các test QA khác vẫn có thể dùng fixture riêng.

Tạo lịch tập dành cho mọi tài khoản user, kể cả gói miễn phí. Khi có cấu hình nhà cung cấp AI, các lần gọi AI dùng hạn mức chung với dinh dưỡng: 5 lượt/ngày cho miễn phí, 50 lượt/ngày cho Premium; hết hạn mức trả HTTP 402. Khi dùng cách chọn bài mặc định từ thư viện thì không tiêu thụ lượt AI. Thiếu dữ liệu bài tập phù hợp trả 503.

## Import dữ liệu

Từ thư mục `backend/database/mongodb`:

```powershell
npm ci
npm run db:exercises:import
```

Script gọi API miễn phí theo từng trang 25 record, dùng cursor `after`, nhưng chỉ giữ catalog 30 bài phổ biến đã chọn; các record còn lại không được lưu. Script upsert theo `source_exercise_id`, nên chạy lại không tạo bản ghi trùng.

MongoDB lưu metadata và `gif_url`; GIF không được tải thành binary vào MongoDB. Collection có validator strict/error và unique index trên `source + source_exercise_id`. Dữ liệu gốc ExerciseDB vẫn giữ ở các field không có hậu tố; nội dung hiển thị tiếng Việt nằm ở `name_vi`, `*_vi`, `instructions_vi`.

## Đọc danh sách — `GET /api/exercises`

Yêu cầu Bearer token của tài khoản đang hoạt động. Query tùy chọn:

- `limit`: 1–100, mặc định 25.
- `after`: `source_exercise_id` cuối trang trước.
- `q`: tìm theo tên, nhóm cơ hoặc dụng cụ.
- `body_part`, `equipment`, `target_muscle`: lọc chính xác.

```http
GET /api/exercises?body_part=chest&limit=20
Authorization: Bearer <token>
```

Response trả `{ success, data, meta }`. FE nên dùng `display_name`, `display_*` và `display_instructions`; các field không có `display_` là dữ liệu gốc để đồng bộ:

```json
{
  "display_name": "Hít đất",
  "display_body_parts": ["Ngực"],
  "display_equipments": ["Trọng lượng cơ thể"],
  "display_instructions": ["Đặt hai tay rộng hơn vai..."],
  "gif_url": "https://static.exercisedb.dev/media/01qpYSe.gif"
}
```

`meta.nextAfter` dùng cho trang tiếp theo:

```http
GET /api/exercises?after=01qpYSe&limit=20
Authorization: Bearer <token>
```

## Đọc một bài — `GET /api/exercises/:exerciseId`

`exerciseId` là UUID nội bộ MongoDB, không phải ID nguồn ExerciseDB.

Khi trainer tạo template, lưu `exercise_id` nội bộ cùng thứ tự, số hiệp, số lần và thời gian nghỉ. Template tham chiếu đến `exercises.gif_url`, không lưu lại toàn bộ GIF.
