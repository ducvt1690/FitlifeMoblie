# Từ điển dữ liệu FitLife

Sinh từ `backend/database/mongodb/schema.js`; auth_sessions được giải thích trong README.

### users

Khóa nghiệp vụ: `user_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| user_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| email | string | Có |  |
| password_hash | string | Không |  |
| full_name | string | Có |  |
| role | string | Có | user, trainer, admin |
| is_active | bool | Có |  |
| gender | string | Có | male, female |
| age | int | Có |  min=5 max=100 |
| date_of_birth | string | Không |  |
| height | int/long/double/decimal | Có |  min=80 max=250 |
| weight | int/long/double/decimal | Có |  min=25 max=300 |
| activity_level | string | Có | sedentary, light, moderate, active |
| goal | string | Có | lose, maintain, gain |
| target_water | int | Có |  min=500 max=4350 |
| target_calories | int | Có |  min=1200 |
| fit_coins | int | Có |  min=0 |
| streak_days | int | Có |  min=0 |
| timezone | string | Có |  |
| streak_last_date | string | Không |  |

Indexes:

- `uq_user_id`: `{"user_id":1}`, unique
- `uq_user_email`: `{"email":1}`, unique

### water_logs

Khóa nghiệp vụ: `log_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| log_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| user_id | string | Có |  |
| amount | int | Có |  min=1 |
| log_time | string | Có |  |
| log_date | string | Có |  |

Indexes:

- `uq_log_id`: `{"log_id":1}`, unique
- `by_user_log_date`: `{"user_id":1,"log_date":-1}`

### workout_logs

Khóa nghiệp vụ: `workout_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| workout_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| user_id | string | Có |  |
| title | string | Có |  |
| category | string | Có |  |
| duration_seconds | int | Có |  min=1 |
| calories_burned | int | Có |  min=0 |
| workout_date | string | Có |  |

Indexes:

- `uq_workout_id`: `{"workout_id":1}`, unique
- `by_user_workout_date`: `{"user_id":1,"workout_date":-1}`

### exercises

Khóa nghiệp vụ: `exercise_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| exercise_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| source | string | Có | exercisedb_v1 |
| source_exercise_id | string | Có |  |
| name | string | Có |  |
| gif_url | string | Có |  |
| body_parts | array | Có |  |
| equipments | array | Có |  |
| target_muscles | array | Có |  |
| secondary_muscles | array | Có |  |
| instructions | array | Có |  |
| name_vi | string | Không |  |
| body_parts_vi | array | Không |  |
| equipments_vi | array | Không |  |
| target_muscles_vi | array | Không |  |
| secondary_muscles_vi | array | Không |  |
| instructions_vi | array | Không |  |
| is_active | bool | Có |  |
| synced_at | date | Có |  |

Indexes:

- `uq_exercise_id`: `{"exercise_id":1}`, unique
- `uq_exercise_source_id`: `{"source":1,"source_exercise_id":1}`, unique
- `by_active_source_name`: `{"is_active":1,"source":1,"name":1}`
- `by_body_part_active`: `{"body_parts":1,"is_active":1}`
- `by_target_muscle_active`: `{"target_muscles":1,"is_active":1}`
- `by_equipment_active`: `{"equipments":1,"is_active":1}`

### meal_logs

Khóa nghiệp vụ: `meal_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| meal_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| user_id | string | Có |  |
| meal_name | string | Có |  |
| calories | int | Có |  min=1 |
| protein | int/long/double/decimal | Có |  min=0 |
| carbs | int/long/double/decimal | Có |  min=0 |
| fat | int/long/double/decimal | Có |  min=0 |
| meal_type | string | Có | breakfast, lunch, dinner, snack |
| meal_date | string | Có |  |

Indexes:

- `uq_meal_id`: `{"meal_id":1}`, unique
- `by_user_meal_date`: `{"user_id":1,"meal_date":-1}`

### daily_quest_logs

Khóa nghiệp vụ: `quest_log_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| quest_log_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| user_id | string | Có |  |
| quest_key | string | Có | q_water, q_workout, q_meal, q_sleep, q_mood, q_checkin, q_chat |
| quest_title | string | Có |  |
| reward_coins | int | Có |  min=10 max=10 |
| is_completed | bool | Có |  |
| extra_value | string | Không |  |
| quest_date | string | Có |  |
| completed_at | date/null | Không |  |

Indexes:

- `uq_quest_log_id`: `{"quest_log_id":1}`, unique
- `uq_user_day_quest`: `{"user_id":1,"quest_date":1,"quest_key":1}`, unique

### bmi_history

Khóa nghiệp vụ: `record_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| record_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| user_id | string | Có |  |
| weight | int/long/double/decimal | Có |  min=25 max=300 |
| height | int/long/double/decimal | Có |  min=80 max=250 |
| bmi_value | int/long/double/decimal | Có |  min=0.01 |
| bmi_status | string | Có | Thiếu cân, Cân đối, Thừa cân nhẹ, Tiền béo phì / Béo phì |
| record_date | string | Có |  |

Indexes:

- `uq_record_id`: `{"record_id":1}`, unique
- `uq_user_record_date`: `{"user_id":1,"record_date":1}`, unique

### sleep_logs

Khóa nghiệp vụ: `sleep_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| sleep_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| user_id | string | Có |  |
| hours | int/long/double/decimal | Có |  min=0 max=24 |
| quality | string | Có | Sâu, Bình thường, Chập chờn |
| sleep_date | string | Có |  |

Indexes:

- `uq_sleep_id`: `{"sleep_id":1}`, unique
- `uq_user_sleep_date`: `{"user_id":1,"sleep_date":1}`, unique

### mood_logs

Khóa nghiệp vụ: `mood_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| mood_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| user_id | string | Có |  |
| mood_label | string | Có |  |
| note | string | Không |  |
| mood_date | string | Có |  |

Indexes:

- `uq_mood_id`: `{"mood_id":1}`, unique
- `uq_user_mood_date`: `{"user_id":1,"mood_date":1}`, unique

### workout_templates

Khóa nghiệp vụ: `template_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| template_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| trainer_id | string | Có |  |
| title | string | Có |  |
| category | string | Có |  |
| duration_seconds | int | Có |  min=1 |
| calories_est | int | Có |  min=0 |
| level | string | Có | beginner, intermediate, advanced |
| description | string | Có |  |
| is_active | bool | Có |  |

Indexes:

- `uq_template_id`: `{"template_id":1}`, unique
- `by_trainer_active`: `{"trainer_id":1,"is_active":1}`
- `by_active_level`: `{"is_active":1,"level":1}`

### trainer_assignments

Khóa nghiệp vụ: `id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| trainer_id | string | Có |  |
| user_id | string | Có |  |
| template_id | string | Có |  |
| note | string | Không |  |
| assigned_at | date | Có |  |
| status | string | Có | assigned, done, cancelled |
| done_at | date/null | Có |  |

Indexes:

- `uq_id`: `{"id":1}`, unique
- `by_trainer_user_status`: `{"trainer_id":1,"user_id":1,"status":1}`
- `by_user_assignment_status`: `{"user_id":1,"status":1,"assigned_at":-1}`
- `by_assignment_template`: `{"template_id":1}`

### trainer_links

Khóa nghiệp vụ: `link_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| link_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| trainer_id | string | Có |  |
| user_id | string/null | Có |  |
| invite_code | string | Có |  |
| status | string | Có | pending, active, ended |
| accepted_at | date/null | Có |  |
| ended_at | date/null | Có |  |

Indexes:

- `uq_link_id`: `{"link_id":1}`, unique
- `uq_link_invite_code`: `{"invite_code":1}`, unique
- `uq_active_trainer_user`: `{"trainer_id":1,"user_id":1}`, unique, partial: `{"status":"active"}`
- `by_trainer_link_status`: `{"trainer_id":1,"status":1}`
- `by_user_link_status`: `{"user_id":1,"status":1}`

### admin_logs

Khóa nghiệp vụ: `log_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| log_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| admin_id | string | Có |  |
| action | string | Có |  |
| target_type | string | Có | user, challenge, reward_item |
| target_id | string | Có |  |
| note | string | Không |  |

Indexes:

- `uq_log_id`: `{"log_id":1}`, unique
- `by_admin_log_time`: `{"created_at":-1}`

### challenges

Khóa nghiệp vụ: `challenge_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| challenge_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| title | string | Có |  |
| description | string | Có |  |
| target_days | int | Có |  min=1 |
| reward_coins | int | Có |  min=0 |
| badge_icon | string | Có |  |
| is_active | bool | Có |  |

Indexes:

- `uq_challenge_id`: `{"challenge_id":1}`, unique
- `by_active_duration`: `{"is_active":1,"target_days":1}`

### user_challenges

Khóa nghiệp vụ: `id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| user_id | string | Có |  |
| challenge_id | string | Có |  |
| current_progress | int | Có |  min=0 |
| is_completed | bool | Có |  |
| joined_at | date | Có |  |
| last_checkin | date/null | Có |  |
| last_checkin_date | string | Không |  |

Indexes:

- `uq_id`: `{"id":1}`, unique
- `uq_user_active_challenge`: `{"user_id":1,"challenge_id":1}`, unique, partial: `{"is_completed":false}`
- `by_challenge_completion`: `{"challenge_id":1,"is_completed":1}`

### reward_items

Khóa nghiệp vụ: `item_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| item_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| title | string | Có |  |
| category | string | Có | badge, theme, voucher |
| cost_coins | int | Có |  min=0 |
| icon | string | Có |  |
| is_available | bool | Có |  |

Indexes:

- `uq_item_id`: `{"item_id":1}`, unique
- `by_available_category_price`: `{"is_available":1,"category":1,"cost_coins":1}`

### purchases

Khóa nghiệp vụ: `purchase_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| purchase_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| user_id | string | Có |  |
| item_id | string | Có |  |
| item_category | string | Có | badge, theme, voucher |
| spent_coins | int | Có |  min=0 |
| purchased_at | date | Có |  |

Indexes:

- `uq_purchase_id`: `{"purchase_id":1}`, unique
- `uq_user_badge`: `{"user_id":1,"item_id":1}`, unique, partial: `{"item_category":"badge"}`
- `by_user_purchased_at`: `{"user_id":1,"purchased_at":-1}`
- `by_purchased_item`: `{"item_id":1}`

### ai_chat_sessions

Khóa nghiệp vụ: `session_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| session_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| user_id | string | Có |  |
| title | string | Có |  |

Indexes:

- `uq_session_id`: `{"session_id":1}`, unique
- `by_user_session_updated`: `{"user_id":1,"updated_at":-1}`

### ai_chat_messages

Khóa nghiệp vụ: `message_id`.

| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |
|---|---|---|---|
| message_id | string | Có |  |
| created_at | date | Có |  |
| updated_at | date | Có |  |
| user_id | string | Có |  |
| session_id | string | Có |  |
| sender | string | Có | user, ai |
| content | string | Có |  |
| ai_engine | string | Không |  |
| timestamp | date | Có |  |

Indexes:

- `uq_message_id`: `{"message_id":1}`, unique
- `by_user_session_message_time`: `{"user_id":1,"session_id":1,"timestamp":1,"message_id":1}`
