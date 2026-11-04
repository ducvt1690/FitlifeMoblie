# ⚡ FitLife Pro — Ứng dụng Quản lý Thể hình & Dinh dưỡng Thông minh (`projectMMA`)

Dự án **FitLife Pro** được thiết kế và phân chia theo kiến trúc 4 phân hệ độc lập, rõ ràng phục vụ phát triển, kiểm thử và báo cáo môn học:

1. 📁 **[`frontend/`](./frontend)** — Giao diện người dùng Đa nền tảng (Mobile iOS/Android & Web Studio) xây dựng bằng **React Native (Expo SDK 58)**.
2. 📁 **[`backend/`](./backend)** — Máy chủ vận hành **Node.js / Express**, quản lý cấu hình hệ thống, CORS, Middlewares và cổng kết nối (`Port 5000`).
3. 📁 **[`api/`](./api)** — Hệ thống **RESTful API** (`Auth`, `Health`, `Workout/ExerciseDB`, `AI Coach`, `Shop`) kèm bộ sưu tập kiểm thử **Postman Collection**.
4. 📁 **[`database/`](./database)** — Hệ thống **Cơ sở dữ liệu** gồm lược đồ chuẩn SQL ([`schema.sql`](./database/schema.sql)), dữ liệu mẫu ([`seed.sql`](./database/seed.sql)), module kết nối ([`db.js`](./database/db.js)) và sơ đồ ERD.

---

## 🗂️ Cấu trúc Thư mục Tổng thể

```text
projectMMA/
├── 📁 frontend/                    # [1. FE] Giao diện Mobile & Web (React Native / Expo)
│   ├── App.js                      # Khung điều hướng chính & Web Studio Frame
│   ├── src/
│   │   ├── components/             # Các thành phần UI (WaveformCard, MetricCard, ExerciseVisual...)
│   │   ├── constants/              # Hệ thống màu sắc, Typography (theme.js) & Dữ liệu mẫu
│   │   ├── screens/                # 12 Màn hình chức năng chính (Auth, Home, Workout, Quest...)
│   │   └── utils/                  # Tầng dịch vụ (storage.js, exerciseApi.js, aiService.js, hash.js)
│   └── package.json
│
├── 📁 backend/                     # [2. BE] Máy chủ Express Server
│   ├── server.js                   # Điểm khởi chạy Server (Port 5000) kết nối vào /api & /database
│   ├── .env.example                # Cấu hình biến môi trường mẫu
│   └── package.json
│
├── 📁 api/                         # [3. API] Tầng định tuyến RESTful API & Kiểm thử
│   ├── index.js                    # Bộ gom nhóm toàn bộ Router API
│   ├── auth.routes.js              # API Đăng ký, Đăng nhập, Đặt lại mật khẩu
│   ├── health.routes.js            # API Sức khỏe, Nước uống, Bài tập, Bữa ăn & ExerciseDB Proxy
│   ├── ai.routes.js                # API Trợ lý AI FitLife Coach
│   ├── shop.routes.js              # API Cửa hàng đổi thưởng FitCoins
│   ├── postman_collection.json     # File import Postman để test toàn bộ API
│   └── README.md                   # Tài liệu đặc tả chi tiết các Endpoint API
│
├── 📁 database/                    # [4. DATABASE] Tầng Cơ sở dữ liệu & Lưu trữ
│   ├── schema.sql                  # Lược đồ tạo 10 bảng CSDL quan hệ chuẩn SQL (DDL)
│   ├── seed.sql                    # Dữ liệu khởi tạo mẫu chuẩn SQL (DML)
│   ├── db.js                       # Module kết nối & đọc/ghi dữ liệu bền vững
│   ├── fitlife_db.json             # Tệp lưu trữ dữ liệu JSON thực thi
│   └── README.md                   # Sơ đồ quan hệ thực thể (ERD) & Đặc tả các bảng
│
├── 📄 FitLife_Luong_Hoat_Dong_App.docx  # Tài liệu đặc tả các luồng hoạt động của ứng dụng
└── 📄 package.json                 # Cấu hình chạy nhanh toàn dự án (Monorepo scripts)
```

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### 1. Khởi chạy Backend & API Server (`Port 5000`)
```powershell
cd backend
npm install
npm start
```
👉 Server hoạt động tại: **`http://localhost:5000`**

### 2. Khởi chạy Frontend App (`Port 8081`)
```powershell
cd frontend
npm install
npx expo start --web
```
👉 Ứng dụng Web mở tại: **`http://localhost:8081`** *(hoặc dùng ứng dụng **Expo Go** trên điện thoại để quét mã QR).*
