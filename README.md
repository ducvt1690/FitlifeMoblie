# 📱 FitLife - Trợ Lý Sức Khỏe & Thể Lực (MMA Fitness App)

Hệ thống ứng dụng sức khỏe và thể lực toàn diện theo mô hình **Monorepo**:
- **`frontend/`**: Ứng dụng di động (React Native & Expo) với giao diện Minimalist Neo-Fitness UI, Dark Mode, Gamification (Quests, Shop, Coins), Bấm giờ Tabata/HIIT, AI Coach, Offline-first (AsyncStorage).
- **`backend/`**: RESTful API Server (Node.js & Express) quản lý xác thực (Auth), dữ liệu nhật ký sức khỏe, AI tư vấn và DDL Database SQL 10 bảng chuẩn hóa 3NF.

---

## 📁 Cấu Trúc Dự Án (Monorepo)

```text
projectMMA/
├── frontend/                     # ỨNG DỤNG DI ĐỘNG (REACT NATIVE / EXPO)
│   ├── assets/                   # Icon, hình ảnh 3D fitness, splash, notification audio
│   ├── src/
│   │   ├── components/           # UI Header, Modal, Cards
│   │   ├── constants/            # theme.js (Lime Neon & Pastel palette), data.js (MMA exercises, foods)
│   │   ├── screens/              # Dashboard, Quests, Challenge, Analytics, Calorie, BMI, Water, Workout
│   │   └── utils/                # storage.js (AsyncStorage & seed data), notifications.js
│   ├── scripts/                  # patch-notifications.js
│   ├── App.js                    # Core App Navigation & Auth Modal (Login/Register/Demo/Guest)
│   ├── app.json                  # Cấu hình Expo
│   ├── package.json              # Thư viện Frontend (Expo 51, Lucide icons, Audio, etc.)
│   └── .gitignore
│
├── backend/                      # MÁY CHỦ API & CƠ SỞ DỮ LIỆU (EXPRESS / SQL)
│   ├── database/
│   │   ├── schema.sql            # File DDL SQL 10 bảng chuẩn hóa 3NF + Dữ liệu mẫu (Seed Data)
│   │   └── db.js                 # Database connector / local JSON fallback cho test nhanh
│   ├── routes/
│   │   ├── auth.routes.js        # Đăng ký, Đăng nhập, Profile user
│   │   ├── health.routes.js      # Lịch sử Nước, Tập luyện, Dinh dưỡng, BMI
│   │   ├── ai.routes.js          # API AI Trợ lý tư vấn MMA & Dinh dưỡng
│   │   └── shop.routes.js        # Mua vật phẩm bằng Coins & quản lý Inventory
│   ├── server.js                 # REST API Server Express (Port 5000)
│   ├── package.json              # Express, Cors, Dotenv
│   ├── .env.example              # Mẫu biến môi trường
│   ├── .gitignore
│   └── README.md
│
├── .gitignore                    # Bộ lọc Git toàn cục (chặn node_modules, .expo, .env)
├── package.json                  # Monorepo root scripts
└── README.md                     # Tài liệu hướng dẫn sử dụng và triển khai
```

---

## 🚀 Hướng Dẫn Chạy Dự Án

### 1. Khởi động Backend (REST API Server)
```bash
cd backend
npm install
npm start
```
> Server sẽ chạy tại: `http://localhost:5000` (hoặc `http://<IP_MAY_TINH>:5000`)  
> Kiểm tra sức khỏe hệ thống: `http://localhost:5000/api/health`

### 2. Khởi động Frontend (React Native Expo App)
Mở một cửa sổ Terminal mới:
```bash
cd frontend
npm install
npx expo start
```
- **Xem trên điện thoại thật:** Mở ứng dụng **Expo Go** (Android/iOS) và quét mã QR trên màn hình.
- **Xem nhanh trên Web:** Bấm phím `w` hoặc chạy `npx expo start --web`.

---

## 🗄️ Cơ Sở Dữ Liệu (Database Specs)

File thiết kế SQL chi tiết đặt tại: [`backend/database/schema.sql`](backend/database/schema.sql)  
Tài liệu phân tích nghiệp vụ database chuẩn học viện: xem trong thư mục tài liệu dự án (`FitLife_Database_Specification.md`).

Hệ thống gồm **10 thực thể chính**:
1. `users`: Tài khoản, mật khẩu băm, vai trò (`member`, `guest`, `coach`, `admin`), số dư xu `coins`.
2. `water_logs`: Lịch sử nạp nước (ml) theo ngày và các mốc thời gian.
3. `workout_logs`: Nhật ký các bài tập MMA, Tabata, thời lượng và calo tiêu hao.
4. `meal_logs`: Nhật ký dinh dưỡng 4 bữa kèm Protein, Carb, Fat.
5. `daily_quest_logs`: Tiến độ hoàn thành 7 nhiệm vụ ngày và lịch sử cộng xu thưởng.
6. `bmi_history`: Theo dõi cân nặng, chiều cao, BMI, BMR, TDEE theo thời gian.
7. `sleep_logs`: Thời gian ngủ, thức, phân tích giấc ngủ sâu.
8. `mood_logs`: Theo dõi cảm xúc hàng ngày và ghi chú tâm trạng.
9. `reward_items`: Danh mục vật phẩm trong Shop (Huy hiệu VIP, Khung avatar, Giáo án).
10. `purchases`: Lịch sử giao dịch đổi vật phẩm bằng coin của người dùng.

---

## 📤 Hướng Dẫn Đẩy Code Lên GitHub (Push to Git)

Dự án đã được cấu hình sẵn file [`.gitignore`](.gitignore) ở cả thư mục gốc lẫn từng thư mục con để **tự động loại trừ** `node_modules`, `.expo`, file môi trường `.env`, giúp repository nhẹ và sạch sẽ.

### Các bước thực hiện:

> **Lưu ý:** Nếu máy tính của bạn chưa có Git, hãy tải và cài đặt nhanh tại [git-scm.com](https://git-scm.com/download/win) (hoặc dùng ứng dụng **GitHub Desktop** / tính năng Source Control của **VS Code**).

1. **Mở Terminal tại thư mục gốc `projectMMA`**:
   ```bash
   # 1. Khởi tạo Git repository (nếu chưa có)
   git init

   # 2. Thêm tất cả các file vào Git stage
   git add .

   # 3. Tạo commit đầu tiên
   git commit -m "feat: Monorepo split into frontend (Expo) and backend (Express + SQL)"

   # 4. Đổi tên nhánh chính thành main
   git branch -M main

   # 5. Liên kết với Repository trên GitHub của bạn
   # (Thay <URL_REPO_CUA_BAN> bằng link tạo trên github.com, ví dụ: https://github.com/username/projectMMA.git)
   git remote add origin <URL_REPO_CUA_BAN>

   # 6. Đẩy toàn bộ mã nguồn lên GitHub
   git push -u origin main
   ```
