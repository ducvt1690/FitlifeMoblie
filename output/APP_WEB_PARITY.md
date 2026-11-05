# Đối chiếu App và Web — 05/11/2026

BMI lấy từ users.weight (kg), users.height (cm) trong MongoDB. Backend tính weight / (height/100)^2 qua GET /api/bmi-records. Đổi cân nặng/chiều cao cập nhật lịch sử bmi_history theo ngày; POST ghi nhận hôm nay cũng dùng hồ sơ server. Ví dụ65kg/1.70² =22.49.

App chưa tương đương100% với Web. Các luồng chính Trainer/Admin, OTP, nutrition, Coach, kế hoạch tập, consent, assignment/feedback, challenge và hồ sơ đã có. Những phần Web đầy đủ hơn:
- Thư viện bài tập độc lập, tìm kiếm và phân trang; App xem chi tiết bài trong kế hoạch.
- Ghi/xóa buổi tập thủ công; App chủ yếu hoàn thành kế hoạch.
- Form giấc ngủ/tâm trạng; App chưa có màn nhập tương ứng.
- BMI: Web có nút ghi nhận riêng và bảng lịch sử; App đọc BMI trong Hồ sơ, hiện trong biểu đồ khi có lịch sử.
- Web có logout tất cả thiết bị; App chưa có nút tương ứng.

Bước chân: App đã thêm expo-sensors Pedometer, xin quyền khi bấm Bắt đầu đếm, sync PUT /api/steps-logs/sensor. Backend nhận tổng tích lũy trong ngày bằng max để retry không cộng trùng; dữ liệu cùng tài khoản, không cộng tổng của nhiều thiết bị. Web đọc GET /api/steps-logs mỗi10giây ở Sức khỏe mỗi ngày. Không có dữ liệu bước chân giả. Sensor chạy foreground, dừng khi App ra nền; không phải đo24/7. Đếm thực tế trên điện thoại cần xác minh trên thiết bị có cảm biến; export và test HTTP đã đạt.

Đổi quà đã gỡ khỏi Web/App/API. Các collection lịch sử được giữ cho dữ liệu cá nhân, tài khoản demo/test đã xóa riêng theo yêu cầu.

VNPay sandbox đã có cấu hình mode, checkout/retry, mobile payment deep-link, đối chiếu trạng thái server và validation chữ ký/merchant. Chưa thể thanh toán qua nhà cung cấp vì chưa có VNP_TMN_CODE và VNP_HASH_SECRET. Đăng ký merchant: https://sandbox.vnpayment.vn/devreg/ ; tài liệu: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html . Chỉ nhập secret trong backend/.env. PUBLIC_API_URL phải được trình duyệt của thiết bị truy cập; IPN cần URL HTTPS công khai. Không dùng khóa giả thay merchant thật.

Atlas: xóa17 tài khoản demo/test cùng dữ liệu liên quan theo transaction, có backup cục bộ Git-ignore. Giữ2 tài khoản admin.test/trainer.test và3 email cá nhân theo lựa chọn người dùng. Credentials trong output/atlas-test-accounts.local.json, đã xác minh login HTTP200 và roleUI đúng.

Kết quả: Backend351/351 trước bước chân; bước chân+thanh toán11/11; Web2 login Atlas+2 UI payment4/4; Expo Android/iOS/Web export pass. Kiểm tra UI payment dùng fixture, không coi là giao dịch ngoài VNPay đã thành công.
