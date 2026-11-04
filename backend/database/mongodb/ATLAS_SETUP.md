# Trạng thái MongoDB Atlas

Cấu hình ngày **29/10/2026**: dự án dùng database duy nhất `fitlife` trong cluster `Cluster0`.

- 16 collection nghiệp vụ, 119 document được audit thành công.
- `auth_sessions` là collection kỹ thuật do backend dùng; hiện không có session hoạt động.
- Các collection backup và thử nghiệm cùng database `fitlife_demo` đã được xóa khỏi Atlas.
- Bản sao BSON trước khi rút gọn nằm trong `.tools/simplification-backups` trên máy đã chạy thao tác; `manifest.json` có SHA-256 của từng bản sao.

Tài khoản, nhật ký, quest, vật phẩm, giao dịch và chat còn trong `fitlife`. Tài khoản/nhật ký mang nhãn `(Mẫu)` là fixture để xem Compass, không phải người dùng thật.

Mở [project Atlas](https://cloud.mongodb.com/v2/6a0fb8ec70039ee567fa6e84#/clusters) → Cluster0 → Browse Collections → `fitlife`.

Kiểm tra hiện trạng bằng `node scripts/cli.js verify`. Lệnh chỉ đọc.
