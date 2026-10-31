// Dữ liệu mẫu cho chế độ demo, cho đến khi nối các API nhật ký.
// Bộ nhiệm vụ khớp backend/database/mongodb/data/catalogs.json (quest v2).

export const DEMO_USER = {
  isDemo: true,
  id: 'demo',
  email: 'demo@fitlife.vn',
  name: 'Nguyễn Minh Anh',
  role: 'user',
  profile: { height: 170, weight: 65, target_water: 2275, target_calories: 2484, coins: 0 },
};

export const DEMO_TODAY = {
  waterMl: 1250,
  calories: { eaten: 1380, protein: 82, carbs: 160, fat: 41 },
  workoutMinutes: 25,
  sleepHours: 7,
  streakDays: 0,
};

export const DEMO_QUESTS = [
  { key: 'q_water', title: 'Ghi nhận nước uống', reward: 10, done: true, icon: 'water' },
  { key: 'q_workout', title: 'Ghi nhận buổi tập', reward: 10, done: true, icon: 'barbell' },
  { key: 'q_meal', title: 'Ghi nhận bữa ăn', reward: 10, done: false, icon: 'restaurant' },
  { key: 'q_sleep', title: 'Ghi nhận giấc ngủ', reward: 10, done: false, icon: 'moon' },
  { key: 'q_mood', title: 'Ghi nhận tâm trạng', reward: 10, done: false, icon: 'happy' },
  { key: 'q_checkin', title: 'Điểm danh trong ngày', reward: 10, done: true, icon: 'checkmark' },
  { key: 'q_chat', title: 'Trò chuyện với AI Coach', reward: 10, done: false, icon: 'chat' },
];

// 7 ngày gần nhất; null = ngày chưa có dữ liệu (khác với số đo 0).
export const DEMO_WEEK_WATER = [
  { day: 'T2', ml: 2100 }, { day: 'T3', ml: 1800 }, { day: 'T4', ml: null },
  { day: 'T5', ml: 2400 }, { day: 'T6', ml: 1950 }, { day: 'T7', ml: 2275 }, { day: 'CN', ml: 1250 },
];

export const DEMO_MEALS = [
  { meal: 'Bữa sáng', items: 'Yến mạch, chuối, sữa chua', kcal: 420 },
  { meal: 'Bữa trưa', items: 'Cơm gạo lứt, ức gà, rau luộc', kcal: 640 },
  { meal: 'Bữa phụ', items: 'Hạt điều, táo', kcal: 320 },
  { meal: 'Bữa tối', items: 'Chưa ghi nhận', kcal: null },
];
