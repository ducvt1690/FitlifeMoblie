# Hướng dẫn kiểm thử FitLife bằng Postman Desktop

## 1. Chạy backend nối MongoDB Atlas

Mở PowerShell tại thư mục dự án và chạy:

```powershell
cd "B:\DỰ ÁN HỌC\FitlifeMoblie\backend"
npm run dev
```

Chỉ chạy một backend trên cổng 5000. Nếu đang có backend do Codex mở thì dùng tiến trình đó; muốn tự chạy terminal mới, dừng backend cũ trước. Khi server khởi động thành công phải thấy cả hai dòng:

```text
FitLife API: http://localhost:5000
MongoDB connected: fitlife
```

Giữ terminal mở. Chế độ `node --watch` tự khởi động lại khi sửa code; trong lúc khởi động lại, request có thể chưa gửi được. Dữ liệu Atlas được lưu độc lập với tiến trình backend. Đăng nhập website Atlas không tự chạy server Node.js.

Nếu cổng 5000 liên tục mất kết nối khi test, dừng tiến trình dev (Ctrl+C), rồi chạy `npm start` trong cùng thư mục để test mà không tự restart. Sau khi kiểm thử xong có thể quay lại `npm run dev` theo yêu cầu giảng viên. Lượt Desktop đạt 62/62 được chạy với server ổn định và kết nối Atlas thật.

## 2. Kiểm tra kết nối trước

Trong Postman: New → HTTP Request, chọn GET, nhập `http://localhost:5000/health`, bấm Send.

Kết quả phải là HTTP 200:

```json
{ "status": "ok", "database": "connected" }
```

Nếu bước này chưa đạt, sửa kết nối/server trước khi chạy collection. Nếu đổi Wi-Fi/VPN, kiểm tra Atlas → Network Access → IP Access List có IP public hiện tại. Chỉ thêm IP hiện tại theo quyền được cấp; không cần mở truy cập toàn Internet.

Postman không cần CORS vì request không có Origin. Nếu test bằng Expo web, thêm origin web vào `CORS_ORIGINS` trong `backend/.env`, ví dụ `http://localhost:8081,http://127.0.0.1:8081`.

## 3. Chạy toàn bộ bộ test — cách khuyên dùng

1. Mở Postman Desktop, chọn đúng workspace FitLife.
2. Chọn Import. Nếu giao diện không có nút Import, nhấn Ctrl+O, chọn tab Import rồi chọn **files**.
3. Chọn file `B:\DỰ ÁN HỌC\FitlifeMoblie\backend\api\all-api.postman_collection.json`.
4. Xác nhận import. Collection có tên **FitLife — ALL API (Run all)** với 37 request.
5. Góc trên phải chọn **No Environment**. Collection mặc định dùng `http://localhost:5000` và tự truyền token giữa các request. Không cần chép token hoặc mật khẩu vào environment cũ.
6. Bấm tên collection → Run. Chọn **37 of 37**, Run method = **Local**, Iterations = **1**. Tắt **Keep variable values** để tránh giữ giá trị của lượt cũ.
7. Bấm Start run và đợi hoàn tất.
8. Kết quả mong đợi: **62 Passed, 0 Failed, 0 Errors**, 37 request.

Bộ test bao phủ 17 method/path nghiệp vụ đã triển khai, cùng GET `/` và `/health`: Auth, Profile, Water, Workout, Meal, Quests và Exercises. Các API sleep/mood/BMI/shop/challenge/trainer/AI chưa triển khai không nằm trong bộ này.

Một số request cố ý trả HTTP 400, 401 hoặc 409 để kiểm tra dữ liệu sai, token thiếu/thu hồi và email trùng. Đọc cột **Passed/Failed**, không dùng màu HTTP status để kết luận API hỏng.

Mỗi lượt tự tạo một tài khoản test mới, ghi nước/tập/bữa ăn, cập nhật hồ sơ, xóa bữa ăn rồi logout hai phiên. Chạy từ Desktop sẽ giữ tài khoản và log nước/tập để xem trên Atlas; không dùng tài khoản cá nhân. Không nhập dữ liệu sức khỏe mẫu vào tài khoản thật. Lượt sau tạo token mới nên việc dọn tài khoản của lượt trước không làm lượt mới bị 401.

Collection có các request phụ thuộc nhau. Không bấm Send riêng request 23 hoặc 31 khi chưa có ID/token của bước trước. Để test thủ công từng endpoint, dùng cách ở mục 4.

## 4. Gửi từng API thủ công

### 4.1. Tạo environment riêng cho tài khoản của bạn

Tại Environments → New, đặt tên **FitLife Manual**. Thêm `baseUrl` có giá trị `http://localhost:5000` và `token` để trống. Bấm Save rồi chọn environment này ở góc phải. Token chỉ lưu local và đánh dấu sensitive; không đưa token thật vào collection/environment export để chia sẻ.

### 4.2. Đăng ký một tài khoản (chỉ cần một lần)

Tạo HTTP request, chọn POST, URL `{{baseUrl}}/api/auth/register`. Authorization = **No Auth**; Body → raw → JSON:

```json
{
  "email": "ban.tu.chon@example.com",
  "password": "MatKhauBanTuDat123!",
  "full_name": "Nguyễn Văn An",
  "gender": "male",
  "date_of_birth": "2003-05-15",
  "height": 170,
  "weight": 65,
  "activity_level": "moderate",
  "goal": "maintain",
  "timezone": "Asia/Ho_Chi_Minh"
}
```

Đổi email/mật khẩu trong ví dụ thành tài khoản của bạn. Ngày sinh gửi ISO `YYYY-MM-DD`, không phải `DD/MM/YYYY`; tuổi do server tính. HTTP 201 nghĩa là tạo thành công. Nếu email đã tồn tại, dùng Login thay vì đăng ký lại.

### 4.3. Login và lấy token mới

POST `{{baseUrl}}/api/auth/login`, No Auth, Body raw JSON:

```json
{
  "email": "ban.tu.chon@example.com",
  "password": "MatKhauBanTuDat123!"
}
```

HTTP 200: copy giá trị `token` vào biến `token` của environment **FitLife Manual**. Chỉ copy chuỗi, không lấy dấu ngoặc kép và không thêm chữ `Bearer` vào giá trị biến.

Có thể tự động lưu token bằng tab Scripts → Post-response của request Login:

```javascript
pm.test('Login thành công', () => pm.response.to.have.status(200));
if (pm.response.code === 200) {
  pm.environment.set('token', pm.response.json().token);
}
```

### 4.4. Cấu hình Authorization cho API cần đăng nhập

Chọn Authorization → Type **Bearer Token**, nhập `{{token}}`. Postman tự tạo header `Authorization: Bearer ...`. Không đồng thời thêm một header Authorization khác trong tab Headers.

GET `{{baseUrl}}/api/auth/me` phải trả HTTP 200 với đúng tài khoản của bạn. `401` nghĩa token thiếu, hết hạn, đã logout hoặc user/phiên đã bị dọn; hãy Login lại.

### 4.5. Xem và sửa hồ sơ

GET `{{baseUrl}}/api/profile` để xem. PATCH cùng URL, Body raw JSON, chỉ gửi trường cần sửa:

```json
{
  "full_name": "Nguyễn Văn An",
  "email": "ban.tu.chon@example.com",
  "date_of_birth": "2003-05-15"
}
```

Đổi email thành công thì lần sau Login bằng email mới. Email trùng trả 409; ngày không tồn tại/tương lai hoặc tuổi ngoài 5–100 trả 400. Không gửi role, coins, targets hay user_id.

### 4.6. Nước và buổi tập

GET `{{baseUrl}}/api/water-logs` hoặc thêm query `?date=2026-10-30`. POST cùng URL:

```json
{ "log_id": "{{$guid}}", "amount": 250 }
```

GET `{{baseUrl}}/api/workout-logs` để xem. POST cùng URL:

```json
{
  "workout_id": "{{$guid}}",
  "title": "Hít đất",
  "category": "Toàn thân",
  "duration_seconds": 600,
  "calories_burned": 50
}
```

`{{$guid}}` sinh UUID mới mỗi lần Send: chỉ dùng để tạo một hoạt động mới. Muốn test retry, thay bằng một UUID cụ thể và giữ cùng payload cho cả hai lần gửi. Lần tạo trả 201; retry cùng ID/nội dung trả 200, reward_coins=0; ID đã dùng nhưng đổi nội dung trả 409.

### 4.7. CRUD bữa ăn

GET `{{baseUrl}}/api/meal-logs` để xem danh sách và tổng dinh dưỡng. POST cùng URL:

```json
{
  "meal_id": "{{$guid}}",
  "meal_name": "Phở bò",
  "calories": 450,
  "protein": 25,
  "carbs": 55,
  "fat": 14,
  "meal_type": "breakfast"
}
```

HTTP 201 trả `log.meal_id`. Copy ID này để sửa/xóa. Ví dụ PATCH `{{baseUrl}}/api/meal-logs/<meal_id vừa copy>`:

```json
{ "calories": 500 }
```

DELETE cùng URL, không cần body, trả 204 và không có JSON response. Không gọi res.json() với 204. Xóa bữa cuối cùng trong ngày thu hồi 10 xu và đặt lại q_meal; nếu không đủ số dư để thu hồi, trả 409 và giữ nguyên dữ liệu. Bữa ăn người khác hoặc ID không tồn tại trả 404.

`meal_type` là mã `breakfast/lunch/dinner/snack`; FE hiển thị tương ứng Sáng/Trưa/Tối/Ăn nhẹ. Các giá trị dinh dưỡng gửi JSON number, không phải chuỗi.

### 4.8. Nhiệm vụ và bài tập

GET `{{baseUrl}}/api/quests` xem 7 nhiệm vụ hôm nay. Hiện đã nối thưởng cho nước, tập luyện và bữa ăn, mỗi nhiệm vụ 10 xu/lần/ngày; streak và các quest còn lại chưa hoàn thiện.

GET `{{baseUrl}}/api/exercises?limit=30` đọc thư viện 30 bài. Dùng `display_name`, `display_instructions` và `gif_url` để hiển thị. Copy `exercise_id` UUID từ response để GET `{{baseUrl}}/api/exercises/<exercise_id>`; không dùng ID nguồn ngắn như `I4hDWkc` ở endpoint chi tiết.

Phân trang: GET `?limit=2`, copy `meta.nextAfter`, rồi GET `?limit=2&after=<nextAfter>`. Giữ đúng chữ hoa/thường của cursor. Lọc `q=push`, `body_part=chest`, `equipment=bodyweight`; các bộ lọc nguồn hiện sử dụng tên tiếng Anh của ExerciseDB.

### 4.9. Đăng xuất sau cùng

POST `{{baseUrl}}/api/auth/logout` với Bearer token, trả 204. Từ lúc đó token không gọi các API bảo vệ được nữa. Nếu tiếp tục thử, Login lấy token mới. Không dùng token logout từ Auth collection để test Meal/Workout.

## 5. Đọc lỗi và chạy lại

- **No response / Request could not be sent**: kiểm tra server đang chạy, URL đã hiện giá trị thật thay vì `{{baseUrl}}`, và GET `/health`. Giữ terminal mở; đừng tắt server ngay sau lượt test.
- **401**: Login lại; xóa dấu ngoặc kép/chữ Bearer thừa trong biến token; kiểm tra selected environment. Token của account test đã xóa không dùng lại được.
- **403**: chỉ role `user` active dùng được hồ sơ/nhật ký.
- **400**: xem response message; kiểm tra raw JSON, kiểu số, tên field và ngày hợp lệ.
- **404**: kiểm tra method/path và ID bản ghi thuộc đúng tài khoản.
- **409**: email/UUID đã dùng, hoặc không đủ xu để hoàn tác thưởng khi xóa bữa cuối. Đây là xung đột nghiệp vụ.
- **429**: đăng ký/login vượt 20 request/IP/15 phút. Đọc Retry-After (giây), chờ đúng thời gian. Trên server dev của bạn có thể Ctrl+C rồi npm run dev để reset bộ đếm; không tắt rate limit trên server thật. ALL API dùng ba request đăng ký/lượt, nên không bấm Run lặp liên tục.
- **500**: cần xem log backend. Lỗi validator ngày sinh cũ trên Atlas đã được sửa bằng migration riêng; không chạy lại init/seed toàn database.
- **503 / TLS lúc startup**: kiểm tra IP Access List, kết nối mạng/VPN và trạng thái cluster Atlas; website Atlas đăng nhập được chưa đủ để chứng minh driver Node đã kết nối.

## 6. Chạy lại bằng CLI khi cần lưu bằng chứng

Từ `backend`:

```powershell
npm run test:postman:atlas
```

Script chạy đúng collection 37 request trên Express thật kết nối Atlas, lưu log tại `backend/postman/all-api-atlas-run.txt`, rồi dọn đúng account/log test có marker riêng của lượt đó. Không đụng dữ liệu người khác.

```powershell
npm run test:postman
```

Lệnh thứ hai dùng MongoDB tạm và catalog fixture. Kết quả này kiểm tra API/transaction, không chứng minh Atlas hay GIF CDN hoạt động. Postman CLI có thể nhắc login để publish report lên cloud; local collection vẫn chạy được và lấy exit code/kết quả assertions làm bằng chứng.

## 7. Kết quả đã kiểm tra ngày 30/10/2026

- Postman Desktop → backend localhost → Atlas `fitlife`: 37 request, 62 Passed, 0 Failed, 0 Errors. Ảnh: `backend/postman/all-api-desktop-passed.png`.
- Postman CLI kết nối Atlas: 37 request, 62 assertions đạt; log: `backend/postman/all-api-atlas-run.txt`. Tài khoản của lượt CLI đã được dọn bằng marker riêng.
- Postman CLI với MongoDB tạm: cùng 37 request, 62 assertions đạt; không dùng dữ liệu Atlas.
- Backend integration tests: 73/73 đạt, gồm phân quyền, transaction, retry, ngày sinh, cập nhật từng trường bữa ăn và xóa đồng thời.
- Atlas audit schema/index/tham chiếu: đạt; đã bổ sung validator ngày sinh. Thư viện giữ đúng 30 bài. Nhật ký chưa có của tài khoản mới là trạng thái hợp lệ; không tạo dữ liệu sức khỏe/ngày sinh giả để lấp chỗ trống.
