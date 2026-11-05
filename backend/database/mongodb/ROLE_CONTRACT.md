# Hợp đồng phân quyền và vòng đời dữ liệu FitLife

Cập nhật 05/11/2026 theo source code và kiểm thử HTTP/database. Đối chiếu kết quả chạy tại `output/backend-verification.md` và báo cáo tổng thể ở root repository. Đây là mô tả quy tắc đang triển khai, không thay thế những quyết định còn mở trong `BUSINESS_DECISIONS.md`.

## Xác thực và phạm vi

- Đăng ký mặc định `user`, có xác minh email. Token Bearer là token ngẫu nhiên, database chỉ giữ SHA-256 digest. Phiên tối đa 12 giờ, kiểm tra hạn ngay trên mỗi request, không chờ TTL cleanup; không có refresh-token trong kiến trúc hiện tại.
- Middleware đọc lại user và role từ database. Role ứng dụng `user | trainer | admin` khác quyền database Atlas.
- `user` dùng nhật ký, Coin, Premium, nhiệm vụ, thử thách, phần thưởng, AI và bài tập được giao của chính mình.
- `trainer` quản lý mẫu của mình, mã mời, học viên đã chấp thuận và bài đã giao. Tiến độ/feedback chỉ thuộc bài được giao; consent này không cấp quyền đọc chat, số đo hoặc toàn bộ nhật ký cá nhân.
- `admin` quản lý tài khoản user/trainer, challenge/reward, tra cứu thanh toán/đổi quà/nhật ký và doanh thu; API không nâng tài khoản thành admin, không sửa trạng thái thanh toán từ giao diện, không sửa/xóa audit log.
- Profile không chấp nhận role, trạng thái khóa, số dư, hash mật khẩu hoặc mục tiêu hệ thống do client gửi. Không API nào trả password hash.

## Huấn luyện viên và consent

- Mã mời có hiệu lực 24 giờ tính từ `created_at`; chỉ mã pending, chưa dùng, chưa bị thu hồi và thuộc Trainer đang hoạt động được chấp nhận. Hai bên có thể kết thúc kết nối.
- Mỗi cặp Trainer–Student chỉ có một consent active nhờ unique partial index. Source hiện cho phép một Student có nhiều Trainer khác nhau; quy tắc sản phẩm một/nhiều Trainer vẫn cần xác nhận.
- Giao bài yêu cầu consent active, Trainer đang hoạt động, Student user đang hoạt động, mẫu active thuộc Trainer đó. Client gửi UUID `id` ổn định cho một thao tác: retry/concurrent retry trả cùng bản ghi; trùng id khác payload trả409. Request legacy không có id được giữ tương thích và không có bảo đảm nhận diện retry.
- Assignment mới lưu `template_snapshot`; sửa mẫu không sửa lịch sử đã giao. Trước lần sửa mẫu đầu tiên, service đóng băng nội dung hiện tại cho các assignment legacy chưa có snapshot trong cùng transaction. Không thể khôi phục một phiên bản nội dung đã bị thay đổi trước khi cơ chế snapshot tồn tại.
- Mẫu chưa từng giao được xóa; mẫu có lịch sử được archive. Trainer hủy riêng một assignment đang assigned bằng lý do bắt buộc, có `cancel_reason`, `cancelled_at`, `status_history`.
- Student tự xác nhận `done`; thao tác này không tự tạo workout log hoặc thưởng Coin. Ghi chú `note` là nội dung chia sẻ cho đúng Trainer và Student nhận bài; không có module ghi chú nội bộ Trainer riêng.
- Kết thúc kết nối hủy các bài đang assigned trong transaction, thu hồi quyền xem progress/giao bài/feedback cho học viên đó. Lịch sử không bị xóa.
- GET templates/students/assignments có search, sort, page/page_size và total phía server. Trang tối đa100 dòng, không giới hạn tổng số dòng100.

## Thu hồi role, khóa tạm và audit

- Thay đổi role thực sự qua Admin API bắt buộc `note` không rỗng. Audit lưu `admin_id`, `target_id`, `previous_role`, `new_role`, lý do và thời gian trong cùng transaction.
- Chuyển role kết thúc consent active/pending liên quan, hủy bài đang assigned, xóa phiên. Thu hồi Trainer đồng thời archive mẫu active của họ. Mẫu và lịch sử assignment vẫn được giữ.
- Cấp lại Trainer không phục hồi consent. Phải tạo mã mời mới, Student chấp thuận mới, và Trainer chủ động mở lại mẫu đã archive nếu muốn sử dụng tiếp.
- Khóa tạm giữ chính sách source cũ: xóa phiên và chặn truy cập; không tự chấm dứt consent. Quyết định khóa tạm có nên kết thúc quan hệ vẫn để mở, không tự gán thêm quy tắc.
- Script bootstrap `set-role.js` chỉ nhận user/admin, cần quyền database vận hành và cũng thực hiện đổi role/thu hồi consent/session/audit trong transaction. `set_role_*` phân biệt sự kiện bootstrap với `change_account_role` của Admin API; bootstrap giữ convention principal là tài khoản đích, không giả định có một admin đang đăng nhập.

## Giao dịch và thống kê

- Ghi workout/quest, thưởng xu, đổi quà và callback thanh toán sử dụng transaction; UUID thao tác và unique index ngăn xử lý lặp khi có hỗ trợ.
- Đổi quà write-lock cả tài khoản lẫn dòng reward để request đồng thời với admin ngừng bán phải retry theo trạng thái mới, không mua từ snapshot đã cũ.
- Chỉ callback VNPay được xác minh mới quyết toán đơn. Admin chỉ có GET tra cứu danh sách/chi tiết, không có API đổi trạng thái thanh toán.
- Revenue được tổng hợp từ `payment_orders` status paid ở backend. Premium và Coin được nhóm riêng theo danh mục sản phẩm phía server, không cộng Coin vào doanh thu Premium.
- GET `/api/admin/revenue?from&to` nhận ngày ISO hoặc timestamp có timezone. Ngày YYYY-MM-DD dùng ranh giới UTC; trả timezone, period, currency VND, công thức, số đơn và số tiền từng nhóm. Pending/failed bị loại. Model chưa có refund/cancel operation nên refunded/cancelled là null, không gán0 giả.

## Schema và migration

Schema hiện có24 collection nghiệp vụ; auth_sessions và registration_email_verifications là collection phụ trợ. Phần mở rộng Fitness không thêm collection: chỉ mở rộng validator assignment/audit, giữ strict/error và mọi index.

Chạy `npm --prefix backend/database/mongodb run db:fitness:plan` trước khi apply. Plan chỉ đọc, kiểm tra old/new validator đã biết, dữ liệu hợp lệ, active consent/template còn thuộc Trainer và nguồn template cho history. Drift không xác định phải dừng. `db:fitness:apply` không rewrite/xóa document, không seed lại dữ liệu và không nới tắt validation. Tính toàn vẹn lịch sử trước triển khai được đánh giá theo snapshot đã có, không được khẳng định có thể khôi phục nội dung không được lưu trước đó.
