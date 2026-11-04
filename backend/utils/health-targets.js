'use strict';

const { withCurrentAge } = require('./birth-date');

function calculateTargets(profile, now = new Date()) {
  const p = withCurrentAge(profile, now);
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.gender === 'male' ? 5 : -161);
  return { target_water: Math.round(Math.min(p.weight * 35, 4000)),
    target_calories: Math.max(p.gender === 'male' ? 1500 : 1200, Math.round(bmr *
      ({ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 })[p.activity_level] +
      ({ lose: -500, maintain: 0, gain: 400 })[p.goal])) };
}

module.exports = { calculateTargets };
