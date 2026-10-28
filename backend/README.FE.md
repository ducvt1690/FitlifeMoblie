# FitLife Backend — Hướng dẫn chạy BE + Database và gọi API login/logout

Dành cho team FE (Mobile + Web). Stack: **Node.js + Express.js**, database **MongoDB Atlas**.
Backend hiện có 3 API xác thực: **login / me / logout**. Chưa có register, AI, health, shop.

---

## A. Chạy Database trên MongoDB Atlas (làm 1 lần)

### A1. Chuẩn bị trên Atlas

1. Tạo tài khoản và cluster **Free (M0)** tại https://cloud.mongodb.com.
2. **Database Access** → Add New Database User → đặt username/password, cấp `readWrite` trên database `fitlife`; người chạy init/migration cần thêm quyền quản trị database.
3. **Network Access** → Add IP Address → **Add Current IP Address** (đổi mạng Wi-Fi là phải cập nhật lại IP, nếu không BE báo lỗi kết nối).
4. **Connect → Drivers → Node.js** → copy **connection string**, ví dụ:
   `mongodb+srv://fitlife_admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   - Thay `<password>` bằng mật khẩu thật, **URL-encode** nếu có ký tự đặc biệt (`@` → `%40`, `/` → `%2F`, `#` → `%23`...).

### A2. Khởi tạo schema + seed dữ liệu

Mở **PowerShell**, chạy từ thư mục `backend/database/mongodb`:

```powershell
cd backend\database\mongodb
npm ci
Copy-Item .env.example .env
```

Mở file `.env` vừa tạo, điền:

| Biến | Giá trị |
|---|---|
| `MONGODB_URI` | Connection string ở bước A1 |
| `MONGODB_DB_NAME` | `fitlife` |
| `FITLIFE_DEMO_PASSWORD` | Mật khẩu ≥ 12 ký tự (chỉ cần khi tạo tài khoản demo) |

> File `.env` **không bao giờ commit** (đã có trong `.gitignore`).

```powershell
npm run db:init      # tạo 16 collection + validator + index
npm run db:seed      # thêm 6 vật phẩm + 3 thử thách mẫu
npm run db:verify    # kiểm tra toàn vẹn — phải PASS mới sang phần B
```

Chỉ sử dụng database `fitlife`. Không chuyển `MONGODB_DB_NAME` sang database khác. Dữ liệu hiện có tài khoản demo user/trainer/admin trong cùng database; không seed lại lên dữ liệu đang dùng.

Chi tiết: [database/mongodb/README.md](database/mongodb/README.md).

---

## B. Chạy Backend (Node.js + Express)

Từ thư mục `backend`:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Mở `.env`, điền **cùng** `MONGODB_URI` và `MONGODB_DB_NAME` như phần A:

| Biến | Giá trị |
|---|---|
| `MONGODB_URI` | Connection string Atlas |
| `MONGODB_DB_NAME` | `fitlife` |
| `PORT` | `5000` (mặc định) |
| `AUTH_SESSION_TTL_SECONDS` | `604800` = 7 ngày (mặc định, không cần sửa) |

> Thứ tự ưu tiên cấu hình: biến môi trường process → `backend/.env` → `backend/database/mongodb/.env`.

```powershell
npm run build   # kiểm tra cú pháp — PASS mới chạy tiếp
npm start       # hoặc: npm run dev (tự reload khi sửa code)
```

Kiểm tra server sống:

- `GET /` → `{ "status": "online", ... }`
- `GET /health` → `{ "status": "ok", "database": "connected" }`

> Server chỉ lắng nghe sau khi kết nối Atlas thành công. Lần chạy đầu, tài khoản database cần quyền tạo collection/index `auth_sessions`.

---

## C. Gọi API login/logout từ FE

### C1. Base URL — chọn đúng theo môi trường

| Môi trường chạy app | `API_URL` |
|---|---|
| Web dev (Vite / CRA / Next.js...) | `http://localhost:5000` |
| iOS Simulator (Expo) | `http://localhost:5000` |
| Android Emulator (Expo) | `http://10.0.2.2:5000` |
| Máy thật (Expo Go, chung Wi-Fi với máy chạy BE) | `http://<IP-LAN>:5000` (xem bằng `ipconfig` → IPv4 Address) |

Đặt một chỗ duy nhất:

- Web (Vite): `const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';`
- Mobile (Expo): `export const API_URL = 'http://192.168.1.10:5000'; // đổi theo môi trường`

### C2. Đăng nhập — `POST /api/auth/login`

```js
const res = await fetch(`${API_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await res.json();
// res.status === 200 → đăng nhập thành công
```

Thành công (`200`):

- **Mobile** — lưu `data.token` vào **AsyncStorage**.
- **Web** — lưu `data.token` vào **localStorage** (demo) hoặc memory + httpOnly cookie do web server riêng quản lý (production); không để token lộ qua URL hay log.

```json
{
  "success": true,
  "token": "<chuỗi-token>",
  "token_type": "Bearer",
  "expires_at": "<ISO-8601>",
  "user": {
    "id": "<user_id>", "user_id": "<user_id>",
    "email": "...", "name": "...", "role": "user",
    "profile": { "height": 170, "weight": 65, "target_water": 2275, "target_calories": 2484, "coins": 0 }
  }
}
```

Thất bại: `400` thiếu/sai định dạng · `401` sai email hoặc mật khẩu (cùng 1 thông báo) · `403` tài khoản bị khóa · `429` quá 20 lần login/15 phút/IP.

### C3. Kiểm tra phiên — `GET /api/auth/me`

```js
const res = await fetch(`${API_URL}/api/auth/me`, {
  headers: { Authorization: `Bearer ${token}` },
});
// 200 → { success: true, user: {...} } — gọi khi mở app để kiểm tra token còn hạn
// 401 → token sai / hết hạn / đã logout → xóa token, về màn hình đăng nhập
```

### C4. Đăng xuất — `POST /api/auth/logout`

```js
const res = await fetch(`${API_URL}/api/auth/logout`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});
// 204, KHÔNG có body — đừng gọi res.json()! Xóa token đã lưu là xong.
```

Gọi 2 lần vẫn `204` (an toàn khi retry). Logout chỉ thu hồi đúng phiên đó, thiết bị khác không ảnh hưởng.

### C5. Bảng mã lỗi

| Mã | Ý nghĩa | FE làm gì |
|---|---|---|
| `200` | OK (login, me) | Lưu token / hiển thị user |
| `204` | OK, không body (logout) | Xóa token, về màn hình login |
| `400` | Thiếu/sai định dạng | Hiện lỗi nhập liệu |
| `401` | Sai credentials / token hết hạn | Xóa token, về màn hình login |
| `403` | Tài khoản bị khóa | Báo tài khoản bị khóa |
| `429` | Quá giới hạn login | Báo thử lại sau (`Retry-After`) |
| `413` / `415` | Body quá lớn / encoding không được hỗ trợ | Sửa body hoặc header request |
| `503` | Mất kết nối database | Báo lỗi server |

Mọi lỗi: `{ "success": false, "message": "..." }`. Response không bao giờ chứa `password`.

### C6. Lưu ý

1. Token là chuỗi ngẫu nhiên (không phải JWT, không decode được). Gửi lại qua header `Authorization: Bearer <token>`.
2. Chưa có API register — tài khoản do BE tạo sẵn trên database (phần A2).
3. Test login sai liên tục sẽ bị `429` — đợi hết thời gian hoặc restart server khi dev.

---

## D. Test nhanh bằng Postman (không cần viết code FE)

1. Backend đang chạy (phần B).
2. Tạo request `POST http://localhost:5000/api/auth/login`, chọn Body → raw → JSON, gửi `email` và `password` của tài khoản trên Atlas.
3. Lấy `token` từ response, gửi `GET http://localhost:5000/api/auth/me` với header `Authorization: Bearer <token>` → cần `200`.
4. Gửi `POST http://localhost:5000/api/auth/logout` với cùng header → cần `204`. Gọi lại `/me` bằng token đó → cần `401`.

Cấu hình collection và environment Postman được giữ riêng trên máy, không nằm trong Git. Không chia sẻ mật khẩu hoặc token trong file cấu hình.

---

## Tài liệu liên quan

- [README.md](README.md) — tài liệu kỹ thuật chi tiết Backend.
- [database/mongodb/README.md](database/mongodb/README.md) — khởi tạo, seed, migration database.
- [database/mongodb/ROLE_CONTRACT.md](database/mongodb/ROLE_CONTRACT.md) — hợp đồng role user/trainer/admin.
