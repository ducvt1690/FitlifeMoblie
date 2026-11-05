# Kiểm chứng Web độc lập

Web dùng React + Vite riêng trong `web/`, cùng API với Expo. Các kiểm tra dưới đây dùng API thật tại cổng 5500 và MongoDB replica set tạm `fitlife_integration_test`; không đọc hoặc ghi Atlas đang cấu hình.

## Kết quả do tác vụ Web trực tiếp chạy

| Kiểm tra | Kết quả |
| --- | --- |
| `npm --prefix web run build` | PASS. Build production thành công; 36 modules. |
| `npm --prefix web run test:e2e -- e2e/training.spec.js --reporter=list` | 4 passed, 0 failed, 0 skipped; lần cuối 7,8 giây. |
| `node web/scripts/verify-native-sync.mjs` | PASS. Một bản ghi tạo/sửa từ Expo native hiển thị đúng trên Web. |
| npm install/audit | 0 vulnerabilities tại thời điểm cài khóa dependency. |
| Hallmark static sweep | 0 FAIL, 0 WARN; một ghi chú về nút xác nhận nguy hiểm đã ghi lý do trong CSS. |

Bốn test trong `web/e2e/training.spec.js` kiểm chứng:

1. Danh mục bài tập từ bộ ExerciseDB đã có của dự án: trang cursor trước/sau, tìm kiếm, chi tiết/hướng dẫn khớp database và kết quả rỗng.
2. Giáo án: lấy lựa chọn Backend, tạo lịch toàn thân, đánh dấu bài, hoàn thành; kiểm tra MongoDB chỉ ghi một workout tương ứng `plan_id`.
3. BMI: giá trị do Backend tính từ hồ sơ; ghi hai lần cùng ngày chỉ có một dòng lịch sử, đúng cân nặng/chiều cao/BMI.
4. Web ở 390 px: mở điều hướng, đi tới BMI, tự đóng, đóng thủ công, không tràn ngang. Điều hướng ẩn dùng `inert` để loại liên kết khỏi thứ tự focus.

Test catalog dùng hàm import sẵn có `prepareDemoExercises` với bộ dữ liệu ExerciseDB đã cache trong repository, chỉ trên database thử nghiệm. Không tạo dữ liệu giả thay API trong ứng dụng.

Các test Trainer/Admin/Member khác do tác vụ tích hợp chạy trong `web/e2e/platform.spec.js`. Tổng số và kết quả lần chạy kết hợp nằm tại `output/playwright/fullstack-results.json` và báo cáo bàn giao gốc; không cộng các lần chạy lặp thành test mới.

## Đồng bộ Expo native → Web

Script smoke tùy chọn `web/scripts/verify-native-sync.mjs` đọc kết quả native và metadata database tạm. Script tạo phiên hợp lệ qua session service thật, mở Web đã xác thực, tìm mẫu và đối chiếu ID từ response API với MongoDB. Phiên thử nghiệm được thu hồi sau khi kết thúc. Việc đăng nhập bằng form đã được kiểm chứng trong suite tích hợp riêng.

- Template ID: `52d31465-a18b-4f0d-a1de-33a8b632b962`.
- Tên: `Native mobile 1793829273997 edited`.
- Thời lượng từ database/API: 1500 giây; UI Web: `1.500 giây` theo định dạng Việt Nam.
- Kết quả máy đọc: `output/web-native-sync-result.json`.
- Ảnh thực tế: `output/playwright/web-native-template-sync.png`.

Smoke này không nằm trong suite E2E có thể chạy lại độc lập vì nó cần artifact từ lần chạy native trước đó. Nếu đã khởi tạo lại database tạm, phải chạy native integration lại trước.

## Lỗi đã phát hiện và sửa

- Chuẩn hóa `publicUser.name` thành `full_name` khi login, khôi phục và refresh; tránh crash Dashboard Member.
- Giá trị sắp xếp theo contract Backend; xử lý bỏ chọn học viên; sửa thông tin quyền trước/sau và đối tượng `excluded.count` trong doanh thu.
- Giới tính, chiều cao và enum chất lượng ngủ đồng bộ với validation Backend.
- Checkbox giáo án giữ trạng thái chờ phản hồi, rollback nếu API lỗi, rồi dùng dữ liệu Backend sau khi lưu. Test ban đầu phát hiện trạng thái bật rồi tắt trong thời gian chờ mạng; đã sửa và chạy lại cả bốn test thành công.
- Thu hồi phiên xử lý 401; với 403 kiểm tra `/auth/me` để phân biệt tài khoản khóa với thao tác thiếu quyền.
- Smoke đầu tiên gặp giới hạn đăng nhập sau nhiều lần chạy suite; giữ nguyên giới hạn bảo vệ và chuyển setup của smoke sang phiên test tạo bằng session service. Kiểm tra thời lượng sửa kỳ vọng theo định dạng Việt Nam, vẫn đối chiếu số thực tại API/database.

## Giới hạn thực tế

- Build có cảnh báo dependency React Router về directive `use client`; build vẫn exit 0. Không bỏ qua lỗi build nào.
- Render riêng của Hallmark không chạy vì không có `puppeteer-core`; không báo là render pass. Kiểm chứng giao diện dùng Playwright/Edge thực tế, có screenshot desktop và 390 px.
- Gửi OTP email và reset email cần SMTP thật. Chưa chứng minh thư đến mailbox ngoài môi trường test.
- Tạo và xác nhận thanh toán thật cần cấu hình VNPay. Web không thay trạng thái thanh toán; không thực hiện khoản thu thật trong kiểm tra này.
- Browser kiểm chứng là Microsoft Edge trên Windows. Các engine/browser khác và triển khai HTTPS sản xuất chưa được xác nhận bởi tác vụ Web này.
