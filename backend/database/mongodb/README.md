# FitLife — MongoDB Atlas v2: user / trainer / admin

Thành viên mới xem [hướng dẫn sử dụng database](../README.md) để kết nối Atlas/Compass hoặc tải dữ liệu về máy. Tài liệu dưới đây dành cho khởi tạo, seed và migration.

Database theo đặc tả role mới. Tiếp tục dùng **MongoDB Atlas**; các subcollection Firestore trong yêu cầu được biểu diễn bằng collection MongoDB có `user_id`/`session_id`. Trường lưu trữ giữ `snake_case`; BE có thể map sang `camelCase` khi trả API.

Tài liệu chính: [đặc tả database v2](../FitLife_Database_Specification.md), [hợp đồng BE/FE và quyền](ROLE_CONTRACT.md).

## Khởi tạo database mới

Yêu cầu Node.js >=20.19. Từ thư mục gốc dự án:

```powershell
cd "B:\DỰ ÁN HỌC\FitlifeMoblie\backend\database\mongodb"
npm ci
Copy-Item .env.example .env
```

Điền URI Atlas trong `.env` tại thư mục này. `MONGODB_DB_NAME=fitlife` là database chính; `fitlife_demo` chứa dữ liệu minh họa. Tài khoản khởi tạo/migrate có `readWrite` + `dbAdmin` trên đúng database. Mật khẩu có ký tự đặc biệt phải URL-encode trong URI.

```powershell
npm run db:init
npm run db:seed
npm run db:verify
```

- `db:init`: tạo **16 collection nghiệp vụ**, validator và index; từ chối thay schema của collection đã có dữ liệu v1 để tránh bỏ lại document sai ràng buộc.
- `db:seed`: thêm 6 vật phẩm và 3 thử thách qua `$setOnInsert`, giữ giá/trạng thái đã chỉnh sửa.
- `db:verify`: audit schema/index/document/tham chiếu, role chủ template, role và ownership của assignment, chủ phiên chat, category giao dịch. Chỉ đọc, exit code 1 khi lỗi. Audit tính toàn vẹn không chứng minh app/API đã phân quyền đúng.

## Nâng database v1 trên Atlas

Chạy kế hoạch chỉ đọc:

```powershell
npm run db:migrate:plan
```

Nếu `issues` rỗng, dừng API/sync đang ghi database rồi chạy:

```powershell
npm run db:migrate
npm run db:verify
```

Migration thực hiện:

1. Thêm `users.role=user`, `is_active=true` khi thiếu; hỗ trợ user ID từ `auth.uid`. Tính lại targets, giữ mật khẩu/hash, số dư coins và streak lịch sử.
2. Đổi `q_meals` → `q_meal`. Chuyển `q_weight`, `q_bowel` vào `archived_daily_quest_logs`; không trừ/cộng lại xu lịch sử. Tạo quest còn thiếu của ngày hiện tại ở trạng thái chưa xong.
3. Gom chat cũ mỗi người thành một session, gắn `session_id` vào tin nhắn, giữ nội dung/thời gian.
4. Thêm unique theo user/ngày cho sleep/mood/BMI; thay unique vĩnh viễn của challenge bằng unique khi chưa hoàn thành; thêm template/assignment/session.

Trước khi sửa dữ liệu, script kiểm tra xung đột uniqueness/tham chiếu, thử validator/index v2 trong collection tạm, rồi lưu bản sao v1 trong `__fitlife_v1_<collection>`. Validator/index gốc được ghi trong `__fitlife_migrations`. Backup/journal/archive là dữ liệu hỗ trợ ngoài 16 collection nghiệp vụ; script không tự xóa backup.

Thay đổi document và archive nằm trong **một transaction**. Validator/index là bước DDL tiếp theo; không thể gộp toàn bộ DDL này vào transaction dữ liệu. Nếu lỗi sau transaction, journal/backup còn để quản trị kiểm tra/khôi phục; script không tự chạy lại migration dang dở.

Nếu trùng sleep/mood/BMI cùng user/ngày, migration dừng, không tự xóa/chọn bản ghi. Kế hoạch tải dữ liệu vào RAM, phù hợp quy mô đồ án; database lớn cần xử lý theo batch. Chỉ migrate khi không có writer để tránh ghi đè thay đổi phát sinh.

Để nâng demo, đặt `$env:MONGODB_DB_NAME='fitlife_demo'` rồi chạy các lệnh trên. Kiểm tra đúng tên database trước khi chạy.

## Dữ liệu mẫu ba role

Đặt `FITLIFE_DEMO_PASSWORD` ít nhất 12 ký tự trong `.env`, chỉ chạy trên database demo:

```powershell
$env:MONGODB_DB_NAME='fitlife_demo'
npm run db:seed:demo
npm run db:verify
```

- `demo@fitlife.example`: user, nhật ký, 7 quest, challenge, đổi quà, phiên chat.
- `trainer@fitlife.example`: trainer, template và assignment cho user demo.
- `admin@fitlife.example`: admin để thử quyền ở BE sau này.

Ba tài khoản dùng mật khẩu từ `FITLIFE_DEMO_PASSWORD`, băm scrypt với salt riêng; không dùng làm tài khoản mặc định ở môi trường thật. Demo mới có 6 quest hoàn thành ×10 xu, mua huy hiệu 50 xu, còn 10 xu; streak=1 do đủ >=5/7. Targets mẫu: 2484 kcal, 2275 ml cơ bản hoặc 2625 ml khi có workout trong ngày.

Chạy lại không reset hồ sơ/coins/mật khẩu của user demo. Với demo v1 đã migrate, chỉ thêm trainer/admin/template/assignment còn thiếu, giữ lịch sử/streak cũ. Khi quay về database chính, bỏ biến môi trường theo phiên terminal:

```powershell
Remove-Item Env:MONGODB_DB_NAME
```

## Bổ sung dữ liệu để xem trong Compass

Với database đã có ba tài khoản mẫu ở trên, có thể bổ sung tối thiểu 6 bản ghi cho mỗi collection nghiệp vụ. Lệnh mặc định chỉ in kế hoạch; thêm `--apply` mới ghi vào database được chọn bởi `MONGODB_DB_NAME` trong `.env`:

```powershell
npm run db:seed:samples
npm run db:seed:samples -- --apply
npm run db:verify
```

Script tạo ba user giả lập có tên `(Mẫu)` và email `*.sample@fitlife.example`, dùng mật khẩu mẫu đã cấu hình. Nhật ký, template, assignment, challenge, purchase và chat liên kết đúng người sở hữu. Mỗi user mới có đủ 7 quest và số xu bằng thưởng quest trừ mua quà; một số collection có nhiều hơn 6 bản ghi để giữ liên kết này.

Chỉ thêm dữ liệu qua một transaction; không sửa dữ liệu cũ hoặc backup/journal/archive. Chạy lại khi mọi collection đã đủ 6 bản ghi sẽ không thêm hay reset dữ liệu. ID bản ghi được ghi trong `.tools/sample-data-reports/` để đối chiếu. Script từ chối tự bổ sung vào database có tài khoản thực hoặc fixture nền khác với ba tài khoản mẫu.

## Tệp chính

- `schema.js`: 16 collection, enum role/quest, validator/index.
- `seed.js`, `data/catalogs.json`: dữ liệu mẫu.
- `sample-data.js`, `scripts/fill-samples.js`: bổ sung dữ liệu mẫu cho Compass, mặc định xem kế hoạch.
- `database.js`: khởi tạo và audit.
- `migrations/v2.js`: migration v1→v2, backup/journal.
- `migrations/v1-schema.json`: schema v1 dùng cho test/đối chiếu.
- `scripts/cli.js`: CLI đọc `.env` trong thư mục này, không in mật khẩu.

`.env`, `node_modules/`, `.tools/` được bỏ qua khỏi Git. Chỉ chuẩn bị database, chưa lập trình BE/FE mới. Phân quyền, thưởng xu, streak, công thức khi chạy ứng dụng và đồng bộ sẽ làm ở giai đoạn sau. Các script hiện tại chỉ tạo/kiểm tra/chuyển dữ liệu; phép tính trong migration chỉ chuyển giá trị đã lưu từ v1 sang v2. `../schema.sql` là thiết kế cũ.

## Kiểm thử

```powershell
npm test
```

Test dùng MongoDB Community 8.2.6/replica set tạm, không đọc `.env` hoặc kết nối Atlas. Chỉ kiểm tra schema/index, enum role, các liên kết dữ liệu, giới hạn giá trị, seed/migration và backup; không kiểm thử API hay luồng nghiệp vụ ứng dụng.

Nếu npm báo `The "file" argument must be of type string`, dùng shell riêng cho lệnh:

```powershell
npm --script-shell=C:\Windows\System32\cmd.exe test
```

## Kết nối Atlas

Tạo/chọn cluster Free → database user có quyền trên `fitlife`/`fitlife_demo` → thêm IP hiện tại vào IP Access List → Connect → Drivers lấy URI. Khi đổi mạng, kiểm tra IP trước khi sửa TLS/password. FE/mobile chỉ gọi backend, không giữ URI Atlas.

Tài liệu chính thức: [database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/), [IP Access List](https://www.mongodb.com/docs/atlas/security/ip-access-list/), [partial indexes](https://www.mongodb.com/docs/manual/core/index-partial/), [transactions](https://www.mongodb.com/docs/drivers/node/current/fundamentals/transactions/).
