'use strict';
const { randomUUID } = require('node:crypto');
const { localDay } = require('../auth/registration');
const { HttpError } = require('../utils/http-error');
const { isUuid, isText, isPlainBody } = require('../utils/validate');
const { complete } = require('./ai.client');
const { withAiQuota } = require('./ai-usage');
const { membershipOf } = require('./payment.service');
const { createWorkoutService } = require('./workout.service');
const { afterWorkout } = require('./after-workout');
const { createNutritionService } = require('./nutrition.service');
const fail = (status, message) => new HttpError(status, message);

const SPLITS = { ppl: ['push', 'pull', 'legs'], upper_lower: ['upper', 'lower'], full_body: ['full'] };
const FOCUS = {
  push: { label: 'Push (ngực, vai, tay sau)', parts: ['chest', 'shoulders', 'upper arms'], skip: 'biceps' },
  pull: { label: 'Pull (lưng, tay trước)', parts: ['back', 'upper arms'], skip: 'triceps' },
  legs: { label: 'Legs (chân, mông, bụng)', parts: ['upper legs', 'lower legs', 'waist'] },
  upper: { label: 'Upper (thân trên)', parts: ['chest', 'back', 'shoulders', 'upper arms'] },
  lower: { label: 'Lower (thân dưới)', parts: ['upper legs', 'lower legs', 'waist'] },
  full: { label: 'Full body', parts: ['chest', 'back', 'shoulders', 'upper arms', 'upper legs', 'lower legs', 'waist'] },
};
const WORK_SECONDS = 40; // one set, including setting up
const SWITCH_SECONDS = 60; // moving to the next exercise
const warmupOf = minutes => (minutes >= 30 ? 5 : 3) * 60;
const secondsOf = (items, minutes) => warmupOf(minutes) + items.reduce((s, i) => s + i.sets * (WORK_SECONDS + i.rest_seconds) + SWITCH_SECONDS, 0);
const COMPOUND = /press|squat|deadlift|row|pull-up|chin-up|lunge|dip|push-up/i;

// Makes the plan fit the time the member has: fewer sets or exercises when too long, more sets or exercises when short.
function fitToTime(items, pool, minutes) {
  const limit = minutes * 60;
  const plan = items.map(i => ({ ...i }));
  while (plan.length > 1 && secondsOf(plan, minutes) > limit) {
    const longest = plan.reduce((a, b) => (b.sets > a.sets ? b : a));
    if (longest.sets > 2) longest.sets -= 1;
    else plan.pop();
  }
  let added = true;
  while (added && limit - secondsOf(plan, minutes) > 4 * 60) {
    added = false;
    const unused = pool.find(e => !plan.some(p => p.exercise_id === e.exercise_id));
    const room = limit - secondsOf(plan, minutes);
    if (unused && room >= 3 * (WORK_SECONDS + 60) + SWITCH_SECONDS && plan.length < 10) {
      plan.push(itemFor(unused, 3)); added = true;
    } else {
      const short = plan.filter(p => p.sets < 5).sort((a, b) => a.sets - b.sets)[0];
      if (short && room >= WORK_SECONDS + short.rest_seconds) { short.sets += 1; added = true; }
    }
  }
  return plan;
}

function itemFor(exercise, sets, reps, rest) {
  const compound = COMPOUND.test(exercise.name);
  return { exercise_id: exercise.exercise_id, name: exercise.name_vi || exercise.name, gif_url: exercise.gif_url,
    target: exercise.target_muscles_vi?.[0] || exercise.target_muscles?.[0] || '', sets,
    reps: reps || (compound ? '6–10' : '10–15'), rest_seconds: rest || (compound ? 90 : 60) };
}

function createWorkoutPlanService({ db, ai = {} }) {
  const workouts = createWorkoutService({ db });
  const nutrition = createNutritionService({ db });
  async function candidates(focus) {
    const f = FOCUS[focus];
    const rows = await db.collection('exercises').find({ is_active: true, body_parts: { $in: f.parts } },
      { projection: { _id: 0, instructions: 0, instructions_vi: 0 } }).limit(80).toArray();
    return rows.filter(e => !f.skip || !e.target_muscles?.includes(f.skip))
      .sort((a, b) => Number(COMPOUND.test(b.name)) - Number(COMPOUND.test(a.name)));
  }

  const service = {
    options() {
      return { success: true, splits: Object.entries(SPLITS).map(([value, days]) => ({ value, days: days.map(d => ({ value: d, label: FOCUS[d].label })) })) };
    },

    async latest(member) {
      const day = localDay(new Date(), member.timezone);
      const plan = await db.collection('workout_plans').findOne({ user_id: member.user_id, day }, { projection: { _id: 0 }, sort: { created_at: -1 } });
      return { success: true, plan };
    },

    // Premium: AI builds a session for the chosen split day from our own exercise catalog, then the server makes it fit the time.
    async create(member, body) {
      if (!isPlainBody(body, ['split', 'focus', 'minutes', 'note']) || !SPLITS[body.split] || !SPLITS[body.split].includes(body.focus)
        || !Number.isInteger(body.minutes) || body.minutes < 15 || body.minutes > 120
        || (body.note !== undefined && body.note !== '' && !isText(body.note, 300))) {
        throw fail(400, 'Cần split (ppl, upper_lower, full_body), focus đúng với split, minutes 15–120 và note tối đa 300 ký tự.');
      }
      if (!(await membershipOf(db, member.user_id)).premium) throw fail(402, 'Lịch tập AI dành cho thành viên Premium.');
      const user = await db.collection('users').findOne({ user_id: member.user_id });
      const pool = await candidates(body.focus);
      if (!pool.length) throw fail(503, 'Thư viện bài tập chưa có bài cho nhóm cơ này.');
      const note = body.note?.trim() || '';
      let items = null;
      let title = `${FOCUS[body.focus].label} · ${body.minutes} phút`;
      let tip = 'Khởi động nhẹ trước, giữ 1–2 rep dự trữ ở mỗi hiệp.';
      let engine = 'rules';
      if (ai.apiKey) {
        try {
          const out = await withAiQuota(db, user, () => complete(ai, { json: true, smart: true, maxTokens: 900,
            system: `Bạn là huấn luyện viên thể hình. Chỉ chọn bài trong danh sách (dùng số thứ tự i). Xếp bài compound trước.
Buổi tập phải vừa ${body.minutes} phút, tính cả khởi động; mỗi hiệp khoảng ${WORK_SECONDS} giây cộng thời gian nghỉ.
Người tập: ${user.gender === 'male' ? 'nam' : 'nữ'}, ${user.age} tuổi, ${user.weight} kg, mục tiêu ${user.goal}.
Dạng: {"title":"tên buổi ngắn","tip":"một câu lưu ý","items":[{"i":0,"sets":3,"reps":"8-10","rest":90}]}.`,
            messages: [{ role: 'user', content: `Buổi ${FOCUS[body.focus].label}, ${body.minutes} phút.${note ? ` Yêu cầu thêm: ${note}` : ''}\nDanh sách:\n`
              + pool.map((e, i) => `${i}. ${e.name} (${e.target_muscles?.[0] ?? ''}, ${e.equipments?.[0] ?? ''})`).join('\n') }] }));
          const seen = new Set();
          items = (Array.isArray(out?.items) ? out.items : []).filter(r => Number.isInteger(r?.i) && pool[r.i] && !seen.has(r.i) && seen.add(r.i))
            .slice(0, 10).map(r => itemFor(pool[r.i], Math.min(Math.max(Number.parseInt(r.sets, 10) || 3, 1), 6),
              isText(String(r.reps ?? ''), 20) ? String(r.reps).trim() : undefined, Math.min(Math.max(Number.parseInt(r.rest, 10) || 60, 30), 180)));
          if (items.length) {
            engine = 'ai';
            // The real length comes from fitToTime, so a duration the model wrote into the title is dropped.
            if (isText(out.title, 80)) title = out.title.replace(/[\s·,-]*\d+\s*(phút|phut|min)\b/giu, '').trim() || title;
            if (isText(out.tip, 300)) tip = out.tip.trim();
          } else items = null;
        } catch (error) {
          if (error instanceof HttpError) throw error;
          items = null;
        }
      }
      items ??= pool.slice(0, Math.max(2, Math.round(body.minutes / 12))).map(e => itemFor(e, 3));
      items = fitToTime(items, pool, body.minutes);
      const now = new Date();
      const plan = { plan_id: randomUUID(), user_id: user.user_id, day: localDay(now, user.timezone), split: body.split, focus: body.focus,
        minutes: body.minutes, note, title, tip, items, warmup_minutes: warmupOf(body.minutes) / 60,
        estimated_minutes: Math.round(secondsOf(items, body.minutes) / 60), engine, status: 'open', done_items: [], created_at: now, updated_at: now };
      // The catalog can be too small for a long session; say so instead of silently making it shorter.
      if (plan.estimated_minutes < body.minutes - 10) plan.notice = `Thư viện hiện có ${pool.length} bài cho nhóm này nên buổi tập dài khoảng ${plan.estimated_minutes} phút thay vì ${body.minutes} phút.`;
      await db.collection('workout_plans').insertOne(plan);
      delete plan._id;
      return { success: true, plan };
    },

    // Swipe-to-finish on each exercise: the list of exercise ids marked done.
    async setDone(member, planId, body) {
      if (!isUuid(planId)) throw fail(400, 'planId không hợp lệ.');
      if (!isPlainBody(body, ['done']) || !Array.isArray(body.done) || body.done.length > 10) throw fail(400, 'done phải là danh sách exercise_id.');
      const plan = await db.collection('workout_plans').findOne({ plan_id: planId, user_id: member.user_id });
      if (!plan) throw fail(404, 'Không tìm thấy lịch tập.');
      const done = plan.items.map(i => i.exercise_id).filter(id => body.done.includes(id));
      await db.collection('workout_plans').updateOne({ plan_id: planId }, { $set: { done_items: done, updated_at: new Date() } });
      return { success: true, done_items: done };
    },

    // "Đã tập xong": logs the session as a workout once (the plan id doubles as the workout id).
    async complete(member, planId) {
      if (!isUuid(planId)) throw fail(400, 'planId không hợp lệ.');
      const plan = await db.collection('workout_plans').findOne({ plan_id: planId, user_id: member.user_id });
      if (!plan) throw fail(404, 'Không tìm thấy lịch tập.');
      // Only the exercises ticked off count, so finishing early logs the time and calories actually spent.
      const doneItems = plan.items.filter(i => (plan.done_items ?? []).includes(i.exercise_id));
      if (!doneItems.length) throw fail(409, 'Hãy đánh dấu ít nhất một bài đã tập trước khi hoàn thành buổi tập.');
      const user = await db.collection('users').findOne({ user_id: member.user_id });
      const minutes = Math.max(1, Math.round(secondsOf(doneItems, plan.minutes) / 60));
      const result = await workouts.create(member, { workout_id: plan.plan_id, title: [...plan.title].slice(0, 150).join(''),
        category: 'strength', duration_seconds: minutes * 60, calories_burned: Math.round(5 * user.weight * minutes / 60) });
      const now = new Date();
      const [meals] = await db.collection('meal_logs').aggregate([{ $match: { user_id: user.user_id, meal_date: localDay(now, user.timezone) } },
        { $group: { _id: null, kcal: { $sum: '$calories' } } }]).toArray();
      const after = plan.after ?? afterWorkout({ now, timezone: user.timezone, eaten: meals?.kcal ?? 0, target: user.target_calories, minutes });
      await db.collection('workout_plans').updateOne({ plan_id: planId }, { $set: { status: 'done', after, updated_at: now } });
      const coach = plan.after ? null : await coachNote(user, plan, minutes, after, now).catch(() => null);
      return { success: true, ...result, after, coach };
    },
  };
  return service;

  // The coach posts the recovery tips (and a meal the member can add with one tap) into their latest chat.
  async function coachNote(user, plan, minutes, after, now) {
    const { suggestion } = await nutrition.suggest(user, { offer: true }).catch(() => ({}));
    const tips = after.tips.map(t => `• ${t.title}: ${t.text}`).join('\n');
    const meal = suggestion ? `\n\nGợi ý bữa sau tập: ${suggestion.meal_name} (~${suggestion.calories} kcal, ${Math.round(suggestion.protein)} g đạm). Bấm "Thêm vào thực đơn" nếu bạn muốn ăn món này.` : '';
    const content = `Chúc mừng bạn đã hoàn thành "${plan.title}" (${minutes} phút)! Vài lưu ý cho lúc này:
${tips}${meal}`;
    let chat = await db.collection('ai_chat_sessions').find({ user_id: user.user_id }).sort({ updated_at: -1 }).limit(1).next();
    if (!chat) {
      chat = { session_id: randomUUID(), user_id: user.user_id, title: 'Sau buổi tập', created_at: now, updated_at: now };
      await db.collection('ai_chat_sessions').insertOne(chat);
    } else await db.collection('ai_chat_sessions').updateOne({ session_id: chat.session_id }, { $set: { updated_at: now } });
    await db.collection('ai_chat_messages').insertOne({ message_id: randomUUID(), user_id: user.user_id, session_id: chat.session_id, sender: 'ai',
      content, ai_engine: suggestion ? `after-workout:${suggestion.suggestion_id}` : 'after-workout', timestamp: now, created_at: now, updated_at: now });
    return { session_id: chat.session_id, preview: `Tập tốt lắm! ${after.tips[0].text}`.slice(0, 120), suggestion };
  }
}

module.exports = { createWorkoutPlanService, fitToTime, secondsOf };
