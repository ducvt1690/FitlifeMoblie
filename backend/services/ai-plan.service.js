'use strict';

const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { isUuid, isPlainBody } = require('../utils/validate');
const { readPage } = require('../utils/fields');
const { withCurrentAge } = require('../utils/birth-date');
const { calculateTargets } = require('../utils/health-targets');
const { lockMember } = require('./quest.service');
const { membershipOf } = require('./payment.service');
const { createMealService } = require('./meal.service');
const { createExerciseService } = require('./exercise.service');
const { DISCLAIMER } = require('./ai-prompts');
const { KINDS, normalize, preferencesOf, healthContextOf, validateResult } = require('./ai-plan.validation');
const { rulePlan } = require('./ai-plan.rules');
const { generatePlan } = require('./ai-plan.provider');

const FREE_DAILY_PLANS = 3;
const PREMIUM_DAILY_PLANS = 20;
const DAY_MS = 86400000;
const PUBLIC_PLAN = { _id: 0, generation_id: 0, generation_expires_at: 0, logged_meals: 0 };
const fail = (status, message) => new HttpError(status, message);

function snapshot(stored) {
  const user = withCurrentAge(stored);
  const calories = user.date_of_birth === undefined ? user.target_calories : calculateTargets(user).target_calories;
  return { gender: user.gender, age: user.age, height: user.height, weight: user.weight, activity_level: user.activity_level,
    goal: user.goal, target_calories: calories, target_water: user.target_water,
    bmi: Math.round(user.weight / ((user.height / 100) ** 2) * 100) / 100 };
}

function ensureSafe(kind, input, preferences, health) {
  // The existing profile has no medical history. Accept explicit declarations without sending them to AI.
  const note = normalize(preferences.note);
  if (input.age < 16 || health.pregnant || health.has_medical_condition
    || /mang thai|co thai|thai ky|benh nen|tieu duong|benh tim|suy than|pregnan|diabet/.test(note)
    || (input.weight / ((input.height / 100) ** 2) < 17 && input.goal === 'lose')) {
    throw fail(422, `Trường hợp này cần gặp bác sĩ hoặc chuyên gia dinh dưỡng trước khi lập kế hoạch. ${DISCLAIMER}.`);
  }
  if (input.target_calories > 10000) throw fail(422, 'Mục tiêu kcal cần được chuyên gia kiểm tra trước khi lập kế hoạch.');
  if (kind === 'meal_day' && preferences.meals_per_day * 2000 < input.target_calories) {
    throw fail(422, 'Mục tiêu kcal vượt giới hạn an toàn của số bữa đã chọn. Hãy gặp chuyên gia dinh dưỡng.');
  }
}

function createAiPlanService({ db, aiPlans = {} }) {
  const meals = createMealService({ db });
  const exerciseService = createExerciseService({ db });

  async function recover(planId, userId) {
    // A process can stop after reserving a quota slot. Its validated rules result is already durable.
    await db.collection('ai_plans').updateOne({ plan_id: planId, user_id: userId, status: 'generating',
      generation_expires_at: { $lte: new Date() } }, {
      $set: { status: 'ready', updated_at: new Date() }, $unset: { generation_id: '', generation_expires_at: '' },
    });
  }

  async function own(user, planId, { session, internal = false } = {}) {
    if (!isUuid(planId)) throw fail(400, 'planId không hợp lệ.');
    if (!session) await recover(planId, user.user_id);
    const plan = await db.collection('ai_plans').findOne({ plan_id: planId, user_id: user.user_id },
      { session, projection: internal ? { _id: 0 } : PUBLIC_PLAN });
    if (!plan) throw fail(404, 'Không tìm thấy kế hoạch.');
    return plan;
  }

  async function create(member, body) {
    if (!isPlainBody(body, ['plan_id', 'kind', 'preferences', 'health_context']) || !isUuid(body.plan_id) || !KINDS.includes(body.kind)) {
      throw fail(400, 'Cần plan_id UUID và kind là meal_day, nutrition hoặc workout_week.');
    }
    const preferences = preferencesOf(body.preferences);
    const health = healthContextOf(body.health_context);
    await recover(body.plan_id, member.user_id);
    const reservation = await transaction(db, async session => {
      const now = new Date();
      const user = await lockMember(db, member.user_id, session, now);
      const existing = await db.collection('ai_plans').findOne({ plan_id: body.plan_id }, { session });
      if (existing) {
        if (existing.user_id !== user.user_id) throw fail(404, 'Không tìm thấy kế hoạch.');
        if (existing.kind !== body.kind || !isDeepStrictEqual(existing.preferences, preferences)
          || !isDeepStrictEqual(existing.input.health_context, health)) throw fail(409, 'plan_id đã được dùng cho yêu cầu khác.');
        return { replayed: true };
      }
      const input = snapshot(user);
      ensureSafe(body.kind, input, preferences, health);
      const premium = (await membershipOf(db, user.user_id, session)).premium;
      const limit = premium ? PREMIUM_DAILY_PLANS : FREE_DAILY_PLANS;
      const recent = await db.collection('ai_plans').countDocuments({ user_id: user.user_id,
        created_at: { $gt: new Date(now.getTime() - DAY_MS) } }, { session });
      if (recent >= limit) throw fail(402, premium ? `Premium được tạo ${limit} kế hoạch mỗi 24 giờ. Hãy thử lại sau.`
        : `Gói miễn phí được tạo ${limit} kế hoạch mỗi 24 giờ. Nâng cấp Premium để có 20 lượt.`);
      const filter = { is_active: true };
      if (preferences.place === 'home') {
        const aliases = ['bodyweight', 'body weight'];
        filter.equipments = { $in: aliases, $not: { $elemMatch: { $nin: aliases } } };
      }
      const exercises = body.kind !== 'workout_week' ? [] : await db.collection('exercises').find(filter,
        { session, projection: { _id: 0, exercise_id: 1, name: 1, name_vi: 1, body_parts: 1 } })
        .sort({ exercise_id: 1 }).limit(40).toArray();
      const context = { input, preferences, exercises };
      const fallback = validateResult(body.kind, rulePlan(body.kind, context), context);
      const generationId = randomUUID();
      await db.collection('ai_plans').insertOne({ plan_id: body.plan_id, user_id: user.user_id, kind: body.kind,
        preferences, input: { ...input, health_context: health }, result: fallback, source: 'fitlife-rules',
        disclaimer: DISCLAIMER, status: 'generating', generation_id: generationId,
        generation_expires_at: new Date(now.getTime() + 60000), logged_meals: [], created_at: now, updated_at: now }, { session });
      return { replayed: false, generationId, context, fallback };
    });
    if (!reservation.replayed) {
      const generated = await generatePlan(aiPlans, body.kind, reservation.context, reservation.fallback);
      await db.collection('ai_plans').updateOne({ plan_id: body.plan_id, user_id: member.user_id, status: 'generating',
        generation_id: reservation.generationId }, { $set: { ...generated, status: 'ready', updated_at: new Date() },
        $unset: { generation_id: '', generation_expires_at: '' } });
    }
    const plan = await own(member, body.plan_id);
    return { success: true, replayed: reservation.replayed, pending: plan.status === 'generating', plan };
  }

  async function list(user, query) {
    if (!isPlainBody(query, ['kind', 'page']) || (query.kind !== undefined && !KINDS.includes(query.kind))) throw fail(400, 'kind không hợp lệ.');
    if (query.page !== undefined && (typeof query.page !== 'string' || !/^[1-9]\d*$/.test(query.page))) throw fail(400, 'page phải là số nguyên dương.');
    const page = readPage(query.page);
    const filter = { user_id: user.user_id, ...(query.kind ? { kind: query.kind } : {}) };
    await db.collection('ai_plans').updateMany({ user_id: user.user_id, status: 'generating', generation_expires_at: { $lte: new Date() } }, {
      $set: { status: 'ready', updated_at: new Date() }, $unset: { generation_id: '', generation_expires_at: '' },
    });
    const [plans, total] = await Promise.all([
      db.collection('ai_plans').find(filter, { projection: PUBLIC_PLAN }).sort({ created_at: -1, plan_id: -1 })
        .skip((page - 1) * 20).limit(20).toArray(), db.collection('ai_plans').countDocuments(filter),
    ]);
    return { success: true, plans, page, page_size: 20, total };
  }

  async function logMeal(member, planId, index, body) {
    if (!/^[0-3]$/.test(index) || !isPlainBody(body, ['meal_id']) || !isUuid(body.meal_id)) throw fail(400, 'Cần index từ 0–3 và meal_id UUID.');
    return transaction(db, async session => {
      const user = await lockMember(db, member.user_id, session, new Date());
      const plan = await own(user, planId, { session, internal: true });
      if (plan.status !== 'ready') throw fail(409, 'Kế hoạch đang được tạo, hãy thử lại sau.');
      const meal = plan.kind === 'meal_day' && plan.result.meals[Number(index)];
      if (!meal) throw fail(404, 'Không tìm thấy món ăn trong kế hoạch.');
      const mapping = plan.logged_meals.find(m => m.index === Number(index));
      const result = await meals.create(user, { meal_id: mapping?.meal_id || body.meal_id, meal_name: meal.name.slice(0, 150),
        calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, meal_type: meal.meal_type }, { session });
      if (!mapping) await db.collection('ai_plans').updateOne({ plan_id: planId, user_id: user.user_id }, {
        $push: { logged_meals: { index: Number(index), meal_id: result.log.meal_id } }, $set: { updated_at: new Date() },
      }, { session });
      return { success: true, ...result };
    });
  }

  async function startWorkout(user, planId, requestedDay, body = {}) {
    if (!/^[1-7]$/.test(requestedDay) || !isPlainBody(body, [])) throw fail(400, 'day phải từ 1–7, body để trống.');
    const plan = await own(user, planId);
    if (plan.status !== 'ready') throw fail(409, 'Kế hoạch đang được tạo, hãy thử lại sau.');
    const day = plan.kind === 'workout_week' && plan.result.days.find(d => d.day === Number(requestedDay));
    if (!day) throw fail(404, 'Không tìm thấy ngày tập.');
    if (day.rest) throw fail(409, 'Đây là ngày nghỉ.');
    const exercises = await Promise.all(day.exercises.map(async item => ({ ...item,
      exercise: (await exerciseService.get(item.exercise_id)).exercise })));
    return { success: true, plan_id: planId, day: { ...day, exercises }, disclaimer: DISCLAIMER };
  }

  return { create, list, get: async (user, id) => ({ success: true, plan: await own(user, id) }), logMeal, startWorkout };
}

module.exports = { createAiPlanService, FREE_DAILY_PLANS, PREMIUM_DAILY_PLANS };
