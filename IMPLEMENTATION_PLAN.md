# Kế hoạch thực hiện

1. Kiểm kê source, trạng thái Git và test nền; giữ nguyên Express/MongoDB/Expo.
2. Ưu tiên CH-01/02: transaction revoke, cancel pending, session revoke và audit.
3. Bổ sung Trainer template snapshot/edit/archive, cancellation, UUID idempotency, invites, pagination, progress/feedback. Giữ tương thích response cũ.
4. Hoàn thiện Admin filter/detail, audit role và revenue phân loại product.
5. Triển khai song song Web độc lập và Expo sử dụng API hợp đồng chung.
6. Test HTTP với database riêng, race/idempotency/permissions; chạy Postman, backend + database tests.
7. Build Web, kiểm tra Expo, khởi chạy API+MongoDB+Web+Expo đồng thời; Playwright kiểm tra dữ liệu lưu thật trong database test.
8. Cập nhật API inventory, feature matrix và báo cáo bằng đúng kết quả đã chạy. Không đánh dấu hoàn tất thiết bị/SMTP/VNPay khi thiếu bằng chứng.

Các lane độc lập: Backend sở hữu routes/services/schema/tests; Mobile sở hữu frontend/; Web sở hữu web/; tác vụ chính sở hữu docs, launcher, tích hợp và báo cáo. Các thay đổi schema phải có migration plan trước khi áp dụng dữ liệu cũ.
