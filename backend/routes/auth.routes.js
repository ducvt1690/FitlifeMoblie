const express = require('express');
const router = express.Router();
const { readDb, writeDb } = require('../database/db');

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin đăng ký!' });
  }

  const db = readDb();
  const cleanEmail = email.trim().toLowerCase();

  if (db.users.some((u) => u.email === cleanEmail)) {
    return res.status(400).json({ success: false, message: 'Email này đã tồn tại trong hệ thống!' });
  }

  const newUser = {
    user_id: Date.now().toString(),
    email: cleanEmail,
    password: password.trim(),
    full_name: name.trim(),
    gender: 'male',
    age: 23,
    height: 170,
    weight: 65,
    activity_level: 'moderate',
    goal: 'maintain',
    target_water: 2275,
    target_calories: 2000,
    fit_coins: 150,
    streak_days: 1,
  };

  db.users.push(newUser);
  writeDb(db);

  return res.status(201).json({
    success: true,
    message: 'Đăng ký tài khoản thành công!',
    user: {
      id: newUser.user_id,
      email: newUser.email,
      name: newUser.full_name,
    },
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập Email và Mật khẩu!' });
  }

  const db = readDb();
  const cleanEmail = email.trim().toLowerCase();
  const found = db.users.find((u) => u.email === cleanEmail && u.password === password.trim());

  if (!found) {
    return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác!' });
  }

  return res.json({
    success: true,
    message: 'Đăng nhập thành công!',
    user: {
      id: found.user_id,
      email: found.email,
      name: found.full_name,
      profile: {
        height: found.height,
        weight: found.weight,
        target_water: found.target_water,
        target_calories: found.target_calories,
        coins: found.fit_coins,
      },
    },
  });
});

// GET /api/auth/users (Dành cho Admin / Kiểm thử)
router.get('/users', (req, res) => {
  const db = readDb();
  const safeList = db.users.map(({ password, ...rest }) => rest);
  return res.json({ success: true, total: safeList.length, users: safeList });
});

module.exports = router;
