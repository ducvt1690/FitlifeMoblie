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

## Tài liệu

- [backend/README.md](backend/README.md): cấu trúc service và danh sách API.
- [backend/api/](backend/api/): tài liệu từng nhóm API và Postman collection.
- [backend/database/](backend/database/): schema, migration, dữ liệu mẫu MongoDB.
