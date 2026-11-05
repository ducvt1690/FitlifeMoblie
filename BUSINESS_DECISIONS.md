# Quyết định nghiệp vụ

Không coi các đề xuất mới là quy tắc đã được chủ sản phẩm xác nhận. Các hành vi dưới đây dựa trên service hiện có, giữ nguyên trừ phần yêu cầu rõ trong MASTER TASK.

| Câu hỏi | Phân loại | Căn cứ / cách triển khai |
|---|---|---|
| Student có một hay nhiều Trainer? | Được phép triển khai theo quy tắc hiện tại | Cho nhiều Trainer; chỉ chặn active link trùng cùng cặp. Chưa có yêu cầu giới hạn một Trainer. |
| Trainer dùng khu Member? | Được phép triển khai theo quy tắc hiện tại | `requireMember` chỉ chấp nhận user; các khu role riêng. |
| Hoàn thành tự báo cáo hay duyệt? | Được phép triển khai theo quy tắc hiện tại | Student tự đánh done; không thêm bước duyệt. |
| Hoàn thành assignment có Workout/Coin? | Được phép triển khai theo quy tắc hiện tại | Không tự tạo workout hoặc cộng coin từ assignment; các module riêng. |
| Phạm vi consent? | Được phép triển khai theo quy tắc hiện tại | Nhận bài, xem lịch sử assignment và phản hồi; không mở rộng sang chat/nhật ký/số đo riêng. |
| Lịch tập/deadline? | Chưa quyết định | Không tự thêm lịch phạt hoặc tự động quá hạn. |
| Student có quyền từ chối bài? | Chưa quyết định | Giữ hành động done hoặc ngắt kết nối hiện tại; không tự thêm trạng thái từ chối. |
| Sửa template ảnh hưởng bài cũ? | Đã xác nhận trong yêu cầu | Không sửa lịch sử; snapshot lúc giao, backfill dữ liệu legacy theo khả năng khôi phục hiện có. |
| Kết nối lại xem lịch sử cũ? | Được phép triển khai theo quy tắc hiện tại | Chỉ sau consent mới Trainer xem được progress của cặp học viên, bao gồm lịch sử cặp trước đó theo service cũ. Student xem lịch sử của chính mình cả khi ngắt kết nối; không thể done bài đã hủy. Không suy diễn consent thành quyền xem nhật ký sức khỏe riêng. |
| Khóa tạm giữ quan hệ? | Đang chờ xác nhận | Giữ quy tắc cũ: thu hồi session/chặn truy cập nhưng giữ quan hệ. Thay đổi ROLE mới kết thúc consent/hủy bài chờ/archive template. Không tự thêm chính sách xóa quan hệ khi khóa tạm. |
| Thu hồi Trainer ai tiếp quản? | Chưa quyết định | Kết thúc quan hệ/hủy bài chờ, không tự chuyển Student cho người khác. |
| Web hay Mobile quản trị đầy đủ? | Đã xác nhận trong yêu cầu | Cả hai có khu Trainer/Admin; Web độc lập, cùng API. |
| Mã mời tồn tại bao lâu? | Được phép triển khai theo quy tắc hiện tại | 24 giờ theo service cũ; bổ sung hiển thị expiry/revoke. |
| Note giao bài | Được phép triển khai theo quy tắc hiện tại | Note hiện tại được chia sẻ đúng Trainer và Student nhận bài. Không dùng nó làm ghi chú nội bộ bí mật. |
| Doanh thu | Đã xác nhận trong yêu cầu | Tổng các payment đã paid, theo paid_at và product; Premium tách Coin, VND. Không thêm refund workflow chưa tồn tại. |
| Múi giờ lọc doanh thu/audit | Được phép triển khai theo quy tắc hiện tại | Ngày đơn thuần dùng ranh giới UTC; timestamp ISO có offset được hỗ trợ. UI hiển thị rõ quy tắc để tránh hiểu nhầm ngày Việt Nam. Chưa chuyển toàn bộ báo cáo sang múi giờ người dùng. |
| Template của Trainer đã thu hồi | Được phép triển khai theo ràng buộc dữ liệu hiện tại | Archive template khi role rời Trainer để không còn template active thuộc tài khoản sai role; giữ lịch sử. Cấp lại role không tự bật lại template hoặc consent. |

Danh mục phải được cập nhật nếu triển khai thực tế phát hiện ràng buộc khác; kiểm thử kỹ thuật không thay thế quyết định chủ sản phẩm.
