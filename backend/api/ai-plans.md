# API tạo kế hoạch bằng AI

Backend đọc hồ sơ của người đăng nhập để tạo thực đơn ngày, kế hoạch dinh dưỡng hoặc lịch tập tuần. Gemini là nhà cung cấp chính; Groq là dự phòng tùy chọn. Khi không có key hoặc các nhà cung cấp lỗi, backend dùng `fitlife-rules`. Kết quả được lưu trong `ai_plans` để đọc lại.

## Cấu hình Gemini

1. Đăng nhập [Google AI Studio](https://aistudio.google.com/api-keys), tạo API key cho project của bạn.
2. Điền key vào **`backend/.env` trên máy chạy backend**, hoặc biến môi trường của dịch vụ triển khai. Nếu đã có `.env`, chỉ bổ sung các biến dưới đây, không ghi đè cấu hình database hiện có.
3. Khởi động lại backend sau khi đổi cấu hình.

```dotenv
GEMINI_API_KEY=<key-cua-ban>
GEMINI_MODEL=gemini-3.5-flash-lite
GROQ_API_KEY=
```

Không đặt key trong mobile/web, Postman, request của người dùng hoặc Git. `.env.example` chỉ chứa giá trị trống. `GROQ_API_KEY` có thể lấy tại [Groq Console](https://console.groq.com/keys); bỏ trống nếu chỉ dùng Gemini. Model Groq dự phòng là `openai/gpt-oss-120b`.

Mặc định chọn `gemini-3.5-flash-lite`, thuộc dòng Flash mới hơn theo [tài liệu model của Google](https://ai.google.dev/gemini-api/docs/deprecations). Có thể đổi `GEMINI_MODEL` theo model project của bạn được cấp; cần kiểm tra khả năng trả JSON theo schema của model đó.

Hạn mức của FitLife ở bên dưới tách biệt với quota của project Gemini/Groq. Quota của nhà cung cấp phụ thuộc project và model; khi hết quota, backend đi qua luồng dự phòng.

Từ thư mục `backend/`, dùng cấu hình MongoDB hiện có:

```powershell
npm ci
npm run db:init -- --only ai_plans
npm run build
npm test
npm start
```

Lệnh khởi tạo trên chỉ tạo/chuẩn bị collection `ai_plans` và index của nó; không seed lại user hay sửa collection khác. MongoDB cần hỗ trợ transaction (Atlas hoặc replica set local). Lịch tập cần có dữ liệu `exercises` đang hoạt động từ trước; xem [API bài tập](exercises.md) và [hướng dẫn database](../database/mongodb/README.md).

Chạy lệnh này trên môi trường của bạn sau khi điền cấu hình database. Bộ kiểm thử dùng database tạm; việc test thành công không đồng nghĩa collection đã được tạo trên Atlas.

## Xác thực và hạn mức

Mọi endpoint yêu cầu tài khoản đang hoạt động với role `user`:

```http
Authorization: Bearer <token-tu-login>
Content-Type: application/json
```

| Gói | Kế hoạch mới trong 24 giờ gần nhất | Khi vượt |
|---|---:|---|
| Free | 3 | HTTP `402`, thông báo nâng cấp Premium |
| Premium còn hạn | 20 | HTTP `402`, thông báo thử lại sau |

Lượt tính chung cho cả ba `kind`, theo cửa sổ 24 giờ liên tục, không reset lúc nửa đêm. Kế hoạch được giữ lượt trước khi gọi AI; kế hoạch đang tạo và kết quả từ bộ luật đều tính một lượt. Gửi lại đúng `plan_id` và nội dung yêu cầu không tính thêm lượt. Đọc lịch sử, thêm món vào nhật ký và bắt đầu buổi tập không dùng lượt tạo kế hoạch. Giới hạn này độc lập với giới hạn tin nhắn của `/api/chat`.

## Tạo kế hoạch

`POST /api/ai-plans`

```json
{
  "plan_id": "a1000000-0000-4000-8000-000000000001",
  "kind": "meal_day",
  "preferences": {
    "diet": "none",
    "allergies": ["tôm"],
    "dislikes": ["mướp đắng"],
    "meals_per_day": 4,
    "budget_vnd_per_day": 100000,
    "place": "home",
    "minutes_per_session": 30,
    "days_per_week": 3,
    "note": "Ưu tiên món Việt dễ nấu"
  },
  "health_context": {
    "pregnant": false,
    "has_medical_condition": false
  }
}
```

`plan_id` là UUID do client sinh một lần cho mỗi thao tác tạo mới. `kind` chỉ nhận `meal_day`, `nutrition`, `workout_week`. Các trường trong `preferences` đều tùy chọn; có thể bỏ cả object. Sai kiểu, sai giới hạn hoặc trường lạ trả `400`. Không gửi chỉ số, mục tiêu kcal, `user_id`, giá gói hay nguồn AI từ client; backend tự lấy các giá trị này.

| Trường sở thích | Giá trị hợp lệ | Mặc định |
|---|---|---|
| `diet` | `none`, `vegetarian`, `vegan` | `none` |
| `allergies`, `dislikes` | Mỗi mảng tối đa 10 chuỗi không rỗng, tối đa 40 ký tự/chuỗi | `[]` |
| `meals_per_day` | Số nguyên `3` hoặc `4` | `4` |
| `budget_vnd_per_day` | Số nguyên 30.000–500.000 | Không chỉ định |
| `place` | `home`, `gym` | `home` |
| `minutes_per_session` | Số nguyên 15–90 | `30` |
| `days_per_week` | Số nguyên 2–6 | `3` |
| `note` | Chuỗi tối đa 300 ký tự, có thể rỗng | `""` |

`health_context` là trường tùy chọn bổ sung vì hồ sơ hiện chưa lưu tình trạng mang thai/bệnh nền. Nó chỉ nhận hai boolean `pregnant` và `has_medical_condition`, mặc định `false`; được dùng để chặn kế hoạch và không gửi sang nhà cung cấp AI. Client nên hỏi người dùng trước khi tạo kế hoạch. Đây là thông tin tự khai, backend không xác minh hay suy đoán bệnh.

Response tạo mới là HTTP `201`:

```json
{
  "success": true,
  "replayed": false,
  "pending": false,
  "plan": {
    "plan_id": "a1000000-0000-4000-8000-000000000001",
    "user_id": "<nguoi-dang-nhap>",
    "kind": "meal_day",
    "preferences": {},
    "input": {},
    "result": {},
    "source": "gemini",
    "status": "ready",
    "disclaimer": "Gợi ý tham khảo, không thay thế tư vấn y tế",
    "created_at": "<ISO-8601 UTC>",
    "updated_at": "<ISO-8601 UTC>"
  }
}
```

Các object rỗng ở ví dụ trên được rút gọn để minh họa cấu trúc. Response thực có sở thích đã chuẩn hóa, ảnh chụp chỉ số tại lúc tạo và kết quả tương ứng `kind`. `source` là `gemini`, `groq` hoặc `fitlife-rules`.

Gửi lại cùng ID và nội dung đã chuẩn hóa trả HTTP `200`, `replayed: true` và kế hoạch đã lưu; không gọi AI lần hai, kể cả khi hồ sơ sau đó thay đổi. Cùng ID nhưng đổi kind/sở thích/thông tin sức khỏe trả `409`. ID thuộc người khác trả `404`.

Nếu request trước vẫn đang chạy, request lặp trả HTTP `202`, `pending: true`, `plan.status: "generating"` và header `Retry-After: 2`. Client đợi 2 giây rồi gọi GET chi tiết đến khi `status` là `ready`; chỉ dùng kết quả khi đã sẵn sàng. Không sinh ID mới để retry. Nếu process bị dừng giữa chừng, lần đọc sau khi hết thời hạn giữ xử lý sẽ trả kết quả bộ luật đã lưu.

### Kết quả theo loại

| `kind` | Trường trong `result` | Ràng buộc |
|---|---|---|
| `meal_day` | `total_calories`, `meals[]`, `tips[]` | Đúng 3/4 bữa; tổng bằng tổng kcal từng bữa và trong ±10% mục tiêu |
| `nutrition` | `calories`, `protein_g`, `carbs_g`, `fat_g`, `water_ml`, `tips[]`, `avoid[]` | Kcal bằng mục tiêu có sẵn; 5–8 lời khuyên; nước tối đa 4000 ml |
| `workout_week` | `days[]`, `tips[]` | Đủ 7 ngày; ngày tập không vượt `days_per_week`; chỉ dùng ID bài tập được gửi cho AI |

Mỗi món có `meal_type`, `name`, `portion`, `calories`, `protein`, `carbs`, `fat`, `why`. `meal_type` là `breakfast`, `lunch`, `dinner`, `snack`; mỗi món 1–2000 kcal. Dinh dưỡng và chi phí là ước tính.

Mỗi ngày tập có `day` (1–7), `rest`, `focus`, `minutes`, `exercises[]`, `calories_est`. Mỗi bài gồm `exercise_id`, `sets`, `reps`, `seconds`, `rest_seconds`. Bài đếm lần có `reps` và `seconds: null`; bài tính giờ có `seconds` và `reps: null`. Ngày nghỉ có 0 phút, 0 kcal và mảng bài rỗng. Kcal tiêu hao là ước tính.

## Đọc kế hoạch đã lưu

```http
GET /api/ai-plans?kind=meal_day&page=1
GET /api/ai-plans/:planId
```

Danh sách hỗ trợ `kind` tùy chọn và `page` bắt đầu từ 1. Trả `{ success, plans, page, page_size: 20, total }`, mới nhất trước. Chi tiết trả `{ success, plan }`. Cả hai chỉ trả dữ liệu của người gọi và không tạo lại bằng AI.

## Thêm món vào nhật ký

`POST /api/ai-plans/:planId/meals/:index/log`

```json
{ "meal_id": "a2000000-0000-4000-8000-000000000001" }
```

`index` là vị trí **bắt đầu từ 0** trong `result.meals`, không phải loại bữa. Server lấy tên/kcal/macros từ kế hoạch đã lưu, ghi `meal_logs` qua meal service và thưởng `q_meal` theo quy tắc hiện có. Ngày ghi là ngày hiện tại theo timezone tài khoản.

Tạo mới trả `201 { success, log, replayed: false, reward_coins, fit_coins }`. Bấm lại cùng món trả `200`, không tạo bản ghi thứ hai hay thưởng lại; kể cả client gửi một `meal_id` mới cho cùng vị trí món, server vẫn dùng ID đã liên kết lần đầu. Không gửi kcal hay tên món từ client. Món không tồn tại hoặc kế hoạch sai loại trả `404`; kế hoạch đang tạo trả `409`.

## Bắt đầu buổi tập

`POST /api/ai-plans/:planId/workouts/:day/start`, body `{}` hoặc không gửi body.

`day` bắt đầu từ **1**, đến 7. Response HTTP `200` gồm `{ success, plan_id, day, disclaimer }`. Mỗi phần tử `day.exercises` giữ sets/reps/seconds/rest và thêm object `exercise` lấy từ danh mục hiện tại, có `gif_url`, `display_name`, `display_instructions` và các trường Việt hóa để màn Workout hiển thị.

Ngày nghỉ hoặc kế hoạch đang tạo trả `409`. Ngày/kế hoạch không tồn tại hoặc bài đã ngừng hoạt động trả `404`. API bắt đầu không ghi `workout_logs` hay thưởng nhiệm vụ. Sau khi người dùng tập xong, client gửi kết quả thực tế đến [POST /api/workout-logs](workouts.md) hiện có.

## Kiểm tra kết quả và dự phòng

Backend gửi system prompt cố định và user prompt dạng JSON. Note/dị ứng/không thích nằm trong dữ liệu JSON, không được nối vào system prompt. Dữ liệu hồ sơ gửi ra chỉ gồm chỉ số ẩn danh, mục tiêu, sở thích; không gửi tên, email, `user_id`, ảnh hay lịch sử chat. Người dùng cần tránh nhập thông tin nhận dạng trong phần ghi chú.

Backend kiểm tra schema và quy tắc nghiệp vụ trước khi lưu kết quả AI: kcal, tổng kcal ngày, macros không âm, chuỗi tối đa 200 ký tự, tên món chứa chất dị ứng/không thích, ID bài tập trong allowlist, giới hạn hiệp/lần/giây và số ngày tập. Tối đa 40 bài đang hoạt động được gửi cho AI; ở nhà chỉ chọn bài có equipment `bodyweight` hoặc `body weight` và không cần thiết bị khác.

Mỗi nhà cung cấp được thử tối đa hai lần. Thứ tự là Gemini → Groq nếu có key → bộ luật. Mỗi lần gọi tối đa 25 giây, tổng thời gian dành cho AI tối đa 50 giây, đầu ra tối đa 2000 token/lần. Không có key thì dùng bộ luật ngay. Đọc `plan.source` để biết kết quả thực tế; không suy nguồn từ việc đã cấu hình key.

HTTP `422` trả lời khuyên gặp chuyên gia cho người dưới 16 tuổi, BMI <17 chọn giảm cân, thông tin tự khai mang thai/bệnh nền hoặc mục tiêu vượt giới hạn hỗ trợ. Thiếu bài tập phù hợp hoặc không có món dự phòng đáp ứng dị ứng/ngân sách cũng trả `422`, không gọi AI và không tạo lượt. Mọi kế hoạch hiển thị dòng `Gợi ý tham khảo, không thay thế tư vấn y tế`.

## Nối mobile/web và thử bằng Postman

Mobile/web gọi API FitLife bằng Bearer token. Mỗi màn có nút tạo tương ứng kind, form sở thích, trạng thái đang tạo và danh sách kế hoạch đã lưu. Hiện thông báo `402` cùng nút Premium; trạng thái membership lấy từ `/api/payments/plans`. Tránh gọi POST khi chỉ mở màn hình. Nhánh backend cung cấp hợp đồng API này; giao diện nằm ở các nhánh frontend.

Import [collection AI plans](ai-plans.postman_collection.json), đặt `baseUrl` và `token` trong environment local, lấy token từ login hiện có. Collection không chứa API key hay token thật. Chạy các request tạo chỉ khi cần vì ba lần tạo khác ID dùng hết hạn mức Free; các request đọc/retry không tốn thêm lượt. Lịch tập cần danh mục exercises phù hợp.

`npm test` trong `backend/` chạy MongoDB replica set tạm và generator giả, không gửi request đến Gemini/Groq hoặc đọc key thật. Kiểm thử tích hợp không xác nhận project Gemini của bạn đã có quota; kiểm tra `source` của một kế hoạch tạo thực để xác nhận đường gọi nhà cung cấp.
