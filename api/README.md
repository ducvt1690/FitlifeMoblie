# 🌐 FitLife Pro — Đặc tả RESTful API (API Module)

Thư mục `api/` chứa toàn bộ các bộ định tuyến (Routes/Controllers) cho hệ thống RESTful API của dự án **FitLife Pro** cũng như tệp kịch bản kiểm thử Postman.

- **Base URL**: `http://localhost:5000/api`
- **Định dạng dữ liệu**: `application/json`

---

## 📁 Cấu trúc thư mục `api/`

| Tệp tin | Nhóm Endpoint | Chức năng chính |
| :--- | :--- | :--- |
| [`index.js`](./index.js) | `/api/*` | Bộ định tuyến trung tâm gom nhóm toàn bộ các module API. |
| [`auth.routes.js`](./auth.routes.js) | `/api/auth/*` | Đăng ký, Đăng nhập, Đặt lại mật khẩu, Quản lý danh sách hội viên. |
| [`health.routes.js`](./health.routes.js) | `/api/health/*` | Tổng quan sức khỏe ngày, ghi nhận Nước uống, Bài tập, Bữa ăn & Proxy ExerciseDB API. |
| [`ai.routes.js`](./ai.routes.js) | `/api/ai/*` | Xử lý hội thoại thông minh cho Trợ lý AI FitLife Coach. |
| [`shop.routes.js`](./shop.routes.js) | `/api/shop/*` | Lấy danh sách quà tặng và thực hiện giao dịch đổi FitCoins. |
| [`postman_collection.json`](./postman_collection.json) | Postman v2.1 | File import trực tiếp vào Postman để kiểm thử toàn bộ API. |

---

## 📋 Danh sách Chi tiết các Endpoint

### 1. Xác thực & Tài khoản (`/api/auth`)
- `POST /api/auth/register` — Tạo tài khoản hội viên mới (`{ name, email, password }`).
- `POST /api/auth/login` — Đăng nhập xác thực tài khoản (`{ email, password }`).
- `POST /api/auth/reset-password` — Khôi phục/Đặt lại mật khẩu mới (`{ email, newPassword }`).
- `GET /api/auth/users` — Lấy danh sách hội viên đã đăng ký.

### 2. Chỉ số Sức khỏe & Tập luyện (`/api/health`)
- `GET /api/health/summary?userId=<id>` — Tổng hợp lượng nước, calo tiêu hao, calo nạp vào trong ngày.
- `POST /api/health/water` — Ghi nhận lần uống nước mới (`{ userId, amount }`).
- `POST /api/health/workout` — Ghi nhận hoàn thành bài tập (`{ userId, title, calories, duration }`).
- `POST /api/health/meal` — Ghi nhận bữa ăn dinh dưỡng (`{ userId, mealName, calories, protein, carbs, fat }`).
- `GET /api/health/exercises?limit=25&search=<keyword>` — Truy vấn kho 1,500+ bài tập kèm ảnh động GIF từ ExerciseDB API.

### 3. Trợ lý AI FitLife Coach (`/api/ai`)
- `POST /api/ai/chat` — Tư vấn thực đơn, tính calo món Việt và gợi ý bài tập (`{ question, profile }`).

### 4. Cửa hàng Đổi Xu (`/api/shop`)
- `GET /api/shop/items` — Lấy danh sách huy hiệu và vật phẩm trong cửa hàng.
- `POST /api/shop/buy` — Đổi vật phẩm bằng FitCoins (`{ userId, itemId }`).
