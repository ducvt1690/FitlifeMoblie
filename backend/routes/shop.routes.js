const express = require('express');
const router = express.Router();
const { readDb, writeDb } = require('../database/db');

const REWARDS = [
  { id: 'badge_1', title: 'Huy hiệu Người Mới Nhập Môn', cost: 0, icon: 'ribbon-outline' },
  { id: 'badge_2', title: 'Chiến Binh Thủy Hỏa 💧', cost: 50, icon: 'water-outline' },
  { id: 'badge_3', title: 'Vua Tabata Đốt Mỡ 🔥', cost: 100, icon: 'flame-outline' },
  { id: 'badge_4', title: 'Bậc Thầy Kỷ Luật 7 Ngày ⭐', cost: 200, icon: 'trophy-outline' },
];

// GET /api/shop/items
router.get('/items', (req, res) => {
  return res.json({ success: true, items: REWARDS });
});

// POST /api/shop/buy
router.post('/buy', (req, res) => {
  const { userId = 'acc_demo', itemId } = req.body;
  const db = readDb();
  const reward = REWARDS.find((r) => r.id === itemId);

  if (!reward) {
    return res.status(404).json({ success: false, message: 'Vật phẩm không tồn tại!' });
  }

  const user = db.users.find((u) => u.user_id === userId);
  if (user && user.fit_coins < reward.cost) {
    return res.status(400).json({ success: false, message: 'Không đủ FitCoins để đổi vật phẩm này!' });
  }

  if (user) {
    user.fit_coins -= reward.cost;
  }

  if (!db.purchases.includes(itemId)) {
    db.purchases.push(itemId);
  }
  writeDb(db);

  return res.json({
    success: true,
    message: `Đổi thành công "${reward.title}"!`,
    remainingCoins: user ? user.fit_coins : 100,
    purchases: db.purchases,
  });
});

module.exports = router;
