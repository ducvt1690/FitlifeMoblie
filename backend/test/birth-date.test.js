'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ageFromBirthDate } = require('../utils/birth-date');
const { validateProfile, validateRegistration } = require('../auth/registration');

test('age advances at the birthday in each account timezone', () => {
  const now = new Date('2026-10-28T18:00:00Z');
  assert.equal(ageFromBirthDate('2000-10-29', 'Asia/Ho_Chi_Minh', now), 26);
  assert.equal(ageFromBirthDate('2000-10-29', 'UTC', now), 25);
});

test('leap-day birthdays advance on March 1 in a non-leap year', () => {
  assert.equal(ageFromBirthDate('2000-02-29', 'UTC', new Date('2025-02-28T12:00:00Z')), 24);
  assert.equal(ageFromBirthDate('2000-02-29', 'UTC', new Date('2025-03-01T00:00:00Z')), 25);
  assert.equal(ageFromBirthDate('2000-02-29', 'UTC', new Date('2024-02-29T00:00:00Z')), 24);
});

test('invalid calendar dates and future dates are rejected without date normalization', () => {
  const now = new Date('2026-10-29T00:00:00Z');
  for (const value of ['2001-02-29', '2000-04-31', '2026-10-30', '2000-1-01', null, '']) {
    assert.equal(ageFromBirthDate(value, 'UTC', now), null);
  }
});

test('validation reads the clock anew and accepts a fifth birthday only when it arrives', () => {
  const input = { full_name: 'Test', gender: 'male', height: 170, weight: 65,
    activity_level: 'moderate', goal: 'maintain', timezone: 'Asia/Ho_Chi_Minh', date_of_birth: '2021-10-29' };
  const before = new Date('2026-10-28T16:59:59.999Z');
  const birthday = new Date('2026-10-28T17:00:00.000Z');
  assert.equal(validateProfile(input, before), null);
  assert.equal(validateProfile(input, birthday).age, 5);
  const registration = { ...input, email: 'birthday@fitlife.example', password: 'test-password' };
  assert.equal(validateRegistration(registration, before), null);
  assert.equal(validateRegistration(registration, birthday).age, 5);
});

test('validation keeps age 100 inclusive and rejects a birth date once age reaches 101', () => {
  const input = { full_name: 'Test', gender: 'male', height: 170, weight: 65,
    activity_level: 'moderate', goal: 'maintain', timezone: 'Asia/Ho_Chi_Minh', date_of_birth: '1925-10-29' };
  assert.equal(validateProfile(input, new Date('2026-10-28T16:59:59.999Z')).age, 100);
  assert.equal(validateProfile(input, new Date('2026-10-28T17:00:00.000Z')), null);
});
