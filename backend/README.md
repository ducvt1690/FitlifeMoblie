# FitLife Health & MMA - Backend API Server

Mã nguồn Backend phục vụ phân hệ xác thực, đồng bộ dữ liệu sức khỏe, trợ lý AI và cửa hàng đổi thưởng cho dự án **FitLife (projectMMA)**.

---

## 1. Cài đặt và Khởi chạy

```bash
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Cài đặt các thư viện cần thiết
npm install

# 3. Chạy server ở chế độ phát triển
npm run dev
# hoặc
npm start
```

Server sẽ khởi chạy tại: `http://localhost:5000`

---

## 2. Danh sách các RESTful API Endpoints

### 🔐 Authentication (`/api/auth`)
* `POST /api/auth/register`: Đăng ký tài khoản mới (Body: `name`, `email`, `password`)
* `POST /api/auth/login`: Đăng nhập hệ thống (Body: `email`, `password`)
* `GET /api/auth/users`: Lấy danh sách tài khoản đã đăng ký (Dành cho Admin)

### 📊 Health & Metrics (`/api/health`)
* `GET /api/health/summary`: Thống kê tiến độ trong ngày (nước, calo nạp/đốt, nhịp tim)
* `POST /api/health/water`: Ghi nhận lượng nước vừa uống (Body: `amount`, `userId`)
* `POST /api/health/workout`: Ghi nhận bài tập (Body: `title`, `calories`, `duration`)

### 🤖 AI Coach (`/api/ai`)
* `POST /api/ai/chat`: Gửi câu hỏi tư vấn dinh dưỡng / bài tập MMA (Body: `question`, `profile`)

### 🎁 Shop & Rewards (`/api/shop`)
* `GET /api/shop/items`: Lấy danh mục vật phẩm và huy hiệu đổi thưởng
* `POST /api/shop/buy`: Đổi vật phẩm bằng FitCoins (Body: `userId`, `itemId`)

---

## 3. Cơ sở dữ liệu (Database)

Database mới dùng **MongoDB Atlas**, gồm 13 collection, validator, index và dữ liệu mẫu.
Xem [hướng dẫn tạo cluster và khởi tạo database](database/mongodb/README.md).

Bộ database hoạt động độc lập trong `backend/database/mongodb`; backend/API hiện tại vẫn dùng kho JSON cũ và sẽ được kết nối MongoDB ở giai đoạn sau. `backend/database/schema.sql` là thiết kế SQL trước đây.
