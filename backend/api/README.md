# Kiểm thử FitLife API trong Postman

## Xác minh email Gmail trước đăng ký

Xem [hợp đồng API email](email-verification.md). Import [collection Gmail thủ công](registration.postman_collection.json) và [environment mẫu](FitLife-Registration.local.postman_environment.json). Gửi mã, đọc Gmail, nhập `registrationCode`, xác minh rồi đăng ký. Không Run all trong luồng email thật.

## Regression local tự động

Chạy `npm run test:postman` trong backend; hoặc `node scripts/run-postman-regression.js --desktop` rồi import `backend/postman/local-email-otp.postman_collection.json`, chọn No Environment, chạy đủ **46 request**, 1 iteration. Kỳ vọng **73 Passed, 0 Failed, 0 Errors**. Database và hộp thư đều tạm, không gửi Gmail thật. Collection chỉ phủ các route được liệt kê, không phải toàn bộ endpoint backend.

`test:postman:atlas` dừng trước khi kết nối; dùng collection Gmail thủ công để test tài khoản/email thật. Các bộ Meal/Workout cần token của tài khoản đã đăng ký.

## API nhật ký tập luyện

[Hợp đồng API nhật ký tập luyện](workouts.md) mô tả `GET`, `POST` và `DELETE /api/workout-logs`, body/response, Bearer token, gửi lại bằng cùng UUID, thưởng nhiệm vụ một lần/ngày và mục tiêu nước trong ngày tập. Chạy BE bằng `npm run dev`; dùng token của tài khoản role `user` để gọi hai endpoint này.

## API mật khẩu

[Hợp đồng API mật khẩu](password.md) mô tả đổi mật khẩu khi đang đăng nhập, quên mật khẩu bằng mã 6 số gửi qua email, đặt lại mật khẩu và cách cấu hình SMTP.

## API nhật ký uống nước

[Hợp đồng API nhật ký uống nước](water.md) mô tả `GET/POST/DELETE /api/water-logs`, gửi lại bằng cùng UUID và hoàn tác thưởng `q_water` khi xóa log cuối cùng trong ngày.

## API nhật ký bữa ăn

[Hợp đồng API nhật ký bữa ăn](meals.md) mô tả CRUD `GET/POST/PATCH/DELETE /api/meal-logs`, tổng dinh dưỡng, idempotency và thưởng `q_meal`.

## ExerciseDB V1 trong MongoDB

[Hướng dẫn import và đọc thư viện ExerciseDB V1](exercises.md) mô tả `npm run db:exercises:import`, collection `exercises`, cursor pagination và `GET /api/exercises`.

## API thông tin cá nhân

[Hợp đồng API thông tin cá nhân](profile.md) mô tả `GET /api/profile` và `PATCH /api/profile`, cập nhật email/ngày sinh, tuổi tự tính, xử lý email trùng và migration bổ sung `users.date_of_birth`.

## Giấc ngủ, tâm trạng, BMI, thử thách, đổi thưởng, thống kê, AI Coach

[Hợp đồng các API còn lại](features.md) mô tả sleep/mood upsert theo ngày, BMI, điểm danh và chuỗi ngày, thử thách, đổi thưởng có idempotency, thống kê nhiều ngày và AI Coach.

Cấu hình Postman cá nhân không được commit. Sao chép `FitLife-Meal.example.postman_environment.json` thành `FitLife-Meal.local.postman_environment.json`, rồi điền thông tin của môi trường bạn sử dụng. Các file `*.local.postman_environment.json` được Git bỏ qua.
