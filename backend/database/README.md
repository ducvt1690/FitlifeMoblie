# Hướng dẫn sử dụng database FitLife

Database của nhóm dùng **MongoDB Atlas**, cluster **Cluster0**. Hướng dẫn này dành cho thành viên muốn xem, thao tác hoặc tải dữ liệu về máy.

Hiện tại chỉ chuẩn bị phần database: collection, validator, index, dữ liệu mẫu và migration. Backend/API và frontend chưa được kết nối với thiết kế database mới.

## 1. Chọn đúng database

- **`fitlife`**: database chính để dùng cho dự án; đã có dữ liệu giả lập cho cả 16 collection nghiệp vụ để xem trong Compass.
- **`fitlife_demo`**: database có dữ liệu minh họa, dùng để xem cấu trúc và thử thao tác.

Hai database cùng nằm trong Cluster0. Thành viên có thể dùng chung dữ liệu trên Atlas; thay đổi được ghi trực tiếp vào database đang kết nối. Nếu muốn thử sửa dữ liệu, dùng `fitlife_demo` hoặc một bản sao local riêng.

Database đã được khởi tạo. Thành viên chỉ cần kết nối và kiểm tra, không cần chạy lại lệnh tạo/migrate để bắt đầu sử dụng.

## 2. Tài khoản và quyền truy cập của thành viên

Có ba loại quyền khác nhau:

- **Tài khoản Atlas**: đăng nhập website MongoDB bằng email, dùng để vào project/Data Explorer.
- **Database user**: username/password để Compass, script hoặc Database Tools kết nối cluster.
- **`users.role` trong dữ liệu FitLife**: `user`, `trainer`, `admin` của ứng dụng sau này; không phải quyền Atlas hoặc tài khoản kết nối database.

### Xem trên website Atlas

Người quản lý project mời email thành viên trong **Project Identity & Access → Users → Invite to Project**. Tùy nhu cầu, chọn **Project Data Access Read Only** hoặc **Project Data Access Read/Write**. Thành viên chấp nhận lời mời qua email.

Mở [project FitLife trên Atlas](https://cloud.mongodb.com/v2/6a0fb8ec70039ee567fa6e84#/clusters) → **Cluster0 → Browse Collections / Data Explorer** → chọn `fitlife` hoặc `fitlife_demo`.

### Kết nối từ máy bằng Compass hoặc script

Người quản lý cấp **database user riêng** cho từng thành viên trong **Database Access / Database Users**:

- Role `read` trên database được giao nếu chỉ xem hoặc tải dữ liệu.
- Role `readWrite` trên database được giao nếu cần thêm/sửa/xóa dữ liệu.
- Chỉ người khởi tạo/migrate cần thêm `dbAdmin` trên database đó.
- Có thể giới hạn scope vào Cluster0. Không dùng chung tài khoản quản trị cho cả nhóm.

Tiếp theo, thêm **IP public hiện tại của máy thành viên** vào **Network Access / IP Access List**. Nếu chính thành viên được cấp quyền sửa Access List, họ có thể chọn **Add IP Address → Add Current IP Address**; nếu không, gửi IP cho người quản lý thêm.

Lấy IP public trên PowerShell:

```powershell
Invoke-RestMethod 'https://api.ipify.org'
```

Khi đổi Wi-Fi, mạng, VPN hoặc nhà mạng cấp IP mới, cần kiểm tra lại IP Access List. Dùng IP cụ thể `/32` cho một máy, không cần mở truy cập toàn Internet để kết nối.

Nhận username/password riêng qua kênh riêng tư. File `.env` của từng thành viên tự tạo trên máy, không gửi hoặc commit lên Git.

## 3. Kết nối bằng MongoDB Compass

1. Cài/mở [MongoDB Compass](https://www.mongodb.com/products/tools/compass).
2. Chọn **Add New Connection**.
3. Dán URI, thay các phần `<...>` bằng tài khoản database được cấp:

```text
mongodb+srv://<DATABASE_USER>:<URL_ENCODED_PASSWORD>@cluster0.mie8mi8.mongodb.net/?retryWrites=true&w=majority
```

4. Đặt tên kết nối, ví dụ `FitLife Atlas`, rồi chọn **Connect**.
5. Chọn `fitlife` hoặc `fitlife_demo` → chọn collection nghiệp vụ như `users`, `water_logs`, `challenges` → **Documents**. Khi nhóm vừa thêm dữ liệu, bấm **Refresh** để tải lại danh sách/bản ghi.

Username/password ở đây là **database user**, không phải email/password đăng nhập website Atlas. Nếu copy URI từ `.env`, chỉ lấy giá trị bắt đầu bằng `mongodb+srv://`, bỏ phần `MONGODB_URI=`.

Mật khẩu có ký tự đặc biệt phải URL-encode khi nằm trong URI; ví dụ `@` → `%40`, `#` → `%23`. Có thể dùng phần Authentication trong tùy chọn kết nối của Compass để nhập username/password riêng.

### Xem và lọc dữ liệu

Chọn collection → tab **Documents**. Ví dụ trong `fitlife_demo.water_logs`, nhập vào ô Filter:

```json
{ "user_id": "30000000-0000-4000-8000-000000000001" }
```

Đây là ID của user demo. Với user khác, lấy `user_id` từ collection `users`. Khi sửa/thêm document bằng Compass, dữ liệu vẫn phải đúng validator; MongoDB không tự tạo các trường nghiệp vụ, tính targets hoặc cấp thưởng.

## 4. Dùng bộ script database trên máy

Yêu cầu **Node.js >=20.19**. Lấy bản code database do nhóm chia sẻ trên nhánh **`Db`**. Từ thư mục gốc repo, chạy PowerShell:

```powershell
cd backend/database/mongodb
npm ci --omit=dev

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
}
```

Thư mục ví dụ trên máy hiện tại là `B:\DỰ ÁN HỌC\FitlifeMoblie\backend\database\mongodb`; trên máy thành viên, đường dẫn gốc có thể khác.

Mở file `.env` **trong thư mục `mongodb`**, điền tài khoản riêng:

```dotenv
MONGODB_URI=mongodb+srv://<DATABASE_USER>:<URL_ENCODED_PASSWORD>@cluster0.mie8mi8.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=fitlife
FITLIFE_DEMO_PASSWORD=
```

Thay toàn bộ `<DATABASE_USER>` và `<URL_ENCODED_PASSWORD>`, bỏ dấu `<`/`>`. `FITLIFE_DEMO_PASSWORD` chỉ cần khi người quản lý tạo dữ liệu demo, không phải mật khẩu kết nối Atlas.

Kiểm tra kết nối và tính toàn vẹn:

```powershell
npm run db:verify
```

Hoặc gọi trực tiếp cùng script:

```powershell
node scripts/cli.js verify
```

Kết quả thành công có số lượng document của từng collection và dòng:

```text
PASS: schemas, indexes, documents and references.
```

Đây là kiểm tra database. Không cần khởi động server Express để chạy lệnh này; kết quả PASS không có nghĩa các luồng BE/FE đã được triển khai.

### Chuyển sang database demo

```powershell
$env:MONGODB_DB_NAME='fitlife_demo'
node scripts/cli.js verify
```

Biến môi trường này ưu tiên hơn giá trị trong `.env` và có hiệu lực trong phiên PowerShell hiện tại. Quay về giá trị trong `.env`:

```powershell
Remove-Item Env:MONGODB_DB_NAME -ErrorAction SilentlyContinue
```

Nếu tài khoản chỉ được cấp quyền cho một database, hãy chọn đúng database đó; không yêu cầu cấp quyền rộng hơn chỉ để xem database còn lại.

## 5. Database gồm những collection nào?

Có **16 collection nghiệp vụ**:

- `users`: hồ sơ, role, trạng thái active, mục tiêu sức khỏe và số dư xu.
- `water_logs`: các lần uống nước.
- `workout_logs`: các buổi tập.
- `meal_logs`: bữa ăn, calo và macro.
- `sleep_logs`: giấc ngủ, tối đa một bản ghi/user/ngày.
- `mood_logs`: tâm trạng, tối đa một bản ghi/user/ngày.
- `bmi_history`: thể trạng, tối đa một bản ghi/user/ngày.
- `daily_quest_logs`: bảy nhiệm vụ theo user/ngày.
- `workout_templates`: bài tập do trainer soạn.
- `trainer_assignments`: bài tập được gán cho user.
- `challenges`: danh mục thử thách.
- `user_challenges`: tham gia và tiến độ thử thách.
- `reward_items`: vật phẩm đổi thưởng.
- `purchases`: lịch sử đổi thưởng.
- `ai_chat_sessions`: các phiên chat.
- `ai_chat_messages`: tin nhắn trong mỗi phiên.

Các collection `__fitlife_v1_*`, `__fitlife_migrations`, `archived_daily_quest_logs` là bản sao/journal/lịch sử phục vụ migration. Chúng không phải database mới và không nằm trong 16 collection nghiệp vụ. Giữ chúng để có thể kiểm tra/khôi phục dữ liệu cũ.

### Quy ước dữ liệu

- Field lưu theo `snake_case`, ví dụ `user_id`, `full_name`, `fit_coins`.
- `_id` là ObjectId nội bộ. ID nghiệp vụ khác dùng UUID, riêng `user_id` có thể là UID từ dịch vụ xác thực.
- Ngày nghiệp vụ là chuỗi `YYYY-MM-DD`, giờ uống nước là `HH:mm`.
- `created_at`, `updated_at` và các timestamp khác phải là BSON Date, không phải chuỗi ngày tùy ý.
- `users.role` chỉ chấp nhận `user`, `trainer`, `admin`; `is_active` là boolean.
- Quest key: `q_water`, `q_workout`, `q_meal`, `q_sleep`, `q_mood`, `q_checkin`, `q_chat`.
- Validator và unique index chặn sai dữ liệu/trùng bản ghi; chưa có logic API tự thưởng coins, tăng streak hoặc phân quyền theo token.

Xem đầy đủ trong [đặc tả database](FitLife_Database_Specification.md).

## 6. Tải dữ liệu về máy

### Xuất một collection ra JSON/CSV

Trong Compass, mở collection cần lấy và dùng chức năng **Export Data / Export Collection**. Chọn xuất toàn bộ hoặc kết quả đã lọc, rồi chọn JSON/CSV.

Phù hợp để đọc hoặc trao đổi dữ liệu từng collection. JSON/CSV không phải bản sao đầy đủ của database và không giữ nguyên validator/index.

### Sao lưu database bằng mongodump

Cài [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools) và bảo đảm PowerShell tìm thấy `mongodump`. Nếu chưa có trong PATH, chạy executable bằng đường dẫn cài đặt đầy đủ.

Ví dụ tải database demo, chạy ở thư mục muốn lưu bản sao:

```powershell
mongodump `
  --uri 'mongodb+srv://cluster0.mie8mi8.mongodb.net/?retryWrites=true&w=majority' `
  --username '<DATABASE_USER>' `
  --authenticationDatabase admin `
  --db fitlife_demo `
  --archive='.\fitlife-demo.archive.gz' `
  --gzip
```

Thay username. Công cụ sẽ hỏi mật khẩu vì không có mật khẩu trong lệnh. Cần quyền đọc database được chọn và IP được Atlas cho phép. Lệnh này tạo file `fitlife-demo.archive.gz`, không xóa hoặc chuyển dữ liệu khỏi Atlas.

Muốn lấy database chính, thay `--db fitlife` và chọn tên file khác. Bản dump cũng bao gồm collection backup/journal nếu chúng nằm trong database đó. Lưu file sao lưu ở thư mục riêng ngoài repo vì có thể chứa thông tin cá nhân và password hash.

### Khôi phục vào MongoDB local riêng

Máy cần có **MongoDB Server local đang chạy** ở `127.0.0.1:27017` và công cụ `mongorestore`. Chỉ cài Compass chưa tạo MongoDB Server local.

Ví dụ restore bản demo thành database local tên `fitlife_local_demo`:

```powershell
mongorestore `
  --uri 'mongodb://127.0.0.1:27017' `
  --archive='.\fitlife-demo.archive.gz' `
  --gzip `
  --nsInclude 'fitlife_demo.*' `
  --nsFrom 'fitlife_demo.*' `
  --nsTo 'fitlife_local_demo.*'
```

Dùng tên database local chưa có dữ liệu để tránh duplicate. Sau đó mở Compass và kết nối `mongodb://127.0.0.1:27017`. Thao tác trong bản local không đồng bộ tự động lên Atlas. Ví dụ trên dành cho local chưa bật authentication; local có auth cần thêm tài khoản tương ứng.

## 7. Lệnh quản lý database — dành cho người phụ trách

Chạy các lệnh bên dưới trong `backend/database/mongodb`, kiểm tra `MONGODB_DB_NAME` trước khi thao tác.

- `npm run db:init`: tạo collection/validator/index cho môi trường mới.
- `npm run db:seed`: thêm danh mục mẫu bằng `$setOnInsert`, không ghi đè danh mục đã có.
- `npm run db:seed:demo`: tạo dữ liệu mẫu ba role; chỉ dùng trên database demo và cần `FITLIFE_DEMO_PASSWORD` ít nhất 12 ký tự.
- `npm run db:seed:samples`: xem kế hoạch bổ sung tối thiểu 6 bản ghi/collection cho database đã có ba tài khoản mẫu. Thêm `-- --apply` mới ghi dữ liệu; giữ nguyên bản ghi cũ. Xem điều kiện và chi tiết trong [hướng dẫn kỹ thuật](mongodb/README.md#bổ-sung-dữ-liệu-để-xem-trong-compass).
- `npm run db:verify`: kiểm tra schema, index và dữ liệu, không sửa database.
- `npm run db:migrate:plan`: xem kế hoạch v1→v2, chỉ đọc.
- `npm run db:migrate`: tạo backup và nâng dữ liệu/schema v1→v2; dừng các luồng ghi trong lúc migrate.
- `npm test`: kiểm tra bằng MongoDB tạm độc lập với Atlas; cần cài cả devDependencies bằng `npm ci`.

Tài khoản database cần `readWrite` + `dbAdmin` cho init/migration. Thành viên chỉ đọc không chạy các lệnh thay đổi schema/dữ liệu.

Dữ liệu demo có `demo@fitlife.example`, `trainer@fitlife.example`, `admin@fitlife.example`. Mật khẩu khi tạo lấy từ `FITLIFE_DEMO_PASSWORD`; đổi biến môi trường sau đó không tự đổi password hash của tài khoản đã có. Hiện chưa có API đăng nhập theo bộ database này.

Đợt bổ sung mẫu cho `fitlife` ngày 26/10/2026 thêm ba user có tên `(Mẫu)` và email `*.sample@fitlife.example`. Số lượng tại thời điểm đó là 119 document nghiệp vụ: 14 collection có 6 bản ghi, `daily_quest_logs` có 28 và `ai_chat_messages` có 7. Đây là dữ liệu để thử nghiệm và xem cấu trúc.

Xem [hướng dẫn kỹ thuật và migration](mongodb/README.md), [trạng thái Atlas đã thiết lập](mongodb/ATLAS_SETUP.md) và [yêu cầu role cho giai đoạn BE/FE](mongodb/ROLE_CONTRACT.md).

## 8. Lỗi thường gặp

- **Authentication failed**: kiểm tra database user/password, `authSource=admin` và URL-encode mật khẩu; không dùng tài khoản website Atlas để đăng nhập database.
- **SSL alert internal error (80), connection closed hoặc timeout**: kiểm tra IP public hiện tại có trong IP Access List trước; tiếp theo kiểm tra cluster sẵn sàng, DNS và mạng có chặn cổng 27017 hay không. Không tắt xác thực chứng chỉ TLS để dùng lâu dài.
- **not authorized**: database user chưa có quyền trên đúng database; cần người quản lý cấp quyền phù hợp với thao tác.
- **Document failed validation (121)**: sai kiểu dữ liệu, thiếu field bắt buộc, sai enum hoặc có field ngoài schema. Date phải là BSON Date và field số nguyên phải đúng kiểu.
- **Duplicate key (11000)**: trùng UUID/email/quest/user-ngày/huy hiệu. Xem index được báo, không xóa dữ liệu chỉ để vượt lỗi.
- **Existing data needs migration**: đang chạy init trên dữ liệu v1. Người quản lý cần xem migrate-plan và thực hiện quy trình migration.
- **mongodump/mongorestore not recognized**: cài Database Tools hoặc dùng đường dẫn executable đầy đủ.
- **npm: The "file" argument must be of type string**: thử chỉ định shell cho lệnh, ví dụ `npm --script-shell=C:\Windows\System32\cmd.exe run db:verify`; cũng có thể dùng `node scripts/cli.js verify`.

## 9. Tài liệu MongoDB

- [Database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/)
- [IP Access List](https://www.mongodb.com/docs/atlas/security/ip-access-list/)
- [Kết nối Compass](https://www.mongodb.com/docs/compass/current/connect/)
- [mongodump](https://www.mongodb.com/docs/database-tools/mongodump/)
- [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/)
