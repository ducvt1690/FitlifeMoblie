# 📱 FitLife - Trợ Lý Sức Khỏe & Thể Lực (MMA Fitness App)

Hệ thống ứng dụng sức khỏe và thể lực toàn diện theo mô hình **Monorepo**:
- **`frontend/`**: Ứng dụng di động (React Native & Expo) với giao diện Minimalist Neo-Fitness UI, Dark Mode, Gamification (Quests, Shop, Coins), Bấm giờ Tabata/HIIT, AI Coach, Offline-first (AsyncStorage).
- **`backend/`**: RESTful API Server (Node.js & Express) dùng MongoDB Atlas, quản lý auth/session, hồ sơ, nhật ký sức khỏe, bài tập ExerciseDB và quest.

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
├── backend/                      # MÁY CHỦ API & MONGODB ATLAS (EXPRESS)
│   ├── database/mongodb/         # Schema, validator, seed, migration và test MongoDB
│   ├── routes/                   # Auth, profile, water, workout, meals, exercises, quests
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
npm run dev
```
> Server sẽ chạy tại: `http://localhost:5000` (hoặc `http://<IP_MAY_TINH>:5000`)  
> Kiểm tra sức khỏe hệ thống: `http://localhost:5000/health`

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

## 🗄️ Cơ Sở Dữ Liệu MongoDB Atlas

Tài liệu schema và cách kết nối đặt tại [`backend/database/mongodb/README.md`](backend/database/mongodb/README.md). Đặc tả nghiệp vụ đặt tại [`backend/database/FitLife_Database_Specification.md`](backend/database/FitLife_Database_Specification.md).

Database `fitlife` gồm **17 collection nghiệp vụ**:

- Tài khoản: `users`, role `user`, `trainer`, `admin`; mật khẩu băm và số dư `fit_coins`.
- Nhật ký: `water_logs`, `workout_logs`, `meal_logs`, `bmi_history`, `sleep_logs`, `mood_logs`.
- Thư viện 30 bài ExerciseDB V1: `exercises`, có tên/hướng dẫn tiếng Việt và URL GIF.
- Nhiệm vụ và thử thách: `daily_quest_logs`, `challenges`, `user_challenges`.
- Cửa hàng: `reward_items`, `purchases`.
- Trainer: `workout_templates`, `trainer_assignments`.
- Chat: `ai_chat_sessions`, `ai_chat_messages`.

`auth_sessions` là collection kỹ thuật lưu hash token và hạn phiên. Các API đã có: auth, profile, nước, tập luyện, bữa ăn, exercises và đọc quest. Shop, Challenge, Trainer, AI cùng các API ngủ/tâm trạng/BMI còn cần triển khai; có collection không đồng nghĩa đã có API. Frontend hiện vẫn dùng nhiều dữ liệu local và cần tích hợp với backend.

Chạy và cấu hình backend: [backend/README.md](backend/README.md). Hướng dẫn Postman: [backend/api/HUONG_DAN_POSTMAN.md](backend/api/HUONG_DAN_POSTMAN.md).

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
   git commit -m "feat: FitLife frontend Expo and backend Express with MongoDB"

   # 4. Đổi tên nhánh chính thành main
   git branch -M main

   # 5. Liên kết với Repository trên GitHub của bạn
   # (Thay <URL_REPO_CUA_BAN> bằng link tạo trên github.com, ví dụ: https://github.com/username/projectMMA.git)
   git remote add origin <URL_REPO_CUA_BAN>

   # 6. Đẩy toàn bộ mã nguồn lên GitHub
   git push -u origin main
   ```
