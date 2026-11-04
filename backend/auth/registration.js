'use strict';

const { collections } = require('../database/mongodb/schema');
const { localDay, ageFromBirthDate } = require('../utils/birth-date');

const emailPattern = new RegExp(collections.find((entry) => entry.name === 'users')
  .validator.$jsonSchema.properties.email.pattern);
const fields = new Set([
  'email', 'password', 'full_name', 'gender', 'age', 'height', 'weight',
  'activity_level', 'goal', 'timezone', 'date_of_birth',
]);
const activityFactors = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
const goalAdjustments = { lose: -500, maintain: 0, gain: 400 };

function normalizeEmail(email) {
  if (typeof email !== 'string' || email.length > 254) return null;
  const cleanEmail = email.trim().toLowerCase();
  return cleanEmail.length <= 100 && emailPattern.test(cleanEmail) ? cleanEmail : null;
}

function validateRegistration(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((key) => !fields.has(key))) return null;
  const { email, password } = body;
  if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string'
    || Buffer.byteLength(password, 'utf8') > 1024 || [...password].length < 8 || !password.trim()) return null;
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return null;
  const profile = validateProfile(body, now);
  return profile ? { email: cleanEmail, password, ...profile } : null;
}

function validateProfile(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { full_name: name, gender, height, weight, activity_level, goal } = body;
  let age = body.age;
  const timezone = body.timezone === undefined ? 'Asia/Ho_Chi_Minh' : body.timezone;
  if (typeof name !== 'string'
    || name.trim().length < 1 || name.trim().length > 100
    || !['male', 'female'].includes(gender)
    || typeof height !== 'number' || !Number.isFinite(height) || height < 80 || height > 250
    || typeof weight !== 'number' || !Number.isFinite(weight) || weight < 25 || weight > 300
    || typeof activity_level !== 'string' || !Object.hasOwn(activityFactors, activity_level)
    || typeof goal !== 'string' || !Object.hasOwn(goalAdjustments, goal)
    || typeof timezone !== 'string' || timezone.length > 100
    || !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(timezone)) return null;
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { return null; }
  if (body.date_of_birth !== undefined) {
    const derivedAge = ageFromBirthDate(body.date_of_birth, timezone, now);
    if (derivedAge === null || (age !== undefined && age !== derivedAge)) return null;
    age = derivedAge;
  }
  if (!Number.isInteger(age) || age < 5 || age > 100) return null;
  return {
    full_name: name.trim(), gender, age, height, weight,
    activity_level, goal, timezone,
    ...(body.date_of_birth === undefined ? {} : { date_of_birth: body.date_of_birth }),
  };
}

module.exports = { validateRegistration, validateProfile, normalizeEmail, localDay };
