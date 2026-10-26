'use strict';

const { collections } = require('./schema');
const { buildDemoDocuments, demoId, localDate } = require('./seed');
const catalogs = require('./data/catalogs.json');

const VERSION = 'compass-samples-v1';
const MINIMUM = 6;
const id = (key) => demoId(`${VERSION}:${key}`);
const members = [
  { key: 'minh', full_name: 'Trần Quang Minh (Mẫu)', gender: 'male', age: 28,
    height: 175, weight: 72, activity_level: 'moderate', goal: 'maintain' },
  { key: 'linh', full_name: 'Lê Thùy Linh (Mẫu)', gender: 'female', age: 25,
    height: 162, weight: 54, activity_level: 'light', goal: 'maintain' },
  { key: 'khoa', full_name: 'Phạm Anh Khoa (Mẫu)', gender: 'male', age: 31,
    height: 168, weight: 78, activity_level: 'active', goal: 'lose' },
];

function calorieTarget(profile) {
  const bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age
    + (profile.gender === 'male' ? 5 : -161);
  const activity = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
  const adjustment = { lose: -500, maintain: 0, gain: 400 };
  return Math.max(profile.gender === 'male' ? 1500 : 1200,
    Math.round(bmr * activity[profile.activity_level] + adjustment[profile.goal]));
}

function bmiStatus(value) {
  return value < 18.5 ? 'Thiếu cân' : value < 23 ? 'Cân đối'
    : value < 25 ? 'Thừa cân nhẹ' : 'Tiền béo phì / Béo phì';
}

async function planSampleData(db, password, now = new Date()) {
  const existing = {};
  await Promise.all(collections.map(async ({ name }) => {
    existing[name] = await db.collection(name).find({}).toArray();
  }));
  const beforeCounts = Object.fromEntries(collections.map(({ name }) => [name, existing[name].length]));
  const plan = { version: VERSION, database: db.databaseName, minimum: MINIMUM,
    fixtureDate: null, userIds: [], beforeCounts, afterCounts: { ...beforeCounts }, documents: {} };
  if (Object.values(beforeCounts).every((count) => count >= MINIMUM)) return plan;

  // This supplement extends the existing three-role fixture, never real user histories.
  if (beforeCounts.users !== 3 || existing.users.some((user) => !user.email?.endsWith('@fitlife.example'))) {
    throw new Error('Sample supplement expects the three existing FitLife example accounts. No data changed.');
  }
  if (existing.users.some((user) => members.some((member) => user.user_id === id(`user:${member.key}`)))) {
    throw new Error('Partial sample cohort detected. Inspect the saved manifest before retrying.');
  }
  const trainer = existing.users.find((user) => user.role === 'trainer' && user.is_active);
  const freeBadge = existing.reward_items.find((item) => item.category === 'badge'
    && item.cost_coins === 0 && item.is_available);
  const paidBadge = existing.reward_items.find((item) => item.category === 'badge'
    && item.cost_coins === 50 && item.is_available);
  if (!trainer || !freeBadge || !paidBadge) throw new Error('Required trainer or sample badge catalog missing.');

  // Completed fixture activities use past calendar days, never future timestamps.
  const date = localDate(new Date(now.getTime() - 86400000));
  const previousDate = localDate(new Date(now.getTime() - 2 * 86400000));
  const at = (day, time) => new Date(`${day}T${time}:00+07:00`);
  const stamp = (time) => ({ created_at: time, updated_at: time });
  const profileStamp = stamp(at(previousDate, '06:00'));
  const hash = () => buildDemoDocuments(password, now).users[0].password_hash;
  const users = members.map(({ key, ...profile }) => ({ ...profile,
    user_id: id(`user:${key}`), email: `${key}.sample@fitlife.example`, password_hash: hash(),
    role: 'user', is_active: true, target_water: Math.round(Math.min(profile.weight * 35, 4000)),
    target_calories: calorieTarget(profile), fit_coins: 0, streak_days: 1,
    streak_last_date: date, timezone: 'Asia/Ho_Chi_Minh', ...profileStamp,
  }));
  plan.fixtureDate = date;
  plan.userIds = users.map((user) => user.user_id);
  plan.documents.users = users;
  const deficit = (name, floor = 0) => Math.max(floor, MINIMUM - beforeCounts[name]);
  const record = (name, index, data, time) => {
    const definition = collections.find((entry) => entry.name === name);
    return { [definition.id]: id(`${name}:${index}`), ...data, ...stamp(time) };
  };
  const activityRows = (name, time, make) => Array.from({ length: deficit(name, users.length) }, (_, index) => {
    const user = users[index % users.length];
    const day = index < users.length ? date : previousDate;
    return record(name, index, { user_id: user.user_id, ...make(user, index, day) }, at(day, time));
  });
  plan.documents.water_logs = activityRows('water_logs', '08:00', (_user, index, day) => ({
    amount: [350, 250, 400, 300, 500, 200][index % 6], log_time: '08:00', log_date: day,
  }));
  const exercises = [
    { title: 'Đi bộ nhanh (Mẫu)', category: 'Cardio', duration_seconds: 1800, calories: 150, level: 'beginner' },
    { title: 'Yoga giãn cơ (Mẫu)', category: 'Yoga', duration_seconds: 1200, calories: 70, level: 'beginner' },
    { title: 'Circuit toàn thân (Mẫu)', category: 'Strength', duration_seconds: 1500, calories: 200, level: 'intermediate' },
    { title: 'Đạp xe nhẹ (Mẫu)', category: 'Cardio', duration_seconds: 2100, calories: 220, level: 'beginner' },
    { title: 'Plank và core (Mẫu)', category: 'Strength', duration_seconds: 900, calories: 90, level: 'intermediate' },
    { title: 'Giãn cơ sau tập (Mẫu)', category: 'Stretching', duration_seconds: 600, calories: 35, level: 'beginner' },
  ];
  plan.documents.workout_logs = activityRows('workout_logs', '07:00', (_user, index, day) => {
    const workout = exercises[index % exercises.length];
    return { title: workout.title, category: workout.category, duration_seconds: workout.duration_seconds,
      calories_burned: workout.calories, workout_date: day };
  });
  const meals = [
    { meal_name: 'Yến mạch và sữa chua (Mẫu)', calories: 342, protein: 18, carbs: 45, fat: 10 },
    { meal_name: 'Bánh mì trứng (Mẫu)', calories: 408, protein: 22, carbs: 44, fat: 16 },
    { meal_name: 'Phở gà (Mẫu)', calories: 440, protein: 30, carbs: 53, fat: 12 },
    { meal_name: 'Khoai lang và trứng luộc (Mẫu)', calories: 336, protein: 20, carbs: 37, fat: 12 },
  ];
  plan.documents.meal_logs = activityRows('meal_logs', '08:15', (_user, index, day) => ({
    ...meals[index % meals.length], meal_type: 'breakfast', meal_date: day,
  }));
  plan.documents.sleep_logs = activityRows('sleep_logs', '06:30', (_user, index, day) => ({
    hours: [7.5, 8, 7, 6.5, 7.8, 8.2][index % 6],
    quality: ['Sâu', 'Sâu', 'Bình thường', 'Chập chờn', 'Sâu', 'Sâu'][index % 6], sleep_date: day,
  }));
  plan.documents.mood_logs = activityRows('mood_logs', '08:30', (_user, index, day) => ({
    mood_label: ['Vui vẻ', 'Bình tĩnh', 'Năng động', 'Hơi mệt', 'Thoải mái', 'Tập trung'][index % 6],
    note: 'Dữ liệu giả lập để xem thử trong Compass.', mood_date: day,
  }));
  plan.documents.bmi_history = activityRows('bmi_history', '06:45', (user, _index, day) => {
    const rawBmi = user.weight / ((user.height / 100) ** 2);
    const bmi = Math.round(rawBmi * 100) / 100;
    return { weight: user.weight, height: user.height, bmi_value: bmi, bmi_status: bmiStatus(rawBmi), record_date: day };
  });
  plan.documents.challenges = Array.from({ length: deficit('challenges') }, (_, index) => {
    const challenge = [
      ['7 ngày ghi nhận bữa sáng (Mẫu)', 'Ghi nhận bữa sáng mỗi ngày trong một tuần.', 'restaurant-outline'],
      ['7 ngày theo dõi tâm trạng (Mẫu)', 'Ghi nhận tâm trạng mỗi ngày trong một tuần.', 'happy-outline'],
      ['7 ngày khởi động nhẹ (Mẫu)', 'Ghi nhận một buổi vận động nhẹ mỗi ngày.', 'walk-outline'],
    ][index % 3];
    return record('challenges', index, { title: challenge[0], description: `${challenge[1]} Dữ liệu minh họa.`,
      target_days: 7, reward_coins: 70, badge_icon: challenge[2], is_active: true }, at(previousDate, '06:00'));
  });
  plan.documents.workout_templates = Array.from({ length: deficit('workout_templates') }, (_, index) => {
    const workout = exercises[index % exercises.length];
    return record('workout_templates', index, { trainer_id: trainer.user_id, title: workout.title,
      category: workout.category, duration_seconds: workout.duration_seconds, calories_est: workout.calories,
      level: workout.level, description: 'Template giả lập do trainer mẫu sở hữu; dùng để xem thử dữ liệu.',
      is_active: true }, at(previousDate, '06:00'));
  });
  const templates = plan.documents.workout_templates.length ? plan.documents.workout_templates
    : existing.workout_templates.filter((template) => template.trainer_id === trainer.user_id && template.is_active);
  if (!templates.length) throw new Error('No active template available for sample assignments.');
  plan.documents.trainer_assignments = Array.from({ length: deficit('trainer_assignments') }, (_, index) => {
    const user = users[index % users.length];
    return record('trainer_assignments', index, { trainer_id: trainer.user_id, user_id: user.user_id,
      template_id: templates[index % templates.length].template_id, note: 'Bài được giao để minh họa trong Compass.',
      assigned_at: at(date, '06:15'), status: 'assigned', done_at: null }, at(date, '06:15'));
  });
  const challenges = [...plan.documents.challenges, ...existing.challenges.filter((challenge) => challenge.is_active)];
  plan.documents.user_challenges = Array.from({ length: deficit('user_challenges') }, (_, index) => {
    const user = users[index % users.length];
    const challenge = challenges[Math.floor(index / users.length) % challenges.length];
    return record('user_challenges', index, { user_id: user.user_id, challenge_id: challenge.challenge_id,
      current_progress: 1, is_completed: false, joined_at: at(date, '06:00'),
      last_checkin: at(date, '18:00'), last_checkin_date: date }, at(date, '18:00'));
  });
  const topics = ['Kế hoạch vận động', 'Ghi nhận giấc ngủ', 'Thói quen uống nước', 'Nhật ký bữa sáng', 'Tâm trạng hôm nay'];
  plan.documents.ai_chat_sessions = Array.from({ length: deficit('ai_chat_sessions', users.length) }, (_, index) => {
    const user = users[index % users.length];
    return record('ai_chat_sessions', index, { user_id: user.user_id,
      title: `${topics[index % topics.length]} (Mẫu)` }, at(date, '19:00'));
  });
  plan.documents.ai_chat_messages = plan.documents.ai_chat_sessions.map((session, index) => record('ai_chat_messages', index, {
    user_id: session.user_id, session_id: session.session_id, sender: 'user',
    content: `${topics[index % topics.length]}: đây là tin nhắn mẫu, chưa gửi đến AI.`, timestamp: at(date, '19:00'),
  }, at(date, '19:00')));
  // Keep every sample session meaningful; add replies only if needed to reach the minimum.
  while (beforeCounts.ai_chat_messages + plan.documents.ai_chat_messages.length < MINIMUM) {
    const index = plan.documents.ai_chat_messages.length;
    const session = plan.documents.ai_chat_sessions[index % plan.documents.ai_chat_sessions.length];
    plan.documents.ai_chat_messages.push(record('ai_chat_messages', index, { user_id: session.user_id,
      session_id: session.session_id, sender: 'ai', ai_engine: 'demo-fixture',
      content: 'Phản hồi giả lập để kiểm tra giao diện lịch sử chat.', timestamp: at(date, '19:01'),
    }, at(date, '19:01')));
  }
  plan.documents.daily_quest_logs = users.flatMap((user) => catalogs.quest_templates.map((quest) => {
    const extraValues = { q_water: 'Đã ghi nhận nước uống', q_workout: 'Đã ghi nhận buổi tập',
      q_meal: 'Đã ghi nhận bữa sáng', q_sleep: 'Đã ghi nhận giấc ngủ', q_mood: 'Đã ghi nhận tâm trạng',
      q_checkin: 'Điểm danh mẫu', q_chat: 'Đã lưu tin nhắn mẫu' };
    return record('daily_quest_logs', `${user.user_id}:${quest.quest_key}`, { user_id: user.user_id,
      ...quest, quest_date: date, is_completed: true, completed_at: at(date, '20:00'),
      extra_value: extraValues[quest.quest_key] }, at(date, '20:00'));
  }));
  plan.documents.purchases = Array.from({ length: deficit('purchases') }, (_, index) => {
    const user = users[index % users.length];
    const item = index < users.length ? freeBadge : paidBadge;
    return record('purchases', index, { user_id: user.user_id, item_id: item.item_id,
      item_category: item.category, spent_coins: item.cost_coins, purchased_at: at(date, '20:15'),
    }, at(date, '20:15'));
  });
  for (const user of users) {
    const earned = plan.documents.daily_quest_logs.filter((quest) => quest.user_id === user.user_id)
      .reduce((sum, quest) => sum + quest.reward_coins, 0);
    const spent = plan.documents.purchases.filter((purchase) => purchase.user_id === user.user_id)
      .reduce((sum, purchase) => sum + purchase.spent_coins, 0);
    user.fit_coins = earned - spent;
    user.updated_at = at(date, '20:15');
  }
  for (const { name } of collections) plan.afterCounts[name] += plan.documents[name]?.length || 0;
  verifySamplePlan(plan);
  return plan;
}

function verifySamplePlan(plan) {
  if (!Object.keys(plan.documents).length) return true;
  const check = (condition, message) => { if (!condition) throw new Error(`Sample plan: ${message}`); };
  check(Object.values(plan.afterCounts).every((count) => count >= MINIMUM), 'collection below six records');
  const rows = plan.documents;
  const activities = { q_water: ['water_logs', 'log_date'], q_workout: ['workout_logs', 'workout_date'],
    q_meal: ['meal_logs', 'meal_date'], q_sleep: ['sleep_logs', 'sleep_date'],
    q_mood: ['mood_logs', 'mood_date'] };
  for (const user of rows.users) {
    const quests = rows.daily_quest_logs.filter((quest) => quest.user_id === user.user_id);
    const purchases = rows.purchases.filter((purchase) => purchase.user_id === user.user_id);
    check(quests.length === 7 && new Set(quests.map((quest) => quest.quest_key)).size === 7, 'incomplete quest set');
    check(user.fit_coins >= 0 && user.fit_coins === quests.reduce((sum, quest) => sum + quest.reward_coins, 0)
      - purchases.reduce((sum, purchase) => sum + purchase.spent_coins, 0), 'coin balance mismatch');
    check(user.target_calories === calorieTarget(user), 'calorie target mismatch');
    check(user.target_water === Math.round(Math.min(user.weight * 35, 4000)), 'base water target mismatch');
    check(user.streak_days === 1 && user.streak_last_date === plan.fixtureDate, 'streak mismatch');
    for (const quest of quests) {
      const activity = activities[quest.quest_key];
      if (activity) check(rows[activity[0]].some((row) => row.user_id === user.user_id
        && row[activity[1]] === quest.quest_date), `missing activity for ${quest.quest_key}`);
      if (quest.quest_key === 'q_chat') check(rows.ai_chat_messages.some((message) => message.user_id === user.user_id
        && message.sender === 'user' && localDate(message.timestamp) === quest.quest_date), 'missing user chat');
      check(quest.is_completed && quest.completed_at instanceof Date, 'invalid quest completion');
    }
  }
  for (const bmi of rows.bmi_history) {
    const rawBmi = bmi.weight / ((bmi.height / 100) ** 2);
    check(bmi.bmi_value === Math.round(rawBmi * 100) / 100, 'BMI mismatch');
    check(bmi.bmi_status === bmiStatus(rawBmi), 'BMI classification mismatch');
  }
  for (const session of rows.ai_chat_sessions) check(rows.ai_chat_messages.some((message) =>
    message.session_id === session.session_id && message.user_id === session.user_id && message.sender === 'user'),
  'session without a user message');
  return true;
}

async function applySampleData(db, client, plan) {
  if (db.databaseName !== plan.database) throw new Error('Sample plan database mismatch.');
  verifySamplePlan(plan);
  const session = client.startSession();
  const inserted = {};
  try {
    await session.withTransaction(async () => {
      // Counts also detect a concurrent writer before inserting this fixed cohort.
      for (const { name } of collections) {
        const count = await db.collection(name).countDocuments({}, { session });
        if (count !== plan.beforeCounts[name]) throw new Error(`Data changed after planning: ${name}. Rebuild the plan.`);
      }
      for (const { name } of collections) {
        const rows = plan.documents[name] || [];
        if (rows.length) await db.collection(name).insertMany(rows, { session });
        inserted[name] = rows.length;
      }
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    return inserted;
  } finally { await session.endSession(); }
}

module.exports = { planSampleData, verifySamplePlan, applySampleData };
