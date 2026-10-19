const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'fitlife_db.json');

// Dữ liệu ban đầu mặc định
const initialData = {
  users: [
    {
      user_id: 'acc_demo',
      email: 'demo@fitlife.app',
      password: '123',
      full_name: 'Nguyễn Thành Nam',
      gender: 'male',
      age: 23,
      height: 170,
      weight: 65,
      activity_level: 'moderate',
      goal: 'maintain',
      target_water: 2275,
      target_calories: 2000,
      fit_coins: 150,
      streak_days: 5,
    },
  ],
  water_logs: [],
  workout_logs: [],
  meal_logs: [],
  daily_quests: [],
  purchases: ['badge_1'],
};

function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    return initialData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return initialData;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing database:', err.message);
    return false;
  }
}

module.exports = {
  readDb,
  writeDb,
};
