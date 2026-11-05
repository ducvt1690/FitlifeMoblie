# FitLife Web

Frontend React + Vite độc lập, dùng cùng Express API với Expo. Không có Backend hay dữ liệu nghiệp vụ riêng trong Web.

```powershell
npm --prefix web ci
Copy-Item web/.env.example web/.env
# Sửa VITE_API_URL nếu Backend không ở http://localhost:5000
npm --prefix web run dev
```

Truy cập `http://localhost:5173`. Cấu hình `CORS_ORIGINS` của Backend phải cho phép origin này. Đổi `VITE_API_URL` cần khởi động lại Vite. Build sản xuất: `npm --prefix web run build`; thư mục kết quả `web/dist`. Khi triển khai, máy chủ static cần fallback mọi URL ứng dụng về `index.html` và Backend cần cho phép origin HTTPS tương ứng.

| Khu vực | Đường dẫn | Chức năng |
| --- | --- | --- |
| Xác thực | `/login`, `/register`, `/forgot` | Đăng nhập, đăng ký qua OTP email, đặt lại mật khẩu |
| Thành viên | `/member` | Dashboard từ thống kê thực tế |
| Bài được giao | `/member/assignments` | Consent mã mời, nhận bài, tự báo hoàn thành, xem ghi chú/phản hồi, ngắt kết nối |
| Thư viện | `/member/exercises` | Tìm bài tập, lọc vùng cơ/dụng cụ, phân trang cursor, chi tiết và hướng dẫn thật |
| Giáo án | `/member/plans` | Lựa chọn lịch tập từ API, tạo lịch, đánh dấu từng bài, hoàn thành và ghi nhận nhật ký |
| BMI | `/member/bmi` | Chỉ số do Backend tính, lịch sử tối đa 365 bản ghi, cập nhật một bản ghi mỗi ngày |
| Hoạt động | `/member/workouts`, `/member/progress` | Nhật ký tập luyện, tiến độ và thống kê lịch sử |
| Sức khỏe | `/member/wellbeing` | Nước uống, bước chân, giấc ngủ, tâm trạng, nhiệm vụ hằng ngày |
| Dinh dưỡng | `/member/nutrition` | Nhật ký bữa ăn, chỉnh sửa/xóa, phân tích món ăn, dị ứng, gợi ý bữa ăn |
| AI Coach | `/member/coach` | Lịch sử hội thoại, gửi tin nhắn, xóa hội thoại/ghi nhớ |
| Thử thách | `/member/challenges` | Tham gia, check-in, rời thử thách |
| Thanh toán | `/member/premium` | Gói Premium/Coin từ API, tạo đơn VNPay, lịch sử thanh toán |
| Trainer | `/trainer` | Tổng số học viên, mẫu bài tập và bài đã giao |
| Học viên | `/trainer/students` | Tìm kiếm, phân trang, tiến độ, ngắt kết nối riêng học viên |
| Mẫu bài tập | `/trainer/templates` | Tạo/sửa đủ trường, xóa hoặc lưu trữ theo lịch sử |
| Bài giao | `/trainer/assignments` | Giao bài với UUID ổn định khi retry, ghi chú, hủy kèm lý do, phản hồi |
| Consent | `/trainer/invites` | Tạo mã, danh sách, thời hạn, trạng thái, thu hồi mã |
| Coaching | `/trainer/progress` | Tiến độ của học viên đang đồng ý kết nối |
| Admin | `/admin` | Tổng quan từ Backend |
| Quản lý | `/admin/accounts`, `/admin/challenges` | Quyền/lý do, khóa tài khoản, CRUD danh mục với xác nhận ngừng hoạt động |
| Giao dịch | `/admin/payments` | Tra cứu, lọc, phân trang, chi tiết; không chỉnh sửa trạng thái thanh toán |
| Kiểm toán | `/admin/logs` | Hành động, tài khoản đích, thời gian, quyền trước/sau, lý do |
| Doanh thu | `/admin/revenue` | Tách Premium/Coin/khác, công thức, kỳ, VND, số giao dịch hợp lệ và bị loại |
| Hồ sơ | `/{member,trainer,admin}/profile` | Hồ sơ, mật khẩu, đăng xuất tất cả thiết bị |

Token chỉ lưu trong `sessionStorage` của tab hiện tại; tài khoản không lưu trong localStorage. Mọi request bị 401 xóa phiên và chuyển về đăng nhập. Ứng dụng kiểm tra phiên khi lấy lại focus và mỗi phút để phản ánh thu hồi quyền, hết hạn hoặc khóa tài khoản. Không có refresh token vì Backend hiện dùng phiên opaque do MongoDB quản lý.

Mọi màn lấy dữ liệu có loading/error/empty, retry và phản hồi kết quả. Tìm kiếm/phân trang/lọc nằm trong URL. Phân quyền giao diện và protected routes chỉ bổ sung cho kiểm tra quyền bắt buộc tại Backend.

SMTP thật cần được cấu hình để đăng ký/đặt lại mật khẩu. VNPay cần cấu hình Backend để tạo đơn thực tế. Web hiển thị lỗi cấu hình từ API, không thay bằng dữ liệu giả.

Kiểm thử browser: `npm --prefix web run test:e2e` (cấu hình và fixture tích hợp trong `web/playwright.config.js và web/e2e/`, xem báo cáo kiểm thử ở thư mục gốc). Build đã chạy thành công. Hallmark static lint: 0 FAIL, 0 WARN; render riêng của skill không chạy do thiếu `puppeteer-core`, không được coi là đã kiểm chứng hiển thị.

Kiểm chứng riêng tác vụ Web: 4/4 tests trong `web/e2e/training.spec.js` đã chạy thành công, gồm catalog cursor, giáo án, BMI và điều hướng 390px. Smoke sau native integration: `npm --prefix web run test:native-sync` (cần database tạm và artifact native cùng lần chạy). Xem `output/web-verification.md`.

Kiểm thử tài khoản Atlas là tùy chọn: đặt `FITLIFE_TEST_ATLAS=1` và cung cấp file credentials local đã Git-ignore trước khi chạy `atlas-role-accounts.spec.js`. Mặc định bộ kiểm thử không truy cập các tài khoản Atlas này.

Chế độ thanh toán giả lập: `PAYMENT_SIMULATION=1` ở Backend cho phép thử thành công/thất bại; quyền lợi cập nhật và giao dịch được gắn nhãn, loại khỏi doanh thu thật. Tính năng đổi quà đã được gỡ theo yêu cầu.
