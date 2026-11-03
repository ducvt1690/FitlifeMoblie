# 🗄️ FitLife Pro — Thiết kế Cơ sở Dữ liệu (Database Module)

Thư mục `database/` chứa toàn bộ cấu trúc lược đồ CSDL chuẩn SQL, dữ liệu khởi tạo và module đọc/ghi dữ liệu bền vững cho hệ thống **FitLife Pro**.

---

## 📁 Cấu trúc thư mục `database/`

| Tệp tin | Mô tả chức năng |
| :--- | :--- |
| [`schema.sql`](./schema.sql) | Định nghĩa lược đồ CSDL quan hệ (DDL `CREATE TABLE` & `CREATE INDEX`) cho 10 bảng dữ liệu. |
| [`seed.sql`](./seed.sql) | Kịch bản khởi tạo dữ liệu danh mục ban đầu (`INSERT INTO` bảng vật phẩm, quà tặng). |
| [`db.js`](./db.js) | Engine kết nối và thao tác đọc/ghi dữ liệu bền vững (`readDb`, `writeDb`). |
| [`fitlife_db.json`](./fitlife_db.json) | Tệp lưu trữ dữ liệu JSON thực thi phía Server. |

---

## 📊 Sơ đồ Quan hệ Thực thể (ERD)

```mermaid
erDiagram
    USERS ||--o{ WATER_LOGS : "ghi nhận"
    USERS ||--o{ WORKOUT_LOGS : "tập luyện"
    USERS ||--o{ MEAL_LOGS : "dinh dưỡng"
    USERS ||--o{ DAILY_QUEST_LOGS : "hoàn thành"
    USERS ||--o{ BMI_HISTORY : "theo dõi"
    USERS ||--o{ STEP_LOGS : "bước chân"
    USERS ||--o{ PURCHASES : "đổi thưởng"
    REWARD_ITEMS ||--o{ PURCHASES : "thuộc về"
    USERS ||--o{ AI_CHAT_MESSAGES : "trò chuyện"

    USERS {
        varchar user_id PK
        varchar email UK
        varchar password_hash
        varchar full_name
        decimal height
        decimal weight
        int target_water
        int target_calories
        int fit_coins
        int streak_days
    }
    WATER_LOGS {
        varchar log_id PK
        varchar user_id FK
        int amount
        varchar log_time
        date log_date
    }
    WORKOUT_LOGS {
        varchar workout_id PK
        varchar user_id FK
        varchar title
        int duration_seconds
        int calories_burned
        date workout_date
    }
    MEAL_LOGS {
        varchar meal_id PK
        varchar user_id FK
        varchar meal_name
        int calories
        decimal protein
        decimal carbs
        decimal fat
        date meal_date
    }
    DAILY_QUEST_LOGS {
        varchar quest_log_id PK
        varchar user_id FK
        varchar quest_key
        int reward_coins
        boolean is_completed
        date quest_date
    }
```
