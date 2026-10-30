# Kiểm thử toàn bộ FitLife API trong Postman

Để kiểm tra tất cả API đã triển khai, import [ALL API](all-api.postman_collection.json), chọn **No Environment**, Run đủ 37 request theo thứ tự. Collection tự lấy token mới mỗi lượt. Kết quả mong đợi: **62 Passed, 0 Failed, 0 Errors**.

Xem [hướng dẫn thao tác Postman Desktop và từng API](HUONG_DAN_POSTMAN.md). Bộ Auth/Meal/Workout cũ bên dưới chỉ kiểm tra từng phần; chúng có biến và điều kiện chuẩn bị riêng.

## Collection auth riêng

1. Chạy backend tại `http://localhost:5000`.
2. Import `registration.postman_collection.json`.
3. Chọn collection **FitLife — Auth 12h (Run all)** → Run → chọn đủ 10 request → Start run.

Collection tự tạo email/mật khẩu thử trong từng lần chạy, rồi truyền token giữa các request. Không cần chọn environment. Nếu muốn đổi địa chỉ backend, đặt `baseUrl` trong environment; `registrationPassword` là tùy chọn. Không gửi từng request phụ thuộc token bằng nút Send khi chưa chạy các bước trước.

Kết quả mong đợi: **14 Passed, 0 Failed, 0 Errors**. HTTP `400` (dữ liệu sai), `409` (email trùng) và `401` (token đã logout) là các tình huống cố ý kiểm tra; xem kết quả assertion thay vì chỉ nhìn màu HTTP status.

Bản **FitLife — Register + onboarding** đã import trước đó thiếu biến mật khẩu khi chọn environment cũ. Dùng collection mới có tên ở trên.

Mỗi lần chạy tạo một tài khoản thử trong database `fitlife` và logout cả hai phiên ở cuối luồng. Chạy quá nhiều lần có thể nhận `429` do giới hạn 20 yêu cầu đăng ký/IP/15 phút; chờ theo `Retry-After`, hoặc khởi động lại server dev do bạn quản lý. Không tắt giới hạn trên server thật.

## API nhật ký tập luyện

[Hợp đồng API nhật ký tập luyện](workouts.md) mô tả `GET /api/workout-logs` và `POST /api/workout-logs`, body/response, Bearer token, gửi lại bằng cùng UUID, thưởng nhiệm vụ một lần/ngày và mục tiêu nước trong ngày tập. Chạy BE bằng `npm run dev`; dùng token của tài khoản role `user` để gọi hai endpoint này.

## API nhật ký bữa ăn

[Hợp đồng API nhật ký bữa ăn](meals.md) mô tả CRUD `GET/POST/PATCH/DELETE /api/meal-logs`, tổng dinh dưỡng, idempotency và thưởng `q_meal`.

## ExerciseDB V1 trong MongoDB

[Hướng dẫn import và đọc thư viện ExerciseDB V1](exercises.md) mô tả `npm run db:exercises:import`, collection `exercises`, cursor pagination và `GET /api/exercises`.

## API thông tin cá nhân

[Hợp đồng API thông tin cá nhân](profile.md) mô tả `GET /api/profile` và `PATCH /api/profile`, cập nhật email/ngày sinh, tuổi tự tính, xử lý email trùng và migration bổ sung `users.date_of_birth`.
