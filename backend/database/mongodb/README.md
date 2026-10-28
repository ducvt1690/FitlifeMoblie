# FitLife MongoDB

FitLife dùng **một database duy nhất: `fitlife`**. Schema giữ 16 collection nghiệp vụ v2; API tạo thêm collection kỹ thuật `auth_sessions` để quản lý phiên đăng nhập. `auth_sessions` không thuộc dữ liệu sức khỏe của người dùng.

Database Atlas hiện có 119 document nghiệp vụ. Bản cập nhật 29/10/2026 đã bỏ các collection thử nghiệm, collection backup trên Atlas và các field mở rộng v3 chưa có API sử dụng. Các document còn lại được giữ nguyên. Bản sao BSON có kiểm tra hash được lưu trong `.tools/simplification-backups` ở máy đã chạy thao tác.

## 16 collection

- **Tài khoản:** `users`.
- **Sức khỏe:** `water_logs`, `workout_logs`, `meal_logs`, `sleep_logs`, `mood_logs`, `bmi_history`.
- **Gamification:** `daily_quest_logs`, `challenges`, `user_challenges`, `reward_items`, `purchases`.
- **Huấn luyện:** `workout_templates`, `trainer_assignments`.
- **AI chat:** `ai_chat_sessions`, `ai_chat_messages`.

Mỗi collection có ID nghiệp vụ và thời điểm tạo/cập nhật. Nhật ký gắn `user_id`; ngày lưu dạng `YYYY-MM-DD`. Validator và index kiểm tra kiểu dữ liệu, field cho phép và các ID cần duy nhất. Kiểm tra role, quyền sở hữu, tính xu và giao dịch là phần backend, không phải chức năng tự động của schema.

## Kết nối và kiểm tra

Cấu hình `.env` trong thư mục này bằng thông tin Atlas được cấp:

```dotenv
MONGODB_URI=mongodb+srv://<DATABASE_USER>:<URL_ENCODED_PASSWORD>@<ATLAS_HOST>/?retryWrites=true&w=majority
MONGODB_DB_NAME=fitlife
```

Chỉ đặt `MONGODB_DB_NAME=fitlife`. Không tạo database phụ cho ứng dụng.

```powershell
npm ci
node scripts/cli.js verify
```

`db:verify` chỉ đọc và kiểm tra schema, index, document cùng các tham chiếu đã khai báo. Thành công in `PASS: schemas, indexes, documents and references.`

## Khởi tạo và migration

Database Atlas đang dùng đã được khởi tạo; không chạy `db:init` lại trên dữ liệu này. Khi tạo môi trường `fitlife` mới, chạy:

```powershell
node scripts/cli.js init
node scripts/cli.js seed
node scripts/cli.js verify
```

Trước mọi thay đổi schema, xem kế hoạch trước:

```powershell
node scripts/cli.js migrate-plan
```

Đối với database v1 cũ, migration được lưu trong `migrations/v2.js`. Chạy lệnh migration trên một bản sao hoặc sau khi sao lưu và đối chiếu kế hoạch. Script sẽ dừng nếu phát hiện dữ liệu cần xem xét.

Nếu database Atlas phát sinh field mở rộng không còn dùng, quản trị viên có thể chạy lệnh rút gọn sau khi ngừng các tiến trình ghi:

```powershell
node scripts/cli.js simplify-plan
node scripts/cli.js simplify
```

Lệnh rút gọn chỉ nhận `fitlife`, tạo bản sao BSON ở `.tools/simplification-backups`, kiểm tra dữ liệu đích rồi mới sửa schema và xóa collection phụ. Lệnh ứng dụng chỉ cho phép chọn `fitlife`.

## Dữ liệu mẫu và test

Các script `db:seed:demo` và `db:seed:samples` chỉ phục vụ tạo fixture. Chúng ghi vào `fitlife`, nên không chạy trên database Atlas đang dùng chung.

```powershell
npm test
```

Test dùng MongoDB tạm, không kết nối Atlas. Các backup rút gọn ở `.tools/` bị Git bỏ qua vì có thể chứa thông tin tài khoản và nhật ký chat.
