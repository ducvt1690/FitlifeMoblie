# API xác minh email trước khi đăng ký

Áp dụng cho backend nhánh `fix_new`. Frontend tích hợp sau. API có thể gửi đến mọi email hợp lệ; Gmail là nhà cung cấp SMTP gửi thư, không phải giới hạn tên miền người nhận.

## Luồng bắt buộc

1. Nhập email → `POST /api/auth/register/email-code`.
2. Đọc mã 6 số trong hộp thư → `POST /api/auth/register/verify-email`.
3. Nhận `verification_token`, gửi cùng email, mật khẩu, xác nhận mật khẩu và onboarding đến `POST /api/auth/register`.
4. Chỉ bước 3 thành công mới tạo user, quest và phiên đăng nhập. Gửi/kiểm tra OTP không tạo tài khoản và không cấp token đăng nhập.

### 1. Gửi mã / gửi lại mã

```http
POST /api/auth/register/email-code
Content-Type: application/json

{"email":"your-address@gmail.com"}
```

HTTP 200:

```json
{"success":true,"expires_in":600,"resend_after":60,"message":"Đã gửi mã xác minh đến email."}
```

Email được trim và chuyển thành chữ thường. OTP có hạn 10 phút. Tối đa 1 lần gửi/email/60 giây, kể cả các request đồng thời; tối đa 5 request/IP/15 phút cho endpoint gửi mã. Gửi lại tạo mã mới, hủy mã và `verification_token` trước đó. Nếu SMTP lỗi, không giữ mã có thể xác minh. Response không chứa OTP.

### 2. Xác minh mã

```http
POST /api/auth/register/verify-email
Content-Type: application/json

{"email":"your-address@gmail.com","code":"012345"}
```

`code` phải là chuỗi để giữ số 0 đầu. HTTP 200:

```json
{"success":true,"verification_token":"<43-character-random-token>","expires_in":600}
```

Tối đa 5 lần kiểm tra cho mỗi mã; khi hết lượt phải chờ cooldown rồi yêu cầu mã mới. Tối đa 20 request/IP/15 phút cho endpoint kiểm tra. OTP dùng một lần. Token xác minh có hạn 10 phút tính từ lúc xác minh, chỉ dùng cho đúng email đó và không dùng làm Bearer token gọi API khác.

### 3. Tạo tài khoản

```http
POST /api/auth/register
Content-Type: application/json

{
  "email":"your-address@gmail.com",
  "verification_token":"<token-from-step-2>",
  "password":"<password-at-least-8-characters>",
  "confirm_password":"<same-password>",
  "full_name":"Nguyễn Văn An",
  "gender":"male",
  "age":23,
  "height":170,
  "weight":65,
  "activity_level":"moderate",
  "goal":"maintain",
  "timezone":"Asia/Ho_Chi_Minh"
}
```

HTTP 201 trả `success`, `message`, `token`, `token_type`, `expires_at`, `user` như hợp đồng đăng nhập. Hai mật khẩu phải khớp nguyên giá trị, không trim. Thông tin đăng ký sai trả 400 và không tiêu thụ token xác minh. Tiêu thụ token, tạo user/quest/session nằm trong cùng transaction: khi lỗi database rollback thì có thể dùng lại token còn hạn. Khi thành công token bị xóa; gửi đồng thời chỉ tạo một tài khoản. Nếu mất response 201, hãy đăng nhập bằng email/mật khẩu đã đăng ký.

### Trạng thái lỗi

| HTTP | Ý nghĩa |
|---|---|
| 400 | Body sai, trường lạ, confirm_password không khớp; OTP sai/hết hạn/đã dùng/hết lượt thử |
| 403 | Đăng ký thiếu token xác minh, token giả, hết hạn, đã dùng hoặc không thuộc email |
| 409 | Email đã có tài khoản |
| 429 | Cooldown hoặc giới hạn IP; xem header `Retry-After` |
| 503 | Chưa cấu hình SMTP, gửi email thất bại hoặc database mất kết nối |

Mọi lỗi có dạng `{"success":false,"message":"..."}`. Auth responses có `Cache-Control: no-store`. Giới hạn IP được lưu theo process như các API auth hiện có; cooldown và số lượt OTP nằm trong MongoDB nên áp dụng giữa các instance.

## Cấu hình Gmail SMTP

Điền trong `backend/.env` (không đưa vào Git/chat):

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-sender@gmail.com
SMTP_PASS=<Google-App-Password>
MAIL_FROM=your-sender@gmail.com
```

Bật xác minh hai bước trên tài khoản gửi và tạo **App Password**, không dùng mật khẩu Gmail thông thường. Port 587 dùng STARTTLS; port 465 dùng TLS ngay từ đầu. Một số tài khoản tổ chức/Advanced Protection không hỗ trợ App Password theo chính sách tài khoản. Xem [Google: App Password](https://support.google.com/accounts/answer/185833) và [Google: Gmail SMTP](https://support.google.com/a/answer/176600).

Backend vẫn cần `MONGODB_URI`, `MONGODB_DB_NAME=fitlife` và database đã khởi tạo. Khi API khởi động, collection runtime `registration_email_verifications` được tạo với validator và TTL index, không thay đổi user cũ. MongoDB cần hỗ trợ transaction (Atlas/replica set). Không có SMTP thì API gửi mã đăng ký trả 503 cả ở development; không có mã mặc định hoặc fallback xác minh qua console. Luồng quên mật khẩu vẫn có hợp đồng riêng tại [password.md](password.md).

Collection runtime chỉ lưu digest OTP có nonce riêng và digest token, không lưu OTP/token thô hoặc mật khẩu. Backend kiểm tra thời hạn trực tiếp, không đợi TTL cleanup. Không cần migration tài khoản cũ; tài khoản cũ vẫn đăng nhập được. Chức năng này chỉ xác minh email lúc đăng ký mới, không bổ sung quy trình xác minh khi đổi email hồ sơ.

## Postman

### Gmail thật

Import [registration.postman_collection.json](registration.postman_collection.json) và [environment mẫu](FitLife-Registration.local.postman_environment.json). Chọn environment, điền các giá trị **local** `registrationEmail`, `registrationPassword`, `registrationPasswordConfirmation`; giữ mật khẩu/token không chia sẻ. Gửi request 01, đọc OTP trong Gmail, điền `registrationCode`, rồi gửi 02 và 03. Script tự truyền `verificationToken` sang bước đăng ký và `sessionToken` sang `/me`/logout. Không bấm Run all vì phải chờ và nhập OTP giữa bước 01–02.

### Tự động trên dữ liệu tạm

```powershell
cd backend
npm test
npm run test:postman
# Hoặc Desktop:
node scripts/run-postman-regression.js --desktop
```

Với Desktop, import file runtime `backend/postman/local-email-otp.postman_collection.json`, chọn **No Environment**, chạy đủ 46 request, 1 iteration. Kỳ vọng 73 assertion đạt. File runtime có URL và khóa của hộp thư giả lập riêng trên loopback; chỉ tồn tại trong phiên test, không dùng cho Gmail/Atlas và được Git ignore. API production không có route lấy OTP. Chạy bằng `127.0.0.1` để tránh trỏ vào server khác đang nghe IPv6 `localhost`.

Các test tự động xác minh logic và hợp đồng API, không chứng minh Gmail đã giao thư. `test:postman:atlas` hiện dừng trước khi kết nối database; dùng collection Gmail thật phía trên để kiểm tra Atlas với email do bạn sở hữu.
