'use strict';

const { HttpError } = require('../utils/http-error');
const { excludedFood, normalize } = require('./ai-plan.validation');

// Estimates per base serving: kcal, protein, carbs, fat, cost VND, diet, ingredients.
// Ingredients include sauces so a safe fallback does not hide allergens in a dish name.
const FOODS = [
  ['Cháo yến mạch chuối', 320, 9, 60, 5, 7000, 'vegan', 'yến mạch chuối'],
  ['Khoai lang hấp', 260, 4, 60, 1, 4000, 'vegan', 'khoai lang'],
  ['Cơm đậu xanh', 400, 14, 76, 4, 5000, 'vegan', 'gạo đậu xanh'],
  ['Cơm đậu đỏ', 400, 14, 76, 4, 5000, 'vegan', 'gạo đậu đỏ'],
  ['Cơm đậu đen', 400, 14, 76, 4, 5000, 'vegan', 'gạo đậu đen'],
  ['Cháo bí đỏ', 280, 5, 60, 2, 4000, 'vegan', 'gạo bí đỏ'],
  ['Cơm rau luộc', 360, 7, 74, 4, 5000, 'vegan', 'gạo cải xanh dầu thực vật'],
  ['Cơm đậu phụ hấp', 420, 20, 65, 9, 8000, 'vegan', 'gạo đậu nành hành'],
  ['Bún nấm rau củ', 350, 10, 65, 6, 8000, 'vegan', 'bún gạo nấm cà rốt'],
  ['Miến nấm', 320, 8, 64, 4, 7000, 'vegan', 'miến dong nấm hành'],
  ['Cháo đậu xanh', 300, 10, 58, 3, 5000, 'vegan', 'gạo đậu xanh'],
  ['Xôi đậu đen', 420, 12, 83, 4, 6000, 'vegan', 'gạo nếp đậu đen'],
  ['Bắp luộc', 280, 8, 58, 3, 5000, 'vegan', 'bắp ngô'],
  ['Khoai tây hấp', 280, 6, 62, 1, 5000, 'vegan', 'khoai tây'],
  ['Cơm bí đỏ đậu phụ', 400, 18, 65, 8, 7000, 'vegan', 'gạo bí đỏ đậu nành'],
  ['Cháo hạt sen', 300, 9, 59, 3, 7000, 'vegan', 'gạo hạt sen'],
  ['Cơm nấm xào', 380, 10, 70, 7, 7000, 'vegan', 'gạo nấm dầu thực vật'],
  ['Bún đậu phụ rau xanh', 400, 18, 65, 8, 8000, 'vegan', 'bún gạo đậu nành rau cải'],
  ['Cơm trứng luộc', 430, 19, 64, 11, 10000, 'vegetarian', 'gạo trứng gà'],
  ['Bánh mì trứng', 400, 18, 53, 13, 12000, 'vegetarian', 'lúa mì trứng gà dầu thực vật'],
  ['Sữa chua chuối', 240, 9, 42, 4, 9000, 'vegetarian', 'sữa chuối'],
  ['Cháo trứng', 350, 14, 52, 10, 8000, 'vegetarian', 'gạo trứng gà'],
  ['Phở gà', 450, 28, 60, 11, 25000, 'none', 'gạo thịt gà hành nước mắm cá'],
  ['Cơm ức gà', 500, 36, 65, 11, 22000, 'none', 'gạo thịt gà rau nước mắm cá'],
  ['Bún bò', 480, 28, 64, 12, 25000, 'none', 'gạo thịt bò nước mắm cá'],
  ['Cơm cá hấp', 480, 30, 65, 11, 20000, 'none', 'gạo cá hành nước mắm cá'],
  ['Cháo thịt nạc', 380, 25, 52, 8, 15000, 'none', 'gạo thịt heo hành nước mắm cá'],
  ['Cơm thịt heo rau xanh', 500, 30, 65, 13, 20000, 'none', 'gạo thịt heo cải nước mắm cá'],
  ['Bún tôm', 400, 24, 60, 7, 22000, 'none', 'gạo tôm rau nước mắm cá'],
  ['Miến gà', 410, 26, 58, 9, 20000, 'none', 'miến dong thịt gà nước mắm cá'],
];
const round = n => Math.round(n * 10) / 10;

function mealDay(input, preferences) {
  const count = preferences.meals_per_day;
  const weights = count === 4 ? [0.25, 0.35, 0.30, 0.10] : [0.30, 0.40, 0.30];
  const types = ['breakfast', 'lunch', 'dinner', 'snack'];
  const allocations = weights.map(share => Math.min(2000, Math.floor(input.target_calories * share)));
  let remaining = input.target_calories - allocations.reduce((sum, n) => sum + n, 0);
  while (remaining > 0) {
    const slot = allocations.findIndex(n => n < 2000);
    if (slot < 0) throw new HttpError(422, 'Mục tiêu kcal vượt giới hạn của số bữa đã chọn. Hãy hỏi chuyên gia dinh dưỡng.');
    const extra = Math.min(remaining, 2000 - allocations[slot]);
    allocations[slot] += extra; remaining -= extra;
  }
  const used = new Set();
  const meals = weights.map((share, i) => {
    const calories = allocations[i];
    const candidates = FOODS.filter(food => !excludedFood(`${food[0]} ${food[7]}`, preferences)
      && (preferences.diet === 'none' || food[6] === 'vegan' || food[6] === preferences.diet)
      && (!preferences.budget_vnd_per_day || food[5] * calories / food[1] <= preferences.budget_vnd_per_day * share));
    const food = candidates.find(row => !used.has(row[0])) || candidates[0];
    if (!food) throw new HttpError(422, 'Chưa có món dự phòng phù hợp dị ứng/sở thích và ngân sách này. Hãy hỏi chuyên gia dinh dưỡng.');
    used.add(food[0]);
    const scale = calories / food[1];
    return { meal_type: types[i], name: food[0], portion: `${round(scale)} khẩu phần chuẩn (~${calories} kcal)`, calories,
      protein: round(food[2] * scale), carbs: round(food[3] * scale), fat: round(food[4] * scale),
      why: 'Ước tính khẩu phần theo mục tiêu kcal và sở thích; dùng nguyên liệu đã nêu, không thêm sốt có chất dị ứng.' };
  });
  return { total_calories: input.target_calories, meals,
    tips: ['Dinh dưỡng và chi phí là ước tính; cân chỉnh khẩu phần theo nguyên liệu thực tế.',
      'Kiểm tra nhãn và tránh nhiễm chéo nếu có dị ứng.', 'Uống nước rải đều trong ngày.'] };
}

function nutrition(input) {
  const protein = round(Math.min(input.weight * (input.goal === 'gain' ? 1.8 : 1.6), input.target_calories * 0.3 / 4));
  const fat = round(input.target_calories * 0.25 / 9);
  return { calories: input.target_calories, protein_g: protein,
    carbs_g: round((input.target_calories - protein * 4 - fat * 9) / 4), fat_g: fat,
    water_ml: Math.min(input.target_water, 4000), tips: [
      { lose: 'Giữ mục tiêu kcal đã tính; tránh bỏ bữa hoặc nhịn ăn cực đoan.', maintain: 'Duy trì khẩu phần và theo dõi cân nặng mỗi tuần.', gain: 'Ăn đủ mục tiêu kcal và kết hợp tập sức mạnh đều đặn.' }[input.goal],
      'Chia lượng đạm đều giữa các bữa.', 'Ưu tiên rau xanh, trái cây và ngũ cốc ít chế biến.',
      'Đo khẩu phần để điều chỉnh theo mức kcal thực tế.', 'Uống nước rải đều trong ngày, không ép uống một lần.',
      'Thay nguyên liệu phù hợp chế độ ăn và luôn kiểm tra dị ứng.' ], avoid: ['Nước ngọt có đường', 'Rượu bia', 'Thực phẩm gây dị ứng cá nhân'] };
}

function workoutWeek(input, preferences, exercises) {
  if (!exercises.length) throw new HttpError(422, 'Chưa có bài tập đang hoạt động phù hợp nơi tập. Cần nhập danh mục exercises trước.');
  const active = new Set(Array.from({ length: preferences.days_per_week }, (_, i) => Math.floor(i * 7 / preferences.days_per_week) + 1));
  const focuses = ['Thân trên', 'Thân dưới', 'Toàn thân'];
  let session = 0;
  return { days: Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    if (!active.has(day)) return { day, rest: true, focus: 'Nghỉ / đi bộ nhẹ', minutes: 0, exercises: [], calories_est: 0 };
    const group = session++ % 3;
    const preferred = exercises.filter(e => group === 2 || (group === 1
      ? /leg|waist|lower|chan|bung/.test(normalize(e.body_parts.join(' ')))
      : /chest|back|arm|shoulder|upper|nguc|lung|tay|vai/.test(normalize(e.body_parts.join(' ')))));
    const pool = preferred.length ? preferred : exercises;
    return { day, rest: false, focus: focuses[group], minutes: preferences.minutes_per_session,
      exercises: pool.slice(0, Math.min(4, Math.max(1, Math.floor(preferences.minutes_per_session / 7)))).map(e => ({
        exercise_id: e.exercise_id, sets: 3, reps: 12, seconds: null, rest_seconds: 60,
      })), calories_est: Math.min(2000, Math.round(preferences.minutes_per_session * input.weight * 0.065)) };
  }), tips: ['Khởi động 5 phút trước mỗi buổi và giãn cơ nhẹ sau tập.',
    'Điều chỉnh tốc độ cho đủ thời lượng; dừng tập khi đau hoặc chóng mặt.', 'Kcal tiêu hao chỉ là ước tính.'] };
}

function rulePlan(kind, { input, preferences, exercises }) {
  if (kind === 'meal_day') return mealDay(input, preferences);
  if (kind === 'nutrition') return nutrition(input);
  return workoutWeek(input, preferences, exercises);
}

module.exports = { rulePlan };
