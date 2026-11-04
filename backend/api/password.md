# API mật khẩu: đổi, quên và đặt lại

Ba endpoint dưới đây dùng collection `users`, `auth_sessions` và `password_resets` trong database `fitlife`. Mật khẩu mới được băm bằng scrypt giống lúc đăng ký. Mọi lỗi có dạng `{ "success": false, "message": "..." }`.

Quy tắc mật khẩu mới (giống đăng ký): chuỗi tối thiểu **8 ký tự**, không được chỉ gồm khoảng trắng, tối đa 1024 byte. Body chỉ được chứa đúng các trường trong hợp đồng; gửi thêm trường khác (ví dụ `role`) trả `400`.

## Đổi mật khẩu — `POST /api/auth/change-password`

Dành cho người **đang đăng nhập** (mọi role).

```http
POST /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{ "current_password": "mat-khau-hien-tai", "new_password": "mat-khau-moi-123" }
```

HTTP `200`:

```json
{ "success": true, "message": "Đổi mật khẩu thành công. Các thiết bị khác đã bị đăng xuất." }
```

- Phiên (token) đang dùng **vẫn hợp lệ**; mọi phiên khác của tài khoản bị xóa ngay.
- `400`: thiếu trường, mật khẩu mới không đạt quy tắc, mật khẩu mới trùng mật khẩu cũ, hoặc **mật khẩu hiện tại sai**. Cố ý dùng `400` thay vì `401` để FE không hiểu nhầm là phiên hết hạn và tự đăng xuất.
- `401`: thiếu/sai token. `403`: tài khoản bị khóa.
- `409`: mật khẩu vừa được đổi bởi một yêu cầu khác cùng lúc; yêu cầu đăng nhập lại.
- `429`: quá 20 lần/15 phút/IP.

## Quên mật khẩu — 2 bước, không cần đăng nhập

### Bước 1: gửi mã — `POST /api/auth/forgot-password`

```json
{ "email": "ban@example.com" }
```

HTTP `200` **luôn cùng một câu**, dù email có đăng ký hay không (để không lộ danh sách người dùng):

```json
{ "success": true, "message": "Nếu email đã đăng ký, mã xác nhận gồm 6 chữ số đã được gửi. Mã có hiệu lực trong 10 phút." }
```

- Mã gồm **6 chữ số**, hiệu lực **10 phút**, gửi tới email tài khoản. Database chỉ lưu SHA-256 của mã.
- Mỗi tài khoản tối đa 1 email/phút: gửi lại trong vòng 1 phút vẫn trả `200` nhưng không gửi email mới.
- Mã mới thay thế mã cũ chưa dùng.
- `400`: email sai định dạng hoặc có trường lạ. `429`: quá 5 lần/15 phút/IP.
- `503`: server chưa cấu hình gửi email (production) hoặc gửi email thất bại.

### Bước 2: đặt lại — `POST /api/auth/reset-password`

```json
{ "email": "ban@example.com", "code": "482913", "new_password": "mat-khau-moi-123" }
```

HTTP `200`:

```json
{ "success": true, "message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới." }
```

- Thành công thì **mọi phiên của tài khoản bị đăng xuất**; FE chuyển về màn hình đăng nhập.
- Mã chỉ dùng được **một lần**. Nhập sai **5 lần** thì mã bị khóa, phải yêu cầu mã mới.
- `400`: `code` không phải 6 chữ số, mật khẩu mới không đạt quy tắc, hoặc `"Mã xác nhận không đúng hoặc đã hết hạn."` (dùng chung một câu cho mã sai, hết hạn, đã dùng, đã khóa, email không tồn tại).
- `429`: quá 20 lần/15 phút/IP.

## Đăng xuất mọi thiết bị — `POST /api/auth/logout-all`

Cần `Authorization: Bearer <token>`. Xóa **mọi phiên** của tài khoản, kể cả phiên đang dùng; trả `204` (không có body). FE xóa token đã lưu và chuyển về màn hình đăng nhập. Dùng cho nút "Đăng xuất khỏi tất cả thiết bị" hoặc khi nghi bị lộ tài khoản. Thiếu/sai token → `401`.

## Cấu hình gửi email (SMTP)

Đặt trong `backend/.env` (xem `.env.example`):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email_cua_ban@gmail.com
SMTP_PASS=app_password_16_ky_tu
MAIL_FROM=FitLife <email_cua_ban@gmail.com>
```

Với Gmail cần bật xác minh 2 bước và tạo **App Password**; không dùng mật khẩu Gmail thường.

| Môi trường | Có SMTP | Không có SMTP |
|---|---|---|
| Development | Gửi email thật | In mã ra terminal server: dòng `[DEV MAIL - chưa cấu hình SMTP]` |
| Production (`NODE_ENV=production`) | Gửi email thật | `forgot-password` trả `503` |

## Database

Collection `password_resets` (tạo bằng `npm run db:init` trong `backend/database/mongodb`): `reset_id`, `user_id`, `code_hash`, `attempts` (0–5), `expires_at`, `used_at`, `created_at`, `updated_at`. Index TTL trên `expires_at` để MongoDB tự xóa mã hết hạn.

## Gợi ý cho frontend

- Màn hình "Quên mật khẩu": nhập email → gọi bước 1 → chuyển sang màn hình nhập mã + mật khẩu mới → gọi bước 2 → về màn hình đăng nhập.
- Nút "Gửi lại mã" nên khóa 60 giây sau mỗi lần bấm.
- Sau đổi mật khẩu thành công, giữ nguyên token hiện tại; không cần đăng nhập lại.
