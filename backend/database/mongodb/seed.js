'use strict';

const { createHash, randomBytes, scryptSync } = require('node:crypto');
const catalogs = require('./data/catalogs.json');

const DEMO_USER_ID = '30000000-0000-4000-8000-000000000001';
const DEMO_EMAIL = 'demo@fitlife.example';

function localDate(date = new Date(), timezone = 'Asia/Ho_Chi_Minh') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

// Stable UUIDs let a retried demo seed refer to the same records.
function demoId(key) {
  const bytes = createHash('sha256').update(`fitlife-demo:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function passwordHash(password) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('FITLIFE_DEMO_PASSWORD must have at least 12 characters.');
  }
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$16384$8$1$${salt}$${derived}`;
}

async function seedCatalogs(db, now = new Date()) {
  for (const [name, id] of [['reward_items', 'item_id'], ['challenges', 'challenge_id']]) {
    for (const document of catalogs[name]) {
      await db.collection(name).updateOne({ [id]: document[id] }, {
        $setOnInsert: { ...document, created_at: now, updated_at: now },
      }, { upsert: true });
    }
  }
}

function buildDemoDocuments(password, now = new Date()) {
  const date = localDate(now);
  const stamp = { created_at: now, updated_at: now };
  const record = (idField, key, data) => ({ [idField]: demoId(key), user_id: DEMO_USER_ID, ...data, ...stamp });
  const user = {
    user_id: DEMO_USER_ID, email: DEMO_EMAIL, password_hash: passwordHash(password),
    full_name: 'Nguyễn Thành Nam (Demo)', gender: 'male', age: 23, height: 170, weight: 65,
    activity_level: 'moderate', goal: 'maintain', target_water: 2275, target_calories: 2484,
    // Six completed quests earn 60, one badge spends 50. No unexplained starting coins.
    fit_coins: 10, streak_days: 0, timezone: 'Asia/Ho_Chi_Minh', ...stamp,
  };
  return {
    users: [user],
    water_logs: [
      record('log_id', 'water-1', { amount: 250, log_time: '08:30', log_date: date }),
      record('log_id', 'water-2', { amount: 500, log_time: '12:00', log_date: date }),
    ],
    workout_logs: [record('workout_id', 'workout', {
      title: 'MMA Shadow Boxing', category: 'Cardio', duration_seconds: 900, calories_burned: 180, workout_date: date,
    })],
    meal_logs: [
      record('meal_id', 'breakfast', { meal_name: 'Phở bò', calories: 450, protein: 25, carbs: 55, fat: 14, meal_type: 'breakfast', meal_date: date }),
      record('meal_id', 'lunch', { meal_name: 'Cơm gạo lứt và ức gà', calories: 520, protein: 42, carbs: 60, fat: 12, meal_type: 'lunch', meal_date: date }),
    ],
    daily_quest_logs: catalogs.quest_templates.map((quest) => {
      const completed = quest.quest_key !== 'q_bowel';
      const values = { q_weight: '65 kg', q_water: '750 ml', q_meals: '2 bữa ăn', q_sleep: '7.5 giờ', q_mood: 'Sẵn sàng', q_workout: '900 giây' };
      return record('quest_log_id', quest.quest_key, {
        ...quest, quest_date: date, is_completed: completed,
        completed_at: completed ? now : null, extra_value: values[quest.quest_key] || '',
      });
    }),
    bmi_history: [record('record_id', 'bmi', { weight: 65, height: 170, bmi_value: 22.49, bmi_status: 'Cân đối', record_date: date })],
    sleep_logs: [record('sleep_id', 'sleep', { hours: 7.5, quality: 'Sâu', sleep_date: date })],
    mood_logs: [record('mood_id', 'mood', { mood_label: 'Sẵn sàng', note: 'Dữ liệu minh họa', mood_date: date })],
    user_challenges: [record('id', 'challenge', {
      challenge_id: catalogs.challenges[0].challenge_id, current_progress: 1,
      is_completed: false, joined_at: now, last_checkin: now, last_checkin_date: date,
    })],
    purchases: [record('purchase_id', 'purchase', {
      item_id: catalogs.reward_items[1].item_id, item_category: 'badge', spent_coins: 50, purchased_at: now,
    })],
    ai_chat_messages: [
      record('message_id', 'chat-user', { sender: 'user', content: 'Hôm nay tôi đã uống bao nhiêu nước?', timestamp: now }),
      record('message_id', 'chat-ai', { sender: 'ai', content: 'Dữ liệu mẫu: bạn đã ghi nhận 750 ml nước trong ngày.', ai_engine: 'demo-fixture', timestamp: new Date(now.getTime() + 1) }),
    ],
  };
}

async function seedDemo(db, client, password, now = new Date()) {
  // A user is the one-time seed marker. Never reset coins/progress/password on a rerun.
  if (await db.collection('users').findOne({ user_id: DEMO_USER_ID }, { projection: { _id: 1 } })) return false;
  const documents = buildDemoDocuments(password, now);
  const badge = await db.collection('reward_items').findOne({ item_id: catalogs.reward_items[1].item_id });
  if (!badge || badge.cost_coins !== 50 || badge.category !== 'badge' || !badge.is_available) {
    throw new Error('Demo expects the original 50-coin badge. Use a separate empty demo database.');
  }
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const [name, rows] of Object.entries(documents)) {
        await db.collection(name).insertMany(rows, { session });
      }
    });
    return true;
  } finally {
    await session.endSession();
  }
}

module.exports = { seedCatalogs, seedDemo, buildDemoDocuments, DEMO_USER_ID, DEMO_EMAIL, localDate };
