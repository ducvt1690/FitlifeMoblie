'use strict';
const { randomUUID } = require('node:crypto');
const { localDay } = require('../auth/registration');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { isUuid, isText, isPlainBody } = require('../utils/validate');
const { createQuestService, lockMember } = require('./quest.service');
const { membershipOf } = require('./payment.service');
const { createWorkoutPlanService } = require('./workout-plan.service');
const { CONTEXTS, createCoachAgent } = require('./coach-agent');
const { isGreeting, greetingReply, planRequest, allowsCoachAction } = require('./chat-intent');
const { classifyCoachMessage, appHelpReply, outOfScopeReply } = require('./coach-scope');
const { createNutritionService } = require('./nutrition.service');
const fail = (status, message) => new HttpError(status, message);
const RULE_ENGINE = 'fitlife-rules';
// Free members get this many questions per rolling 24 hours; Premium is unlimited.
const FREE_DAILY_MESSAGES = 10;
const fmt = n => Math.round(n).toLocaleString('vi-VN');
const PLAN_ENGINE = 'workout-plan';

function planReply(plan) {
  const lines = plan.items.map((i, n) => `${n + 1}. ${i.name}: ${i.sets} hiệp × ${i.reps}, nghỉ ${i.rest_seconds}s`);
  return [`Mình đã lên lịch "${plan.title}" (khoảng ${plan.estimated_minutes} phút, khởi động ${plan.warmup_minutes} phút):`, ...lines,
    plan.tip, 'Lịch đã có sẵn trong tab Tập luyện, bạn mở ra tập luôn.'].join('\n');
}

// Today's numbers give both the AI model and the rule-based coach something concrete to say.
async function todayContext(db, user) {
  const day = localDay(new Date(), user.timezone);
  const sum = (collection, dateField, field) => db.collection(collection).aggregate([
    { $match: { user_id: user.user_id, [dateField]: day } }, { $group: { _id: null, total: { $sum: `$${field}` } } },
  ]).toArray().then(rows => rows[0]?.total ?? 0);
  const [water, calories, workoutSeconds, sleep] = await Promise.all([
    sum('water_logs', 'log_date', 'amount'), sum('meal_logs', 'meal_date', 'calories'),
    sum('workout_logs', 'workout_date', 'duration_seconds'),
    db.collection('sleep_logs').findOne({ user_id: user.user_id, sleep_date: day }),
  ]);
  return { water, calories, workoutMinutes: Math.round(workoutSeconds / 60), sleepHours: sleep?.hours ?? null };
}

function ruleReply(user, ctx, text, topic) {
  const q = text.toLowerCase();
  const bmi = user.weight / ((user.height / 100) ** 2);
  if (topic === 'water') {
    const left = Math.max(user.target_water - ctx.water, 0);
    return left ? `Hôm nay bạn đã uống ${fmt(ctx.water)} / ${fmt(user.target_water)} ml. Còn khoảng ${fmt(left)} ml — chia thành ${Math.ceil(left / 250)} ly 250 ml, uống rải đều đến tối nhé.`
      : `Bạn đã đạt mục tiêu ${fmt(user.target_water)} ml nước hôm nay. Tiếp tục uống khi khát, không cần ép thêm.`;
  }
  if (topic === 'nutrition') {
    const left = user.target_calories - ctx.calories;
    const goal = { lose: 'giảm cân', maintain: 'giữ cân', gain: 'tăng cân' }[user.goal];
    return `Mục tiêu ${goal} của bạn là ${fmt(user.target_calories)} kcal/ngày; hôm nay đã ghi ${fmt(ctx.calories)} kcal. `
      + (left > 0 ? `Còn khoảng ${fmt(left)} kcal — ưu tiên đạm nạc (trứng, ức gà, cá, đậu phụ) và rau xanh.` : 'Bạn đã chạm mục tiêu, bữa còn lại nên nhẹ và nhiều rau.');
  }
  if (topic === 'sleep') {
    return ctx.sleepHours === null ? 'Bạn chưa ghi giấc ngủ hôm nay. Người trưởng thành nên ngủ 7–9 tiếng; hãy cố định giờ ngủ và tránh màn hình 30 phút trước khi ngủ.'
      : `Đêm qua bạn ngủ ${ctx.sleepHours} tiếng. ${ctx.sleepHours < 7 ? 'Hơi ít — tối nay thử đi ngủ sớm hơn 30 phút.' : 'Rất tốt, giữ nhịp này nhé.'}`;
  }
  if (topic === 'workout') {
    if (/(?:lịch|giáo án|kế hoạch)\s*tập\s+(?:là gì|có nghĩa)/.test(q)) return 'Lịch tập trong FitLife là danh sách bài cho buổi tập, gồm số hiệp, số lần và thời gian nghỉ. Bạn xem lịch ở Tập luyện, đánh dấu bài đã làm rồi bấm Đã tập xong.';
    if (/đừng|không cần|không muốn/.test(q)) return 'Mình chưa tạo hoặc thay đổi lịch tập. Bạn muốn xem lịch hiện có hay hỏi cách dùng Tập luyện?';
    return `Hôm nay bạn đã tập ${ctx.workoutMinutes} phút. Gợi ý: 150 phút vận động vừa mỗi tuần, cộng 2 buổi tập sức mạnh. `
      + 'Nếu ít thời gian, một vòng Tabata 4 phút (20 giây tập, 10 giây nghỉ × 8) với squat, hít đất, plank là đủ khởi động.';
  }
  if (topic === 'bmi') {
    return `Với ${user.weight} kg và ${user.height} cm, BMI của bạn khoảng ${bmi.toFixed(1)} `
      + `(${bmi < 18.5 ? 'thiếu cân' : bmi < 23 ? 'cân đối' : bmi < 25 ? 'thừa cân nhẹ' : 'béo phì'} theo chuẩn châu Á).`;
  }
  if (topic !== 'stats') return 'Bạn muốn mình hướng dẫn phần nào trong FitLife? Hãy nói rõ câu hỏi về tập luyện, ăn uống, nước uống hoặc hồ sơ nhé.';
  return `Tóm tắt hôm nay: ${fmt(ctx.water)} ml nước, ${fmt(ctx.calories)} kcal, ${ctx.workoutMinutes} phút tập`
    + `${ctx.sleepHours === null ? '' : `, ngủ ${ctx.sleepHours} tiếng`}. Bạn có thể hỏi mình về nước uống, dinh dưỡng, giấc ngủ, tập luyện hoặc BMI.`;
}

function createChatService({ db, ai = {} }) {
  const quests = createQuestService({ db });
  const plans = createWorkoutPlanService({ db, ai });
  const rulePlans = createWorkoutPlanService({ db });
  const agent = createCoachAgent({ db, ai });
  const readNutrition = createNutritionService({ db });
  async function foodAnswer(user, content) {
    const question = content.match(/^(.+?)\s+(?:(?:có|chứa)\s+)?(?:bao nhiêu|bao|mấy)\s+(?:calo|calorie|calories|kcal)\b/i)
      || content.match(/(?:bao nhiêu|bao)\s+(?:calo|calorie|calories|kcal)\s+(?:trong|cho)\s+(.+)/i);
    if (!question) return null;
    const food = question[1].replace(/^(?:ăn|uống)\s+/i, '').trim();
    if (!food || food.length > 200) return null;
    try {
      const result = await readNutrition.parse(user, { text: food });
      if (!result.items.length || result.unknown?.length) return `Mình chưa có số liệu chắc chắn cho ${food} trong bảng món ăn của FitLife. Bạn có thể vào Ăn uống, nhập rõ món và khối lượng rồi bấm Tính macro; đừng coi mục tiêu kcal ngày là lượng calo của món đó.`;
      return result.items.map(item => `Theo bảng món ăn FitLife, ${item.grams} g ${item.name} ước tính ${item.calories} kcal, ${item.protein} g đạm, ${item.carbs} g tinh bột và ${item.fat} g chất béo.`).join('\n');
    } catch { return 'Bạn hãy ghi rõ món và lượng ăn, ví dụ "100g ức gà có bao nhiêu calo?". Mình chưa ghi bữa ăn từ câu hỏi này.'; }
  }
  async function ownSession(user, sessionId) {
    if (!isUuid(sessionId)) throw fail(400, 'session_id không hợp lệ.');
    const chat = await db.collection('ai_chat_sessions').findOne({ session_id: sessionId, user_id: user.user_id }, { projection: { _id: 0 } });
    if (!chat) throw fail(404, 'Cuộc trò chuyện không tồn tại.');
    return chat;
  }
  return {
    // What the coach remembers about the member, and a way to wipe it.
    async memory(user) { return { success: true, facts: await agent.facts(user.user_id) }; },
    async clearMemory(user) { await agent.clear(user.user_id); return { success: true, facts: [] }; },
    async sessions(user) {
      const sessions = await db.collection('ai_chat_sessions').find({ user_id: user.user_id }, { projection: { _id: 0 } })
        .sort({ updated_at: -1 }).limit(50).toArray();
      return { success: true, ai_enabled: !!ai.apiKey, sessions };
    },
    async messages(user, sessionId) {
      const session = await ownSession(user, sessionId);
      const messages = await db.collection('ai_chat_messages').find({ user_id: user.user_id, session_id: sessionId }, { projection: { _id: 0 } })
        .sort({ timestamp: 1, message_id: 1 }).toArray();
      return { success: true, session, messages };
    },
    // Delete one conversation and all its messages. The daily free quota (ai_question_usage) is kept.
    async remove(user, sessionId) {
      await ownSession(user, sessionId);
      return transaction(db, async session => {
        const removed = await db.collection('ai_chat_messages').deleteMany({ user_id: user.user_id, session_id: sessionId }, { session });
        await db.collection('ai_chat_sessions').deleteOne({ session_id: sessionId, user_id: user.user_id }, { session });
        return { success: true, deleted: true, session_id: sessionId, deleted_messages: removed.deletedCount };
      });
    },
    // Saves the member's message (creating the session on first use), pays q_chat once a day, then stores the coach reply.
    async send(member, body) {
      if (!isPlainBody(body, ['session_id', 'message_id', 'content', 'context']) || !isUuid(body.session_id)
        || !isUuid(body.message_id) || !isText(body.content, 4000) || (body.context !== undefined && !Object.hasOwn(CONTEXTS, body.context))) {
        throw fail(400, 'Cần session_id UUID, message_id UUID, content (1–4000 ký tự) và context general/workout/nutrition nếu có.');
      }
      const content = body.content.trim();
      const previousUser = await db.collection('ai_chat_messages').findOne({ user_id: member.user_id,
        session_id: body.session_id, sender: 'user' }, { sort: { timestamp: -1 }, projection: { content: 1 } });
      const greeting = isGreeting(content);
      const scope = classifyCoachMessage(content, { previousUserText: previousUser?.content });
      const help = !greeting && scope.kind === 'in_scope' ? appHelpReply(content) : null;
      // Small talk/refusals/help do not spend the member's substantive coaching allowance.
      const countsQuestion = !greeting && scope.kind === 'in_scope' && !help;
      const saved = await transaction(db, async session => {
        const now = new Date();
        const user = await lockMember(db, member.user_id, session, now);
        const existing = await db.collection('ai_chat_messages').findOne({ message_id: body.message_id }, { session, projection: { _id: 0 } });
        if (existing) {
          if (existing.user_id !== user.user_id || existing.session_id !== body.session_id || existing.content !== content) {
            throw fail(409, 'message_id đã được sử dụng cho yêu cầu khác.');
          }
          return { user, message: existing, replayed: true, reward: 0 };
        }
        if (countsQuestion && !(await membershipOf(db, user.user_id, session)).premium) {
          const recent = await db.collection('ai_question_usage').countDocuments({ user_id: user.user_id,
            created_at: { $gte: new Date(now.getTime() - 86400000) } }, { session });
          if (recent >= FREE_DAILY_MESSAGES) throw fail(402, `Gói miễn phí được hỏi ${FREE_DAILY_MESSAGES} câu mỗi 24 giờ. Nâng cấp Premium để hỏi không giới hạn.`);
        }
        const chat = await db.collection('ai_chat_sessions').findOne({ session_id: body.session_id }, { session });
        if (chat && chat.user_id !== user.user_id) throw fail(404, 'Cuộc trò chuyện không tồn tại.');
        if (chat) await db.collection('ai_chat_sessions').updateOne({ session_id: body.session_id }, { $set: { updated_at: now } }, { session });
        else await db.collection('ai_chat_sessions').insertOne({ session_id: body.session_id, user_id: user.user_id,
          title: [...content].slice(0, 60).join(''), created_at: now, updated_at: now }, { session });
        const message = { message_id: body.message_id, user_id: user.user_id, session_id: body.session_id, sender: 'user',
          content, timestamp: now, created_at: now, updated_at: now };
        await db.collection('ai_chat_messages').insertOne(message, { session });
        if (countsQuestion) await db.collection('ai_question_usage').insertOne({ usage_id: randomUUID(), user_id: user.user_id, created_at: now, updated_at: now }, { session });
        delete message._id;
        const reward = await quests.rewardChat(user, localDay(now, user.timezone), now, session);
        return { user, message, replayed: false, reward };
      });
      if (saved.replayed) return { success: true, replayed: true, message: saved.message, reply: null, reward_coins: 0, fit_coins: saved.user.fit_coins };

      const ctx = await todayContext(db, saved.user);
      let text = greeting ? greetingReply() : scope.kind === 'out_of_scope' ? outOfScopeReply()
        : scope.kind === 'thanks' ? 'Rất vui được hỗ trợ bạn! Khi cần, bạn cứ hỏi về các tính năng hoặc dữ liệu trong FitLife nhé.'
          : scope.kind === 'clarify' ? 'Mình chưa rõ bạn đang hỏi phần nào trong FitLife. Bạn muốn hỏi về tập luyện, ăn uống, nước uống hay hồ sơ?'
            : help || undefined;
      if (!text && scope.topic === 'weight_goal') {
        const q = content.normalize('NFKD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').toLowerCase();
        const goal = /giam/.test(q) ? 'Giảm cân' : /tang/.test(q) ? 'Tăng cơ' : 'Giữ dáng';
        const current = { lose: 'Giảm cân', maintain: 'Giữ dáng', gain: 'Tăng cơ' }[saved.user.goal];
        text = `Bạn đang muốn ${goal.toLowerCase()}; hồ sơ hiện đặt mục tiêu ${current}. Vào Hồ sơ → Chỉnh sửa, chọn Mục tiêu ${goal} rồi bấm Lưu thay đổi để FitLife tính lại chỉ tiêu phù hợp. Hôm nay, hãy ghi các bữa trong Ăn uống và theo dõi buổi tập ở Tập luyện. Mình chưa tự đổi mục tiêu hoặc tạo lịch từ câu hỏi này.`;
      }
      if (!text && ['water', 'bmi', 'stats'].includes(scope.topic)) text = ruleReply(saved.user, ctx, content, scope.topic);
      if (!text && scope.topic === 'nutrition') text = await foodAnswer(saved.user, content);
      let engine = RULE_ENGINE, plan = null, actions = [], slow = false;
      if (ai.apiKey && !text && scope.kind === 'in_scope') {
        const history = await db.collection('ai_chat_messages').find({ user_id: saved.user.user_id, session_id: body.session_id })
          .sort({ timestamp: -1, message_id: -1 }).limit(20).toArray();
        history.reverse();
        // The model conversation must start with a user turn.
        while (history[0]?.sender === 'ai') history.shift();
        try {
          ({ text, kinds: actions } = await agent.reply(saved.user, ctx, history, body.context, content));
          engine = actions.length ? `agent:${actions.join(',')}` : ai.model;
        } catch (error) { console.warn(`Coach AI lỗi, dùng luật: ${error.name}`); text = undefined; actions = []; slow = error.name === 'TimeoutError'; }
      }
      // A plain "lên lịch tập ..." always ends with a real plan in the Tập luyện tab, even when AI is off or skipped the action.
      const wanted = scope.kind === 'in_scope' && !help && !actions.includes('plan')
        && allowsCoachAction('plan', content) && planRequest(content, (await plans.latest(saved.user)).plan);
      if (wanted) {
        try {
          // After a model timeout the plan is built from rules instead of waiting on the model a second time.
          plan = (await (slow ? rulePlans : plans).create(saved.user, wanted)).plan;
          text = text ? `${text}\n\n${planReply(plan)}` : planReply(plan);
          actions = [...actions, 'plan'];
          engine = engine === RULE_ENGINE ? PLAN_ENGINE : `agent:${actions.join(',')}`;
        } catch (error) {
          if (!text && (error.httpStatus === 402 || error.httpStatus === 503)) text = `${error.message} Bạn vẫn có thể tự tạo ở tab Tập luyện.`;
        }
      }
      if (!text && scope.topic === 'nutrition' && allowsCoachAction('suggest_meal', content)) {
        const suggestion = await readNutrition.suggest(saved.user).catch(() => null);
        if (suggestion?.suggestion) {
          const meal = suggestion.suggestion;
          text = `Gợi ý trong FitLife: ${meal.meal_name}, khoảng ${meal.calories} kcal và ${meal.protein} g đạm. Xem ở Ăn uống; chỉ bấm Đã ăn sau khi bạn ăn xong.`;
          actions = [...actions, 'meal']; engine = 'agent:meal';
        }
      }
      if (!text) text = ruleReply(saved.user, ctx, content, scope.topic);
      const now = new Date();
      const reply = { message_id: randomUUID(), user_id: saved.user.user_id, session_id: body.session_id, sender: 'ai',
        content: text, ai_engine: engine, timestamp: now, created_at: now, updated_at: now };
      await db.collection('ai_chat_messages').insertOne(reply);
      delete reply._id;
      return { success: true, replayed: false, message: saved.message, reply, plan, actions,
        reward_coins: saved.reward, fit_coins: saved.user.fit_coins + saved.reward };
    },
  };
}
module.exports = { FREE_DAILY_MESSAGES, PLAN_ENGINE, createChatService, planRequest };
