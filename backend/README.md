# FitLife Backend — Node.js + Express + MongoDB Atlas

API xác thực dùng tài khoản trong collection `users` trên MongoDB Atlas. Đăng nhập tạo phiên có thời hạn; đăng xuất thu hồi đúng phiên đã gửi. Backend không dùng kho JSON cho các API dưới đây.

## Chạy local

Yêu cầu Node.js >=20.19.0 và quyền kết nối database Atlas đã khởi tạo:

```powershell
cd backend
npm ci
npm run build
npm test
npm start
```

Mặc định server chạy tại `http://localhost:5000`. `npm run dev` chạy ở chế độ theo dõi thay đổi. `npm run build` kiểm tra cú pháp các file JavaScript; không biên dịch hay tạo bundle.

Cấu hình được lấy theo thứ tự ưu tiên: biến môi trường của process → `backend/.env` → `backend/database/mongodb/.env`. Có thể dùng cấu hình database local hiện có hoặc sao chép `.env.example` thành `.env` rồi điền URI Atlas và tên database. Không commit hoặc chia sẻ `.env`.

- `MONGODB_URI`: URI Atlas của tài khoản database được cấp quyền.
- `MONGODB_DB_NAME`: cố định là `fitlife`.
- `PORT`: mặc định `5000`.
- `AUTH_SESSION_TTL_SECONDS`: mặc định `43200` (12 giờ), cho phép rút ngắn từ `60` đến `43200` giây.
- `CORS_ORIGINS`: danh sách origin HTTP/HTTPS cách nhau bằng dấu phẩy; mặc định cho Expo web là `http://localhost:8081,http://127.0.0.1:8081`. Native Expo/Postman không gửi Origin vẫn được xử lý bằng Bearer token.

Server chỉ bắt đầu lắng nghe sau khi kết nối database và chuẩn bị collection phiên thành công. Khi chạy lần đầu, tài khoản database cần quyền tạo collection/index `auth_sessions`. Không tự tạo tài khoản ứng dụng hoặc seed lại dữ liệu khi khởi động.

## API xác thực

### `POST /api/auth/register`

Đăng ký kèm onboarding. Body JSON dùng `snake_case`:

```json
{
  "email": "new.user@example.com",
  "password": "<your-password>",
  "full_name": "Nguyễn Văn An",
  "gender": "male",
  "age": 23,
  "height": 170,
  "weight": 65,
  "activity_level": "moderate",
  "goal": "maintain",
  "timezone": "Asia/Ho_Chi_Minh"
}
```

Các field trong ví dụ trừ `timezone` đều bắt buộc; có thể thay `age` bằng `date_of_birth` dạng `YYYY-MM-DD`. Nếu gửi cả hai thì tuổi phải khớp ngày sinh tại ngày hiện tại theo timezone tài khoản. Ngày sinh phải có thật, không trong tương lai và cho tuổi 5–100; ngày tham chiếu lấy từ đồng hồ server mỗi yêu cầu. Timezone mặc định `Asia/Ho_Chi_Minh`, phải là tên timezone được runtime IANA hỗ trợ. Email trim/lowercase, tối đa 100 ký tự; full_name trim, 1–100 ký tự. Password tối thiểu 8 ký tự Unicode, tối đa 1024 byte UTF-8; giữ nguyên khoảng trắng, không được chỉ có khoảng trắng. Age là số nguyên 5–100; height 80–250 cm; weight 25–300 kg; không nhận số dưới dạng chuỗi. Gender: male/female; activity_level: sedentary/light/moderate/active; goal: lose/maintain/gain.

Chỉ nhận các field nêu trên. Field lạ hoặc field hệ thống như `role`, `is_active`, `user_id`, `fit_coins`, `streak_days`, `password_hash`, `target_water`, `target_calories` trả `400`. Server tự gán UUID, role=user, is_active=true, coins/streak=0 và băm password bằng scrypt với salt ngẫu nhiên. Targets theo database v2: nước `round(min(weight*35,4000))` lúc đăng ký; calories theo Mifflin/TDEE/goal, làm tròn và áp sàn nữ 1200/nam 1500. Chưa có workout nên không cộng thêm nước.

HTTP `201` trả cùng cấu trúc với login (`success`, `message`, `token`, `token_type`, `expires_at`, `user`), thông báo `Đăng ký thành công.`. Token dùng ngay với `/me` và `/logout`; thông tin nhạy cảm không xuất hiện trong response. Một transaction tạo user, 7 quest v2 của ngày theo timezone (chưa hoàn thành, thưởng 10 xu/quest, chưa cộng xu) và phiên đăng nhập. Không tạo BMI log hoặc hoàn thành quest từ onboarding. Database phải hỗ trợ transaction (Atlas hoặc replica set local); không có fallback ghi từng bước.

Email đã có (kể cả đăng ký đồng thời/canonical hóa cùng email) trả `409`, không ghi đè tài khoản. Gửi lại sau lần đăng ký thành công trả `409`; nếu mất response, dùng login. Invalid body trả `400`; lỗi ghi trả `500`/`503` và transaction rollback. Register có giới hạn riêng 20 request/IP/15 phút, trả `429` cùng `Retry-After`, lưu trong bộ nhớ từng process.

Collection Postman cho register → me → duplicate → login → logout tại [api/registration.postman_collection.json](api/registration.postman_collection.json). Import bản **FitLife — Auth 12h (Run all)** và chạy đủ 10 request theo thứ tự. Không cần environment: mỗi lần chạy tự sinh email/mật khẩu thử trong biến local và tạo một tài khoản mới. Có thể đặt `baseUrl` hoặc `registrationPassword` trong environment nếu cần. Không lưu token/mật khẩu vào collection export. Xem [hướng dẫn và các HTTP status mong đợi](api/README.md).

### `POST /api/auth/login`

Body JSON gồm `email` và `password`. Email được trim và đổi sang chữ thường; mật khẩu được kiểm tra nguyên giá trị, không trim. API xác thực `password_hash` dạng scrypt hiện có trong database, không nhận mật khẩu plaintext hoặc thay thế cơ chế external auth.

Khi thành công, HTTP `200` trả:

```json
{
  "success": true,
  "message": "Đăng nhập thành công.",
  "token": "<opaque-session-token>",
  "token_type": "Bearer",
  "expires_at": "<ISO-8601 UTC>",
  "user": {
    "id": "<user_id>",
    "user_id": "<user_id>",
    "email": "<email>",
    "name": "<full_name>",
    "role": "user",
    "profile": {
      "height": 170,
      "weight": 65,
      "target_water": 2275,
      "target_calories": 2484,
      "coins": 0
    }
  }
}
```

`role` có thể là `user`, `trainer` hoặc `admin`; các giá trị profile lấy từ tài khoản thực. Tài khoản mẫu `demo@fitlife.example` dùng mật khẩu đã cấu hình bằng `FITLIFE_DEMO_PASSWORD` lúc seed, không có mật khẩu mặc định trong mã nguồn. Xem [hướng dẫn database](database/mongodb/README.md) để chuẩn bị dữ liệu mẫu.

### `GET /api/auth/me`

Gửi header `Authorization: Bearer <token>`. HTTP `200` trả `{ "success": true, "user": ... }` với cùng cấu trúc public user như login. Mỗi request kiểm tra phiên chưa hết hạn và tài khoản vẫn active; không trả password hash.

### `POST /api/auth/logout`

Gửi cùng bearer token. API xóa đúng phiên tương ứng và trả HTTP `204`, không có body. Token đó gọi `/me` sau logout sẽ nhận `401`; phiên trên thiết bị khác vẫn giữ nguyên. Gửi lại một token đúng định dạng đã logout vẫn trả `204` để hỗ trợ retry.

### Trạng thái lỗi

- `400`: email/password thiếu, sai kiểu, JSON hoặc nội dung nén không hợp lệ.
- `401`: sai thông tin đăng nhập, không có password hash được hỗ trợ, hoặc bearer token thiếu/sai/hết hạn/đã thu hồi.
- `403`: tài khoản đã bị khóa; kiểm tra login chỉ trả lỗi này sau khi mật khẩu đúng.
- `429`: vượt giới hạn 20 lần gọi login mỗi IP trong 15 phút; xem header `Retry-After`. Giới hạn lưu trong bộ nhớ từng process.
- `413`: body quá lớn; `415`: charset/encoding không được hỗ trợ; `503`: mất kết nối database; lỗi ngoài dự kiến trả `500`.

Các lỗi trả JSON `{ "success": false, "message": "..." }`. Login dùng cùng thông báo `401` cho tài khoản không tồn tại và mật khẩu sai.

## Phiên đăng nhập và phạm vi

Token là chuỗi ngẫu nhiên, không phải JWT và không cần `JWT_SECRET`. Collection `auth_sessions` lưu SHA-256 của token cùng `user_id`, `created_at`, `expires_at`; không lưu raw token. Có unique index cho token hash và TTL index dọn phiên hết hạn. API vẫn kiểm tra expiry trực tiếp vì TTL cleanup không chạy tức thời. Collection này phục vụ runtime, nằm ngoài 16 collection nghiệp vụ.

Đăng nhập/đăng ký cấp phiên có hạn cố định 12 giờ tính từ lúc tạo, trả mốc `expires_at` UTC cho client. Gọi `/me` hoặc API khác không kéo dài phiên. Tại đúng thời điểm hết hạn, backend trả `401` cho request cần xác thực; muốn tiếp tục phải đăng nhập để nhận token mới. Phiên cũ có `expires_at` dài hơn cũng bị từ chối sau 12 giờ từ `created_at`. TTL dọn bản ghi sau đó; backend không chờ việc dọn này mới khóa truy cập. Việc xóa token trên thiết bị và điều hướng màn hình là phía client.

`GET /` liệt kê API hiện có. `GET /health` kiểm tra kết nối MongoDB bằng ping. Register chỉ tạo role user. CORS chỉ cho phép các origin trong `CORS_ORIGINS`; request native/Postman không có Origin không bị chặn bởi CORS nhưng vẫn phải qua auth/ownership. Frontend hiện vẫn dùng auth local, chưa nối vào các endpoint mới.

## Cấu trúc backend theo service

Các service chạy chung trong một Express server và dùng một database `fitlife`. Route khai báo URL, method và HTTP response; service nhận dữ liệu/identity đã xác thực và thực hiện nghiệp vụ. Service không sử dụng `req`/`res`.

```text
backend/
├── routes/
│   ├── auth.routes.js       # register, login, me, logout
│   ├── profile.routes.js    # GET/PATCH /api/profile
│   ├── water.routes.js      # GET/POST /api/water-logs
│   ├── workout.routes.js    # GET/POST /api/workout-logs
│   └── quest.routes.js      # GET /api/quests
├── services/
│   ├── auth.service.js      # Tạo tài khoản, xác minh mật khẩu
│   ├── session.service.js   # Tạo, kiểm tra, thu hồi phiên 12 giờ
│   ├── profile.service.js   # Đọc/sửa hồ sơ, tính lại mục tiêu
│   ├── water.service.js     # Nhật ký nước, xử lý log_id gửi lại
│   ├── workout.service.js   # Nhật ký tập, thưởng nhiệm vụ và mục tiêu nước
│   └── quest.service.js     # Nhiệm vụ hôm nay và thưởng nước/tập một lần
├── middleware/
│   ├── require-auth.js      # Bearer token và quyền user
│   └── rate-limit.js        # Giới hạn số lần đăng nhập/đăng ký
├── auth/                   # Validator đăng ký/hồ sơ, password và token helpers
├── utils/                  # Công thức mục tiêu, HttpError, async handler
└── database/transaction.js # Transaction dùng chung
```

`AuthService` gọi `SessionService` để cấp phiên; khi đăng ký, user + quest + session cùng transaction. `WaterService` gọi `QuestService` trong cùng transaction ghi nước để thưởng 10 xu đúng một lần/ngày. `log_id` đã tồn tại với cùng user/amount trả lại log cũ; payload hoặc chủ tài khoản khác trả `409`. Ngày được xác định theo timezone của tài khoản.

API hồ sơ/nước/tập luyện/quest yêu cầu Bearer token và role `user`. `PATCH /api/profile` nhận `email`, `date_of_birth`, `full_name`, `gender`, `age`, `height`, `weight`, `activity_level`, `goal`; mục tiêu nước/calo do server tính. Email được chuẩn hóa và kiểm tra duy nhất, trùng trả `409`. Ngày sinh được validate theo ngày hiện tại và tự tính tuổi; tài khoản cũ chưa có ngày sinh nhận `null`. Đổi email thành công thì đăng nhập bằng email mới. Xem [hợp đồng hồ sơ](api/profile.md) và migration thêm ngày sinh trước khi chạy với Atlas cũ. `GET /api/water-logs` nhận `date=YYYY-MM-DD` tùy chọn; `POST` nhận `{ "log_id": "<UUID>", "amount": 250 }`. `GET /api/quests` trả bộ bảy nhiệm vụ hôm nay; hiện ghi nhận/thưởng nhiệm vụ nước và tập luyện.

### API nhật ký tập luyện

- `GET /api/workout-logs?date=YYYY-MM-DD`: xem nhật ký của người gọi theo ngày; mặc định hôm nay theo timezone tài khoản, trả tổng giây tập và kcal ước tính.
- `POST /api/workout-logs`: nhận `workout_id` UUID, `title`, `category`, `duration_seconds`, `calories_burned`. Server tự gắn người dùng và ngày. Tạo mới trả `201`; gửi lại cùng ID/nội dung trả `200` mà không tạo log hoặc thưởng lặp; ID xung đột trả `409`.

Ghi nhật ký, thưởng `q_workout` 10 xu tối đa một lần/ngày và cập nhật mục tiêu nước cùng transaction. Ngày có tập cộng 350 ml một lần, tối đa 4350 ml; đọc profile, nước hoặc `/me` phản ánh mục tiêu ngày hiện tại, kể cả khi sang ngày mới. Sửa hồ sơ giữ bonus nếu hôm nay đã tập. Calo là ước tính do người dùng/FE nhập, không phải số đo đã xác minh. Chưa có API sửa/xóa nhật ký tập.

Ví dụ request/response, giới hạn và hướng dẫn nối FE: [API nhật ký tập luyện](api/workouts.md). Dùng collection `workout_logs` và schema Atlas hiện có, không cần migrate database.

### Huấn luyện viên và quản trị

Mỗi khu chỉ nhận đúng role (`requireRole`), sai role trả `403`. Cả ba role dùng được trên website và app mobile.

- Trainer (`/api/trainer`): `GET overview`; `GET/POST links` (tạo mã mời 8 ký tự, tối đa 10 mã chưa dùng); `DELETE links/:linkId` (hủy mã hoặc kết thúc kết nối, đồng thời hủy bài đang giao); `GET/POST templates`, `PATCH templates/:id` (chỉ giáo án của mình, `is_active` để ngừng dùng); `GET assignments?status=`, `POST assignments` (`id` UUID, `user_id`, `template_id`, `note`), `POST assignments/:id/cancel`; `GET students/:userId?days=7`.
- Thành viên (`/api/coaching`): `GET` kết nối và bài được giao; `POST links` nhập `{ "code" }` để đồng ý; `DELETE links/:linkId`; `POST assignments/:id/complete|decline`.
- Quyền xem dữ liệu: trainer chỉ thấy học viên đã nhập mã mời. Nhật ký sức khỏe (`health`) chỉ trả về khi kết nối còn mở **và** có ít nhất một bài đang giao; ngược lại `health: null`. Không có API nào cho trainer/admin đọc chat AI.
- Admin (`/api/admin`): `GET overview`; `GET accounts?q=&role=&status=&page=`; `PATCH accounts/:userId` nhận `is_active`, `role` (`user`|`trainer`), `note` — không sửa được chính mình hay admin khác, đổi role sẽ kết thúc kết nối/bài giao liên quan và đăng xuất tài khoản đó; `GET/POST challenges`, `PATCH challenges/:id`; `GET/POST rewards`, `PATCH rewards/:id`; `GET transactions?page=`; `GET payments?status=pending|paid|failed&page=` (đơn VNPay kèm email người mua); `GET logs?page=`. `overview` có thêm `paid_orders`, `revenue_vnd`, `premium_members`. Mọi thao tác ghi vào `admin_logs`.

Admin đầu tiên không tạo qua API. Đăng ký tài khoản bình thường rồi chạy trong `backend/`:

```bash
npm run role -- <email> admin     # hoặc trainer / user
```

Script đọc `.env`, đổi role, xóa phiên cũ và ghi `admin_logs`. Sau đó admin cấp/thu hồi quyền huấn luyện viên trên web (Quản trị → Tài khoản).

### Bước chân

- `GET /api/steps-logs?date=YYYY-MM-DD`: trả `{ date, steps }` của ngày (mặc định hôm nay theo timezone tài khoản).
- `POST /api/steps-logs` nhận `{ "amount": 1..50000 }`, cộng dồn vào tổng của ngày, tối đa 200000 bước/ngày (vượt trả `409`).

### Thanh toán VNPay và Premium

Giá nằm ở server; client chỉ gửi mã sản phẩm. `premium_month` 49.000đ (30 ngày + 100 xu), `premium_year` 399.000đ (365 ngày + 1500 xu), `coins_200` 20.000đ, `coins_550` 50.000đ.

- `GET /api/payments/plans`: danh sách gói, trạng thái `membership { premium, premium_until }`, `configured`.
- `POST /api/payments/orders` nhận `{ order_id: UUID, product, return_url? }`, trả `201 { order, payment_url }`. Gửi lại cùng `order_id` khi đơn còn chờ trả lại đúng link cũ; đơn đã kết thúc trả `409`. Đơn hết hạn sau 15 phút. `return_url` chỉ nhận `fitlife://…`, `exp://…` (Expo Go) hoặc trang thuộc `WEB_APP_URL`.
- `GET /api/payments/orders?page=`, `GET /api/payments/orders/:orderId`: chỉ đơn của chính mình (đơn người khác trả `404`).
- `GET /api/payments/vnpay/ipn` (public, VNPay gọi server-to-server): kiểm chữ ký HMAC-SHA512 → `97`, không có đơn → `01`, sai số tiền → `04`, đã xử lý → `02`, thành công → `00`. Cộng xu/gia hạn Premium trong cùng transaction, chỉ một lần dù VNPay gọi lại.
- `GET /api/payments/vnpay/return` (public, trình duyệt quay về): xử lý giống IPN (để chạy local không cần IPN), hiện trang kết quả rồi chuyển về `return_url?order=…&status=paid|failed`.

Premium gia hạn nối tiếp từ ngày hết hạn hiện tại. Gói miễn phí được hỏi AI Coach 10 tin/24 giờ, tin thứ 11 trả `402`.

Biến môi trường: `VNP_TMN_CODE`, `VNP_HASH_SECRET` (thiếu thì API tạo đơn trả `503`), `VNP_PAY_URL` (mặc định sandbox), `PUBLIC_API_URL` (URL công khai của backend để dựng return URL), `WEB_APP_URL`, `TRUST_PROXY=1` khi chạy sau proxy (Vercel). Khai IPN URL `https://<backend>/api/payments/vnpay/ipn` trong trang quản trị sandbox VNPay. Thẻ test NCB: xem tài liệu sandbox của VNPay.

AI chat dùng `/api/chat`. Khi bổ sung chức năng, tạo route và service cùng tên; dùng middleware xác thực và truyền transaction giữa các service có bước ghi liên quan.

### API kế hoạch AI `/api/ai-plans`

Gemini tạo thực đơn ngày (`meal_day`), kế hoạch dinh dưỡng (`nutrition`) và lịch tập tuần (`workout_week`) từ hồ sơ đã lưu. Gói Free được tạo tổng cộng 3 kế hoạch trong 24 giờ gần nhất; Premium còn hạn được 20. Vượt hạn mức trả `402`. Gửi lại cùng `plan_id` và nội dung trả kế hoạch cũ, không gọi AI hay dùng thêm lượt.

- `POST /api/ai-plans`: nhận `{ plan_id: UUID, kind, preferences?, health_context? }`, tạo mới trả `201`; retry kế hoạch xong trả `200`; request trùng đang xử lý trả `202` kèm `Retry-After: 2`.
- `GET /api/ai-plans?kind=&page=` và `GET /api/ai-plans/:planId`: xem lịch sử/chi tiết của chính mình.
- `POST /api/ai-plans/:planId/meals/:index/log`: nhận `{ meal_id: UUID }`, ghi món vào nhật ký và thưởng nhiệm vụ theo meal service; chống ghi lặp cùng món.
- `POST /api/ai-plans/:planId/workouts/:day/start`: trả buổi tập kèm GIF/hướng dẫn từ exercises; khi tập xong vẫn ghi qua `/api/workout-logs`.

Tất cả yêu cầu Bearer token và role `user`. Kế hoạch của người khác trả `404`; trainer/admin trả `403`. Kết quả có `source` (`gemini`, `groq`, `fitlife-rules`) và dòng `Gợi ý tham khảo, không thay thế tư vấn y tế`. Trường hợp sức khỏe không được hỗ trợ trả lời khuyên gặp chuyên gia.

Lấy key tại [Google AI Studio](https://aistudio.google.com/api-keys), đặt `GEMINI_API_KEY` trong `backend/.env`; model mặc định `GEMINI_MODEL=gemini-3.5-flash-lite`. `GROQ_API_KEY` là dự phòng tùy chọn. Không có key hoặc AI lỗi vẫn dùng bộ luật. Key chỉ nằm ở backend, không gửi vào app/web hoặc commit Git. Chuẩn bị collection mới bằng `npm run db:init -- --only ai_plans` từ `backend/`, không cần seed lại dữ liệu.

Xem [hợp đồng API, sở thích, cấu hình và cách nối frontend](api/ai-plans.md), [collection Postman AI plans](api/ai-plans.postman_collection.json). Giao diện mobile/web được tích hợp trên các nhánh frontend.

## Kiểm thử

`npm test` chạy kiểm thử tích hợp với MongoDB replica set tạm, không đọc `.env` hoặc kết nối Atlas. Lần chạy đầu có thể tải MongoDB binary. Bộ test kiểm tra phiên, thu hồi token, expiry, account bị khóa và các lỗi xác thực; không chứng minh frontend đã tích hợp.

Có thể import collection đăng ký ở trên hoặc tạo request để kiểm tra API thật: register/login → me → logout → token bị thu hồi. Collection trong `api/` không có credentials; cấu hình environment riêng trên máy, không commit mật khẩu/token. Test tự động còn kiểm tra đăng ký đồng thời, rollback, timezone và field hệ thống.

Tài liệu liên quan: [sử dụng database/Compass](database/README.md), [schema và migration](database/mongodb/README.md), [role và quyền cần triển khai tiếp](database/mongodb/ROLE_CONTRACT.md).
