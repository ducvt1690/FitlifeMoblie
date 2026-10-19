-- ====================================================================
-- FITLIFE HEALTH & MMA (projectMMA) - DATABASE SCHEMA DEFINITION (DDL)
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
    fit_coins INT DEFAULT 150,
    streak_days INT DEFAULT 5,
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

-- 7. BẢNG GIẤC NGỦ (SLEEP_LOGS)
CREATE TABLE IF NOT EXISTS sleep_logs (
    sleep_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    hours DECIMAL(3,1) NOT NULL,
    quality VARCHAR(50) DEFAULT 'Ngủ sâu 😴',
    sleep_date DATE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 8. BẢNG TÂM TRẠNG (MOOD_LOGS)
CREATE TABLE IF NOT EXISTS mood_logs (
    mood_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    mood_label VARCHAR(50) NOT NULL,
    note TEXT,
    mood_date DATE NOT NULL,
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
    ai_engine VARCHAR(50) DEFAULT 'Turbo 0.3s',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ====================================================================
-- DỮ LIỆU MẪU (SEED DATA CHO DEMO ĐỒ ÁN)
-- ====================================================================
INSERT INTO users (user_id, email, password_hash, full_name, gender, age, height, weight, target_water, target_calories, fit_coins, streak_days)
VALUES 
('acc_demo', 'demo@fitlife.app', '123', 'Nguyễn Thành Nam', 'male', 23, 170.0, 65.0, 2275, 2000, 150, 5)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO reward_items (item_id, title, category, cost_coins, icon)
VALUES 
('badge_1', 'Huy hiệu Người Mới Nhập Môn', 'badge', 0, 'ribbon-outline'),
('badge_2', 'Chiến Binh Thủy Hỏa 💧', 'badge', 50, 'water-outline'),
('badge_3', 'Vua Tabata Đốt Mỡ 🔥', 'badge', 100, 'flame-outline'),
('badge_4', 'Bậc Thầy Kỷ Luật 7 Ngày ⭐', 'badge', 200, 'trophy-outline')
ON CONFLICT (item_id) DO NOTHING;
