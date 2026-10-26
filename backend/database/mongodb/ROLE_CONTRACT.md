# Yêu cầu role cho giai đoạn BE/FE sau này

Tài liệu này ghi yêu cầu thiết kế. Phạm vi hiện tại chỉ làm database: collection, field, validator, index, quan hệ dữ liệu, seed và migration. Chưa lập trình API, giao diện, middleware phân quyền hay logic thưởng xu/streak.

## Role và dữ liệu phục vụ phân quyền

- `users.role = user | trainer | admin`; đăng ký public sau này mặc định user.
- `users.is_active` phục vụ khóa/mở account.
- `trainer_assignments.trainer_id/user_id/status` xác định trainer đang được gán cho user nào.
- `workout_templates.trainer_id` xác định chủ template.
- Mỗi nhật ký có `user_id`; chat có cả `user_id` và `session_id`.

Role ứng dụng không phải database role của Atlas. Lưu role trong document không tự phân quyền cho ứng dụng; BE sẽ xác thực token và kiểm tra quyền ở giai đoạn sau. Thành viên dùng Compass có quyền theo tài khoản database được cấp.

## Quyền cần thực thi sau này

- **User:** thao tác dữ liệu cá nhân, quest, mua quà, challenge và chat của mình.
- **Trainer:** tạo/sửa template của mình, gán bài cho user, xem hồ sơ/nhật ký khi assignment còn `assigned`; không sửa log hoặc quản lý shop/challenge.
- **Admin:** quản lý challenge/reward, khóa/mở account, đọc hệ thống phục vụ quản trị; không sửa nhật ký cá nhân hoặc đọc chat riêng của người khác.
- Tài khoản không active phải bị từ chối ở BE, kể cả token đã cấp trước đó.
- Không nhận `role`, `is_active`, `fit_coins`, `streak_days`, targets hoặc password hash từ thao tác sửa hồ sơ thông thường. Không trả hash qua API.

## Quy tắc nghiệp vụ chưa lập trình

- Hoàn thành quest và cộng 10 xu chỉ một lần, trong cùng transaction; FE không set trực tiếp trạng thái thưởng.
- Đạt >=5/7 quest/ngày thì tăng streak một lần, reset quest theo ngày địa phương, giữ lịch sử.
- Đổi quà phải kiểm tra item khả dụng/đủ coins, trừ xu và ghi purchase cùng transaction; retry không trừ lặp.
- Trainer chỉ gán template active của mình cho user active; user chỉ đánh done assignment của mình.
- Check-in challenge tối đa một lần/ngày; thưởng hoàn thành chỉ một lần.
- BE tự tính targets/BMI, gắn ownership từ token và kiểm tra session chat thuộc user.
- Sleep/mood/BMI dùng upsert theo user/ngày; giữ UUID đã tạo, không sinh một bản ghi mới mỗi lần cập nhật.

Các unique index/validator đã chuẩn bị hỗ trợ những quy tắc trên, nhưng không tự thực hiện transaction, tính toán hay kiểm tra token. Quy tắc chi tiết nằm trong [đặc tả database v2](../FitLife_Database_Specification.md).

## Definition of Done

Ở giai đoạn database: đủ collection, field, validator, index, dữ liệu mẫu, migration và kiểm tra toàn vẹn. Luồng đăng ký → log → quest/coins → shop → home → trainer/admin sẽ lập trình và kiểm thử ở các giai đoạn BE/FE tiếp theo.
