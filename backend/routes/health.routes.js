const express = require('express');
const router = express.Router();
const { readDb, writeDb } = require('../database/db');

// GET /api/health/summary (Lấy tổng quan sức khỏe trong ngày)
router.get('/summary', (req, res) => {
  const db = readDb();
  const today = new Date().toISOString().slice(0, 10);

  const waterToday = db.water_logs
    .filter((w) => w.log_date === today)
    .reduce((sum, item) => sum + item.amount, 0);

  const caloriesBurned = db.workout_logs
    .filter((w) => w.workout_date === today)
    .reduce((sum, item) => sum + item.calories_burned, 0);

  const caloriesIn = db.meal_logs
    .filter((m) => m.meal_date === today)
    .reduce((sum, item) => sum + item.calories, 0);

  return res.json({
    success: true,
    date: today,
    metrics: {
      waterToday,
      caloriesBurned,
      caloriesIn,
      heartRate: 105,
      steps: 7420,
    },
  });
});

// POST /api/health/water (Ghi nhận uống nước)
router.post('/water', (req, res) => {
  const { userId = 'acc_demo', amount = 250 } = req.body;
  const db = readDb();
  const now = new Date();

  const newLog = {
    log_id: Date.now().toString(),
    user_id: userId,
    amount: Number(amount),
    log_time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    log_date: now.toISOString().slice(0, 10),
    created_at: now.toISOString(),
  };

  db.water_logs.unshift(newLog);
  writeDb(db);

  return res.status(201).json({ success: true, log: newLog });
});

// POST /api/health/workout (Ghi nhận bài tập)
router.post('/workout', (req, res) => {
  const { userId = 'acc_demo', title = 'HIIT Cardio', calories = 180, duration = 900 } = req.body;
  const db = readDb();
  const now = new Date();

  const newWorkout = {
    workout_id: Date.now().toString(),
    user_id: userId,
    title,
    calories_burned: Number(calories),
    duration_seconds: Number(duration),
    workout_date: now.toISOString().slice(0, 10),
    created_at: now.toISOString(),
  };

  db.workout_logs.unshift(newWorkout);
  writeDb(db);

  return res.status(201).json({ success: true, workout: newWorkout });
});

module.exports = router;
