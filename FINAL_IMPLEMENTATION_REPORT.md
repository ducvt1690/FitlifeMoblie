> Cập nhật05/11: chức năng đổi quà đã gỡ theo yêu cầu mới; số liệu kiểm thử và kiểm tra App/Web mới nhất xem output/APP_WEB_PARITY.md. VNPay ngoài hệ thống còn thiếu merchant sandbox.

# FitLife — Báo cáo triển khai và kiểm chứng

Ngày: **05/11/2026, Asia/Saigon**. Mã được sửa tại repository hiện có trên branch `fix_new`; không commit/push, không xóa thay đổi có sẵn.

## A. Tổng quan

Đã triển khai các nghiệp vụ Trainer/Admin và đồng bộ qua Express API hiện tại, Web React/Vite độc lập và Expo Mobile. Đã chạy API với MongoDB thật, Postman, Web Playwright có đối chiếu persistence và Android Expo Go trên emulator API36. Không tạo backend thứ hai hoặc dùng dữ liệu frontend giả thay API.

Các mảng đã có được kế thừa: auth/email OTP, hồ sơ, workout/exercise catalog, workout plans, nutrition, nhật ký sức khỏe, quest/Coin, challenge/reward, VNPay, AI Coach. Web bổ sung giao diện các luồng tương ứng bên cạnh Trainer/Admin.

Giới hạn bàn giao: chưa kiểm chứng giao dịch VNPay qua nhà cung cấp bên ngoài, giao email Gmail thực, runtime iOS và điện thoại vật lý qua Wi-Fi. Các câu hỏi về lịch/deadline, Student từ chối bài, chuyển giao Student, mở rộng consent sức khỏe nằm trong BUSINESS_DECISIONS.md; không tạo chính sách mới để lấp chỗ trống.

## B. Backend

- Hiện có **103 endpoint nghiệp vụ** trong Express registry; chi tiết ở API_INVENTORY.md, có script sinh lại từ router thực tế.
- Template sửa đủ tên/hướng dẫn/nhóm/thời lượng/calo/độ khó; assignment dùng snapshot tại lúc giao. Legacy assignment được đóng băng transaction trước lần sửa template đầu tiên.
- Xóa template chưa có lịch sử; archive template có lịch sử. Role Trainer bị thu hồi thì template active được archive, không bật lại khi cấp lại role.
- Assignment UUID do client giữ cho retry; cùng ID không tạo record thứ hai, khác payload trả409. Client cũ không gửi ID vẫn tương thích nhưng không có bảo đảm nhận diện retry đó.
- Cancel riêng một bài cần lý do, lưu thời điểm/actor/status_history. Bài đã hủy không được done. Disconnect kết thúc consent, hủy bài chờ, chặn giao mới; không xóa lịch sử.
- Invitation list/expiry/revoke; students trả link_id; search/filter/page_size/page/allowlisted sort; progress/feedback dựa trên dữ liệu assignment thật.
- Admin challenge/reward CRUD, detail/search/pagination; payment/redemption/log filters/detail; không có API Admin tự đổi trạng thái paid.
- Doanh thu tính tại Backend theo payment_orders đã paid và paid_at; Premium tách Coin, có đơn vị VND/công thức/khoảng thời gian/số đơn. Refund/cancellation payment chưa có mô hình nghiệp vụ; không giả lập số hoàn tiền.
- Role transition cần lý do không rỗng ở Backend; audit lưu người thực hiện/đích/role trước-sau/thời điểm/lý do. Revoke role kết thúc active/pending consent, hủy pending assignment, revoke session và ghi log trong transaction. CLI bootstrap role cũng giữ các bất biến này.
- Temporary lock giữ quan hệ theo quy tắc cũ, thu hồi session/chặn truy cập; chưa tự thêm chính sách kết thúc quan hệ khi khóa tạm.
- Sửa race redeem reward khi Admin ngừng bán bằng write-lock catalog trong transaction.
- Sửa AI diagnostic thiếu export và side effect gọi provider khi import; test không còn tự gọi nhà cung cấp AI.

### API bổ sung/sửa tiêu biểu

`PATCH/DELETE /api/trainer/templates/:id`, `POST /api/trainer/assignments/:id/cancel`, `POST /api/trainer/assignments/:id/feedback`, `GET /api/trainer/students/:id/progress`, `GET /api/trainer/invites`, `POST /api/trainer/invites/:id/revoke`, `GET /api/admin/revenue`, detail endpoints của challenge/reward/payment/transaction/log. Các danh sách, role change, reward purchase và endpoint metadata được cập nhật tại chỗ.

### Database / migration đã thực hiện

Đã chạy dry-run trên Atlas cấu hình, phát hiện audit target enum rộng hơn schema local; giữ lại các giá trị đang hỗ trợ. Đã kiểm thử migration additive và tình huống schema drift trước khi apply.

Chỉ thực hiện **hai `collMod` validator** cho `trainer_assignments` và `admin_logs`. Không sửa document hoặc index. Assignment **9 → 9**, audit **5 → 5**, BSON EJSON SHA-256 và index trước/sau trùng nhau. Backup và kết quả:

- `output/fullstack-atlas-validator-backup.json`
- `output/fullstack-atlas-migration-plan.json`
- `output/fullstack-atlas-migration-result.json` (`verified:true`)

Chín assignment cũ chưa có snapshot được giữ nguyên; source template hiện tồn tại. Không thể phục hồi nội dung template đã bị thay đổi trước khi có snapshot nếu không có nguồn phiên bản cũ. Migration lặp lại là no-op; schema drift khác bị chặn.

Đã sửa maintenance simplify để giữ các field snapshot hiện đã thuộc schema và giữ collection xác minh email. Test rollback/preservation của maintenance chạy lại thành công.

## C. Web

Project độc lập `web/`, package/lock/routing/API client riêng; dùng chung Backend. Có protected role routes, sessionStorage, xử lý401/403, refresh session khi focus, responsive navigation, modal xác nhận, form validation, loading/error/empty/success và pagination.

Khu vực: login/register OTP/forgot, Trainer dashboard/students/templates/assignments/invites/progress-feedback, Admin dashboard/accounts/challenges/rewards/payments/redemptions/logs/revenue, Member inbox/workouts/progress/challenges/rewards/Premium/profile/nutrition/Coach/wellbeing/exercise catalog/guided plans/BMI.

Giá, số dư, doanh thu, mục tiêu sức khỏe, danh mục và tiến độ lấy từ Backend. `web/README.md` hướng dẫn đầy đủ; `output/web-verification.md` lưu kiểm chứng bổ sung và đồng bộ native → Web. Screenshot desktop/390px trong `output/playwright/`.

## D. Mobile Expo

Giữ Expo Router/React Native và component/theme có sẵn. Hoàn thiện Trainer management, member assignment inbox và Admin operations/catalog/ledger/log/revenue; form dữ liệu đầy đủ thay giá trị cố định. Call authenticated dùng chung xử lý401, refreshUser và foreground revalidation; session bị thu hồi được xóa và có thông báo.

Đã sửa sáu lệch phiên bản dependency theo Expo, doctor20/20 và export Android/iOS/Web thành công. Có runner native tái lập `frontend/scripts/mobile-ui.js` và `frontend/scripts/start-integration.js`. Chi tiết/screenshot: `output/mobile-verification.md`, `output/mobile-native-test-result.json`.

## E. Testing thực tế

| Bộ kiểm tra | Đạt | Lỗi cuối | Bằng chứng |
|---|---:|---:|---|
| Backend node:test, gồm HTTP/DB/race/auth | 365 | 0 | output/fullstack-final-backend-tests.txt |
| MongoDB schema/migration/sample/maintenance | 40 | 0 | output/fullstack-final-database-tests.txt |
| Postman collection có sẵn | 46 request / 73 assertion | 0 | output/fullstack-postman-tests.txt |
| Postman Trainer/Admin mới | 68 request / 75 assertion | 0 | output/fullstack-platform-postman.txt |
| Web Playwright toàn bộ | 11 | 0 | output/fullstack-web-e2e.txt; output/playwright/fullstack-results.json |
| Android native | 14 | 0 (0 blocked) | output/mobile-native-test-result.json |
| Expo Doctor / package compatibility | 20/20 / pass | 0 | output/mobile-verification.md |
| Backend syntax + Web production build | pass | 0 | output/fullstack-final-build.txt |
| Configured Atlas startup + CORS5173 | pass | 0 | output/fullstack-configured-startup.json |

Không cộng request, assertion và test case thành một con số gây nhầm lẫn. Backend365 bao gồm182 kiểm tra ranh giới auth/role và17 platform regression; không cộng lại các lượt chạy tập trung/trùng lặp.

Các ca quan trọng đã chạy: khác Trainer bị chặn; disconnect không giao mới; cancelled không done; concurrent retry có một record; revoke token401; revoke Trainer không còn active consent/pending exercise; regrant cần consent mới; user không vào Admin; Premium không cộng Coin; reward ngừng bán không redeem. Kiểm tra Web tạo dữ liệu qua giao diện rồi đọc MongoDB để xác minh; không mock network response. Native kiểm tra thao tác và persistence trên Android Expo Go.

Lỗi nền đã sửa: AI check5 ca fail, database simplify3 ca fail, mismatch API sort/full_name Web, checkbox guided plan, modal lifecycle và dependency Expo. Lượt UI lặp nhiều lần chạm429 login limiter; đã reset riêng database/API kiểm thử và chạy lại, giữ nguyên limiter sản phẩm. Không bỏ test để có kết quả xanh.

Phạm vi chưa chứng minh: mọi tổ hợp negative/boundary cho từng endpoint; mọi thao tác native trên mọi thiết bị; runtime iOS/Chrome/Firefox; thanh toán/provider mail bên ngoài. Hai Postman collection có request cho **50/103 endpoint**; bộ HTTP/DB bổ sung coverage, không gọi đó là Postman coverage100%.

Dependency audit Mobile còn **7 cảnh báo moderate, 0 high/critical** trong công cụ Expo/tunnel và dependency gián tiếp; không force downgrade phá SDK để làm sạch báo cáo. Chi tiết `output/mobile-dependency-audit.json`. Web audit tại lúc triển khai không có cảnh báo. Đây là giới hạn chất lượng cần theo dõi, không bị ẩn khỏi log.

## F. Cách chạy

Từ thư mục repository:

```powershell
npm --prefix backend ci
npm --prefix web ci
npm --prefix frontend ci
npm run dev:all
```

`dev:all` dùng database cấu hình sẵn, chạy API **http://localhost:5000**, Web **http://localhost:5173**, Expo **:8081**. Dừng service cũ dùng cùng cổng trước khi chạy launcher mới. Lệnh riêng:

```powershell
npm --prefix backend start
npm --prefix web run dev -- --host 0.0.0.0 --port 5173 --strictPort
npm --prefix frontend start -- --port 8081 --lan
```

Web `VITE_API_URL`, Mobile `EXPO_PUBLIC_API_URL` trỏ cùng API; khi dùng launcher, có thể đặt:

```powershell
$env:FITLIFE_CLIENT_API_URL='http://<IP-LAN-máy-tính>:5000'
npm run dev:all
```

Điện thoại cùng Wi-Fi quét QR Expo, cho phép cổng API/Metro qua firewall. Chưa tuyên bố đã kiểm chứng điện thoại vật lý; Android emulator đã kiểm chứng bằng adb reverse.

### Tái lập bộ tích hợp an toàn

```powershell
npm run dev:integration
npm run check:integration
npm run test:platform
npm --prefix web run test:e2e
```

Harness dùng chính Express API :5500 + MongoDB replica set riêng, Web :5173, Expo :8081. Accounts fixture sinh ngẫu nhiên trong `output/integration-runtime.local.json` (Git ignore); không đưa fixture lên Atlas. Test catalog lấy từ danh mục ExerciseDB có sẵn, không dùng số liệu dashboard giả. Chạy Postman một lượt rồi Web; nếu lặp quá nhiều trong rate window, reset harness test trước lượt mới thay vì tăng limiter sản phẩm.

Harness đã được reset trước lượt xác nhận cuối để chạy với source Backend cuối và rate window mới. Screenshot/proof native → Web ghi nhận trước reset vẫn là bằng chứng lượt đã chạy; các fixture từ lượt trước không được coi là dữ liệu bền vững của phiên test hiện tại.

Emulator:

```powershell
adb reverse tcp:5500 tcp:5500
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d exp://127.0.0.1:8081
```

Nếu khởi chạy Metro riêng cho harness, dùng `npm --prefix frontend run start:integration`. Test native đọc metadata hiện tại; xem lệnh từng luồng trong mobile-verification.md. Playwright mặc định dùng Edge đã cài, có thể đổi `PLAYWRIGHT_CHANNEL`.

Migration kiểm tra: `npm --prefix backend/database/mongodb run db:fitness:plan`; apply: `npm --prefix backend/database/mongodb run db:fitness:apply`. Không init/seed/drop dữ liệu thật để chạy test.

Trong lượt kiểm thử bàn giao ban đầu, Web/Metro trỏ API test5500. **Cập nhật sau lỗi SMTP ngày05/11/2026:** cấu hình local của Web và Mobile đã chuyển về API chính `http://127.0.0.1:5000` dùng Atlas và SMTP thật. Kết nối/xác thực SMTP đã kiểm tra thành công, chưa gửi email thử;11 kiểm tra xác minh email pass. Bằng chứng tại `output/smtp-runtime-verification.json`. API5500 là harness dùng riêng cho test và không cấu hình gửi email thật; không dùng nó để đăng ký tài khoản sử dụng lâu dài. Các health script chỉ chứng minh service có phản hồi; chứng cứ đồng bộ dữ liệu là Web E2E/native và `output/web-native-sync-result.json`.

## G. Trạng thái backlog và phần chưa kiểm chứng

TR-01…TR-10, AD-01…AD-06, CH-01…CH-03: **DONE trong phạm vi triển khai và các luồng tích hợp local đã kiểm chứng**, xem FEATURE_MATRIX.md cho từng ID/bằng chứng. Chưa tuyên bố đạt DoD sản xuất tuyệt đối vì các phạm vi external/thiết bị và coverage nêu ở phần E vẫn UNVERIFIED. Không có API/build blocker còn tái hiện trong các bộ kiểm tra cuối đã ghi nhận.
