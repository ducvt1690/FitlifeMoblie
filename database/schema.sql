-- ====================================================================
-- FITLIFE PRO (projectMMA) - DATABASE SCHEMA DEFINITION (DDL)
-- Hệ quản trị tương thích: PostgreSQL / MySQL / SQLite
-- ====================================================================

-- 1. BẢNG NGƯỜI DÙNG & HỒ SƠ THỂ TRẠNG (USERS)
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    gender VARCHAR(10) DEFAULT 'male',
    age INT DEFAULT 23,
    height DECIMAL(5,2) DEFAULT 170.0,
    weight DECIMAL(5,2) DEFAULT 65.0,
    activity_level VARCHAR(20) DEFAULT 'moderate',
    goal VARCHAR(20) DEFAULT 'maintain',
    target_water INT DEFAULT 2200,
    target_calories INT DEFAULT 2000,
    fit_coins INT DEFAULT 0,
    streak_days INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. BẢNG NHẬT KÝ UỐNG NƯỚC (WATER_LOGS)
CREATE TABLE IF NOT EXISTS water_logs (
    log_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    amount INT NOT NULL,
    log_time VARCHAR(8) NOT NULL,
    log_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 3. BẢNG NHẬT KÝ TẬP LUYỆN (WORKOUT_LOGS)
CREATE TABLE IF NOT EXISTS workout_logs (
    workout_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(50) DEFAULT 'Cardio',
    duration_seconds INT DEFAULT 900,
    calories_burned INT DEFAULT 180,
    workout_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 4. BẢNG NHẬT KÝ BỮA ĂN & CALO (MEAL_LOGS)
CREATE TABLE IF NOT EXISTS meal_logs (
    meal_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    meal_name VARCHAR(150) NOT NULL,
    calories INT NOT NULL,
    protein DECIMAL(5,1) DEFAULT 0,
    carbs DECIMAL(5,1) DEFAULT 0,
    fat DECIMAL(5,1) DEFAULT 0,
    meal_type VARCHAR(20) DEFAULT 'lunch',
    meal_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 5. BẢNG NHIỆM VỤ HÀNG NGÀY (DAILY_QUEST_LOGS)
CREATE TABLE IF NOT EXISTS daily_quest_logs (
    quest_log_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    quest_key VARCHAR(50) NOT NULL,
    quest_title VARCHAR(150) NOT NULL,
    reward_coins INT DEFAULT 10,
    is_completed BOOLEAN DEFAULT FALSE,
    extra_value VARCHAR(100),
    quest_date DATE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 6. BẢNG LỊCH SỬ THỂ TRẠNG & BMI (BMI_HISTORY)
CREATE TABLE IF NOT EXISTS bmi_history (
    record_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    weight DECIMAL(5,2) NOT NULL,
    height DECIMAL(5,2) NOT NULL,
    bmi_value DECIMAL(4,1) NOT NULL,
    bmi_status VARCHAR(50) NOT NULL,
    record_date DATE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 7. BẢNG THEO DÕI BƯỚC CHÂN (STEP_LOGS)
CREATE TABLE IF NOT EXISTS step_logs (
    step_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    steps_count INT DEFAULT 0,
    goal_steps INT DEFAULT 10000,
    step_date DATE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 8. BẢNG THỬ THÁCH 30 NGÀY (USER_CHALLENGES)
CREATE TABLE IF NOT EXISTS user_challenges (
    challenge_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(150) NOT NULL,
    progress_percent INT DEFAULT 0,
    progress_label VARCHAR(50),
    is_completed BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 9. BẢNG VẬT PHẨM QUÀ TẶNG & GIAO DỊCH ĐỔI XU (REWARD_ITEMS & PURCHASES)
CREATE TABLE IF NOT EXISTS reward_items (
    item_id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'badge',
    cost_coins INT NOT NULL,
    icon VARCHAR(50) DEFAULT 'ribbon-outline',
    is_available BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS purchases (
    purchase_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    spent_coins INT NOT NULL,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES reward_items(item_id)
);

-- 10. BẢNG TIN NHẮN TRỢ LÝ AI (AI_CHAT_MESSAGES)
CREATE TABLE IF NOT EXISTS ai_chat_messages (
    message_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    sender VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    ai_engine VARCHAR(50) DEFAULT 'FitLife AI Coach',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- CHỈ MỤC TỐI ƯU TRUY VẤN (INDEXES)
CREATE INDEX IF NOT EXISTS idx_water_user_date ON water_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_workout_user_date ON workout_logs(user_id, workout_date);
CREATE INDEX IF NOT EXISTS idx_meal_user_date ON meal_logs(user_id, meal_date);
CREATE INDEX IF NOT EXISTS idx_quest_user_date ON daily_quest_logs(user_id, quest_date);
