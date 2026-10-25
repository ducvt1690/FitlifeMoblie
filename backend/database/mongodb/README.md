# FitLife — Database MongoDB Atlas

Bộ database độc lập, chuyển từ `../FitLife_Database_Specification.md` sang MongoDB Atlas. Phần này chỉ tạo collection, validator, index và dữ liệu. Backend/API hiện tại chưa được nối vào MongoDB.

## 1. Tạo cluster Atlas lần đầu

1. Mở [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register), đăng ký/đăng nhập và tạo project `FitLife`.
2. Chọn tạo database deployment/cluster. Chọn gói **Free** nếu tài khoản/khu vực có hỗ trợ, đặt tên `FitLifeCluster`. Có thể chọn khu vực Singapore gần Việt Nam. Kiểm tra gói hiển thị trước khi tạo.
3. Trong **Database Access / Database Users**, tạo database user `fitlife_admin` và mật khẩu riêng. Đây là tài khoản truy cập database, khác tài khoản đăng nhập website Atlas.
4. Cấp quyền `readWrite` và `dbAdmin` trên riêng database `fitlife` qua phần quyền cụ thể. `dbAdmin` phục vụ tạo/cập nhật validator và index. Nếu dùng tên database khác, thay tên ở cả quyền và file `.env`. Khi làm backend, dùng một database user riêng chỉ có `readWrite`.
5. Trong **Network Access / IP Access List**, chọn **Add Current IP Address**. Khi địa chỉ mạng thay đổi, cập nhật lại IP này.
6. Đợi cluster sẵn sàng, chọn **Connect → Drivers → Node.js**, sao chép chuỗi `mongodb+srv://...`.
7. Làm bước 2 bên dưới. Không cần tạo thủ công 13 collection trong giao diện; `db:init` tạo toàn bộ.

Tên các nút có thể khác nhẹ theo giao diện Atlas. Tài liệu chính thức: [tạo cluster](https://www.mongodb.com/docs/atlas/tutorial/create-new-cluster/), [database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/), [kết nối Atlas](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).

## 2. Cấu hình và đưa database lên Atlas

Yêu cầu Node.js **20.19 trở lên**. PowerShell, từ thư mục gốc dự án:

```powershell
cd "B:\DỰ ÁN HỌC\FitlifeMoblie\backend\database\mongodb"
npm ci --omit=dev
Copy-Item .env.example .env
```

Mở file `.env` trong **thư mục mongodb này**, điền URI thật và tên database:

```dotenv
MONGODB_URI=mongodb+srv://fitlife_admin:<MAT_KHAU_DA_URL_ENCODE>@<HOST_CLUSTER>/?retryWrites=true&w=majority
MONGODB_DB_NAME=fitlife
FITLIFE_DEMO_PASSWORD=
```

Thay toàn bộ phần `<...>`, bỏ dấu `<` và `>`. Mật khẩu có ký tự đặc biệt phải được URL-encode trong URI; ví dụ `@` thành `%40`, `#` thành `%23`. Giữ URI trong `.env`, đã được `.gitignore` của dự án bỏ qua. Không gửi mật khẩu hoặc URI chứa mật khẩu vào chat.

Chạy lần lượt:

```powershell
npm run db:init
npm run db:seed
npm run db:verify
```

- `db:init`: tạo **13 collection**, validator và index. Chạy lại sẽ áp dụng lại validator và thêm các index còn thiếu; không xóa document. Đây là thao tác cập nhật schema, nên dùng migration riêng nếu sau này thay thiết kế trên dữ liệu thật.
- `db:seed`: thêm **6 vật phẩm** và **3 thử thách mẫu**. Dùng `$setOnInsert`, giữ nguyên bản ghi đã có, bao gồm giá và trạng thái đã chỉnh sửa. Voucher minh họa bị tắt và không có giá trị sử dụng thực tế.
- `db:verify`: chỉ đọc; kiểm tra đủ collection, validator, index, document sai schema, liên kết mồ côi và phân loại vật phẩm trong giao dịch. Trả exit code 1 nếu có lỗi. Việc kiểm tra tham chiếu sẽ quét dữ liệu, phù hợp giai đoạn khởi tạo/đồ án.

Sau đó mở **Browse Collections / Data Explorer → fitlife** để xem dữ liệu. Các collection nhật ký ban đầu trống là đúng; chỉ danh mục được seed mặc định.

### Dữ liệu demo cho toàn bộ collection (tùy chọn)

Nên dùng database riêng `fitlife_demo` và cấp cùng quyền cho tên đó, rồi chạy `db:init` + `db:seed` trước. Điền `FITLIFE_DEMO_PASSWORD` ít nhất 12 ký tự trong `.env`, rồi chạy:

```powershell
npm run db:seed:demo
npm run db:verify
```

Tạo một hồ sơ giả `demo@fitlife.example` và các bản ghi liên quan trong toàn bộ collection: nước, tập luyện, bữa ăn, 7 nhiệm vụ, BMI, ngủ, tâm trạng, tham gia thử thách, đổi quà và chat mẫu. Không gọi dịch vụ AI. Mật khẩu lưu dưới dạng **scrypt có salt ngẫu nhiên**, không lưu bản rõ.

Demo có 6 nhiệm vụ hoàn thành × 10 xu = 60 xu, mua một huy hiệu 50 xu, số dư còn **10 xu**; nhiệm vụ tiêu hóa chưa hoàn thành nên streak = 0. BMI và mục tiêu của người mẫu nam 23 tuổi, 65 kg, 170 cm, vận động vừa/giữ cân: BMI 22.49, nước 2275 ml, calo 2484 kcal theo công thức trong đặc tả.

Toàn bộ dữ liệu người dùng demo được ghi trong **một transaction**, cần replica set (Atlas đáp ứng). Nếu lỗi, không để lại hồ sơ hoặc số dư dở dang. Seed demo chạy một lần: nếu UUID demo đã tồn tại thì bỏ qua hoàn toàn, kể cả chạy vào ngày khác. Không tự đặt lại mật khẩu, thêm xu hoặc khởi tạo nhiệm vụ của ngày mới.

## 3. Các collection

Giữ tên trường `snake_case` và ID chuỗi UUID theo đặc tả; `_id` nội bộ của MongoDB là `ObjectId` tự sinh. Mỗi ID nghiệp vụ đều có unique index.

- `users`: hồ sơ, mật khẩu băm, mục tiêu, số dư xu, streak; email chữ thường và duy nhất.
- `water_logs`: từng lần uống, lượng ml, giờ và ngày.
- `workout_logs`: buổi tập, loại, thời lượng giây và calo tiêu hao.
- `meal_logs`: tên bữa, calo, macro và loại bữa.
- `daily_quest_logs`: trạng thái từng nhiệm vụ theo người dùng/ngày.
- `bmi_history`: lịch sử chiều cao, cân nặng, BMI và phân loại.
- `sleep_logs`: thời lượng, chất lượng ngủ và ngày.
- `mood_logs`: nhãn tâm trạng, ghi chú và ngày.
- `challenges`: danh mục thử thách và phần thưởng.
- `user_challenges`: tham gia, tiến độ và lần điểm danh gần nhất.
- `reward_items`: huy hiệu, giao diện, voucher và giá.
- `purchases`: lịch sử đổi thưởng và giá đã trả tại thời điểm mua.
- `ai_chat_messages`: hội thoại của từng người dùng.

Validator chạy trực tiếp trên MongoDB với `validationLevel: strict`, `validationAction: error`, từ chối trường ngoài schema. Giới hạn chiều cao/cân nặng/tuổi và các enum bám theo tài liệu. Các trường số nguyên dùng BSON `int`; macro, chiều cao/cân nặng và thời lượng ngủ chấp nhận số thập phân. Ví dụ schema chạy thực tế nằm ở `schema.js`.

Các index chính:

- Unique `users.email`; email phải viết thường để tránh trùng do hoa/thường.
- Unique `(user_id, quest_date, quest_key)` để mỗi nhiệm vụ chỉ có một bản ghi mỗi ngày.
- Partial unique `(user_id, item_id)` khi `item_category = badge`, chặn mua trùng huy hiệu; voucher có thể có nhiều giao dịch.
- Unique `(user_id, challenge_id)` cho việc tham gia thử thách một lần theo thiết kế ban đầu.
- Index người dùng + ngày cho các nhật ký, người dùng + thời gian cho chat và giao dịch; index trạng thái/loại/giá cho cửa hàng.

## 4. Quy ước và phần nghiệp vụ dành cho backend sau

1. **Nguồn thiết kế:** yêu cầu MongoDB Atlas thay thế phần Firestore/Supabase trong tài liệu. Chưa tự chuyển dữ liệu local cũ hoặc sửa luồng frontend/API.
2. **Ngày và thời gian:** ngày nghiệp vụ là chuỗi `YYYY-MM-DD` theo múi giờ người dùng; timestamp là BSON Date UTC. Thêm trường bắt buộc `users.timezone`, demo dùng `Asia/Ho_Chi_Minh`. Regex database kiểm tra định dạng ngày/tháng, backend vẫn phải kiểm tra ngày lịch thực tế và tên múi giờ IANA hợp lệ.
3. **Đồng bộ:** UUID của từng lần ghi có unique index để nhận diện bản ghi trùng khi gửi lại. Mọi collection có `created_at`, `updated_at` bắt buộc. Database không tự điền ngày, UUID, default hay cập nhật timestamp; phía ghi dữ liệu phải điền. Chính sách sửa/xóa offline, tombstone và giải quyết xung đột chưa được triển khai.
4. **7 nhiệm vụ:** dùng đúng 7 key hiện có trong `frontend/src/utils/storage.js`: `q_weight`, `q_water`, `q_meals`, `q_sleep`, `q_mood`, `q_bowel`, `q_workout`. Mẫu nằm ở `data/catalogs.json`, không tạo thêm collection ngoài 13 collection của đặc tả. `q_bowel` dùng `extra_value`; tài liệu chưa có collection nhật ký tiêu hóa riêng.
5. **Ngưỡng hoàn thành:** demo minh họa cách ghi nhận một hoạt động như frontend hiện tại. `q_water` có thể hoàn thành khi đã ghi nhận nước dù chưa đạt `target_water`; đó chưa phải quy tắc sản phẩm được chốt. Backend cần xác nhận ngưỡng từng nhiệm vụ trước khi tự cộng thưởng. `reward_coins` được chụp tại bản ghi nhiệm vụ; hoàn thành cần `completed_at`.
6. **Cộng xu và đổi quà:** index chặn bản ghi trùng, không tự cộng/trừ xu. Backend phải dùng transaction và cập nhật có điều kiện: chuyển nhiệm vụ từ chưa xong sang xong + tăng xu; hoặc giảm xu với điều kiện đủ tiền + ghi giao dịch. Không nhận số dư, giá, phần thưởng hay `item_category` từ client. `item_category` của purchase là snapshot tin cậy từ `reward_items.category`; audit phát hiện sai lệch nhưng MongoDB không có foreign key để tự chặn mọi sai lệch giữa collection.
7. **Streak và thử thách:** thêm `streak_last_date` (tùy chọn) để tránh cộng streak nhiều lần/ngày, `last_checkin_date` để phân biệt ngày theo múi giờ. Backend phải xử lý thiếu ngày, backfill và ngày mới. Bản hiện tại chặn tham gia lại cùng thử thách; nếu cần nhiều lượt tham gia phải thêm khái niệm lượt/chu kỳ rồi đổi index.
8. **Ràng buộc liên kết:** MongoDB không tự kiểm tra foreign key hay cascade delete. `db:verify` phát hiện document mồ côi. Tạo/sửa/xóa dữ liệu liên quan cần kiểm tra và transaction từ backend. Không hard-delete vật phẩm đã có giao dịch; dùng `is_available = false`, giữ nguyên category và lịch sử giá.
9. **BMI và mục tiêu:** schema lưu kết quả, không tự tính. Đặc tả có mâu thuẫn giữa công thức calo và mức tối thiểu 800; database thực thi mức tối thiểu 800. Cách xử lý công thức ra thấp hơn và việc cá nhân hóa cho tuổi dưới 18 cần được chốt trước khi triển khai backend. Mức 800 trong schema là ràng buộc kỹ thuật từ tài liệu, không phải khuyến nghị dinh dưỡng.
10. **Bảo mật dữ liệu:** schema chấp nhận chuỗi hash scrypt/bcrypt/Argon2; backend phải băm và kiểm tra mật khẩu đúng thuật toán. Không trả `password_hash` qua API. Tin chat demo dùng `ai_engine = demo-fixture`; tên model là chuỗi mở, không cố định theo nhãn quảng bá trong đặc tả.

## 5. Tệp trong bộ database

- `schema.js`: 13 validator và toàn bộ index.
- `data/catalogs.json`: 7 mẫu nhiệm vụ, 6 vật phẩm, 3 thử thách có thể chỉnh trước lần seed đầu.
- `database.js`: khởi tạo schema và audit chỉ đọc.
- `seed.js`: seed danh mục và bộ dữ liệu người dùng minh họa.
- `scripts/cli.js`: kết nối MongoDB bằng `.env` và chạy các lệnh database.
- `.env.example`: mẫu kết nối Atlas, không chứa thông tin đăng nhập thật.
- `test/database.test.js`: kiểm thử bằng MongoDB thật chạy tạm trên máy.

`../schema.sql` là bản thiết kế SQL cũ; bộ MongoDB này là nguồn schema dùng cho Atlas. `../db.js` hiện vẫn là kho JSON của backend cũ, chưa được chuyển đổi trong giai đoạn database.

## 6. Kiểm thử local

```powershell
npm ci
npm test
```

Test tải MongoDB Community **8.2.6** nếu chưa có cache, khởi động replica set tạm, kiểm tra schema/index/seed/transaction rồi dừng. Test không đọc `.env`, không kết nối Atlas và không dùng dữ liệu thật. Chỉ cần Node.js, không cần cài Docker hay MongoDB service.

Nếu môi trường PowerShell báo `The "file" argument must be of type string. Received undefined` khi npm chạy script, đặt shell cho riêng lệnh:

```powershell
npm --script-shell=C:\Windows\System32\cmd.exe ci
npm --script-shell=C:\Windows\System32\cmd.exe test
```

## 7. Lỗi kết nối thường gặp

- **Authentication failed:** kiểm tra database user/password, URL-encode mật khẩu và đúng cluster.
- **Server selection timed out:** kiểm tra IP Access List, cluster đã sẵn sàng, mạng có cho phép truy cập Atlas hay không.
- **not authorized / collMod:** tài khoản khởi tạo cần thêm `dbAdmin` trên đúng tên database.
- **Document failed validation (121):** document không khớp schema; không tắt validator để nhập dữ liệu sai.
- **Duplicate key (11000):** trùng email/UUID/nhiệm vụ/huy hiệu/lượt tham gia. Script không tự xóa dữ liệu để vượt lỗi.
- **IndexOptionsConflict:** index có cùng tên nhưng định nghĩa khác. Xem lại thiết kế và migration; script không tự drop index.

Tài liệu MongoDB: [JSON Schema validation](https://www.mongodb.com/docs/manual/core/schema-validation/specify-json-schema/), [unique indexes](https://www.mongodb.com/docs/manual/core/index-unique/), [Node.js driver](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/).
