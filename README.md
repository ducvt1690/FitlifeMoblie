# FitLife — FE_Mobile

Nhánh này chứa frontend mobile được tách từ `main` tại commit `95c5c06e626ef7e5fb07f1e1df3e76016363621e`.

## Nội dung

`frontend/` là ứng dụng React Native/Expo gồm toàn bộ màn hình, components, tiện ích, assets và cấu hình Android/iOS của commit nguồn. Mã nguồn trong thư mục này được giữ nguyên; chỉ tài liệu và lệnh chạy ở thư mục gốc được điều chỉnh cho nhánh riêng.

## Cài đặt và chạy

Từ thư mục gốc:

```powershell
npm --prefix frontend ci
npm start
```

- `npm run android`: mở ứng dụng qua Expo trên Android.
- `npm run ios`: mở qua iOS Simulator trên máy macOS.
- `npm run web`: chạy bản Expo trên trình duyệt.
- `npm run tunnel`: khởi động Expo qua tunnel.

Có thể chạy `npm start`, rồi quét QR bằng Expo Go hoặc dùng emulator phù hợp. Các phụ thuộc và cấu hình Expo nằm trong [frontend/package.json](frontend/package.json) và [frontend/app.json](frontend/app.json).

Backend từ cùng commit nguồn được tách tại nhánh `BE_ALL`. Luồng lưu trữ và xác thực của app giữ nguyên như `main`; việc tách nhánh không tự bổ sung tích hợp API.
