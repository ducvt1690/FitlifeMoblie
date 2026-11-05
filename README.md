# FitLife — BE_ALL

Backend REST API của FitLife: **Node.js + Express**, dữ liệu lưu trên **MongoDB Atlas**. Cùng một API phục vụ app mobile (nhánh `FE_Mobile`) và website (nhánh `web-fe`).

## Cài đặt và chạy

```powershell
npm --prefix backend ci
copy backend\.env.example backend\.env   # rồi điền MONGODB_URI thật
npm start                                # http://localhost:5000
npm test                                 # chạy toàn bộ test
```

Biến môi trường (xem `backend/.env.example`):

| Biến | Ý nghĩa |
| --- | --- |
| `MONGODB_URI` | Chuỗi kết nối Atlas. Không commit giá trị thật. |
| `MONGODB_DB_NAME` | Luôn là `fitlife`. |
| `PORT` | Cổng server, mặc định 5000. |
| `AUTH_SESSION_TTL_SECONDS` | Thời hạn phiên đăng nhập. |
| `CORS_ORIGINS` | Các origin web được phép gọi API, cách nhau bằng dấu phẩy. |
| `ANTHROPIC_API_KEY` | Tùy chọn. Bỏ trống thì AI Coach trả lời theo quy tắc dựa trên nhật ký. |

## Vai trò

- **user**: thành viên, đăng ký mặc định.
- **trainer**: huấn luyện viên, chỉ xem dữ liệu học viên đã đồng ý qua mã mời và đang có bài được giao.
- **admin**: quản lý tài khoản, thử thách, vật phẩm, giao dịch; mọi thao tác được ghi nhật ký.

Tạo admin đầu tiên: đăng ký tài khoản bình thường rồi chạy

```powershell
npm run role -- email@cua-ban.com admin
```

Sau đó admin cấp quyền huấn luyện viên ngay trong ứng dụng.

## Web và Mobile cùng Backend

Web riêng ở `web/` (React + Vite), Mobile ở `frontend/` (Expo Router). Cài `npm --prefix web ci` và `npm --prefix frontend ci`, sau đó `npm run dev:all` khởi chạy API :5000, Web :5173 và Expo :8081 cùng lúc. Dừng các tiến trình cũ dùng cùng cổng trước khi khởi chạy lại. Với điện thoại cùng Wi-Fi, đặt `FITLIFE_CLIENT_API_URL=http://<IP-LAN-máy-tính>:5000` trước lệnh trên. Các biến cấu hình có ví dụ trong từng project.

`npm run dev:integration` dùng đúng Express API trên :5500 với MongoDB replica set dùng riêng cho kiểm thử. Không chèn fixture lên Atlas. Thông tin đăng nhập test sinh ngẫu nhiên được lưu cục bộ tại `output/integration-runtime.local.json` (Git ignore), mất hiệu lực khi dừng database test. Dùng `npm run check:integration`, `npm run test:platform` và `npm --prefix web run test:e2e` để kiểm tra lại. Emulator Android cần `adb reverse tcp:5500 tcp:5500` và `adb reverse tcp:8081 tcp:8081`, sau đó mở Expo Go tại `exp://127.0.0.1:8081`.

Để đăng ký bằng email thật, dùng API chính :5000 với SMTP trong `backend/.env`; harness :5500 không gửi email thật. Web dùng `VITE_API_URL`, Mobile dùng `EXPO_PUBLIC_API_URL`. SMTP là cấu hình Backend dùng chung cho cả hai; không đặt mật khẩu SMTP trong frontend. Lượt cập nhật05/11 đã kiểm tra xác thực SMTP thành công và chuyển cấu hình local Web/Mobile về :5000.

Migration validator Fitness được kiểm tra bằng `npm --prefix backend/database/mongodb run db:fitness:plan`; chỉ áp dụng sau khi xem plan và kiểm tra tương thích. Báo cáo bàn giao, bằng chứng test và giới hạn nằm trong [FINAL_IMPLEMENTATION_REPORT.md](FINAL_IMPLEMENTATION_REPORT.md).

## Tài liệu

- [backend/README.md](backend/README.md): cấu trúc service và danh sách API.
- [backend/api/](backend/api/): tài liệu từng nhóm API và Postman collection.
- [backend/database/](backend/database/): schema, migration, dữ liệu mẫu MongoDB.

## Thanh toán giả lập

Để thử các gói khi chưa có merchant VNPay, đặt `PAYMENT_SIMULATION=1` trong `backend/.env` và restart Backend. Web/App hiển thị nút chọn thành công/thất bại; quyền lợi được cấp đúng một lần. Các đơn giả lập được gắn nhãn và loại khỏi doanh thu. Chế độ này bị chặn trong production. Xem `output/PAYMENT_SIMULATION.md`.
