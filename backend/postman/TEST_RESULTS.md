# Kết quả kiểm thử API

## Rà soát backend — 27/10/2026

- Build kiểm tra cú pháp 8 file JavaScript: PASS.
- Test tích hợp authentication: **15/15 PASS** trên MongoDB tạm.
- Test schema, migration và dữ liệu mẫu: **27/27 PASS** trên MongoDB tạm.
- Postman CLI với backend vừa khởi động lại và Atlas `fitlife`: **11 request, 37/37 assertion PASS**, exit code 0.
- Thử trực tiếp tài khoản demo user/trainer/admin trên Atlas: Login và Me đều `200`; logout các phiên thử nghiệm thành công.
- Atlas `db:verify`: PASS. `npm audit`: không ghi nhận vulnerability.
- Sửa lỗi parser đổi request encoding sai thành `500`: nay trả `415` cho charset/content encoding không hỗ trợ, `400` cho gzip hỏng; JSON và gzip quá 16 KB trả `413`. Đã thêm test, kiểm tra cả gzip hợp lệ vẫn login thành công.
- Sửa hướng dẫn FE thiếu `db:init` và `db:seed` khi chuyển sang database demo mới.

Phạm vi hiện có là Login / Me / Logout. Các API nghiệp vụ FitLife và tích hợp frontend chưa hoàn thành. Kết quả này không thay cho kiểm thử toàn ứng dụng.

## Xác minh trực tiếp trong Postman desktop

Ngày 26/10/2026 đã kiểm tra cửa sổ Postman và lịch sử chạy thực tế trên máy. Lần chạy lỗi chọn `FitLife Example` là environment mẫu trống mật khẩu: script trước request Login dừng, dẫn tới Me/Logout không có token. Ba lần chạy trước ghi nhận 29 assertion PASS, 6 FAIL.

Đã chuyển environment sang `FitLife Local`, bấm Send lần lượt trên giao diện: Login `200` lúc 23:51:59, Me `200` lúc 23:52:35, Logout `204` lúc 23:53:04. Sau đó chạy toàn bộ `FitLife Auth` bằng Collection Runner trên giao diện lúc 23:54:17: **37/37 PASS, 0 FAIL, 0 errors**. Lịch sử Postman lưu kết quả hoàn tất lúc 23:54:19. Thời gian theo Asia/Saigon.

Các request cố tình không có token, sai mật khẩu và dùng token đã logout vẫn cần `401`. Điều này được assertion xác nhận là PASS; không sửa API để bỏ xác thực.

## Kiểm tra CLI và backend

Backend Node.js + Express chạy tại `http://127.0.0.1:5000`, kết nối MongoDB Atlas database `fitlife`. Kiểm tra bằng Postman CLI 1.77.0, gọi API thật, không dùng mock. Không gửi report lên Postman cloud (`--no-report-events`).

- Build: `npm run build` PASS, kiểm tra cú pháp 11 file JavaScript.
- Integration test: `npm test` PASS **13/13**, dùng replica set MongoDB tạm, không ghi Atlas.
- Postman: **11/11 request, 37/37 assertion PASS**, exit code **0**.
- Sau Postman: `GET /health` trả database connected; `db:verify` PASS; `auth_sessions` không còn phiên thử nghiệm. Unique token hash index và TTL expiry index hiện diện.

Postman xác nhận thiếu token → 401; body thiếu/sai JSON/operator injection → 400; sai mật khẩu → 401; login đúng → 200; me → đúng tài khoản; logout → 204; dùng lại token đã logout → 401; logout lặp → 204. Response không chứa password hoặc hash nội bộ.

Chạy lại bằng [collection và environment mẫu](README.md). Environment chứa credentials dùng riêng trên máy, được Git bỏ qua; không đưa vào báo cáo. Kết quả này chỉ xác nhận phạm vi authentication API, chưa kiểm chứng giao diện mobile hoặc API nghiệp vụ khác.
