'use strict';
// The coach as an agent: it remembers lasting facts about the member and can act in the app
// (build today's workout plan, log a meal, suggest the next meal, add allergies) from one chat message.
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../utils/http-error');
const { isText } = require('../utils/validate');
const { complete } = require('./ai.client');
const { createWorkoutPlanService } = require('./workout-plan.service');
const { createNutritionService } = require('./nutrition.service');
const { createMealService } = require('./meal.service');
const { isGreeting, greetingReply, allowsCoachAction } = require('./chat-intent');
const { classifyCoachMessage, outOfScopeReply } = require('./coach-scope');

const MAX_FACTS = 30;
const MAX_ACTIONS = 3;
const CONTEXTS = { general: '', workout: 'Người dùng đang ở tab Tập luyện: ưu tiên lịch tập, kỹ thuật, phục hồi.',
  nutrition: 'Người dùng đang ở tab Ăn uống: ưu tiên bữa ăn, macro, dị ứng.' };
const SPLIT_OF = { push: 'ppl', pull: 'ppl', legs: 'ppl', upper: 'upper_lower', lower: 'upper_lower', full: 'full_body' };
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const clean = (s, max) => [...String(s).replace(/\s+/g, ' ').trim()].slice(0, max).join('');
// The app shows plain text, so markdown from the model (**bold**, # headings, * bullets) is turned into plain text.
const plainText = s => s.replace(/\*\*(.+?)\*\*|__(.+?)__/g, '$1$2').replace(/^#{1,6}\s*/gm, '').replace(/^\s*[*-]\s+/gm, '• ').trim();

function createCoachAgent({ db, ai = {} }) {
  const plans = createWorkoutPlanService({ db, ai });
  const nutrition = createNutritionService({ db, ai });
  const meals = createMealService({ db });
  const memory = () => db.collection('coach_memory');

  async function facts(userId) {
    return (await memory().findOne({ user_id: userId }))?.facts ?? [];
  }
  async function saveFacts(userId, list) {
    const now = new Date();
    await memory().updateOne({ user_id: userId }, { $set: { facts: list.slice(-MAX_FACTS), updated_at: now },
      $setOnInsert: { user_id: userId, created_at: now } }, { upsert: true });
  }

  // Each action runs on its own; a failure becomes a short note instead of breaking the reply.
  async function run(user, action) {
    try {
      switch (action?.type) {
        case 'plan': {
          const focus = SPLIT_OF[action.focus] ? action.focus : 'full';
          const minutes = Math.min(Math.max(Math.round(Number(action.minutes) || 45), 15), 120);
          const note = isText(action.note, 300) ? action.note.trim() : '';
          const { plan } = await plans.create(user, { split: SPLIT_OF[focus], focus, minutes, ...(note ? { note } : {}) });
          const lines = plan.items.map((i, n) => `${n + 1}. ${i.name}: ${i.sets} hiệp × ${i.reps}, nghỉ ${i.rest_seconds}s`);
          return { kind: 'plan', text: [`Lịch "${plan.title}" (~${plan.estimated_minutes} phút, khởi động ${plan.warmup_minutes} phút):`, ...lines,
            'Đã có sẵn trong tab Tập luyện.'].join('\n') };
        }
        case 'meal': {
          if (!isText(action.text, 300)) return null;
          const parsed = await nutrition.parse(user, { text: action.text });
          if (!parsed.items.length) return { kind: 'note', text: parsed.message || 'Mình chưa nhận ra món nào để ghi.' };
          const sum = k => Math.round(parsed.items.reduce((s, i) => s + (Number(i[k]) || 0), 0) * 10) / 10;
          const type = MEAL_TYPES.includes(action.meal_type) ? action.meal_type : 'snack';
          await meals.create(user, { meal_id: randomUUID(), meal_name: clean(parsed.items.map(i => i.name).join(', '), 150),
            calories: Math.max(Math.round(sum('calories')), 1), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat'), meal_type: type });
          return { kind: 'meal', text: `Đã ghi bữa: ${parsed.items.map(i => `${i.name} (${Math.round(i.calories)} kcal)`).join(', ')}.`
            + `${parsed.warnings?.length ? ` ${parsed.warnings.join(' ')}` : ''}` };
        }
        case 'suggest_meal': {
          const { suggestion, message } = await nutrition.suggest(user);
          if (!suggestion) return { kind: 'note', text: message };
          return { kind: 'meal', text: `Gợi ý: ${suggestion.meal_name} (${suggestion.calories} kcal, ${suggestion.protein} g đạm). `
            + 'Bấm "Đã ăn" ở tab Ăn uống khi bạn ăn xong.' };
        }
        case 'allergy': {
          const add = (Array.isArray(action.add) ? action.add : []).filter(a => isText(a, 30));
          if (!add.length) return null;
          const { allergies: current = [] } = await nutrition.today(user);
          const { allergies } = await nutrition.setAllergies(user, { allergies: [...new Set([...current, ...add])].slice(0, 10) });
          return { kind: 'meal', text: `Đã lưu dị ứng: ${allergies.join(', ')}.` };
        }
        case 'remember': {
          if (!isText(action.fact, 200)) return null;
          const list = await facts(user.user_id);
          const fact = clean(action.fact, 200);
          if (!list.includes(fact)) await saveFacts(user.user_id, [...list, fact]);
          return { kind: 'memory', text: null };
        }
        case 'forget': {
          if (!isText(action.fact, 200)) return null;
          const needle = action.fact.trim().toLowerCase();
          const list = await facts(user.user_id);
          await saveFacts(user.user_id, list.filter(f => !f.toLowerCase().includes(needle) && !needle.includes(f.toLowerCase())));
          return { kind: 'memory', text: null };
        }
        default: return null;
      }
    } catch (error) {
      if (error instanceof HttpError) return { kind: 'note', text: error.message };
      return { kind: 'note', text: 'Có một thao tác chưa làm được, bạn thử lại sau nhé.' };
    }
  }

  return {
    facts,
    async clear(userId) { await memory().deleteOne({ user_id: userId }); },

    // Returns { text, kinds } or throws when the model is unavailable, so the caller can fall back to rules.
    async reply(user, ctx, history, context = 'general', currentMessage) {
      const latestMessage = currentMessage ?? [...history].reverse().find(m => m.sender === 'user')?.content ?? '';
      if (isGreeting(latestMessage)) return { text: greetingReply(), kinds: [] };
      const previousUserText = [...history].reverse().filter(m => m.sender === 'user')[1]?.content;
      const scope = classifyCoachMessage(latestMessage, { previousUserText });
      if (scope.kind === 'out_of_scope') return { text: outOfScopeReply(), kinds: [] };
      if (scope.kind === 'clarify') return { text: 'Bạn muốn hỏi chức năng hoặc dữ liệu nào trong FitLife? Hãy nói rõ hơn một chút nhé.', kinds: [] };
      const [remembered, { allergies = [] }] = await Promise.all([facts(user.user_id), nutrition.today(user).catch(() => ({}))]);
      const system = `Bạn là FitLife Coach, trợ lý cho ứng dụng FitLife, trả lời tiếng Việt, ngắn gọn và đúng câu hỏi.
Chỉ hỗ trợ tính năng FitLife, dữ liệu cá nhân trong app, tập luyện, dinh dưỡng và theo dõi thói quen. Không trả lời lập trình, chính trị, thời tiết, tài chính hoặc kiến thức ngoài phạm vi app. Không chẩn đoán hay kê thuốc.
Không biết thì nói rõ giới hạn, không tự đoán dữ liệu hoặc chức năng app không có. Không trả bản tóm tắt ngày nếu người dùng hỏi một câu cụ thể.
Người dùng: ${user.full_name}, ${user.gender === 'male' ? 'nam' : 'nữ'}, ${user.age} tuổi, ${user.height} cm, ${user.weight} kg, mục tiêu ${user.goal}.
Mục tiêu ngày: ${user.target_water} ml nước, ${user.target_calories} kcal. Dị ứng: ${allergies.join(', ') || 'không'}.
Hôm nay: ${ctx.water} ml nước, ${ctx.calories} kcal, ${ctx.workoutMinutes} phút tập, ngủ ${ctx.sleepHours ?? 'chưa ghi'} giờ.
Điều bạn nhớ về người dùng: ${remembered.length ? remembered.map(f => `- ${f}`).join('\n') : 'chưa có'}
${CONTEXTS[context] ?? ''}
Trả về {"reply":"lời nhắn cho người dùng","actions":[]}. Chỉ thêm action khi người dùng nhờ rõ ràng, tối đa ${MAX_ACTIONS}:
{"type":"plan","focus":"push|pull|legs|upper|lower|full","minutes":45,"note":"yêu cầu thêm"} lên lịch tập hôm nay (app tự chọn bài, bạn không liệt kê bài);
{"type":"meal","text":"200g ức gà, 1 bát cơm","meal_type":"breakfast|lunch|dinner|snack"} ghi bữa người dùng ĐÃ ăn;
{"type":"suggest_meal"} gợi ý bữa tiếp theo;
{"type":"allergy","add":["tôm"]} lưu dị ứng;
{"type":"remember","fact":"..."} nhớ lâu dài điều quan trọng (chấn thương, thiết bị, lịch rảnh, món thích/ghét);
{"type":"forget","fact":"..."} quên điều người dùng muốn bỏ.
Chỉ tạo action khi TIN NHẮN HIỆN TẠI yêu cầu rõ ràng; không lặp lại yêu cầu cũ chỉ vì có trong lịch sử hoặc ngữ cảnh tab.
Lời chào, cảm ơn hay câu hỏi thông tin thông thường phải trả lời trực tiếp, actions rỗng.
Người dùng muốn có, đổi hay chỉnh lịch tập trong tin nhắn hiện tại (kể cả "chỉnh lại", "đổi bài") → dùng action plan,
đưa yêu cầu vào note (VD "tập ở phòng gym, có máy"); KHÔNG tự viết danh sách bài tập trong reply.
Khi có action, reply chỉ cần một câu ngắn, kết quả sẽ được app nối thêm. reply là chữ thường, không markdown, tối đa 120 từ.`;
      const messages = history.map(m => ({ role: m.sender === 'ai' ? 'assistant' : 'user', content: m.content }));
      let out;
      try { out = await complete(ai, { system, json: true, smart: true, maxTokens: 1500, messages }); }
      catch (error) {
        // A reply that is not valid JSON still answers the member, just without actions.
        if (!(error instanceof SyntaxError)) throw error;
        out = { reply: await complete(ai, { system: system.split('Trả về {')[0], smart: true, maxTokens: 800, messages }), actions: [] };
      }
      if (!isText(out?.reply, 4000) && !Array.isArray(out?.actions)) throw new Error('bad reply');
      out.reply = isText(out.reply, 4000) ? plainText(out.reply) : '';
      if (classifyCoachMessage(out.reply).kind === 'out_of_scope') out.reply = '';
      const done = [];
      let blocked = false;
      for (const action of (Array.isArray(out.actions) ? out.actions : []).slice(0, MAX_ACTIONS)) {
        if (!allowsCoachAction(action?.type, latestMessage)) { blocked = true; continue; }
        const result = await run(user, action);
        if (result) done.push(result);
      }
      const text = [!blocked && isText(out.reply, 4000) ? out.reply.trim() : '', ...done.map(d => d.text).filter(Boolean)].filter(Boolean).join('\n\n');
      return { text: text || (done.some(d => d.kind === 'memory') ? 'Đã ghi nhớ.' : ''), kinds: [...new Set(done.map(d => d.kind).filter(k => k !== 'note'))] };
    },
    run,
  };
}

module.exports = { CONTEXTS, createCoachAgent };
