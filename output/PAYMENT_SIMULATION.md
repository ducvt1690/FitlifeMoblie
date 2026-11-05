# Thanh toán giả lập — 05/11/2026

Đã bật PAYMENT_SIMULATION=1 trong backend/.env của môi trường hiện tại và khởi động lại Backend :5000.

Web: Thành viên → Premium & Coin → Mua gói → Giả lập thành công hoặc Giả lập thất bại.
App: Hồ sơ → Nâng cấp Premium / FitLife Premium → chọn gói → chọn kết quả giả lập.

Áp dụng Premium tháng/năm và các gói Coin. Thành công cập nhật membership/fit_coins thật trong tài khoản để thử; thất bại không cấp quyền lợi. Không gọi VNPay, không thu tiền thật. Mỗi order_id được xử lý đúng một lần trong transaction. API kiểm tra user role, ownership, hạn đơn và loại giao dịch. Callback VNPay không xử lý đơn giả lập, endpoint giả lập không xử lý đơn VNPay.

Các order được đánh dấu bank_code=FITLIFE_SIMULATION, response_code=SIMULATED/SIM_OK/SIM_FAIL, mã giao dịch có tiền tố SIM-. Đây là các field đã được validator cho phép, không đổi schema Atlas. Response thêm simulated để hai client hiển thị nhãn. Thống kê doanh thu/paid_orders loại các order này; excluded.simulated ghi số lượng riêng.

Tắt bằng PAYMENT_SIMULATION=0 rồi restart Backend. NODE_ENV=production hoặc VNP_ENV=production từ chối bật giả lập. Việc tắt chế độ không tự xóa quyền lợi đã cấp để test.

Kiểm chứng:15/15 Backend test gồm4gói, đồng thời/retry, thất bại/hết hạn, auth/role/ownership, configproduction và hồi quy VNPay. UI chạy với HTTP API và MongoDB replica riêng:4gói Web + thất bại + MembershipSheet Expo Web, kiểm tra database và doanh thu. Không dùng tài khoản cá nhân trên Atlas để tự mua gói trong lượt kiểm thử. Export Android/iOS/Web thành công; chưa chạy checkout mới trên phần cứng điện thoại trong lượt này.
