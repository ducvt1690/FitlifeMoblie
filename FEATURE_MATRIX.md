> Cập nhật05/11: chức năng đổi quà đã gỡ theo yêu cầu mới; số liệu kiểm thử và kiểm tra App/Web mới nhất xem output/APP_WEB_PARITY.md. VNPay ngoài hệ thống còn thiếu merchant sandbox.

# Feature matrix

Trạng thái bàn giao trong môi trường tích hợp local (05/11/2026). DONE dựa trên test đã chạy, không chỉ sự tồn tại của source. Phạm vi iOS runtime, SMTP/VNPay bên ngoài và toàn bộ tổ hợp thao tác native vẫn được ghi riêng trong báo cáo; không suy diễn từ build thành thành công runtime.

| ID | Phạm vi | Trạng thái | Bằng chứng tiêu biểu |
|---|---|---|---|
| TR-01 | Sửa template, giữ lịch sử | DONE | HTTP snapshot/legacy-freeze; Web create/edit + DB; Android create/edit |
| TR-02 | Xóa/archive template | DONE | HTTP xóa mẫu chưa giao, archive mẫu có lịch sử; Postman historical archive |
| TR-03 | Hủy riêng bài có lý do | DONE | HTTP status_history; Web và Android cancel + DB |
| TR-04 | Idempotency assignment | DONE | Concurrent HTTP cùng UUID có một record; khác payload 409; Postman replay |
| TR-05 | Trainer disconnect | DONE | HTTP/Web/Android end consent và cancel pending; assign sau disconnect 403 |
| TR-06 | Danh sách/revoke invitation | DONE | HTTP hết hạn/revoke; Postman create/list/revoke/refused accept |
| TR-07 | Note giao bài | DONE | Web/Android lưu note; member inbox; scope owner; không chia sẻ sang học viên khác |
| TR-08 | Student nhận bài | DONE | Web/Android inbox/instructions/note/feedback/done + DB |
| TR-09 | Search/filter/pagination | DONE | Backend vượt 100 record và boundary; Web search/sort/pager; client không tải cố định 100 |
| TR-10 | Progress/feedback | DONE | HTTP summary thật; Web gửi feedback/member đọc; Android hiển thị |
| AD-01 | Challenge CRUD | DONE | HTTP/Postman; Web create/edit/deactivate; Android create/deactivate |
| AD-02 | Reward CRUD | DONE | HTTP/Postman; Web tạo/đổi quà; Android tạo; race ngừng bán bị chặn |
| AD-03 | Payment/redemption lookup | DONE | HTTP filter/detail; Postman; Web redemption detail + DB, payment lookup |
| AD-04 | Audit log filters | DONE | HTTP action/account/time/paging; Web log page; API không có sửa/xóa log |
| AD-05 | Revenue split | DONE | HTTP paid product/date; Web Premium/Coin riêng; Android màn doanh thu |
| AD-06 | Role audit | DONE | Missing/blank reason400; Web đổi quyền; persisted actor/target/previous/new role/time/note |
| CH-01 | Revoke Trainer transaction | DONE | HTTP race + rollback scope; Web revoke live tab; no active links/pending/tasks/session |
| CH-02 | Session revoke hai client | DONE | Backend expired/revoked401; Web logout-all/revoke; Android xóa auth state và thông báo |
| CH-03 | Cross platform | DONE | API/MongoDB + Vite + Metro đồng thời; native template xuất hiện trên Web đúng ID/nội dung |

Các phần ngoài backlog cốt lõi: external Gmail delivery UNVERIFIED; thanh toán VNPay bên ngoài UNVERIFIED; iOS runtime UNVERIFIED; LAN điện thoại vật lý UNVERIFIED; phục hồi nội dung lịch sử trước snapshot UNVERIFIED (không có nguồn phiên bản cũ). Bộ Postman có request cho 50/103 endpoint, không tuyên bố mọi endpoint có mọi tổ hợp negative/boundary; bộ HTTP/DB và auth-boundary bổ sung phạm vi.
