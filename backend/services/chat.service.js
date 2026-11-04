'use strict';
const { randomUUID } = require('node:crypto');
const { localDay } = require('../auth/registration');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { isUuid, isText, isPlainBody } = require('../utils/validate');
const { createQuestService, lockMember } = require('./quest.service');
const { membershipOf } = require('./payment.service');
const { aiLimits, DEFAULT_AI_LIMITS } = require('./ai-usage');
const { createWorkoutPlanService } = require('./workout-plan.service');
const { CONTEXTS, createCoachAgent } = require('./coach-agent');
const fail = (status, message) => new HttpError(status, message);
const RULE_ENGINE = 'fitlife-rules';
// Default free limit (questions per rolling 24 hours); the live limits per plan come from ai_limits settings.
const FREE_DAILY_MESSAGES = DEFAULT_AI_LIMITS.free.chat;
const fmt = n => Math.round(n).toLocaleString('vi-VN');
const PLAN_ENGINE = 'workout-plan';

// "Lên lịch tập 45 phút cho ngực" → the same request the Tập luyện tab sends; null when the message is not asking for a plan.
// `previous` is today's last plan: a follow-up like "chỉnh lại tập ở phòng gym" keeps its muscle group and length.
function planRequest(text, previous) {
  const q = text.toLowerCase();
  if (!/(lịch|giáo án|kế hoạch|chương trình|plan|buổi)\s*(tập|workout|gym)|lên lịch|xếp lịch|sắp lịch|đổi lịch|chỉnh (lại )?lịch|chỉnh lại.*tập|đổi bài/.test(q)) return null;
  const hours = q.match(/(\d+(?:[.,]\d+)?)\s*(tiếng|giờ|h\b)/);
  const mins = q.match(/(\d{1,3})\s*(phút|p\b|min)/);
  const minutes = Math.min(Math.max(Math.round(hours ? Number(hours[1].replace(',', '.')) * 60 : mins ? Number(mins[1]) : previous?.minutes ?? 45), 15), 120);
  const [split, focus] = /thân trên|upper/.test(q) ? ['upper_lower', 'upper'] : /thân dưới|lower/.test(q) ? ['upper_lower', 'lower']
    : /push|ngực|vai|tay sau/.test(q) ? ['ppl', 'push'] : /pull|lưng|xô|tay trước|bắp tay/.test(q) ? ['ppl', 'pull']
      : /\blegs?\b|chân|mông|đùi/.test(q) ? ['ppl', 'legs']
        : previous ? [previous.split, previous.focus] : ['full_body', 'full'];
  return { split, focus, minutes, note: [...text.trim()].slice(0, 300).join('') };
}

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

function ruleReply(user, ctx, text) {
  const q = text.toLowerCase();
  const bmi = user.weight / ((user.height / 100) ** 2);
  if (/nước|uống|water/.test(q)) {
    const left = Math.max(user.target_water - ctx.water, 0);
    return left ? `Hôm nay bạn đã uống ${fmt(ctx.water)} / ${fmt(user.target_water)} ml. Còn khoảng ${fmt(left)} ml — chia thành ${Math.ceil(left / 250)} ly 250 ml, uống rải đều đến tối nhé.`
      : `Bạn đã đạt mục tiêu ${fmt(user.target_water)} ml nước hôm nay. Tiếp tục uống khi khát, không cần ép thêm.`;
  }
  if (/calo|kcal|ăn|bữa|giảm cân|tăng cân|dinh dưỡng/.test(q)) {
    const left = user.target_calories - ctx.calories;
    const goal = { lose: 'giảm cân', maintain: 'giữ cân', gain: 'tăng cân' }[user.goal];
    return `Mục tiêu ${goal} của bạn là ${fmt(user.target_calories)} kcal/ngày; hôm nay đã ghi ${fmt(ctx.calories)} kcal. `
      + (left > 0 ? `Còn khoảng ${fmt(left)} kcal — ưu tiên đạm nạc (trứng, ức gà, cá, đậu phụ) và rau xanh.` : 'Bạn đã chạm mục tiêu, bữa còn lại nên nhẹ và nhiều rau.');
  }
  if (/ngủ|sleep|mệt/.test(q)) {
    return ctx.sleepHours === null ? 'Bạn chưa ghi giấc ngủ hôm nay. Người trưởng thành nên ngủ 7–9 tiếng; hãy cố định giờ ngủ và tránh màn hình 30 phút trước khi ngủ.'
      : `Đêm qua bạn ngủ ${ctx.sleepHours} tiếng. ${ctx.sleepHours < 7 ? 'Hơi ít — tối nay thử đi ngủ sớm hơn 30 phút.' : 'Rất tốt, giữ nhịp này nhé.'}`;
  }
  if (/tập|workout|cơ|chạy|hiit|tabata/.test(q)) {
    return `Hôm nay bạn đã tập ${ctx.workoutMinutes} phút. Gợi ý: 150 phút vận động vừa mỗi tuần, cộng 2 buổi tập sức mạnh. `
      + 'Nếu ít thời gian, một vòng Tabata 4 phút (20 giây tập, 10 giây nghỉ × 8) với squat, hít đất, plank là đủ khởi động.';
  }
  if (/bmi|cân nặng|chiều cao/.test(q)) {
    return `Với ${user.weight} kg và ${user.height} cm, BMI của bạn khoảng ${bmi.toFixed(1)} `
      + `(${bmi < 18.5 ? 'thiếu cân' : bmi < 23 ? 'cân đối' : bmi < 25 ? 'thừa cân nhẹ' : 'béo phì'} theo chuẩn châu Á).`;
  }
  return `Tóm tắt hôm nay: ${fmt(ctx.water)} ml nước, ${fmt(ctx.calories)} kcal, ${ctx.workoutMinutes} phút tập`
    + `${ctx.sleepHours === null ? '' : `, ngủ ${ctx.sleepHours} tiếng`}. Bạn có thể hỏi mình về nước uống, dinh dưỡng, giấc ngủ, tập luyện hoặc BMI.`;
}

function createChatService({ db, ai = {} }) {
  const quests = createQuestService({ db });
  const plans = createWorkoutPlanService({ db, ai });
  const rulePlans = createWorkoutPlanService({ db });
  const agent = createCoachAgent({ db, ai });
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
        // Limits come from admin settings (ai_limits.chat) and count questions in the last 24 hours.
        const premium = (await membershipOf(db, user.user_id, session)).premium;
        const limit = (await aiLimits(db, session))[premium ? 'premium' : 'free'].chat;
        const recent = await db.collection('ai_question_usage').countDocuments({ user_id: user.user_id,
          created_at: { $gte: new Date(now.getTime() - 86400000) } }, { session });
        if (recent >= limit) {
          throw fail(402, premium ? `Bạn đã dùng hết ${limit} câu hỏi AI trong 24 giờ.`
            : `Gói miễn phí được hỏi ${limit} câu mỗi 24 giờ. Nâng cấp Premium để hỏi nhiều hơn.`);
        }
        const chat = await db.collection('ai_chat_sessions').findOne({ session_id: body.session_id }, { session });
        if (chat && chat.user_id !== user.user_id) throw fail(404, 'Cuộc trò chuyện không tồn tại.');
        if (chat) await db.collection('ai_chat_sessions').updateOne({ session_id: body.session_id }, { $set: { updated_at: now } }, { session });
        else await db.collection('ai_chat_sessions').insertOne({ session_id: body.session_id, user_id: user.user_id,
          title: [...content].slice(0, 60).join(''), created_at: now, updated_at: now }, { session });
        const message = { message_id: body.message_id, user_id: user.user_id, session_id: body.session_id, sender: 'user',
          content, timestamp: now, created_at: now, updated_at: now };
        await db.collection('ai_chat_messages').insertOne(message, { session });
        await db.collection('ai_question_usage').insertOne({ usage_id: randomUUID(), user_id: user.user_id, created_at: now, updated_at: now }, { session });
        delete message._id;
        const reward = await quests.rewardChat(user, localDay(now, user.timezone), now, session);
        return { user, message, replayed: false, reward };
      });
      if (saved.replayed) return { success: true, replayed: true, message: saved.message, reply: null, reward_coins: 0, fit_coins: saved.user.fit_coins };

      const ctx = await todayContext(db, saved.user);
      let text, engine = RULE_ENGINE, plan = null, actions = [], slow = false;
      if (ai.apiKey) {
        const history = await db.collection('ai_chat_messages').find({ user_id: saved.user.user_id, session_id: body.session_id })
          .sort({ timestamp: -1, message_id: -1 }).limit(20).toArray();
        history.reverse();
        // The model conversation must start with a user turn.
        while (history[0]?.sender === 'ai') history.shift();
        try {
          ({ text, kinds: actions } = await agent.reply(saved.user, ctx, history, body.context));
          engine = actions.length ? `agent:${actions.join(',')}` : ai.model;
        } catch (error) { console.warn(`Coach AI lỗi, dùng luật: ${error.name}`); text = undefined; actions = []; slow = error.name === 'TimeoutError'; }
      }
      // A plain "lên lịch tập ..." always ends with a real plan in the Tập luyện tab, even when AI is off or skipped the action.
      const wanted = !actions.includes('plan') && planRequest(content, (await plans.latest(saved.user)).plan);
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
      if (!text) text = ruleReply(saved.user, ctx, content);
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
