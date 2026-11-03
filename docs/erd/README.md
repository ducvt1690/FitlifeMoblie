# ERD FitLife theo mã nguồn

Ngày đối chiếu: 03/11/2026. Schema: `backend/database/mongodb/schema.js` và `backend/database/connection.js`.

- [Xem tất cả sơ đồ](index.html).
- [File draw.io chỉnh sửa được — 4 trang](FitLife-ERD.drawio). Mở draw.io → Open Existing Diagram / File → Open from → Device, rồi chọn file. Trang 01 là tổng quan; trang 02–04 có đầy đủ field trong validator (ẩn `_id`).
- [Toàn bộ 20 collection — SVG](fitlife-full.svg), [PNG](fitlife-full.png), [Mermaid](fitlife-full.mmd).
- [Tài khoản, nhật ký, nhiệm vụ, exercises](fitlife-health.svg).
- [Thử thách và đổi thưởng](fitlife-rewards.svg).
- [Trainer, admin và chat](fitlife-coaching-chat.svg).
- [Từ điển đầy đủ các trường và index](DATA_DICTIONARY.md).

Hình chỉ chọn các field chính để dễ đọc; không thay thế toàn bộ validator. Có 19 collection nghiệp vụ và `auth_sessions` kỹ thuật. Các collection không được tách thêm chỉ vì trong UI có một màn hình.

PK là khóa nghiệp vụ unique (auth_sessions dùng token_hash unique), còn `_id` là khóa MongoDB thật và được ẩn để hình gọn. FK là tham chiếu logic. Đường 1 → 0..N nghĩa một document cha có thể có nhiều document con; trainer_links.user_id có thể null ở lời mời pending nên phía user là 0..1. Role user/trainer/admin cùng nằm trong users.

`users` xuất hiện lại trong từng sơ đồ theo nhóm, vẫn là cùng một collection. `exercises` đứng riêng vì workout_logs/workout_templates hiện chưa có exercise_id. `admin_logs.target_id` đa hình theo `target_type = user|challenge|reward_item`; không phải một FK duy nhất.

Các ràng buộc đáng lưu ý:

- users.email và trainer_links.invite_code unique.
- sleep/mood/BMI unique theo user + ngày.
- daily_quest_logs unique theo user + ngày + quest_key.
- user_challenges chỉ unique user + challenge với run chưa hoàn thành; cho phép nhiều run đã hoàn thành.
- trainer_links chỉ unique trainer + user ở status active; không quy định mỗi user chỉ có một trainer.
- purchases có unique partial user + item với badge; theme mua một lần được service kiểm tra.
- auth_sessions có unique token_hash và TTL expires_at; API kiểm tra hạn ngay khi xác thực.

Tham chiếu `auth_sessions.user_id` bổ sung từ connection/session service, không nằm trong mảng business references. `ai_chat_messages.user_id` phải trùng chủ session; workout_templates/assignments dùng trainer_id trỏ users có role trainer. Kiểm tra role/quyền do backend thực hiện.

Sinh lại Mermaid/DOT/từ điển bằng `node docs/generate-erd.cjs`. Muốn render SVG/PNG, cài `@viz-js/viz` và `sharp` ở thư mục công cụ riêng rồi đặt `FITLIFE_ERD_TOOLS` tới thư mục node_modules đó. Không cần thêm thư viện render vào runtime backend.

Sinh lại file draw.io bằng `node docs/generate-drawio.cjs`, với `FITLIFE_ERD_TOOLS` trỏ tới node_modules có `@viz-js/viz`. Bảng, dòng thuộc tính và đường nối là các đối tượng draw.io, không phải ảnh nhúng.
