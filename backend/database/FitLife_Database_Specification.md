# FitLife Health & MMA — Database v2 và role BE/FE

Phiên bản 2 theo yêu cầu user/trainer/admin ngày 25/10/2026. Triển khai bằng **MongoDB Atlas**. Firestore trong bản yêu cầu mô tả mô hình logic; các subcollection được chuyển thành collection MongoDB có field tham chiếu.

## 1. Quy ước

- **16 collection nghiệp vụ**; mỗi document có `_id: ObjectId` và ID nghiệp vụ unique.
- `user_id` là chuỗi từ token đã verify, tương ứng `auth.uid`, không bắt buộc UUID; `trainer_id` tham chiếu cùng field. Các ID khác dùng UUID.
- Timestamp là BSON Date UTC; ngày nghiệp vụ là YYYY-MM-DD theo users.timezone; log_time là HH:mm.
- Mọi document có created_at/updated_at bắt buộc. BE phải điền, database không tự gán.
- Lưu snake_case; API có thể map user_id↔userId, full_name↔fullName, is_active↔isActive, fit_coins↔fitCoins, target_water↔targetWater, v.v. FE không ghi trực tiếp Atlas.
- Validator chặn sai kiểu/giá trị/field lạ; index chặn trùng. Quyền theo người dùng, foreign key, transaction thuộc BE và được db:verify audit.

## 2. Role

users.role = **user | trainer | admin**, đăng ký mặc định user.

- User ghi/xem dữ liệu sức khỏe của mình, quest/coins, shop, challenge và chat AI.
- Trainer tạo/sửa template của mình, gán bài cho user, đọc hồ sơ/nhật ký khi có assignment assigned còn hiệu lực; không sửa log user/shop/challenge.
- Admin CRUD challenge/reward, khóa/mở account, đọc hệ thống phục vụ quản trị; không sửa log cá nhân hay đọc chat riêng của người khác.

Mọi quyền cần account active. Đây là yêu cầu cho BE triển khai sau; hiện chỉ lưu role/is_active và quan hệ dữ liệu. Role ứng dụng không thay database role của Atlas.

## 3. users

ID user_id unique; email unique, chữ thường.

- email: 3–100 ký tự; full_name: 1–100.
- role: user/trainer/admin; is_active: boolean, BE mặc định true.
- gender: male/female; age: số nguyên 5–100.
- height: 80–250 cm; weight: 25–300 kg.
- activity_level: sedentary/light/moderate/active; goal: lose/maintain/gain.
- target_water: int ml = round(min(weight×35,4000)), +350 một lần nếu có >=1 workout trong ngày; tối đa 4350 khi tập, 4000 cơ bản.
- target_calories: int kcal tính Mifflin–St Jeor/TDEE, điều chỉnh goal, làm tròn rồi áp sàn 1200 nữ/1500 nam.
- fit_coins, streak_days: int >=0, BE mặc định 0.
- timezone: IANA timezone, mặc định Asia/Ho_Chi_Minh.
- password_hash: tùy chọn, scrypt/bcrypt/Argon2 nếu BE tự quản lý password; external auth có thể bỏ.
- streak_last_date: tùy chọn, ngày gần nhất đã tăng streak.

Hồ sơ thông thường chỉ sửa full_name/gender/age/height/weight/activity_level/goal/timezone. Role/khóa/coins/streak/targets/auth là field hệ thống, không nhận ghi từ body thông thường. Không trả hash qua API. Tính BMI/targets khi onboarding hoặc đổi chỉ số sẽ được BE triển khai ở giai đoạn sau.

## 4. Nhật ký sức khỏe

Tất cả đều có user_id tham chiếu users:

- **water_logs**, ID log_id: amount int >0 ml, log_time HH:mm, log_date. Nhiều lần/ngày, index (user_id,log_date).
- **workout_logs**, ID workout_id: title 1–150, category 1–50, duration_seconds int >0, calories_burned int >=0, workout_date. Nhiều lần/ngày, index (user_id,workout_date).
- **meal_logs**, ID meal_id: meal_name 1–150, calories int >0, protein/carbs/fat số >=0 gram, meal_type breakfast/lunch/dinner/snack, meal_date. Nhiều lần/ngày, index (user_id,meal_date).
- **sleep_logs**, ID sleep_id: hours 0–24, quality Sâu/Bình thường/Chập chờn, sleep_date. Unique (user_id,sleep_date).
- **mood_logs**, ID mood_id: mood_label 1–50, note tùy chọn 0–2000, mood_date. Unique (user_id,mood_date).
- **bmi_history**, ID record_id: weight, height, bmi_value >0, bmi_status, record_date. Unique (user_id,record_date).

Sleep/mood/BMI upsert cùng ngày phải giữ UUID ban đầu. User chỉ ghi dữ liệu mình; trainer có assignment hiệu lực chỉ đọc; admin không ghi log. BMI do BE tính, schema không tự thực hiện công thức.

## 5. daily_quest_logs

ID quest_log_id; user_id, quest_key, quest_title, reward_coins=10, is_completed, quest_date, extra_value tùy chọn; completed_at bắt buộc Date khi xong, null/thiếu khi chưa xong.

Bộ key: **q_water, q_workout, q_meal, q_sleep, q_mood, q_checkin, q_chat**.

Unique (user_id,quest_date,quest_key). Hoạt động hợp lệ ghi thành công mới xét quest. Q_water là ghi nhận nước, không đợi đủ target; workout/meal/sleep/mood tương tự; q_checkin có endpoint điểm danh; q_chat dựa vào tin user đã lưu.

BE upsert 7 quest của ngày, reset logic lúc 00:00 theo timezone, giữ lịch sử ngày trước. Chuyển false→true và cộng 10 coins cùng transaction, không cộng lặp. FE không set is_completed/reward_coins trực tiếp. Đạt **>=5/7** tăng streak một lần/ngày; streak_last_date chống tăng lặp, bỏ ngày bắt đầu lại 1.

Migration đổi q_meals→q_meal, archive q_weight/q_bowel, giữ nguyên số xu lịch sử.

## 6. Trainer

**workout_templates**, ID template_id:

- trainer_id tham chiếu role trainer; title, category, duration_seconds >0, calories_est >=0.
- level beginner/intermediate/advanced, description, is_active.
- Trainer ghi template của mình, user đọc active.
- Index (trainer_id,is_active), (is_active,level).

**trainer_assignments**, ID id:

- trainer_id, user_id, template_id, note tùy chọn, assigned_at.
- status assigned/done/cancelled; done_at là Date khi done, null khi assigned/cancelled.
- Trainer tạo từ template active của mình cho user active. User chỉ đánh done assignment của mình, admin đọc.
- Quyền trainer đọc user khi status assigned; done/cancelled kết thúc quyền.
- Index (trainer_id,user_id,status), (user_id,status,assigned_at), template_id.

BE phải kiểm tra role/ownership trong thao tác, db:verify phát hiện quan hệ sai sau ghi/import.

## 7. Gamification

**challenges**, ID challenge_id: title, description, target_days int >0, reward_coins int >=0, badge_icon, is_active. Admin CRUD, user/trainer đọc active.

**user_challenges**, ID id: user_id, challenge_id, current_progress >=0, is_completed, joined_at, last_checkin Date/null, last_checkin_date tùy chọn. Partial unique (user_id,challenge_id) khi is_completed=false; cho phép lượt mới sau hoàn thành. Check-in tối đa 1/ngày, thưởng hoàn thành dùng transaction một lần. Progress là số ngày check-in phân biệt, có thể không liên tiếp.

**reward_items**, ID item_id: title, category badge/theme/voucher, cost_coins >=0, icon, is_available. Admin CRUD, user xem khả dụng. Soft-disable item đã có giao dịch.

**purchases**, ID purchase_id: user_id, item_id, item_category snapshot server, spent_coins >=0, purchased_at. Partial unique (user_id,item_id) khi badge: một lần trọn đời; voucher mua lặp được. Debit đủ tiền và insert purchase cùng transaction; giữ ID giao dịch khi retry để không trừ lại coins.

## 8. AI chat

**ai_chat_sessions**, ID session_id: user_id, title, timestamp chung; index (user_id,updated_at).

**ai_chat_messages**, ID message_id: user_id, session_id, sender user/ai, content 1–32000, ai_engine tùy chọn, timestamp Date; index (user_id,session_id,timestamp,message_id).

Chỉ chủ session truy cập, trainer/admin không đọc chat người khác. BE kiểm tra message.user_id == session.user_id; tự gắn sender=user, chỉ dịch vụ AI tin cậy ghi sender=ai.

## 9. Công thức

- BMI = weight/(height/100)². Phân loại trên giá trị chưa làm tròn: <18.5 thiếu cân; <23 cân đối; <25 thừa cân nhẹ; còn lại béo phì. Giá trị lưu làm tròn 2 chữ số.
- Nam BMR=10W+6.25H−5A+5; nữ BMR=10W+6.25H−5A−161.
- TDEE=BMR×1.2 sedentary, 1.375 light, 1.55 moderate, 1.725 active.
- Goal lose −500, maintain 0, gain +400. Làm tròn số nguyên rồi áp sàn nữ 1200/nam 1500.
- Nước=round(min(W×35,4000))+350 nếu có workout, chỉ cộng một lần, tính lại khi đổi ngày.

Đây là ràng buộc phần mềm theo yêu cầu. Chính sách người dưới 18 tuổi cần chốt trước khi dùng thực tế.

## 10. Triển khai và kiểm chứng

mongodb/schema.js là schema thực thi. Chạy db:migrate:plan trước khi nâng v1; db:migrate tạo backup/journal rồi nâng dữ liệu/schema. Xem [hướng dẫn database](mongodb/README.md).

Backup __fitlife_v1_*, journal __fitlife_migrations và archived_daily_quest_logs phục vụ giữ lịch sử, ngoài 16 collection nghiệp vụ. Không tự xóa dữ liệu để vượt lỗi duplicate.

Definition of Done đích: đăng ký/tính targets → log → quest thưởng một lần → shop debit đúng → home % ngày → trainer assign → admin quản lý. Giai đoạn hiện tại chỉ làm schema, index, dữ liệu mẫu và migration; chưa lập trình API/FE hay logic phân quyền/thưởng/streak. Xem [yêu cầu cho BE/FE sau này](mongodb/ROLE_CONTRACT.md).
