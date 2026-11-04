'use strict';
const { randomUUID } = require('node:crypto');
const { localDay } = require('../auth/registration');
const { HttpError } = require('../utils/http-error');
const { isUuid, isText, isPlainBody } = require('../utils/validate');
const { complete } = require('./ai.client');
const { aiQuota, withAiQuota } = require('./ai-usage');
const { createMealService } = require('./meal.service');
const fail = (status, message) => new HttpError(status, message);

// Per 100 g: kcal, protein, carbs, fat, then grams in one usual serving (quả, bát, ly…). Used before asking AI.
const FOODS = {
  'ức gà': [165, 31, 0, 3.6, 120], 'thịt gà': [200, 27, 0, 10, 120], 'đùi gà': [210, 26, 0, 11, 150],
  'thịt bò': [250, 26, 0, 15, 100], 'thịt heo nạc': [143, 21, 0, 6, 100], 'thịt lợn nạc': [143, 21, 0, 6, 100],
  'thịt ba chỉ': [518, 9, 0, 53, 100], 'cá hồi': [208, 20, 0, 13, 120], 'cá ngừ': [132, 28, 0, 1, 100],
  'tôm': [99, 24, 0.2, 0.3, 100], 'trứng': [155, 13, 1.1, 11, 50], 'lòng trắng trứng': [52, 11, 0.7, 0.2, 33],
  'đậu phụ': [76, 8, 1.9, 4.8, 150], 'cơm': [130, 2.7, 28, 0.3, 150], 'cơm gạo lứt': [111, 2.6, 23, 0.9, 150],
  'bún': [110, 1.7, 25, 0.2, 200], 'phở bò': [90, 6, 11, 2.5, 500], 'bánh mì': [265, 9, 49, 3.2, 80],
  'yến mạch': [389, 17, 66, 7, 40], 'khoai lang': [86, 1.6, 20, 0.1, 150], 'khoai tây': [77, 2, 17, 0.1, 150],
  'chuối': [89, 1.1, 23, 0.3, 120], 'táo': [52, 0.3, 14, 0.2, 180], 'sữa tươi': [62, 3.2, 4.8, 3.3, 250],
  'sữa chua hy lạp': [97, 9, 3.6, 5, 150], 'sữa chua': [99, 3.5, 15, 3, 100], 'whey': [400, 80, 8, 6, 30],
  'bơ đậu phộng': [588, 25, 20, 50, 16], 'hạnh nhân': [579, 21, 22, 50, 20], 'rau': [30, 2.5, 5, 0.3, 150],
  'bông cải': [34, 2.8, 7, 0.4, 150], 'salad': [20, 1.5, 3.5, 0.2, 150], 'dầu ăn': [884, 0, 0, 100, 10],
  'mì gói': [470, 9.5, 60, 20, 75], 'xôi': [170, 3.5, 36, 1, 200], 'bánh bao': [220, 8, 35, 5, 150],
};
const UNITS = 'quả|trái|bát|chén|tô|đĩa|ly|cốc|hộp|hũ|lát|miếng|cái|củ|gói|ổ|thìa|muỗng|phần|suất';
// Words that only describe how a known food is cooked, so "ức gà luộc" still matches "ức gà" without asking AI.
const COOKING = new Set('luộc nướng hấp chiên rán xào áp chảo kho rang trắng tươi sống chín không đường ít béo nguyên kem tách béo nạc'.split(' '));
const norm = s => s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
const round1 = n => Math.round(n * 10) / 10;
const num = (v, max) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
const MEAL_LABEL = { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', dinner: 'Bữa tối', snack: 'Bữa phụ' };

function localHour(tz) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz || 'Asia/Ho_Chi_Minh' }).format(new Date()));
  return hour % 24;
}

// Protein 1.6–2 g/kg by goal, fat 25 % of energy, carbs take the rest.
function targetsFor(user) {
  const calories = user.target_calories;
  const protein = Math.round(user.weight * ({ gain: 2, lose: 1.8 }[user.goal] ?? 1.6));
  const fat = Math.round(calories * 0.25 / 9);
  return { calories, protein, fat, carbs: Math.max(Math.round((calories - protein * 4 - fat * 9) / 4), 0) };
}

function withAmounts(name, grams, per100, source) {
  const k = grams / 100;
  return { name, grams: Math.round(grams), per100, source,
    calories: Math.round(per100.kcal * k), protein: round1(per100.protein * k), carbs: round1(per100.carbs * k), fat: round1(per100.fat * k) };
}

// "300g ức gà, 2 quả trứng và 1 bát cơm" → [{ amount, unit, name }].
function splitMeal(text) {
  return text.split(/,|;|\+|\n| và | với /i).map(s => s.trim()).filter(Boolean).map(chunk => {
    const m = chunk.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(kg|g|gr|gram|grams|ml|${UNITS})?\\s*(.*)$`, 'i'));
    if (!m || !m[3]) return { amount: null, unit: null, name: norm(chunk) };
    return { amount: Number(m[1].replace(',', '.')), unit: m[2]?.toLowerCase() ?? null, name: norm(m[3]) };
  });
}

function gramsOf(part, serving) {
  if (part.amount === null) return serving;
  if (part.unit === 'kg') return part.amount * 1000;
  if (['g', 'gr', 'gram', 'grams', 'ml'].includes(part.unit)) return part.amount;
  if (part.unit || part.amount <= 10) return part.amount * serving;
  return part.amount;
}

function createNutritionService({ db, ai = {} }) {
  const meals = createMealService({ db });
  const foods = () => db.collection('foods');
  const loadUser = async member => {
    const user = await db.collection('users').findOne({ user_id: member.user_id }, { projection: { _id: 0, password_hash: 0 } });
    if (!user) throw fail(403, 'Tài khoản không còn khả dụng.');
    return user;
  };

  // The built-in table plus everything AI has taught us before, longest name first so "cơm gạo lứt" beats "cơm".
  async function knownFoods() {
    const cached = await foods().find({}, { projection: { _id: 0 } }).limit(1000).toArray();
    const table = Object.entries(FOODS).map(([key, [kcal, protein, carbs, fat, serving]]) => ({ key, kcal, protein, carbs, fat, serving, source: 'table' }));
    return [...cached.map(f => ({ ...f, source: 'cache' })), ...table].sort((a, b) => b.key.length - a.key.length);
  }

  async function aiParse(text) {
    const out = await complete(ai, { maxTokens: 700, json: true,
      system: `Bạn là chuyên gia dinh dưỡng Việt Nam. Tách mô tả bữa ăn thành từng món. Với mỗi món: tên ngắn tiếng Việt,
khối lượng ước tính theo gram (đổi bát, quả, lát… ra gram), và giá trị trên 100 g theo bảng USDA hoặc Viện Dinh dưỡng.
Dạng: {"items":[{"name":"ức gà luộc","grams":300,"kcal":165,"protein":31,"carbs":0,"fat":3.6}]}. Nếu không phải đồ ăn, trả {"items":[]}.`,
      messages: [{ role: 'user', content: text }] });
    const items = (Array.isArray(out?.items) ? out.items : []).filter(i => isText(i?.name, 80) && num(i.grams, 3000) && i.grams > 0
      && num(i.kcal, 900) && num(i.protein, 100) && num(i.carbs, 100) && num(i.fat, 100)).slice(0, 15);
    const now = new Date();
    await Promise.all(items.map(i => foods().updateOne({ key: norm(i.name) }, { $setOnInsert: { key: norm(i.name), name: i.name.trim(),
      kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat, serving: Math.round(i.grams), created_at: now } }, { upsert: true })));
    return items.map(i => withAmounts(i.name.trim(), i.grams, { kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat }, 'ai'));
  }

  async function status(member) {
    const user = await loadUser(member);
    const day = localDay(new Date(), user.timezone);
    const [list, done, suggestion, quota] = await Promise.all([
      meals.list(user),
      db.collection('nutrition_days').findOne({ user_id: user.user_id, day }),
      db.collection('meal_suggestions').findOne({ user_id: user.user_id, day, status: 'open' }, { projection: { _id: 0 }, sort: { created_at: -1 } }),
      aiQuota(db, user),
    ]);
    const targets = targetsFor(user);
    const consumed = { calories: list.total_calories, protein: round1(list.total_protein), carbs: round1(list.total_carbs), fat: round1(list.total_fat) };
    const remaining = Object.fromEntries(Object.keys(targets).map(k => [k, Math.max(round1(targets[k] - consumed[k]), 0)]));
    return { user, day, targets, consumed, remaining, meals: list.logs, suggestion, completed: !!done,
      ai: { enabled: !!ai.apiKey, premium: quota.premium, used: quota.used, limit: quota.limit } };
  }

  function ruleSuggestion(kind, budget, remaining, day) {
    const pick = (list) => list[Number(day.slice(-2)) % list.length];
    if (kind === 'snack') {
      const [a, ga, b, gb] = pick([['sữa chua hy lạp', 150, 'chuối', 120], ['sữa tươi', 250, 'hạnh nhân', 20],
        ['whey', 30, 'táo', 180], ['lòng trắng trứng', 132, 'khoai lang', 150]]);
      return { meal_name: `${a} + ${b}`, items: [withAmounts(a, ga, per(a)), withAmounts(b, gb, per(b))],
        note: 'Nhẹ bụng, nhiều đạm, dễ mua ở cửa hàng tiện lợi.' };
    }
    const [protein, carb] = pick([['ức gà', 'cơm'], ['cá hồi', 'khoai lang'], ['thịt bò', 'cơm gạo lứt'], ['đậu phụ', 'bún'], ['tôm', 'cơm']]);
    const p = per(protein), c = per(carb), veg = withAmounts('rau', 150, per('rau'));
    const pg = Math.min(Math.max(Math.round(remaining.protein * 0.6 / p.protein * 10) * 10, 80), 250);
    const pItem = withAmounts(protein, pg, p);
    const cg = Math.min(Math.max(Math.round((budget - pItem.calories - veg.calories) / c.kcal * 10) * 10, 0), 300);
    const items = [pItem, ...(cg >= 50 ? [withAmounts(carb, cg, c)] : []), veg];
    return { meal_name: items.map(i => i.name).join(' + '), items, note: 'Đạm nạc, tinh bột vừa đủ và rau xanh.' };
  }
  const per = key => { const [kcal, protein, carbs, fat] = FOODS[key]; return { kcal, protein, carbs, fat }; };

  return {
    async today(member) {
      const { user, ...rest } = await status(member);
      return { success: true, ...rest };
    },

    // Reads what the member ate. Known foods are worked out locally; anything new goes to AI once and is cached.
    async parse(member, body) {
      if (!isPlainBody(body, ['text']) || !isText(body.text, 300)) throw fail(400, 'Nhập món đã ăn (1–300 ký tự), ví dụ "300g ức gà, 1 bát cơm".');
      const parts = splitMeal(body.text);
      const known = await knownFoods();
      const items = [];
      const unknown = [];
      for (const part of parts) {
        const food = known.find(f => part.name === f.key || (part.name.startsWith(`${f.key} `)
          && part.name.slice(f.key.length).trim().split(' ').every(w => COOKING.has(w))));
        if (!food) { unknown.push(part.name); continue; }
        items.push(withAmounts(food.name ?? food.key, gramsOf(part, food.serving),
          { kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat }, food.source));
      }
      if (!unknown.length) return { success: true, items, unknown, engine: 'table' };
      if (!ai.apiKey) {
        return { success: true, items, unknown, engine: 'table',
          message: `Chưa nhận ra: ${unknown.join(', ')}. Bạn nhập macro tay ở ô bên dưới.` };
      }
      const user = await loadUser(member);
      try {
        const aiItems = await withAiQuota(db, user, () => aiParse(body.text.trim()));
        return { success: true, items: aiItems, unknown: [], engine: 'ai' };
      } catch (error) {
        if (error instanceof HttpError) throw error;
        return { success: true, items, unknown, engine: 'table', message: 'AI đang bận, bạn nhập macro tay cho món chưa nhận ra.' };
      }
    },

    // One meal idea for what is left today: a light snack late in the evening, a proper meal earlier.
    async suggest(member) {
      const state = await status(member);
      const { user, day, remaining } = state;
      if (remaining.calories < 100) return { success: true, suggestion: null, message: 'Bạn đã ăn gần đủ mục tiêu hôm nay.' };
      const hour = localHour(user.timezone);
      const kind = hour >= 20 || hour < 5 ? 'snack' : hour < 10 ? 'breakfast' : hour < 14 ? 'lunch' : hour < 17 ? 'snack' : 'dinner';
      const budget = Math.min(remaining.calories, { snack: 300, breakfast: 600, lunch: 800, dinner: 700 }[kind]);
      let idea;
      let engine = 'rules';
      if (ai.apiKey) {
        try {
          idea = await withAiQuota(db, user, () => complete(ai, { json: true, maxTokens: 600,
            system: `Bạn là chuyên gia dinh dưỡng ở Việt Nam. Gợi ý MỘT ${kind === 'snack' ? 'bữa phụ nhẹ' : MEAL_LABEL[kind].toLowerCase()}
khoảng ${budget} kcal, ưu tiên bù đạm còn thiếu, món dễ mua hoặc dễ nấu ở Việt Nam. Mục tiêu người dùng: ${user.goal}.
Dạng: {"meal_name":"...","note":"một câu lý do","items":[{"name":"...","grams":150,"calories":200,"protein":20,"carbs":10,"fat":5}]}.`,
            messages: [{ role: 'user', content: `Bây giờ ${hour} giờ. Còn thiếu: ${remaining.calories} kcal, ${remaining.protein} g đạm, ${remaining.carbs} g tinh bột, ${remaining.fat} g béo.` }] }));
          const items = (Array.isArray(idea?.items) ? idea.items : []).filter(i => isText(i?.name, 80) && num(i.grams, 2000)
            && num(i.calories, 3000) && num(i.protein, 300) && num(i.carbs, 500) && num(i.fat, 300)).slice(0, 6)
            .map(i => ({ name: i.name.trim(), grams: Math.round(i.grams), calories: Math.round(i.calories), protein: round1(i.protein), carbs: round1(i.carbs), fat: round1(i.fat) }));
          idea = items.length && isText(idea.meal_name, 120) ? { meal_name: idea.meal_name.trim(), note: isText(idea.note, 300) ? idea.note.trim() : '', items } : null;
          if (idea) engine = 'ai';
        } catch (error) {
          if (error instanceof HttpError) throw error;
          idea = null;
        }
      }
      idea ??= ruleSuggestion(kind, budget, remaining, day);
      const total = k => round1(idea.items.reduce((s, i) => s + i[k], 0));
      const now = new Date();
      const suggestion = { suggestion_id: randomUUID(), user_id: user.user_id, day, meal_type: kind, meal_name: idea.meal_name,
        note: idea.note, items: idea.items.map(({ per100, source, ...i }) => i), calories: Math.max(Math.round(total('calories')), 1),
        protein: total('protein'), carbs: total('carbs'), fat: total('fat'), engine, status: 'open', created_at: now, updated_at: now };
      await db.collection('meal_suggestions').updateMany({ user_id: user.user_id, day, status: 'open' }, { $set: { status: 'dismissed', updated_at: now } });
      await db.collection('meal_suggestions').insertOne(suggestion);
      delete suggestion._id;
      return { success: true, suggestion };
    },

    // "Đã ăn": logs the suggested meal once (the suggestion id doubles as the meal id, so retries are safe).
    async eatSuggestion(member, suggestionId) {
      if (!isUuid(suggestionId)) throw fail(400, 'suggestionId không hợp lệ.');
      const s = await db.collection('meal_suggestions').findOne({ suggestion_id: suggestionId, user_id: member.user_id });
      if (!s) throw fail(404, 'Không tìm thấy gợi ý.');
      const result = await meals.create(member, { meal_id: s.suggestion_id, meal_name: [...s.meal_name].slice(0, 150).join(''),
        calories: s.calories, protein: s.protein, carbs: s.carbs, fat: s.fat, meal_type: s.meal_type });
      await db.collection('meal_suggestions').updateOne({ suggestion_id: suggestionId }, { $set: { status: 'eaten', updated_at: new Date() } });
      return { success: true, ...result };
    },

    async setCompleted(member, body) {
      if (!isPlainBody(body, ['completed']) || typeof body.completed !== 'boolean') throw fail(400, 'Cần completed là true hoặc false.');
      const user = await loadUser(member);
      const day = localDay(new Date(), user.timezone);
      if (body.completed) {
        await db.collection('nutrition_days').updateOne({ user_id: user.user_id, day },
          { $setOnInsert: { user_id: user.user_id, day, completed_at: new Date() } }, { upsert: true });
      } else {
        await db.collection('nutrition_days').deleteOne({ user_id: user.user_id, day });
      }
      return { success: true, day, completed: body.completed };
    },
  };
}

module.exports = { createNutritionService, splitMeal, targetsFor };
