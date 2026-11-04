# FitLife — BE_ALL

Nhánh này chứa backend được tách từ `main` tại commit `95c5c06e626ef7e5fb07f1e1df3e76016363621e`.

## Nội dung

- `backend/`: server Node.js/Express và dependencies.
- `api/`: các route xác thực, sức khỏe, bài tập, AI và cửa hàng; Postman collection.
- `database/`: module lưu dữ liệu JSON, schema SQL và dữ liệu mẫu.

Ba thư mục được giữ cùng nhau vì `backend/server.js` nạp `../api` và các route dùng `../database`. Mã nguồn trong cả ba thư mục giữ nguyên từ commit nguồn; chỉ tài liệu và lệnh chạy ở thư mục gốc được điều chỉnh cho nhánh riêng.

## Cài đặt và chạy

Từ thư mục gốc:

```powershell
npm --prefix backend ci
npm start
```

Server mặc định: `http://localhost:5000`. `GET /` kiểm tra trạng thái server. Chạy development bằng `npm run dev`.

Cấu hình mẫu nằm tại `backend/.env.example`; nếu cần cấu hình riêng, sao chép thành `backend/.env` trước khi chạy. Bản backend này lưu dữ liệu ở `database/fitlife_db.json`.

Xem [tài liệu API](api/README.md), [Postman collection](api/postman_collection.json) và [tài liệu database](database/README.md).

Frontend mobile từ cùng commit nguồn được tách tại nhánh `FE_Mobile`.
