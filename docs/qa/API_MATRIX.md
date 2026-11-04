# Ma trận nghiệp vụ → API → database → web → mobile → test

Được sinh từ route thật và collection review. Có 60 cặp method/path nghiệp vụ; `GET /` và `GET /health` là hai route hệ thống bổ sung. Phủ route không thay thế kiểm thử mọi tổ hợp đầu vào. Kết quả thực thi nằm ở [báo cáo QA](ACCEPTANCE_2026-11-04.md).

| Nghiệp vụ | API | MongoDB | Web | Mobile | Bằng chứng kiểm thử |
|---|---|---|---|---|---|
| Quản lý tài khoản, danh mục và audit | GET /api/admin/overview | users, challenges, reward_items, purchases, admin_logs | admin/* | Không áp dụng (mobile chỉ user) | roles.test.js; 3 Postman request(s) |
| Quản lý tài khoản, danh mục và audit | GET /api/admin/accounts | users, challenges, reward_items, purchases, admin_logs | admin/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Quản lý tài khoản, danh mục và audit | PATCH /api/admin/accounts/:userId | users, challenges, reward_items, purchases, admin_logs | admin/* | Không áp dụng (mobile chỉ user) | roles.test.js; 2 Postman request(s) |
| Quản lý tài khoản, danh mục và audit | GET /api/admin/challenges | users, challenges, reward_items, purchases, admin_logs | admin/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Quản lý tài khoản, danh mục và audit | POST /api/admin/challenges | users, challenges, reward_items, purchases, admin_logs | admin/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Quản lý tài khoản, danh mục và audit | PATCH /api/admin/challenges/:challengeId | users, challenges, reward_items, purchases, admin_logs | admin/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Quản lý tài khoản, danh mục và audit | GET /api/admin/rewards | users, challenges, reward_items, purchases, admin_logs | admin/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Quản lý tài khoản, danh mục và audit | POST /api/admin/rewards | users, challenges, reward_items, purchases, admin_logs | admin/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Quản lý tài khoản, danh mục và audit | PATCH /api/admin/rewards/:itemId | users, challenges, reward_items, purchases, admin_logs | admin/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Quản lý tài khoản, danh mục và audit | GET /api/admin/transactions | users, challenges, reward_items, purchases, admin_logs | admin/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Quản lý tài khoản, danh mục và audit | GET /api/admin/logs | users, challenges, reward_items, purchases, admin_logs | admin/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Tài khoản và phiên | POST /api/auth/register | users, auth_sessions, daily_quest_logs | Login, Register | AuthScreen | auth.test.js; 3 Postman request(s) |
| Tài khoản và phiên | POST /api/auth/login | users, auth_sessions, daily_quest_logs | Login, Register | AuthScreen | auth.test.js; 4 Postman request(s) |
| Tài khoản và phiên | GET /api/auth/me | users, auth_sessions, daily_quest_logs | Login, Register | AuthScreen | auth.test.js; 7 Postman request(s) |
| Tài khoản và phiên | POST /api/auth/logout | users, auth_sessions, daily_quest_logs | Login, Register | AuthScreen | auth.test.js; 2 Postman request(s) |
| BMI hiện tại và lịch sử | GET /api/bmi-records | bmi_history, users | Progress (đọc) | BmiCalculatorScreen | features.test.js; 3 Postman request(s) |
| BMI hiện tại và lịch sử | POST /api/bmi-records | bmi_history, users | Progress (đọc) | BmiCalculatorScreen | features.test.js; 1 Postman request(s) |
| Tham gia và check-in thử thách | GET /api/challenges | challenges, user_challenges, users | Challenges | ChallengeScreen | features.test.js; 2 Postman request(s) |
| Tham gia và check-in thử thách | POST /api/challenges/:challengeId/join | challenges, user_challenges, users | Challenges | ChallengeScreen | features.test.js; 3 Postman request(s) |
| Tham gia và check-in thử thách | POST /api/challenges/:challengeId/checkin | challenges, user_challenges, users | Challenges | ChallengeScreen | features.test.js; 2 Postman request(s) |
| AI Coach và lịch sử | GET /api/chat/sessions | ai_chat_sessions, ai_chat_messages, users, daily_quest_logs | Coach | AiCoachScreen | features.test.js; 2 Postman request(s) |
| AI Coach và lịch sử | GET /api/chat/sessions/:sessionId/messages | ai_chat_sessions, ai_chat_messages, users, daily_quest_logs | Coach | AiCoachScreen | features.test.js; 2 Postman request(s) |
| AI Coach và lịch sử | POST /api/chat/messages | ai_chat_sessions, ai_chat_messages, users, daily_quest_logs | Coach | AiCoachScreen | features.test.js; 3 Postman request(s) |
| Đồng ý kết nối và xử lý bài giao | GET /api/coaching | trainer_links, trainer_assignments, workout_templates | Coaching | CoachingScreen | roles.test.js; 2 Postman request(s) |
| Đồng ý kết nối và xử lý bài giao | POST /api/coaching/links | trainer_links, trainer_assignments, workout_templates | Coaching | CoachingScreen | roles.test.js; 1 Postman request(s) |
| Đồng ý kết nối và xử lý bài giao | DELETE /api/coaching/links/:linkId | trainer_links, trainer_assignments, workout_templates | Coaching | CoachingScreen | roles.test.js; 1 Postman request(s) |
| Đồng ý kết nối và xử lý bài giao | POST /api/coaching/assignments/:id/complete | trainer_links, trainer_assignments, workout_templates | Coaching | CoachingScreen | roles.test.js; 2 Postman request(s) |
| Đồng ý kết nối và xử lý bài giao | POST /api/coaching/assignments/:id/decline | trainer_links, trainer_assignments, workout_templates | Coaching | CoachingScreen | roles.test.js; 1 Postman request(s) |
| Giấc ngủ | GET /api/sleep-logs | sleep_logs, users, daily_quest_logs | Logs | QuestScreen | features.test.js; 2 Postman request(s) |
| Giấc ngủ | PUT /api/sleep-logs | sleep_logs, users, daily_quest_logs | Logs | QuestScreen | features.test.js; 3 Postman request(s) |
| Tâm trạng | GET /api/mood-logs | mood_logs, users, daily_quest_logs | Logs | HomeScreen, QuestScreen | features.test.js; 2 Postman request(s) |
| Tâm trạng | PUT /api/mood-logs | mood_logs, users, daily_quest_logs | Logs | HomeScreen, QuestScreen | features.test.js; 2 Postman request(s) |
| Danh mục, tìm kiếm và chi tiết bài tập | GET /api/exercises | exercises | Workouts | WorkoutScreen | Postman review; 2 Postman request(s) |
| Danh mục, tìm kiếm và chi tiết bài tập | GET /api/exercises/:exerciseId | exercises | Workouts | WorkoutScreen | Postman review; 1 Postman request(s) |
| Thêm, xem, sửa và xóa bữa ăn | GET /api/meal-logs | meal_logs, users, daily_quest_logs | Logs | CalorieScreen | meal.test.js; 2 Postman request(s) |
| Thêm, xem, sửa và xóa bữa ăn | POST /api/meal-logs | meal_logs, users, daily_quest_logs | Logs | CalorieScreen | meal.test.js; 2 Postman request(s) |
| Thêm, xem, sửa và xóa bữa ăn | PATCH /api/meal-logs/:mealId | meal_logs, users, daily_quest_logs | Logs | CalorieScreen | meal.test.js; 1 Postman request(s) |
| Thêm, xem, sửa và xóa bữa ăn | DELETE /api/meal-logs/:mealId | meal_logs, users, daily_quest_logs | Logs | CalorieScreen | meal.test.js; 1 Postman request(s) |
| Hồ sơ và mục tiêu | GET /api/profile | users, bmi_history, workout_logs | Profile | ProfileScreen, BmiCalculatorScreen | profile.test.js; 2 Postman request(s) |
| Hồ sơ và mục tiêu | PATCH /api/profile | users, bmi_history, workout_logs | Profile | ProfileScreen, BmiCalculatorScreen | profile.test.js; 3 Postman request(s) |
| Nhiệm vụ, điểm danh và streak | GET /api/quests | daily_quest_logs, users | Quests | QuestScreen | features.test.js; 3 Postman request(s) |
| Nhiệm vụ, điểm danh và streak | POST /api/quests/checkin | daily_quest_logs, users | Quests | QuestScreen | features.test.js; 2 Postman request(s) |
| Đổi thưởng và sở hữu vật phẩm | GET /api/rewards | reward_items, purchases, users | Rewards | ShopScreen | features.test.js; 3 Postman request(s) |
| Đổi thưởng và sở hữu vật phẩm | POST /api/rewards/:itemId/purchase | reward_items, purchases, users | Rewards | ShopScreen | features.test.js; 3 Postman request(s) |
| Thống kê 1–31 ngày | GET /api/stats | water_logs, meal_logs, workout_logs, sleep_logs, mood_logs, daily_quest_logs | Dashboard, Progress | AnalyticsScreen | features.test.js; 3 Postman request(s) |
| Mã mời, giáo án, giao bài và xem học viên | GET /api/trainer/overview | users, trainer_links, workout_templates, trainer_assignments; đọc nhật ký khi đủ quyền | trainer/* | Không áp dụng (mobile chỉ user) | roles.test.js; 3 Postman request(s) |
| Mã mời, giáo án, giao bài và xem học viên | GET /api/trainer/links | users, trainer_links, workout_templates, trainer_assignments; đọc nhật ký khi đủ quyền | trainer/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Mã mời, giáo án, giao bài và xem học viên | POST /api/trainer/links | users, trainer_links, workout_templates, trainer_assignments; đọc nhật ký khi đủ quyền | trainer/* | Không áp dụng (mobile chỉ user) | roles.test.js; 2 Postman request(s) |
| Mã mời, giáo án, giao bài và xem học viên | DELETE /api/trainer/links/:linkId | users, trainer_links, workout_templates, trainer_assignments; đọc nhật ký khi đủ quyền | trainer/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Mã mời, giáo án, giao bài và xem học viên | GET /api/trainer/templates | users, trainer_links, workout_templates, trainer_assignments; đọc nhật ký khi đủ quyền | trainer/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Mã mời, giáo án, giao bài và xem học viên | POST /api/trainer/templates | users, trainer_links, workout_templates, trainer_assignments; đọc nhật ký khi đủ quyền | trainer/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Mã mời, giáo án, giao bài và xem học viên | PATCH /api/trainer/templates/:templateId | users, trainer_links, workout_templates, trainer_assignments; đọc nhật ký khi đủ quyền | trainer/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Mã mời, giáo án, giao bài và xem học viên | GET /api/trainer/assignments | users, trainer_links, workout_templates, trainer_assignments; đọc nhật ký khi đủ quyền | trainer/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Mã mời, giáo án, giao bài và xem học viên | POST /api/trainer/assignments | users, trainer_links, workout_templates, trainer_assignments; đọc nhật ký khi đủ quyền | trainer/* | Không áp dụng (mobile chỉ user) | roles.test.js; 3 Postman request(s) |
| Mã mời, giáo án, giao bài và xem học viên | POST /api/trainer/assignments/:id/cancel | users, trainer_links, workout_templates, trainer_assignments; đọc nhật ký khi đủ quyền | trainer/* | Không áp dụng (mobile chỉ user) | roles.test.js; 1 Postman request(s) |
| Mã mời, giáo án, giao bài và xem học viên | GET /api/trainer/students/:userId | users, trainer_links, workout_templates, trainer_assignments; đọc nhật ký khi đủ quyền | trainer/* | Không áp dụng (mobile chỉ user) | roles.test.js; 4 Postman request(s) |
| Nhật ký nước | GET /api/water-logs | water_logs, users, daily_quest_logs | Logs, Dashboard | HomeScreen, WaterTrackerScreen | member.test.js; 1 Postman request(s) |
| Nhật ký nước | POST /api/water-logs | water_logs, users, daily_quest_logs | Logs, Dashboard | HomeScreen, WaterTrackerScreen | member.test.js; 2 Postman request(s) |
| Nhật ký tập | GET /api/workout-logs | workout_logs, users, daily_quest_logs | Logs | WorkoutScreen, QuestScreen | workout.test.js; 2 Postman request(s) |
| Nhật ký tập | POST /api/workout-logs | workout_logs, users, daily_quest_logs | Logs | WorkoutScreen, QuestScreen | workout.test.js; 2 Postman request(s) |

Chi tiết request/response, validation và lỗi: [profile](../../backend/api/profile.md), [workout](../../backend/api/workouts.md), [meals](../../backend/api/meals.md), [features](../../backend/api/features.md), [Postman review](../../backend/api/review-api.postman_collection.json). Mobile adapter được kiểm tra với backend/MongoDB thật bởi `frontend/tests/server-integration.test.cjs`. Một số endpoint chi tiết được API test bao phủ dù UI dùng dữ liệu đã có từ danh sách.
