const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'fitlife_db.json');

// Dữ liệu khởi tạo mặc định của hệ thống
const initialData = {
  users: [],
  water_logs: [],
  workout_logs: [],
  meal_logs: [],
  daily_quests: [],
  purchases: [],
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
  DB_FILE,
  readDb,
  writeDb,
};
