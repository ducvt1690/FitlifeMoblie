# Trạng thái Atlas — database v2

Đã áp dụng migration ngày **25/10/2026** theo giờ Việt Nam vào cluster hiện có `Cluster0`.

- `fitlife`: 16 collection nghiệp vụ, **119 document** sau khi bổ sung **85 bản ghi mẫu ngày 26/10/2026**. Có 6 tài khoản (4 user, 1 trainer, 1 admin), 28 quest và 7 tin nhắn chat; 14 collection còn lại có 6 bản ghi mỗi collection. Gồm nhật ký sức khỏe, template/assignment, thử thách, đổi thưởng và các phiên chat liên kết với nhau.
- `fitlife_demo`: 16 collection nghiệp vụ; 3 tài khoản role user/trainer/admin, một template và một assignment. Giữ nguyên hồ sơ, password hash, số dư, streak lịch sử và nhật ký từ demo v1.
- Cả hai database đã đạt audit schema, index, document và tham chiếu sau migration.
- Sau lần bổ sung ngày **26/10/2026**, audit trên `fitlife` đạt `PASS: schemas, indexes, documents and references.`; cả 16 collection nghiệp vụ đều có ít nhất 6 bản ghi. Ngoài `demo@fitlife.example`, `trainer@fitlife.example`, `admin@fitlife.example`, có thêm `minh.sample@fitlife.example`, `linh.sample@fitlife.example`, `khoa.sample@fitlife.example`. Mật khẩu khi tạo lấy từ `FITLIFE_DEMO_PASSWORD` trong `.env`, được băm scrypt với salt riêng. Các tài khoản đều là dữ liệu giả lập.
- Migration journal `__fitlife_migrations` có trạng thái `complete`; các collection `__fitlife_v1_*` giữ dữ liệu gốc/metadata khôi phục. Hai quest bị loại của demo nằm trong `archived_daily_quest_logs`, không bị mất lịch sử.
- Bộ kiểm thử local đạt **27/27**, kiểm tra database/seed/migration và việc bổ sung mẫu, dùng replica set tạm độc lập với Atlas. Kiểm thử bao gồm giữ nguyên dữ liệu cũ, chạy lại không tạo trùng và rollback khi có lỗi cuối transaction.

Mở [project Atlas](https://cloud.mongodb.com/v2/6a0fb8ec70039ee567fa6e84#/clusters) → Cluster0 → Browse Collections. Ngoài 16 collection nghiệp vụ có thể thấy các collection backup/journal/archive phục vụ migration; không phải database ứng dụng bổ sung.

URI và mật khẩu database/demo giữ trong `.env` cùng thư mục, đã bỏ qua Git. Hiện chỉ hoàn tất phần database, chưa lập trình BE/FE mới. `users.role` và `is_active` là dữ liệu chuẩn bị cho BE phân quyền sau này, không tự tạo cơ chế phân quyền ứng dụng.

Xem [hướng dẫn database](README.md), [đặc tả v2](../FitLife_Database_Specification.md) và [hợp đồng BE/FE](ROLE_CONTRACT.md).
