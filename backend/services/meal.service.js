'use strict';

const { localDay } = require('../auth/registration');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { createQuestService } = require('./quest.service');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const INT32_MAX = 2147483647;
const fields = ['meal_id', 'meal_name', 'calories', 'protein', 'carbs', 'fat', 'meal_type'];
const editableFields = fields.filter(key => key !== 'meal_id');
const mealTypes = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const fail = (status, message) => new HttpError(status, message);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && [...value.trim()].length <= max;
const decimal = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= INT32_MAX;
const integer = value => Number.isInteger(value) && value >= 1 && value <= INT32_MAX;
const validDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
  && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

function validateMeal(body, { requireId = true } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(key => !(requireId ? fields : editableFields).includes(key))
    || (requireId && (typeof body.meal_id !== 'string' || !UUID.test(body.meal_id)))
    || !text(body.meal_name, 150) || !integer(body.calories)
    || !decimal(body.protein) || !decimal(body.carbs) || !decimal(body.fat)
    || typeof body.meal_type !== 'string' || !mealTypes.has(body.meal_type)) {
    throw fail(400, 'Bữa ăn cần meal_id UUID, meal_name, calories nguyên dương, protein/carbs/fat không âm và meal_type hợp lệ.');
  }
  return { ...(requireId ? { meal_id: body.meal_id } : {}), meal_name: body.meal_name.trim(),
    calories: body.calories, protein: body.protein, carbs: body.carbs, fat: body.fat, meal_type: body.meal_type };
}

function createMealService({ db }) {
  const quests = createQuestService({ db });
  async function list(user, requestedDate) {
    const date = requestedDate === undefined ? localDay(new Date(), user.timezone) : requestedDate;
    if (!validDate(date)) throw fail(400, 'Ngày không hợp lệ. Dùng định dạng YYYY-MM-DD.');
    const logs = await db.collection('meal_logs').find({ user_id: user.user_id, meal_date: date }, { projection: { _id: 0 } })
      .sort({ created_at: -1, meal_id: 1 }).toArray();
    return { success: true, date, logs,
      total_calories: logs.reduce((sum, row) => sum + row.calories, 0),
      total_protein: logs.reduce((sum, row) => sum + row.protein, 0),
      total_carbs: logs.reduce((sum, row) => sum + row.carbs, 0),
      total_fat: logs.reduce((sum, row) => sum + row.fat, 0) };
  }

  async function create(userInput, body) {
    const input = validateMeal(body);
    return transaction(db, async session => {
      const now = new Date();
      const user = await db.collection('users').findOneAndUpdate({ user_id: userInput.user_id, is_active: true, role: 'user' },
        { $set: { updated_at: now } }, { session, returnDocument: 'after' });
      if (!user) throw fail(403, 'Tài khoản không còn khả dụng.');
      const existing = await db.collection('meal_logs').findOne({ meal_id: input.meal_id }, { session, projection: { _id: 0 } });
      if (existing) {
        if (existing.user_id !== user.user_id || fields.some(key => existing[key] !== input[key])) throw fail(409, 'meal_id đã được sử dụng cho yêu cầu khác.');
        return { log: existing, replayed: true, reward_coins: 0, fit_coins: user.fit_coins };
      }
      const log = { ...input, user_id: user.user_id, meal_date: localDay(now, user.timezone), created_at: now, updated_at: now };
      await db.collection('meal_logs').insertOne(log, { session });
      const reward = await quests.rewardMeal(user, log.meal_date, now, session);
      delete log._id;
      return { log, replayed: false, reward_coins: reward, fit_coins: user.fit_coins + reward };
    });
  }

  async function update(userInput, mealId, body) {
    if (typeof mealId !== 'string' || !UUID.test(mealId)) throw fail(400, 'mealId không hợp lệ.');
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length
      || Object.keys(body).some(key => !editableFields.includes(key))) {
      throw fail(400, 'Chỉ gửi các trường bữa ăn cần cập nhật; không gửi ID, ngày, chủ tài khoản hoặc số xu.');
    }
    return transaction(db, async session => {
      const now = new Date();
      const user = await db.collection('users').findOneAndUpdate({ user_id: userInput.user_id, is_active: true, role: 'user' },
        { $set: { updated_at: now } }, { session, returnDocument: 'after' });
      if (!user) throw fail(403, 'Tài khoản không còn khả dụng.');
      const current = await db.collection('meal_logs').findOne({ meal_id: mealId, user_id: user.user_id }, { session, projection: { _id: 0 } });
      if (!current) throw fail(404, 'Không tìm thấy bữa ăn.');
      const input = validateMeal({ ...Object.fromEntries(editableFields.map(key => [key, current[key]])), ...body }, { requireId: false });
      const update = { ...input, updated_at: now };
      await db.collection('meal_logs').updateOne({ meal_id: mealId, user_id: user.user_id }, { $set: update }, { session });
      return { ...current, ...update, meal_id: mealId, user_id: user.user_id };
    });
  }

  async function remove(userInput, mealId) {
    if (typeof mealId !== 'string' || !UUID.test(mealId)) throw fail(400, 'mealId không hợp lệ.');
    return transaction(db, async session => {
      const now = new Date();
      // Match create's user lock so concurrent deletes cannot each observe a
      // different remaining meal and leave an empty day with its reward intact.
      const user = await db.collection('users').findOneAndUpdate({ user_id: userInput.user_id, is_active: true, role: 'user' },
        { $set: { updated_at: now } }, { session, returnDocument: 'after' });
      if (!user) throw fail(403, 'Tài khoản không còn khả dụng.');
      const current = await db.collection('meal_logs').findOne({ meal_id: mealId, user_id: user.user_id }, { session, projection: { _id: 0 } });
      if (!current) throw fail(404, 'Không tìm thấy bữa ăn.');
      await db.collection('meal_logs').deleteOne({ meal_id: mealId, user_id: user.user_id }, { session });
      const remaining = await db.collection('meal_logs').countDocuments({ user_id: user.user_id, meal_date: current.meal_date }, { session });
      let refund = 0;
      if (!remaining) refund = await quests.unrewardMeal(user, current.meal_date, now, session);
      return { deleted: true, meal_id: mealId, refund_coins: refund, fit_coins: user.fit_coins - refund };
    });
  }

  return { list, create, update, remove };
}

module.exports = { createMealService, validateMeal };
