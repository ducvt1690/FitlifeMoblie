'use strict';

function localDay(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = type => parts.find(entry => entry.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// A birthday is a calendar date, not a UTC timestamp. Compare month/day in the
// account's timezone, and treat a Feb 29 birthday as reached on March 1 in a
// non-leap year. Invalid dates/future birthdays return null rather than rolling.
function ageFromBirthDate(birthDate, timezone, now = new Date()) {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const parsed = new Date(birthDate + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthDate) return null;
  const today = localDay(now, timezone);
  if (birthDate > today) return null;
  return Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4))
    - (today.slice(5) < birthDate.slice(5) ? 1 : 0);
}

function withCurrentAge(profile, now = new Date()) {
  if (profile.date_of_birth === undefined) return profile;
  const age = ageFromBirthDate(profile.date_of_birth, profile.timezone, now);
  return age === null ? profile : { ...profile, age };
}

module.exports = { localDay, ageFromBirthDate, withCurrentAge };
