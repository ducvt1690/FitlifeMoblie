# API nhật ký tập luyện

API này lưu buổi tập đã thực hiện của người dùng vào `workout_logs` trong database `fitlife`. Nhật ký, thưởng nhiệm vụ tập luyện và cập nhật mục tiêu nước được xử lý trong cùng transaction. API sử dụng schema MongoDB hiện có, không cần thêm collection.

## Chạy và xác thực

Từ thư mục `backend`, chạy:

```powershell
npm run dev
```

Base URL mặc định: `http://localhost:5000`.

Cả hai endpoint đều yêu cầu tài khoản có role `user`, đang hoạt động và header:

```http
Authorization: Bearer <token>
```

Token lấy từ API đăng ký hoặc đăng nhập của FitLife, là token phiên dạng chuỗi ngẫu nhiên, không phải JWT. Server lấy `user_id` và timezone từ tài khoản đã xác thực; FE không gửi hai trường này trong body.

## Xem nhật ký — `GET /api/workout-logs`

Query `date` là tùy chọn, định dạng `YYYY-MM-DD`, phải là ngày có thật. Nếu không gửi, server dùng ngày hiện tại theo timezone của tài khoản.

```http
GET /api/workout-logs?date=2026-10-29
Authorization: Bearer <token>
```

HTTP `200`:

```json
{
  "success": true,
  "date": "2026-10-29",
  "logs": [
    {
      "workout_id": "60000000-0000-4000-8000-000000000001",
      "user_id": "30000000-0000-4000-8000-000000000001",
      "title": "Hít đất",
      "category": "fullbody",
      "duration_seconds": 600,
      "calories_burned": 50,
      "workout_date": "2026-10-29",
      "created_at": "2026-10-29T08:00:00.000Z",
      "updated_at": "2026-10-29T08:00:00.000Z"
    }
  ],
  "total_duration_seconds": 600,
  "total_calories_burned": 50
}
```

Chỉ trả nhật ký của chính người gọi trong ngày đã chọn. Danh sách sắp xếp theo `created_at` giảm dần, rồi `workout_id` tăng dần khi trùng thời điểm. Ngày chưa có nhật ký trả `logs: []` và hai tổng bằng `0`. Response không chứa `_id` của MongoDB.

Ngày không đúng định dạng, ngày không tồn tại như `2026-02-30`, hoặc `date` là mảng/object trả `400`.

## Lưu buổi tập — `POST /api/workout-logs`

Body JSON gồm đúng năm trường bắt buộc:

- `workout_id`: UUID chữ thường do FE tạo một lần cho mỗi buổi tập. Giữ nguyên ID này khi gửi lại yêu cầu sau lỗi mạng.
- `title`: tên bài/buổi tập, chuỗi từ 1 đến 150 ký tự Unicode sau khi bỏ khoảng trắng ở đầu/cuối.
- `category`: tên nhóm bài tập, chuỗi từ 1 đến 50 ký tự Unicode sau khi bỏ khoảng trắng ở đầu/cuối.
- `duration_seconds`: thời lượng tính bằng giây, số nguyên từ `1` đến `2147483647`.
- `calories_burned`: lượng kcal ước tính, số nguyên từ `0` đến `2147483647`.

Số phải được gửi dưới dạng JSON number, không phải chuỗi. `category` chưa bị giới hạn vào một danh mục cố định.

```http
POST /api/workout-logs
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "workout_id": "60000000-0000-4000-8000-000000000001",
  "title": "Hít đất",
  "category": "fullbody",
  "duration_seconds": 600,
  "calories_burned": 50
}
```

Không gửi `user_id`, `workout_date`, timestamp, xu, trạng thái nhiệm vụ hoặc trường khác. Server từ chối trường ngoài hợp đồng bằng `400`. Nhật ký mới luôn thuộc ngày tại thời điểm server ghi nhận theo timezone của tài khoản; API này chưa hỗ trợ nhập bù ngày trước.

Ví dụ HTTP `201` khi đây là lần ghi nhận tập luyện đầu tiên trong ngày, người dùng đang có 0 xu và nặng 65 kg:

```json
{
  "success": true,
  "log": {
    "workout_id": "60000000-0000-4000-8000-000000000001",
    "user_id": "30000000-0000-4000-8000-000000000001",
    "title": "Hít đất",
    "category": "fullbody",
    "duration_seconds": 600,
    "calories_burned": 50,
    "workout_date": "2026-10-29",
    "created_at": "2026-10-29T08:00:00.000Z",
    "updated_at": "2026-10-29T08:00:00.000Z"
  },
  "replayed": false,
  "reward_coins": 10,
  "fit_coins": 10,
  "target_water": 2625
}
```

`calories_burned` là số ước tính do người dùng/FE nhập cho nhật ký thủ công, không phải kết quả đo được server xác minh và không tự lấy từ ExerciseDB.

## Gửi lại yêu cầu và thưởng nhiệm vụ

- ID mới và dữ liệu hợp lệ: trả `201`, tạo một nhật ký.
- Cùng `workout_id`, cùng người dùng và cùng dữ liệu sau chuẩn hóa tên/nhóm: trả `200`, `replayed: true`, `reward_coins: 0`, trả lại nhật ký cũ. Không tạo bản ghi mới hoặc cộng xu lần nữa.
- Cùng `workout_id` nhưng khác dữ liệu hoặc khác chủ tài khoản: trả `409` với thông báo chung, không trả nhật ký của người khác.
- ID đã dùng từ ngày trước vẫn là bản ghi cũ. Gửi lại ID đó không tạo buổi tập hoặc hoàn thành nhiệm vụ cho ngày mới.

Lần ghi nhận mới đầu tiên trong ngày hoàn thành `q_workout` và cộng `10` xu. Các buổi tập mới tiếp theo cùng ngày vẫn được lưu nhưng không thưởng thêm nhiệm vụ này. Thưởng nhiệm vụ uống nước và tập luyện độc lập; hoàn thành cả hai có thể nhận tổng cộng `20` xu. `fit_coins` trong response là số dư sau thao tác, không phải số xu được cộng riêng lần này.

Ghi nhật ký, hoàn thành nhiệm vụ, cộng xu và cập nhật mục tiêu nước cùng transaction. Nếu một bước ghi thất bại, transaction rollback; không để lại nhật ký hoặc thưởng dở dang. Gửi đồng thời cũng chỉ thưởng `q_workout` một lần/ngày.

## Mục tiêu nước trong ngày tập

Mục tiêu cơ bản là `round(min(weight × 35, 4000))` ml. Có ít nhất một nhật ký tập luyện hôm nay thì cộng thêm `350` ml, chỉ cộng một lần trong ngày; tối đa `4350` ml.

- `target_water` trong response POST là mục tiêu của ngày hiện tại.
- Đọc hồ sơ, phiên hiện tại (`GET /api/auth/me`) và nhật ký nước phản ánh mục tiêu theo ngày hiện tại.
- Sửa cân nặng/hồ sơ sau khi tập vẫn giữ phần cộng `350` ml của ngày đó.
- Sang ngày mới, chưa có buổi tập mới thì mục tiêu trở lại mức cơ bản. Gửi lại ID của buổi tập ngày cũ không kích hoạt phần cộng nước cho hôm nay.

## Lỗi

Các lỗi có dạng:

```json
{
  "success": false,
  "message": "Thông báo lỗi"
}
```

- `400`: body/query sai, thiếu trường, sai kiểu, số vượt giới hạn hoặc gửi trường ngoài hợp đồng.
- `401`: thiếu token, token không hợp lệ, hết hạn hoặc đã đăng xuất.
- `403`: tài khoản bị khóa hoặc role không phải `user`.
- `409`: `workout_id` đã được dùng cho yêu cầu khác.
- `500`/`503`: lỗi xử lý hoặc kết nối database; thao tác ghi không thành công phải rollback.

## Nối với frontend hiện tại

Frontend đang dùng tên `durationSec` và `calories` trong kho dữ liệu local. Khi nối API, map sang `duration_seconds` và `calories_burned`, bổ sung `category` và UUID `workout_id`. Không gửi nguyên object local nếu nó chứa `id`, `time`, `date` hoặc field khác.

Tạo UUID khi hoàn thành buổi tập và giữ cùng payload cho các lần retry. Chỉ tạo UUID mới cho một buổi tập mới, không tạo lại ID mỗi lần bấm gửi lại. Khi thành công, cập nhật số dư/mục tiêu từ response hoặc tải lại hồ sơ và nhiệm vụ; FE không tự cộng xu.

Đợt API này chỉ có xem và thêm nhật ký. Chưa có sửa/xóa nhật ký, tạo template trainer, lưu GIF hay đồng bộ danh mục ExerciseDB.

## Chạy collection Postman

1. Chạy backend bằng `npm run dev`, rồi import [workouts.postman_collection.json](workouts.postman_collection.json).
2. Đăng nhập bằng một tài khoản FitLife role `user` đang hoạt động. Trong Postman, tạo/chọn environment cục bộ, đặt biến `token` bằng token vừa nhận; chỉ lưu ở giá trị local/current và đánh dấu nhạy cảm. Không đưa token thật vào file collection hoặc environment xuất để chia sẻ.
3. Nếu BE chạy khác `http://localhost:5000`, đặt `baseUrl` trong environment. Chọn environment đó trước khi chạy collection **FitLife — Workout logs (Run all)**.
4. Chọn đủ bốn request và chạy theo thứ tự: tạo buổi tập → gửi lại cùng ID → xem nhật ký hôm nay → xem nhiệm vụ hôm nay.

Collection có **16 assertion** khi chạy đủ luồng. `workoutId` được tạo trong biến local của lần chạy, không lưu vào environment hay collection. Hai POST dùng cùng payload và cùng ID để kiểm tra gửi lại không tạo bản ghi/thưởng lặp. Collection không tự tạo tài khoản, không đăng xuất và không chứa token thật.

Mỗi lần Run all **tạo một nhật ký tập luyện thật** cho tài khoản đang dùng, có thể cộng `10` xu nếu nhiệm vụ tập luyện hôm nay chưa xong và cộng `350` ml mục tiêu nước nếu đây là buổi tập đầu tiên hôm nay. Bản ghi không tự xóa sau khi chạy. Nếu chỉ cần đọc dữ liệu, gửi riêng một trong hai request GET; assertion phụ thuộc ID của lần chạy sẽ được bỏ qua khi chưa có `workoutId`.
