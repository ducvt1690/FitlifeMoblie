const express = require('express');
const router = express.Router();

// CSDL món ăn Việt Nam trên server
const VN_FOODS = [
  { name: 'Phở bò tái/chín', kcal: 430, protein: 26, carbs: 58, fat: 11 },
  { name: 'Bún bò Huế', kcal: 520, protein: 28, carbs: 62, fat: 16 },
  { name: 'Cơm tấm sườn bì chả', kcal: 680, protein: 32, carbs: 78, fat: 24 },
  { name: 'Bánh mì thịt patê', kcal: 410, protein: 17, carbs: 48, fat: 16 },
  { name: 'Trà sữa trân châu', kcal: 450, protein: 3, carbs: 85, fat: 11 },
  { name: 'Cà phê sữa đá', kcal: 180, protein: 4, carbs: 28, fat: 6 },
  { name: 'Ức gà áp chảo (150g)', kcal: 248, protein: 46, carbs: 0, fat: 5 },
  { name: 'Trứng gà (1 quả)', kcal: 78, protein: 6.5, carbs: 0.6, fat: 5.5 },
];

// POST /api/ai/chat
router.post('/chat', (req, res) => {
  const { question = '', profile = { weight: 65, height: 170 } } = req.body;
  const q = question.toLowerCase();

  const matched = VN_FOODS.filter((f) => q.includes(f.name.toLowerCase().split(' ')[0]));
  if (matched.length > 0) {
    const lines = matched.map((f) => `• **${f.name}**: ~${f.kcal} kcal (${f.protein}g Đạm | ${f.carbs}g Tinh bột | ${f.fat}g Béo)`).join('\n');
    return res.json({
      success: true,
      engine: 'FitLife Turbo Server Engine',
      reply: `🍽️ **Phân tích dinh dưỡng từ Server API:**\n\n${lines}\n\n🔥 Lời khuyên: Cần khoảng 35-45 phút tập HIIT hoặc chạy bộ để đốt cháy lượng năng lượng này.`,
    });
  }

  return res.json({
    success: true,
    engine: 'FitLife Turbo Server Engine',
    reply: `Chào bạn! Về câu hỏi "${question}": Hãy duy trì chế độ thâm hụt calo lành mạnh, ưu tiên đạm và rau xanh, kết hợp 15 phút Tabata mỗi ngày nhé!`,
  });
});

module.exports = router;
