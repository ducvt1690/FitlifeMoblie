import {
  getUserProfile,
  getWaterLogsToday,
  getMealLogsToday,
  getWorkoutLogsToday,
  getStepsToday,
  getSleepToday,
  getAiApiKey,
} from './storage';

// Bảng dữ liệu dinh dưỡng phong phú các món ăn & thức uống quen thuộc tại Việt Nam
const VN_FOOD_DB = [
  { keywords: ['phở bò', 'pho bo', 'phở tái', 'phở chín'], name: 'Phở bò tái/chín (1 tô)', kcal: 430, protein: 26, carbs: 58, fat: 11 },
  { keywords: ['phở gà', 'pho ga'], name: 'Phở gà ta (1 tô)', kcal: 390, protein: 24, carbs: 56, fat: 9 },
  { keywords: ['bún bò', 'bun bo'], name: 'Bún bò Huế (1 tô)', kcal: 520, protein: 28, carbs: 62, fat: 16 },
  { keywords: ['bún chả', 'bun cha'], name: 'Bún chả Hà Nội (1 phần)', kcal: 550, protein: 29, carbs: 68, fat: 18 },
  { keywords: ['bún riêu', 'bun rieu'], name: 'Bún riêu cua (1 tô)', kcal: 420, protein: 20, carbs: 58, fat: 12 },
  { keywords: ['bún thịt nướng', 'bun thit nuong'], name: 'Bún thịt nướng chả giò (1 tô)', kcal: 580, protein: 25, carbs: 75, fat: 20 },
  { keywords: ['cơm tấm', 'com tam', 'sườn bì', 'sườn trứng'], name: 'Cơm tấm sườn bì chả (1 đĩa)', kcal: 680, protein: 32, carbs: 78, fat: 24 },
  { keywords: ['cơm gà', 'com ga'], name: 'Cơm gà xối mỡ/luộc (1 đĩa)', kcal: 610, protein: 30, carbs: 74, fat: 21 },
  { keywords: ['cơm chiên', 'com rang', 'cơm rang'], name: 'Cơm chiên dưa bò/hải sản (1 đĩa)', kcal: 630, protein: 22, carbs: 82, fat: 23 },
  { keywords: ['bánh mì thịt', 'banh mi thit', 'bánh mì patê'], name: 'Bánh mì thịt chả patê (1 ổ)', kcal: 410, protein: 17, carbs: 48, fat: 16 },
  { keywords: ['bánh mì trứng', 'banh mi trung', 'bánh mì ốp la'], name: 'Bánh mì 2 trứng ốp la (1 ổ)', kcal: 360, protein: 16, carbs: 44, fat: 13 },
  { keywords: ['bánh cuốn', 'banh cuon'], name: 'Bánh cuốn chả quế (1 đĩa)', kcal: 380, protein: 14, carbs: 60, fat: 10 },
  { keywords: ['gỏi cuốn', 'goi cuon'], name: 'Gỏi cuốn tôm thịt (3 cuốn)', kcal: 210, protein: 15, carbs: 30, fat: 3 },
  { keywords: ['bánh xèo', 'banh xeo'], name: 'Bánh xèo miền Tây (1 cái)', kcal: 460, protein: 16, carbs: 48, fat: 22 },
  { keywords: ['trà sữa', 'tra sua'], name: 'Trà sữa trân châu đường đen (1 ly M)', kcal: 450, protein: 3, carbs: 85, fat: 11 },
  { keywords: ['cà phê sữa', 'ca phe sua', 'bạc xỉu'], name: 'Cà phê sữa đá (1 ly)', kcal: 180, protein: 4, carbs: 28, fat: 6 },
  { keywords: ['nước mía', 'nuoc mia'], name: 'Nước mía nguyên chất (1 ly)', kcal: 160, protein: 0.5, carbs: 40, fat: 0 },
  { keywords: ['nước dừa', 'nuoc dua'], name: 'Nước dừa tươi (1 quả)', kcal: 45, protein: 1, carbs: 9, fat: 0.5 },
  { keywords: ['sinh tố bơ', 'sinh to bo'], name: 'Sinh tố bơ sữa đặc (1 ly)', kcal: 390, protein: 5, carbs: 45, fat: 22 },
  { keywords: ['ức gà', 'uc ga'], name: 'Ức gà áp chảo/luộc (150g)', kcal: 248, protein: 46, carbs: 0, fat: 5 },
  { keywords: ['thịt bò', 'thit bo'], name: 'Thịt bò thăn xào/áp chảo (150g)', kcal: 290, protein: 38, carbs: 0, fat: 14 },
  { keywords: ['cá hồi', 'ca hoi'], name: 'Cá hồi áp chảo (150g)', kcal: 310, protein: 34, carbs: 0, fat: 18 },
  { keywords: ['trứng gà', 'trung ga', 'trứng luộc', 'trứng ốp'], name: 'Trứng gà (1 quả)', kcal: 78, protein: 6.5, carbs: 0.6, fat: 5.5 },
  { keywords: ['khoai lang'], name: 'Khoai lang luộc (1 củ 150g)', kcal: 130, protein: 2.4, carbs: 30, fat: 0.2 },
  { keywords: ['chuối', 'chuoi'], name: 'Chuối tiêu chín (1 quả)', kcal: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { keywords: ['cơm trắng', 'chén cơm', 'bát cơm'], name: 'Cơm trắng (1 chén vừa)', kcal: 200, protein: 4.2, carbs: 44, fat: 0.5 },
  { keywords: ['mì tôm', 'mi goi', 'mì gói'], name: 'Mì ăn liền / mì gói (1 gói)', kcal: 360, protein: 7, carbs: 52, fat: 14 },
  { keywords: ['xôi', 'xoi man', 'xôi gà'], name: 'Xôi mặn/xôi gà (1 gói)', kcal: 510, protein: 18, carbs: 72, fat: 15 },
  { keywords: ['gà rán', 'ga ran'], name: 'Gà rán KFC/Lotteria (1 miếng đùi)', kcal: 320, protein: 18, carbs: 16, fat: 21 },
  { keywords: ['pizza'], name: 'Pizza (1 miếng vừa)', kcal: 280, protein: 12, carbs: 32, fat: 11 },
];

export const loadRealtimeHealthContext = async () => {
  const [profile, waterLogs, mealLogs, workoutLogs, steps, sleep] = await Promise.all([
    getUserProfile(),
    getWaterLogsToday(),
    getMealLogsToday(),
    getWorkoutLogsToday(),
    getStepsToday(),
    getSleepToday(),
  ]);

  const p = profile || {
    name: 'Người dùng FitLife',
    gender: 'male',
    age: 23,
    height: 170,
    weight: 65,
    activityLevel: 'moderate',
    targetWater: 2200,
    targetCalories: 2000,
  };

  const heightM = (Number(p.height) || 170) / 100;
  const weightKg = Number(p.weight) || 65;
  const bmi = Number((weightKg / (heightM * heightM)).toFixed(1));
  let bmiStatus = 'Bình thường';
  if (bmi < 18.5) bmiStatus = 'Thiếu cân';
  else if (bmi >= 23 && bmi < 25) bmiStatus = 'Thừa cân nhẹ';
  else if (bmi >= 25) bmiStatus = 'Thừa cân / Béo phì';

  const waterToday = (waterLogs || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const caloriesInToday = (mealLogs || []).reduce((s, l) => s + (Number(l.calories) || 0), 0);
  const caloriesBurnedToday = (workoutLogs || []).reduce((s, l) => s + (Number(l.calories) || 0), 0);
  const sleepHours = sleep?.hours || 0;

  return {
    profile: p,
    bmi,
    bmiStatus,
    waterToday,
    caloriesInToday,
    caloriesBurnedToday,
    stepsToday: steps || 0,
    sleepHours,
    mealCount: (mealLogs || []).length,
    workoutCount: (workoutLogs || []).length,
  };
};

const buildSystemPrompt = (ctx) => {
  const { profile, bmi, bmiStatus, waterToday, caloriesInToday, caloriesBurnedToday, stepsToday, sleepHours } = ctx;
  const genderLabel = profile.gender === 'female' ? 'Nữ' : 'Nam';

  return `Bạn là FitLife AI Coach, huấn luyện viên thể hình (MMA, HIIT, Gym) và chuyên gia dinh dưỡng cá nhân trong ứng dụng FitLife.
Hãy trả lời bằng tiếng Việt cực kỳ súc tích, thân thiện, dùng gạch đầu dòng rõ ràng và emoji sinh động. Tránh dài dòng thừa thãi.

HỒ SƠ NGƯỜI DÙNG:
- Tên: ${profile.name} (${genderLabel}, ${profile.age} tuổi) | Cao ${profile.height}cm | Nặng ${profile.weight}kg | BMI ${bmi} (${bmiStatus})
- Mục tiêu: ${profile.targetCalories} kcal & ${profile.targetWater} ml nước
- Thực tế hôm nay: Nạp ${caloriesInToday} kcal, Đốt ${caloriesBurnedToday} kcal, Uống ${waterToday} ml nước, Đi ${stepsToday} bước, Ngủ ${sleepHours}h.`;
};

// Timeout cực ngắn (3.5 giây) để không bao giờ để người dùng chờ lâu
const fetchWithShortTimeout = async (url, options, timeoutMs = 3500) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
};

// Gọi Google Gemini API với timeout 3.5s
const callGeminiApiFast = async (apiKey, systemPrompt, conversationHistory, userMessage) => {
  const recentContents = conversationHistory.slice(-4).map((m) => ({
    role: m.sender === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));

  recentContents.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetchWithShortTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: recentContents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
    },
    3800
  );

  if (!res.ok) throw new Error(`Gemini status ${res.status}`);
  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error('Empty Gemini response');
  return { text: reply.trim(), source: 'Gemini 2.5 Flash' };
};

// Gọi Cloud AI với timeout 3.2s
const callCloudAiFast = async (systemPrompt, conversationHistory, userMessage) => {
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-4).map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    })),
    { role: 'user', content: userMessage },
  ];

  const res = await fetchWithShortTimeout(
    'https://text.pollinations.ai/openai',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: apiMessages,
        temperature: 0.6,
      }),
    },
    3200
  );

  if (!res.ok) throw new Error(`Cloud status ${res.status}`);
  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply || typeof reply !== 'string') throw new Error('Invalid cloud reply');
  return { text: reply.trim(), source: 'FitLife Cloud AI' };
};

// Smart Local AI Engine: Phân tích tức thì 0ms, chính xác tuyệt đối theo hồ sơ thật
export const generateLocalSmartResponse = (userQuestion, ctx) => {
  const q = userQuestion.toLowerCase();
  const { profile, bmi, bmiStatus, waterToday, caloriesInToday, caloriesBurnedToday, stepsToday, sleepHours } = ctx;
  const userName = profile.name && profile.name !== 'Người dùng FitLife' ? profile.name : 'bạn';
  const remainingCalories = Math.max(0, (profile.targetCalories || 2000) - caloriesInToday + caloriesBurnedToday);
  const remainingWater = Math.max(0, (profile.targetWater || 2200) - waterToday);

  // 1. Phân tích món ăn Việt Nam
  const matchedFoods = VN_FOOD_DB.filter((item) =>
    item.keywords.some((kw) => q.includes(kw))
  );

  if (matchedFoods.length > 0) {
    const totalKcal = matchedFoods.reduce((s, f) => s + f.kcal, 0);
    const totalProtein = matchedFoods.reduce((s, f) => s + f.protein, 0);
    const runMinutes = Math.round(totalKcal / 10);
    const foodLines = matchedFoods
      .map((f) => `• **${f.name}**: ~${f.kcal} kcal (${f.protein}g Đạm | ${f.carbs}g Tinh bột | ${f.fat}g Béo)`)
      .join('\n');

    return {
      text:
        `🍽️ **Phân tích dinh dưỡng món ăn cho ${userName}:**\n\n` +
        `${foodLines}\n\n` +
        `🔥 **Tổng năng lượng:** ~**${totalKcal} kcal** (${totalProtein}g Đạm)\n` +
        `• Quỹ Calo còn lại hôm nay: **${remainingCalories} kcal** (Mục tiêu: ${profile.targetCalories} kcal)\n` +
        `• 🏃 **Vận động tương ứng:** Cần khoảng **${runMinutes} phút** chạy bộ hoặc tập MMA/HIIT để đốt hết số calo này!`,
      source: 'FitLife Turbo AI ⚡',
    };
  }

  // 2. Đánh giá tiến độ hôm nay
  if (q.includes('tiến độ') || q.includes('hôm nay') || q.includes('đánh giá') || q.includes('tổng kết') || q.includes('báo cáo')) {
    return {
      text:
        `📊 **Đánh giá sức khỏe hôm nay của ${userName}:**\n\n` +
        `• **Thể trạng:** ${profile.weight}kg / ${profile.height}cm — **BMI ${bmi}** (${bmiStatus})\n` +
        `• **Dinh dưỡng:** Đã nạp **${caloriesInToday}/${profile.targetCalories} kcal** (Còn nạp thêm được ~${remainingCalories} kcal)\n` +
        `• **Nước uống:** **${waterToday}/${profile.targetWater} ml** ${remainingWater > 0 ? `(Cần thêm ${remainingWater} ml)` : '(Đã hoàn thành! 🎉)'}\n` +
        `• **Vận động:** **${stepsToday.toLocaleString()} bước** | Đốt **${caloriesBurnedToday} kcal** từ bài tập\n` +
        `• **Giấc ngủ:** ${sleepHours > 0 ? `${sleepHours} giờ` : 'Chưa ghi nhận hôm nay'}\n\n` +
        `💡 *Lời khuyên:* ${
          remainingWater > 500
            ? 'Bạn đang uống hơi ít nước, uống ngay 1 ly 250ml nhé!'
            : 'Phong độ rất tốt! Hãy duy trì bài tập Tabata 15 phút chiều nay.'
        }`,
      source: 'FitLife Turbo AI ⚡',
    };
  }

  // 3. Thực đơn / Giảm mỡ / Tăng cơ / Ăn uống
  if (q.includes('thực đơn') || q.includes('giảm mỡ') || q.includes('giảm cân') || q.includes('tăng cơ') || q.includes('ăn')) {
    const target = profile.targetCalories || 1800;
    const proteinTarget = Math.round((profile.weight || 65) * 1.8);
    return {
      text:
        `🥗 **Gợi ý thực đơn ${target} kcal cá nhân hóa cho ${userName} (${profile.weight}kg):**\n\n` +
        `🎯 Mục tiêu Đạm khuyến nghị: **~${proteinTarget}g Protein/ngày**\n\n` +
        `• **Sáng (7:30 - ~${Math.round(target * 0.25)} kcal):** 1 tô Phở bò tái ít bánh phở + 1 trứng chần (hoặc 2 quả trứng + 1 củ khoai lang).\n` +
        `• **Trưa (12:30 - ~${Math.round(target * 0.4)} kcal):** 150g ức gà áp chảo + 1 chén cơm gạo lứt + rau luộc.\n` +
        `• **Phụ chiều (16:00 - ~${Math.round(target * 0.1)} kcal):** 1 quả chuối + 1 hộp sữa chua Hy Lạp / hạt hạnh nhân.\n` +
        `• **Tối (19:00 - ~${Math.round(target * 0.25)} kcal):** Salad cá ngừ hoặc thịt bò nạc + canh rau (hạn chế tinh bột sau 19h30).\n\n` +
        `👉 *Uống 1 ly nước lọc 250ml trước mỗi bữa ăn để tối ưu trao đổi chất nhé!*`,
      source: 'FitLife Turbo AI ⚡',
    };
  }

  // 4. Luyện tập / Bụng / MMA / HIIT
  if (q.includes('bụng') || q.includes('tập') || q.includes('mma') || q.includes('cardio') || q.includes('hiit') || q.includes('lịch')) {
    return {
      text:
        `🔥 **Lộ trình HIIT & MMA Đốt Mỡ Cực Nhanh (15 phút tại nhà):**\n\n` +
        `Thực hiện 4 hiệp (40 giây tập - 20 giây nghỉ):\n` +
        `1. **Jumping Jacks:** 40s làm nóng toàn thân và đẩy nhịp tim.\n` +
        `2. **Shadow Boxing Jab-Cross-Sprawl:** 40s đấm gió liên hoàn và bật nhảy phản xạ.\n` +
        `3. **Mountain Climbers:** 40s siết chặt cơ bụng dưới.\n` +
        `4. **Plank giữ cơ lõi:** 45s gồng cứng bụng và mông.\n\n` +
        `⚡ *Ước tính tiêu hao: **180 - 240 kcal**! Vào tab "Luyện tập" trong Menu để mở bộ đếm giờ HIIT Tabata có tiếng còi báo nhé.*`,
      source: 'FitLife Turbo AI ⚡',
    };
  }

  // 5. Nước uống
  if (q.includes('nước') || q.includes('uống')) {
    const w = profile.weight || 65;
    const recommended = Math.round(w * 35);
    return {
      text:
        `💧 **Nhu cầu nước chuẩn khoa học cho ${userName} (${w}kg):**\n\n` +
        `• Lượng nước tiêu chuẩn: **${recommended.toLocaleString()} ml/ngày** (${w}kg × 35ml).\n` +
        `• Mục tiêu trong app: **${profile.targetWater} ml** | Đã uống hôm nay: **${waterToday} ml**.\n` +
        `• Còn thiếu: **${remainingWater > 0 ? `${remainingWater} ml` : '0 ml (Tuyệt vời! Đã đủ chỉ tiêu)'}**.\n` +
        `• *Mẹo:* Chia đều 8 cốc 250ml trong ngày, không uống dồn một lúc để thận hoạt động tốt nhất.`,
      source: 'FitLife Turbo AI ⚡',
    };
  }

  // 6. Giấc ngủ & Phục hồi
  if (q.includes('ngủ') || q.includes('mệt') || q.includes('stress') || q.includes('phục hồi')) {
    return {
      text:
        `🌙 **Bí quyết phục hồi & ngủ sâu cho ${userName}:**\n\n` +
        `• Giấc ngủ tối ưu cho thể thao: **7.5 - 8 tiếng/đêm** (Đêm qua bạn đã ngủ: ${sleepHours > 0 ? `${sleepHours}h` : 'Chưa ghi nhận'}).\n` +
        `• **Phương pháp thở 4-7-8:** Hít vào 4 giây qua mũi $\\rightarrow$ Nín thở 7 giây $\\rightarrow$ Thở ra từ từ 8 giây qua miệng. Làm 4 chu kỳ giúp thư giãn hệ thần kinh sau 2 phút!\n` +
        `• Không dùng điện thoại trước khi ngủ 30 phút và giữ phòng ngủ mát mẻ.`,
      source: 'FitLife Turbo AI ⚡',
    };
  }

  // 7. Chỉ số BMI / Cân nặng
  if (q.includes('bmi') || q.includes('bmr') || q.includes('tdee') || q.includes('chỉ số') || q.includes('cân nặng')) {
    const idealWeight = Number(((22 * (profile.height / 100) * (profile.height / 100))).toFixed(1));
    return {
      text:
        `📐 **Báo cáo chỉ số hình thể của ${userName}:**\n\n` +
        `• Chiều cao: **${profile.height} cm** | Cân nặng: **${profile.weight} kg**\n` +
        `• Chỉ số BMI: **${bmi}** — Thể trạng: **${bmiStatus}**\n` +
        `• Cân nặng lý tưởng theo chuẩn BMI 22: **~${idealWeight} kg**\n` +
        `• Nhu cầu Calo giữ cân: **~${profile.targetCalories} kcal/ngày**\n\n` +
        `👉 *Nếu muốn giảm mỡ: hãy duy trì ${profile.targetCalories - 300} kcal/ngày. Nếu muốn tăng cơ: hãy nạp ${profile.targetCalories + 250} kcal/ngày.*`,
      source: 'FitLife Turbo AI ⚡',
    };
  }

  // Tư vấn tổng quát theo hồ sơ
  return {
    text:
      `Chào ${userName}! Với thể trạng hiện tại (**${profile.weight}kg, ${profile.height}cm, BMI ${bmi} - ${bmiStatus}**):\n\n` +
      `• Về câu hỏi *"${userQuestion}"*: Nguyên tắc vàng để cơ thể săn chắc và dẻo dai luôn là **80% Dinh dưỡng + 20% Vận động + Giấc ngủ**.\n` +
      `• Hôm nay bạn đã nạp **${caloriesInToday}/${profile.targetCalories} kcal** và uống **${waterToday}/${profile.targetWater} ml** nước.\n\n` +
      `💡 *Bạn có thể hỏi tôi chi tiết: "1 tô bún bò bao nhiêu calo?", "Lên thực đơn giảm mỡ", hoặc "Bài tập bụng 15 phút" để tôi tư vấn chuẩn xác nhất nhé!*`,
    source: 'FitLife Turbo AI ⚡',
  };
};

// Hàm chính hỏi AI: Tự động chọn đường nhanh nhất để KHÔNG BAO GIỜ bị lag hay lỗi kết nối
export const askFitLifeAi = async (userMessage, conversationHistory = [], preferFast = false) => {
  const ctx = await loadRealtimeHealthContext();
  const q = userMessage.toLowerCase().trim();

  // 1. Nếu preferFast hoặc là câu hỏi thuộc các chủ đề cốt lõi -> Trả lời NGAY LẬP TỨC (< 300ms)
  const isCoreTopic =
    VN_FOOD_DB.some((item) => item.keywords.some((kw) => q.includes(kw))) ||
    q.includes('tiến độ') || q.includes('hôm nay') || q.includes('đánh giá') ||
    q.includes('thực đơn') || q.includes('giảm mỡ') || q.includes('giảm cân') ||
    q.includes('tập') || q.includes('mma') || q.includes('bụng') || q.includes('hiit') ||
    q.includes('nước') || q.includes('uống') || q.includes('ngủ') || q.includes('bmi');

  if (preferFast || isCoreTopic) {
    // Trả lời lập tức từ Turbo AI Engine
    return generateLocalSmartResponse(userMessage, ctx);
  }

  // 2. Với các câu hỏi mở rộng khác: Thử gọi Cloud AI với timeout ngắn 3.5s
  const systemPrompt = buildSystemPrompt(ctx);
  const savedApiKey = await getAiApiKey();

  if (savedApiKey && savedApiKey.length > 15) {
    try {
      return await callGeminiApiFast(savedApiKey, systemPrompt, conversationHistory, userMessage);
    } catch (e) {
      console.warn('Gemini fast timeout/error, fallback instantly to Turbo Engine:', e.message);
    }
  }

  try {
    return await callCloudAiFast(systemPrompt, conversationHistory, userMessage);
  } catch (e) {
    console.warn('Cloud fast timeout/error, fallback instantly to Turbo Engine:', e.message);
  }

  // 3. Fallback tức thì không bao giờ để người dùng thấy lỗi kết nối
  return generateLocalSmartResponse(userMessage, ctx);
};
