# Review FitLife và kiểm thử Postman — 03/11/2026

**Cập nhật 04/11/2026:** Nhánh `thông` đã nhận `web-fe`; ba lỗi API và ba kiểm thử database nêu trong review này đã được xử lý. Xem [kết quả kiểm tra sau khi gộp](MERGE_WEB_FE_THONG_2026-11-04.md). Phần dưới giữ lại kết quả lịch sử trước khi sửa; các thiếu hụt mobile và tính năng mở rộng vẫn còn.

Backend đã có phần lớn API cho website ba vai trò, nhưng dự án chưa hoàn chỉnh: mobile chưa nối backend, Postman mở rộng tái hiện được 3 vấn đề và bộ test database còn 3 test thất bại. Đây là kết quả review; logic nghiệp vụ chưa được sửa trong lượt này.

## Phạm vi và bằng chứng

Đã đối chiếu Express routes, services, middleware, auth, schema/index/reference MongoDB, migration/seed/test; kiểm tra lớp gọi API và các trang của `web/`, luồng auth/storage và các màn hình trong `frontend/`. Database thật trên Atlas và dịch vụ AI bên ngoài không được gọi. Tất cả kiểm thử dữ liệu chạy trên MongoDB replica set tạm 8.2.6, tự dọn sau lượt chạy.

| Kiểm tra thực tế | Kết quả |
|---|---|
| Backend `npm run build` | Đạt kiểm tra cú pháp; backend JavaScript không có bước transpile |
| Backend `npm test` | **87/87 đạt**, không skip |
| Postman CLI, collection cũ | **37 request, 62/62 assertion đạt** |
| Postman CLI, collection review bổ sung | **121 request, 165 assertion: 162 đạt, 3 thất bại** |
| Database `npm test` trong `backend/database/mongodb` | **40 test: 37 đạt, 3 thất bại** |
| Website `npm run build` | Đạt Vite production build |

Collection review chạm đủ **60 cặp HTTP method/path nghiệp vụ**, cộng `GET /` và `GET /health`: tổng **62/62 cặp**. Đây là coverage endpoint, không có nghĩa đã kiểm tra hết mọi tổ hợp dữ liệu, cạnh tranh, role hoặc lỗi mạng. Các assertion có chữ `REGRESSION` kiểm tra hành vi cần có để phơi bày vấn đề; không đổi expected thành hành vi sai để làm xanh bộ test.

Log chạy thực tế nằm trong [validation](validation/). Collection: [review-api.postman_collection.json](../backend/api/review-api.postman_collection.json). Danh sách phủ route: [API_COVERAGE.csv](validation/API_COVERAGE.csv).

## Phát hiện cần ưu tiên

### 1. [P1] Mobile chưa tích hợp backend; dữ liệu tài khoản dùng chung local

Nguồn: `frontend/src/screens/AuthScreen.js:17`, `frontend/src/utils/storage.js:3`, `frontend/src/utils/storage.js:586`, `frontend/App.js:42`.

Màn đăng nhập gọi `loginAccount/registerAccount` từ storage. Hai hàm thao tác danh sách tài khoản local, không gọi `/api/auth`. Các nhật ký, xu, hồ sơ và challenge cũng dùng AsyncStorage với khóa cố định, không có namespace theo `user_id`. Đăng nhập tài khoản khác trên cùng thiết bị vẫn đọc bộ dữ liệu dùng chung; mobile và website không đồng bộ. Đây là thiếu tích hợp, dù API đang chạy đúng ở nhiều luồng.

Hướng xử lý: thêm API client/base URL cho mobile, đăng ký kèm onboarding đúng contract, dùng Bearer session và xử lý hết hạn. Nếu giữ cache/offline, chia khóa theo user, giữ UUID khi retry, thêm hàng đợi đồng bộ và quy tắc xung đột. Guest/demo cần vùng dữ liệu riêng.

### 2. [P1] Mobile lưu và so sánh mật khẩu rõ

Nguồn: `frontend/src/utils/storage.js:596`, `frontend/src/utils/storage.js:632`. `newAcc` chứa `password`, lưu nguyên object bằng AsyncStorage; login so sánh `a.password === password`. UI còn chấp nhận mật khẩu từ 3 ký tự, trong khi backend yêu cầu ít nhất 8.

Không dùng luồng này cho tài khoản thật. Chuyển xác thực về backend; thiết bị chỉ giữ session bằng cơ chế lưu trữ phù hợp. Không giải quyết bằng cách chỉ băm mật khẩu ở client rồi tiếp tục dùng danh sách account local làm nguồn xác thực.

### 3. [P1] Challenge có thể thưởng lại trong cùng ngày sau khi tham gia lượt mới

Nguồn: `backend/services/challenge.service.js:57` và `:59`.

Postman tái hiện: admin tạo challenge hợp lệ `target_days: 1, reward_coins: 30` → member join → checkin hoàn thành, nhận 30 xu → join lại → checkin ngay trong ngày vẫn **HTTP 200**, tiếp tục nhận 30 xu. Assertion cần **409** thất bại.

Nguyên nhân: kiểm tra `last_checkin_date` chỉ trên run có `is_completed: false`; run mới chưa có ngày checkin. Quy tắc tối đa một lần/ngày trong `backend/api/features.md` bị vượt qua giữa hai lượt. Hướng sửa: kiểm tra hoặc khóa theo `(user_id, challenge_id, ngày)` xuyên các lượt, giữ thao tác tiến độ/thưởng trong cùng transaction. Nếu chủ đích cho phép nhận lại trong ngày, cần chốt lại quy tắc kinh tế xu và sửa contract rõ ràng.

### 4. [P2] Đã sở hữu vật phẩm nhưng API báo chưa sở hữu sau 100 giao dịch

Nguồn: `backend/services/reward.service.js:15` và `:17`.

Postman dùng member có một theme cũ và 101 lượt mua voucher sau đó. `GET /api/rewards` trả theme cũ `owned: false`, dù purchase vẫn tồn tại. Assertion `owned === true` thất bại. Lệnh mua lần nữa vẫn có kiểm tra trên toàn bộ purchases nên lỗi tái hiện là trạng thái hiển thị, không phải bằng chứng trừ xu hai lần.

Nguyên nhân: tập `owned` dựng từ 100 purchase mới nhất. Hướng sửa: truy vấn ownership badge/theme riêng trên toàn bộ lịch sử hoặc mô hình inventory; phân trang lịch sử purchases độc lập.

### 5. [P2] Retry tin chat không khôi phục phản hồi

Nguồn: `backend/services/chat.service.js:123`.

Postman gửi tin với `session_id/message_id` cố định; lần đầu có reply. Gửi lại đúng payload trả **200, replayed: true, reply: null**, dù reply đã lưu và đọc được trong lịch sử. Assertion khôi phục reply thất bại. Khi response đầu bị mất, client không thể phục hồi đầy đủ bằng cùng thao tác retry.

Nguồn hiện chưa liên kết reply với message gốc; reply được ghi ngoài transaction lưu tin user. Hướng sửa: thêm trường như `reply_to_message_id` hoặc khóa request cùng trạng thái xử lý, trả lại reply đã lưu, có cơ chế tiếp tục nếu tiến trình dừng giữa hai lần ghi. Phần khôi phục khi tiến trình dừng là rủi ro suy ra từ code, chưa được fault-injection trong lượt này.

### 6. [P2] Bộ test database không đồng bộ với 19 collection nghiệp vụ hiện tại

Ba lỗi thực tế:

| Test | Thất bại và nguyên nhân |
|---|---|
| `test/database.test.js:41` | Kiểm tra mọi collection trừ exercises có dữ liệu; demo seed chưa tạo `trainer_links` và `admin_logs` |
| `test/sample-data.test.js:117` | Mong `trainer_links` có ít nhất 6 bản ghi, trong khi `sample-data.js:12` loại cả trainer_links/admin_logs khỏi cohort sample |
| `test/simplify.test.js:45` | Mong 18 collection nhưng thực tế 20: 19 nghiệp vụ + auth_sessions |

Hai lỗi đầu cần chốt mục tiêu của bộ fixture: chỉ kiểm tra collection chủ đích seed hoặc bổ sung dữ liệu consent/admin đúng nghiệp vụ. Không tự tạo nhật ký admin giả chỉ để đạt số lượng. Lỗi cuối cần cập nhật expectation theo schema. Các lỗi này không chứng minh dữ liệu Atlas bị hỏng.

## API/chức năng còn thiếu

Phân biệt phần cần để hoàn tất luồng hiện có với phần mở rộng tùy phạm vi đồ án:

| Nhóm | Hiện trạng | Cần làm tiếp |
|---|---|---|
| Mobile ↔ backend | Chưa có API adapter cho luồng chính | Ưu tiên số 1: auth, profile, logs, quest, coins, shop, challenge và chat dùng nguồn server |
| Khôi phục tài khoản | Routes auth hiện chỉ register/login/me/logout | Nếu dùng tài khoản thật: đổi mật khẩu, quên/reset mật khẩu; xác minh email theo yêu cầu |
| Dữ liệu người dùng | Chưa có endpoint xóa tài khoản/xuất dữ liệu | Bổ sung nếu thuộc yêu cầu sản phẩm; xác định cách xử lý log/links/chat/purchases |
| Shop | Có catalog + purchase và số xu | Chưa có trang bị theme/badge hoặc đổi trạng thái voucher đã sử dụng; cần contract và schema nếu UI hứa chức năng này |
| Chat | Gửi tin, danh sách session, đọc messages | Retry đầy đủ; thiếu xóa/đổi tên session và cursor phân trang; giới hạn tần suất gọi mô hình khi triển khai AI thật |
| Water/workout | Có đọc và thêm | Chưa có sửa/xóa. Chỉ cần bổ sung nếu UI cho phép, và phải định nghĩa hoàn tác quest/xu/mục tiêu nước |
| Thư viện bài tập | exercises độc lập; template/log chỉ lưu tên, thời lượng, calo | Nếu cần giáo án nhiều động tác: quan hệ template–exercise, thứ tự/sets/reps/rest và workout chi tiết |
| Đồng bộ offline | Client tạo UUID được ở web; mobile đang local | Chưa có queue/policy đồng bộ; API tạo log hiện gắn ngày server, chưa hỗ trợ backfill ngày offline |
| Nghiệm thu và triển khai | Có test API/database, Postman smoke và health check | Cần xử lý 3 test DB lỗi, mở rộng smoke docs; chưa thấy CI workflow, OpenAPI hay cấu hình container trong repo |

Các nhóm đã có API gồm auth/profile, water/workout/meal, exercises, quests/checkin, sleep/mood/BMI, challenges, rewards, stats, AI chat, coaching, trainer và admin. Không cần viết lại backend từ đầu.

Tài liệu cũng đang lệch: `backend/api/README.md` gọi bộ 37 request là “tất cả API”, `ROLE_CONTRACT.md` còn mô tả nghiệp vụ chưa triển khai và số collection cũ, `FRONTEND_UI_TODO.md` nói chưa có website trainer/admin trong khi `web/` đã có hai khu này. Khi chốt backend nên cập nhật các tài liệu gốc.

## Chạy lại

```powershell
cd "C:\hoc tap\FitlifeMoblie\backend"
npm ci
npm run build
npm test
npm run test:postman
npm run test:postman:review

cd database\mongodb
npm test
```

`test:postman:review` cần Postman CLI và devDependencies backend. Runner tự tạo trainer/admin/member trong MongoDB tạm; không đọc `.env`, không cấp quyền trên Atlas. Có thể chỉ định executable bằng `FITLIFE_POSTMAN_CLI`. Collection review không phải bộ import-and-run trên database thật vì cần fixture riêng. Postman CLI chạy và xuất log local; không đăng nhập/publish kết quả lên Postman Cloud. Với mã nguồn hiện tại, ba regression assertion và ba test DB nêu trên vẫn thất bại.

## ERD sau review/test

[Mở bộ ERD](erd/index.html) · [Sơ đồ toàn bộ SVG](erd/fitlife-full.svg) · [Mermaid toàn bộ](erd/fitlife-full.mmd) · [Từ điển dữ liệu/index](erd/DATA_DICTIONARY.md).

ERD phản ánh mã nguồn hiện có, không trộn các bảng đề xuất. Tổng cộng **19 collection nghiệp vụ + auth_sessions**. PK trong hình là khóa nghiệp vụ unique; `_id` vẫn là khóa MongoDB. FK là tham chiếu logic do service/kiểm tra database quản lý, không phải foreign key tự cưỡng chế. `admin_logs.target_id` là tham chiếu đa hình theo target_type, chỉ thể hiện bằng field, không ép thành một FK duy nhất.

Các thiếu hụt như inventory/equip, reply_to_message_id hay template_exercises được mô tả ở review, chưa được vẽ thành collection đã tồn tại.
