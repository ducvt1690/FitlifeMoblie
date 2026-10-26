# FitLife Auth — Postman

Collection dùng API Node.js + Express thật, kết nối MongoDB Atlas. Không dùng mock. Chạy cả collection theo thứ tự để kiểm tra vòng đời token.

## Panel Postman trong editor

Panel Local View đọc thư mục `postman/` ở gốc project. Collection v3 nằm tại `postman/collections/FitLife-Auth`; environment mẫu là `FitLife Example`. Environment `FitLife Local` đã chuẩn bị riêng trên máy hiện tại bằng credential demo có sẵn; file `postman/environments/fitlife.local.environment.yaml` được Git bỏ qua.

Để **bấm Send từng bước**, dùng collection `FitLife-Login-Logout` mới:

1. Chọn environment **FitLife Local**.
2. Mở `01 Login` → **Send** → cần `200`.
3. Mở `02 Me` → **Send** → cần `200`.
4. Mở `03 Logout` → **Send** → cần `204`.

Collection này lưu token riêng trong environment local giữa các lần Send, rồi xóa token sau Logout. Nếu bấm Login lại khi đang có phiên, hãy gửi Logout trước; nếu token hết hạn, gửi Me để xóa phiên local không còn hợp lệ rồi Login lại. Trên máy khác, tạo bản environment có tên kết thúc `.local.environment.yaml`, điền credentials của riêng mình và thêm biến `fitlifePrivate` có giá trị chuỗi `true`; giữ file này ngoài Git.

Đã chạy collection 3 request này trên Atlas: Login `200` → Me `200` → Logout `204`, 6 assertion PASS. Đây là luồng đăng nhập thành công để làm quen API.

Mở rộng `collections` → `FitLife Auth` (thư mục `FitLife-Auth`), chọn environment `FitLife Local`, rồi dùng **Run collection** để chạy cả 11 request theo thứ tự. Nếu cây chưa cập nhật, thu gọn/mở lại panel. Không cần import JSON cho Local View.

Token được nối bằng biến trong cùng lần chạy; bấm Send riêng từng request không giữ token từ Login sang Me. Từ thư mục gốc có thể chạy cùng collection v3 bằng:

```powershell
postman collection run postman/collections/FitLife-Auth -e postman/environments/fitlife.local.environment.yaml --no-report-events --timeout-request 15000
```

Đã lint collection/environment không có lỗi và chạy lại trên Atlas: 11 request, 37 assertion PASS ngày 26/10/2026.

Trong bộ 11 request, `02`, `06`, `10` cố tình cần `401`, còn `03`–`05` cố tình cần `400`. Tên mỗi request có `[expected ...]` để phân biệt mã HTTP mong đợi với assertion FAIL. Request Login đúng (`07`) và Me sau Login (`08`) phải nhận `200`.

## Postman desktop

1. Khởi động backend theo `backend/README.md`.
2. Import `FitLife-Auth.postman_collection.json` và `FitLife-Local.postman_environment.example.json`.
3. Chọn environment vừa import. Điền `email` và `password` của tài khoản đã có trên Atlas vào giá trị local; chỉnh `baseUrl` nếu backend dùng port khác.
4. Chọn **Run collection**, chạy toàn bộ 11 request theo thứ tự.

Collection kiểm tra API hoạt động, body thiếu/sai định dạng, NoSQL injection, mật khẩu sai, đăng nhập thành công, thông tin phiên, đăng xuất, token bị thu hồi và đăng xuất lặp lại. Token được giữ bằng `pm.variables` trong lần chạy, không ghi vào collection/environment hoặc console. Body đăng nhập được tạo bằng `JSON.stringify` để mật khẩu có dấu nháy/ký tự đặc biệt vẫn gửi đúng.

## Postman CLI

Từ thư mục gốc project, tạo bản environment local (được `.gitignore` bỏ qua):

```powershell
Copy-Item backend/postman/FitLife-Local.postman_environment.example.json backend/postman/FitLife-Local.local.json
```

Điền email/password vào file local đó, rồi chạy:

```powershell
postman collection run backend/postman/FitLife-Auth.postman_collection.json -e backend/postman/FitLife-Local.local.json --no-report-events --timeout-request 15000
```

Postman CLI 1.77.0 hỗ trợ `--no-report-events`, tắt gửi sự kiện chạy kiểm thử lên API Catalog/Application Inventory. Không dùng `--verbose`, không export response/environment và không truyền mật khẩu bằng tham số dòng lệnh. Chỉ commit collection và environment mẫu trống; không chia sẻ file `*.local.json`.

Exit code 0 cùng toàn bộ assertion PASS xác nhận các hành vi đã kiểm tra trên backend tại `baseUrl`; collection không kiểm chứng giao diện mobile hoặc các API nghiệp vụ khác.
