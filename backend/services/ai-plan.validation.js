'use strict';

const { HttpError } = require('../utils/http-error');
const { isPlainBody, isText } = require('../utils/validate');
const { SCHEMAS } = require('./ai-prompts');
const KINDS = Object.keys(SCHEMAS);
const normalize = text => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');

function preferencesOf(value = {}) {
  const fields = ['diet', 'allergies', 'dislikes', 'meals_per_day', 'budget_vnd_per_day', 'place',
    'minutes_per_session', 'days_per_week', 'note'];
  const fail = () => { throw new HttpError(400, 'preferences không hợp lệ. Xem giới hạn trường trong API AI plans.'); };
  if (!isPlainBody(value, fields)) fail();
  for (const [key, choices] of Object.entries({ diet: ['none', 'vegetarian', 'vegan'], place: ['home', 'gym'], meals_per_day: [3, 4] })) {
    if (value[key] !== undefined && !choices.includes(value[key])) fail();
  }
  for (const key of ['allergies', 'dislikes']) {
    if (value[key] !== undefined && (!Array.isArray(value[key]) || value[key].length > 10 || !value[key].every(s => isText(s, 40)))) fail();
  }
  for (const [key, [min, max]] of Object.entries({ budget_vnd_per_day: [30000, 500000], minutes_per_session: [15, 90], days_per_week: [2, 6] })) {
    if (value[key] !== undefined && (!Number.isInteger(value[key]) || value[key] < min || value[key] > max)) fail();
  }
  if (value.note !== undefined && !isText(value.note, 300, 0)) fail();
  return { diet: value.diet ?? 'none', allergies: (value.allergies ?? []).map(s => s.trim()),
    dislikes: (value.dislikes ?? []).map(s => s.trim()), meals_per_day: value.meals_per_day ?? 4,
    ...(value.budget_vnd_per_day === undefined ? {} : { budget_vnd_per_day: value.budget_vnd_per_day }),
    place: value.place ?? 'home', minutes_per_session: value.minutes_per_session ?? 30,
    days_per_week: value.days_per_week ?? 3, note: value.note?.trim() ?? '' };
}

function healthContextOf(value = {}) {
  if (!isPlainBody(value, ['pregnant', 'has_medical_condition']) || Object.values(value).some(v => typeof v !== 'boolean')) {
    throw new HttpError(400, 'health_context chỉ nhận pregnant và has_medical_condition kiểu boolean.');
  }
  return { pregnant: value.pregnant ?? false, has_medical_condition: value.has_medical_condition ?? false };
}

// Validate against the very same schema sent to both providers, then check business constraints.
function matchesSchema(value, schema) {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (!types.includes(type) && !(type === 'number' && types.includes('integer') && Number.isInteger(value))) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (type === 'number' && (!Number.isFinite(value) || value < schema.minimum || value > schema.maximum)) return false;
  if (type === 'string' && (!value.trim() || [...value].length < schema.minLength || [...value].length > schema.maxLength)) return false;
  if (type === 'array' && (value.length < schema.minItems || value.length > schema.maxItems || !value.every(v => matchesSchema(v, schema.items)))) return false;
  if (type === 'object' && (schema.required.some(k => !Object.hasOwn(value, k))
    || Object.keys(value).some(k => !Object.hasOwn(schema.properties, k) || !matchesSchema(value[k], schema.properties[k])))) return false;
  return true;
}

function excludedFood(name, preferences) {
  const text = normalize(name);
  if ([...preferences.allergies, ...preferences.dislikes].some(word => text.includes(normalize(word)))) return true;
  // Enforce common dietary notes in the fallback and validator as well as in the prompt.
  // These can only add restrictions; they cannot relax structured allergies or diet.
  const note = normalize(preferences.note).replace(/\bkhong (?:muon )?an chay\b/g, '');
  let diet = preferences.diet;
  if (/\b(thuan chay|vegan)\b/.test(note)) diet = 'vegan';
  else if (diet === 'none' && /\b(an chay|vegetarian)\b/.test(note)) diet = 'vegetarian';
  const exclusions = [...note.matchAll(/\b(?:khong an|khong dung|tranh|kieng|di ung(?: voi)?)\s+(hai san|tom|cua|muc|ca|thit|trung|sua|dau nanh|dau phong)\b/g)].map(match => match[1]);
  if (exclusions.some(word => word === 'hai san'
    ? /\b(tom|cua|muc|ca|tep|hen|oc|ngheu|so|hai san|nuoc mam|fish|shrimp|seafood)\b/.test(text)
    : text.includes(word))) return true;
  // Eggs are vegetarian; avocado/cabbage/tomato must not be mistaken for beef/fish.
  const withoutPlantsOrEggs = text.replace(/\b(trung (ga|vit)|qua bo|trai bo|bo sap|bo xanh|bap cai|cai bo xoi|ca chua|ca rot|ca tim|ca phe|ca cao)\b/g, '');
  const meat = /\b(ga|bo|heo|lon|vit|ca|tom|cua|muc|hai san|thit|tep|hen|oc|ngheu|so|nuoc mam|fish|chicken|beef|pork|shrimp|seafood)\b/;
  return (diet !== 'none' && meat.test(withoutPlantsOrEggs))
    || (diet === 'vegan' && /\b(trung|sua|pho mai|bo sua|mat ong|egg|milk|cheese|honey|butter)\b/.test(text));
}

function validateResult(kind, raw, { input, preferences, exercises }) {
  const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!matchesSchema(result, SCHEMAS[kind])) throw new Error('Invalid plan schema');
  if (kind === 'meal_day') {
    const expected = ['breakfast', 'lunch', 'dinner', ...(preferences.meals_per_day === 4 ? ['snack'] : [])];
    const total = result.meals.reduce((sum, meal) => sum + meal.calories, 0);
    if (result.meals.length !== expected.length || new Set(result.meals.map(m => m.meal_type)).size !== expected.length
      || result.meals.some(m => !expected.includes(m.meal_type) || excludedFood(`${m.name} ${m.portion}`, preferences))
      || total !== result.total_calories || Math.abs(total - input.target_calories) > input.target_calories * 0.1) throw new Error('Invalid meal plan');
  }
  if (kind === 'nutrition') {
    const energy = result.protein_g * 4 + result.carbs_g * 4 + result.fat_g * 9;
    if (result.calories !== input.target_calories || result.water_ml !== Math.min(input.target_water, 4000)
      || Math.abs(energy - result.calories) > result.calories * 0.15) throw new Error('Invalid nutrition targets');
  }
  if (kind === 'workout_week') {
    const ids = new Set(exercises.map(e => e.exercise_id));
    const active = result.days.filter(d => !d.rest);
    if (new Set(result.days.map(d => d.day)).size !== 7 || active.length < 1 || active.length > preferences.days_per_week) throw new Error('Invalid workout days');
    for (const day of result.days) {
      if (day.rest ? day.minutes !== 0 || day.exercises.length !== 0 || day.calories_est !== 0
        : day.minutes < 1 || day.minutes > preferences.minutes_per_session || !day.exercises.length) throw new Error('Invalid workout duration');
      if (new Set(day.exercises.map(e => e.exercise_id)).size !== day.exercises.length) throw new Error('Duplicate exercise');
      for (const e of day.exercises) {
        if (!ids.has(e.exercise_id) || (e.reps === null) === (e.seconds === null)) throw new Error('Invalid exercise');
      }
    }
  }
  return result;
}

module.exports = { KINDS, normalize, preferencesOf, healthContextOf, excludedFood, matchesSchema, validateResult };
