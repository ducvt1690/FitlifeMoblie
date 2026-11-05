# Luồng trainer và học viên

Trainer đăng nhập vào `/trainer`, user vào `/home`, admin vào `/admin`. Mỗi khu vực chỉ tồn tại cho đúng role trong frontend; backend tiếp tục kiểm tra role và quyền sở hữu trên mọi request.

## API trainer (Bearer token role trainer)

| Method | Path | Chức năng |
|---|---|---|
| GET | `/api/trainer/templates` | Các bài mẫu thuộc trainer hiện tại |
| POST | `/api/trainer/templates` | Tạo bài mẫu: `title`, `category`, `duration_seconds`, `calories_est`, `level`, `description` |
| PATCH | `/api/trainer/templates/:id` | Bật/tắt bài mẫu bằng `is_active` |
| POST | `/api/trainer/invites` | Mã mời 8 ký tự, dùng một lần, hiệu lực 24 giờ |
| GET | `/api/trainer/students` | Học viên đã chấp thuận kết nối |
| GET | `/api/trainer/assignments` | Bài trainer đã giao |
| POST | `/api/trainer/assignments` | Giao bài: `user_id`, `template_id`, `note` tùy chọn |
| POST | `/api/trainer/links/:id/end` | Ngắt kết nối và hủy bài còn chờ |

Không được giao bài cho người chưa kết nối hoặc dùng template của trainer khác. API không cấp quyền đọc chat riêng hay sửa nhật ký của học viên. Giao bài và ngắt kết nối được tuần tự hóa bằng transaction ghi vào bản ghi consent để tránh tạo bài sau khi quyền bị thu hồi.

## API học viên (Bearer token role user)

Trong Hồ sơ → **Huấn luyện viên của tôi**:

- `POST /api/trainer-links/accept` với `{ "code": "AB12CD34" }` để đồng ý kết nối.
- `GET /api/trainer-links` để xem trainer và bài được giao của chính mình.
- `POST /api/trainer-links/assignments/:id/done` để đánh dấu hoàn thành. Gửi lại bài đã hoàn thành thành công; bài đã hủy trả 409. Đây là trạng thái bài được giao, không tự tạo workout log hoặc cộng xu.
- `POST /api/trainer-links/:id/end` để ngắt kết nối. Bài chưa hoàn thành được hủy; trainer mất quyền truy cập học viên qua kết nối đó.

Danh sách hiện giới hạn 100 bản ghi. Không trả password hash/session token hoặc dữ liệu của học viên chưa chấp thuận. Mã mời bị giới hạn số lần tạo/nhập theo IP.

## Admin và hồ sơ theo role

`GET /api/admin/accounts` hỗ trợ `q`, `role`, `status`, `page`. `PATCH /api/admin/accounts/:id` cho khóa/mở khóa hoặc đổi `user` ↔ `trainer`; không cấp role admin, không sửa tài khoản quản trị hoặc chính mình. Khóa và đổi role thu hồi phiên, ghi audit log.

`GET/PATCH /api/profile` cho mọi role đọc/sửa hồ sơ của chính mình. Allowlist field vẫn giữ nguyên; không nhận role, owner, số xu hoặc mục tiêu giả. Chỉ role user mới cập nhật BMI history và mục tiêu nước phụ thuộc workout.
