# API nhật ký bữa ăn

Các endpoint yêu cầu Bearer token của tài khoản `user` đang hoạt động. Dữ liệu chỉ thuộc user trong token.

Trong Postman Desktop, import `FitLife-Meal.local.postman_environment.json`, chọn environment này, rồi đặt **Current Value** của biến `token` bằng token mới lấy từ `POST /api/auth/login`. Không dùng token đã logout hoặc hết hạn.

```http
Authorization: Bearer <token>
```

## Đọc bữa ăn — `GET /api/meal-logs`

Query `date=YYYY-MM-DD` tùy chọn; mặc định là ngày hiện tại theo timezone tài khoản. Response có danh sách và tổng kcal, protein, carb, fat.

## Tạo — `POST /api/meal-logs`

```json
{
  "meal_id": "60000000-0000-4000-8000-000000000001",
  "meal_name": "Phở bò",
  "calories": 450,
  "protein": 25,
  "carbs": 55,
  "fat": 14,
  "meal_type": "breakfast"
}
```

Meal type hợp lệ: `breakfast`, `lunch`, `dinner`, `snack`. Server tự gắn `user_id` và `meal_date`. Bản ghi đầu tiên trong ngày hoàn thành `q_meal` và cộng 10 xu; gửi lại cùng `meal_id` trả `200` mà không cộng lại.

## Cập nhật và xóa

```http
PATCH /api/meal-logs/:mealId
DELETE /api/meal-logs/:mealId
```

PATCH nhận một hoặc nhiều trường bữa ăn cần sửa; không nhận `meal_id`, `user_id`, `meal_date`, timestamp và số xu. DELETE trả `204`. Chỉ chủ bản ghi mới có thể cập nhật/xóa. Khi xóa bữa cuối cùng trong ngày, backend hoàn tác `q_meal` và 10 xu trong cùng transaction. Nếu số dư không đủ thu hồi, API trả `409` và giữ nguyên cả bữa ăn lẫn nhiệm vụ.

Các thao tác ghi đều có transaction; lỗi giữa chừng không để lại bữa ăn hoặc phần thưởng dở dang.
