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
- `MONGODB_DB_NAME`: database cần kết nối, thường là `fitlife` hoặc `fitlife_demo`.
- `PORT`: mặc định `5000`.
- `AUTH_SESSION_TTL_SECONDS`: mặc định `604800` (7 ngày), cho phép từ `60` đến `2592000` giây.

Server chỉ bắt đầu lắng nghe sau khi kết nối database và chuẩn bị collection phiên thành công. Khi chạy lần đầu, tài khoản database cần quyền tạo collection/index `auth_sessions`. Không tự tạo tài khoản ứng dụng hoặc seed lại dữ liệu khi khởi động.

## API xác thực

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

`GET /` liệt kê API hiện có. `GET /health` kiểm tra kết nối MongoDB bằng ping. Public register và danh sách users không được cung cấp trong đợt này. Public register và danh sách users không được cung cấp trong đợt này. Frontend hiện vẫn dùng auth local, chưa nối vào các endpoint mới.

## Kiểm thử

`npm test` chạy kiểm thử tích hợp với MongoDB replica set tạm, không đọc `.env` hoặc kết nối Atlas. Lần chạy đầu có thể tải MongoDB binary. Bộ test kiểm tra phiên, thu hồi token, expiry, account bị khóa và các lỗi xác thực; không chứng minh frontend đã tích hợp.

Để chạy cùng API thật trên Atlas bằng Postman, import collection và environment mẫu theo [hướng dẫn Postman](postman/README.md). Collection có request và assertion cho login → me → logout → token bị thu hồi; điền thông tin đăng nhập chỉ ở environment local.

Tài liệu liên quan: [sử dụng database/Compass](database/README.md), [schema và migration](database/mongodb/README.md), [role và quyền cần triển khai tiếp](database/mongodb/ROLE_CONTRACT.md).
