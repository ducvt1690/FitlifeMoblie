'use strict';

// Generate a Desktop/CLI compatible collection. Secrets exist only in the run's
// local variables, never in the saved collection or shared environment.
const fs = require('node:fs');
const path = require('node:path');
const collection = {
  info: { name: 'FitLife — ALL API (Run all)',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description: 'Run ALL requests in order. No token/environment required. Each run creates one isolated test user, captures fresh tokens locally, tests every implemented route, then logs out both sessions. Expected 400/401/409 are negative tests. Each run retains its test account/logs for inspection. Registration is limited to 20 requests/IP/15 minutes: this collection uses three registration requests per run. On 429 the run stops with Retry-After instead of cascading authentication failures.' },
  variable: [{ key: 'baseUrl', value: 'http://localhost:5000', type: 'string' }],
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{fitlifeRunToken}}', type: 'string' }] },
  event: [{ listen: 'test', script: { type: 'text/javascript', exec: [
    "if (pm.response.code === 429) { pm.test('Rate limited: wait Retry-After=' + pm.response.headers.get('Retry-After') + ' seconds before rerunning', () => pm.response.to.have.status(200)); pm.execution.setNextRequest(null); }",
  ] } }], item: [],
};
function add(name, method, endpoint, { body, tests = [], pre = [], status = 200, noauth = false } = {}) {
  const item = { name, request: { method, header: [], url: '{{baseUrl}}' + endpoint }, event: [] };
  if (noauth) item.request.auth = { type: 'noauth' };
  if (body !== undefined) {
    item.request.header.push({ key: 'Content-Type', value: 'application/json' });
    item.request.body = { mode: 'raw', raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } };
  }
  if (pre.length) item.event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: pre } });
  item.event.push({ listen: 'test', script: { type: 'text/javascript', exec: [
    `pm.test(${JSON.stringify(name + ' — HTTP ' + status)}, () => pm.response.to.have.status(${status}));`, ...tests,
  ] } });
  collection.item.push(item);
}
const check = (name, code) => `pm.test(${JSON.stringify(name)}, () => { ${code} });`;
const meal = { meal_id: '{{fitlifeMealId}}', meal_name: 'Phở bò', calories: 450, protein: 25, carbs: 55, fat: 14, meal_type: 'breakfast' };
add('01 — API index', 'GET', '/', { noauth: true, pre: [
  "pm.variables.set('baseUrl', (pm.environment.get('baseUrl') || 'http://localhost:5000').replace(/\\/$/, ''));",
  "['fitlifeRunToken','fitlifeRegistrationToken','fitlifeUserId','fitlifeExerciseId','fitlifeCursor'].forEach(k => pm.variables.unset(k));",
  "const id = pm.variables.replaceIn('{{$guid}}');",
  "pm.variables.set('fitlifeEmail', 'postman-all-' + (pm.variables.get('fitlifeRunTag') || 'desktop') + '-' + id + '@fitlife.example');",
  "pm.variables.set('fitlifePassword', 'FitLife-' + pm.variables.replaceIn('{{$guid}}'));",
  "['Meal','Water','Workout'].forEach(k => pm.variables.set('fitlife' + k + 'Id', pm.variables.replaceIn('{{$guid}}').toLowerCase()));",
  "pm.variables.set('fitlifeRegistrationBody', JSON.stringify({email:pm.variables.get('fitlifeEmail'),password:pm.variables.get('fitlifePassword'),full_name:'Kiểm thử Postman',gender:'male',age:23,height:170,weight:65,activity_level:'moderate',goal:'maintain',timezone:'Asia/Ho_Chi_Minh'}));",
], tests: [check('Route catalog contains all business groups', "const e=pm.response.json().endpoints; ['auth','profile','water','workouts','exercises','meals','quests'].forEach(k=>pm.expect(e).to.have.property(k));")] });
add('02 — Database health', 'GET', '/health', { noauth: true, tests: [check('Database connected', "pm.expect(pm.response.json().database).to.eql('connected');")] });
add('03 — Invalid registration', 'POST', '/api/auth/register', { noauth: true, body: {}, status: 400 });
add('04 — Register isolated user', 'POST', '/api/auth/register', { noauth: true, body: '{{fitlifeRegistrationBody}}', status: 201, tests: [
  "if (pm.response.code !== 201) { pm.execution.setNextRequest(null); } else { const b=pm.response.json(); pm.variables.set('fitlifeRunToken',b.token); pm.variables.set('fitlifeRegistrationToken',b.token); pm.variables.set('fitlifeUserId',b.user.user_id); }",
  check('New account has user role, zero coins and valid token', "const b=pm.response.json(); pm.expect(b.user.role).to.eql('user'); pm.expect(b.user.profile.coins).to.eql(0); pm.expect(b.token).to.match(/^[A-Za-z0-9_-]{43}$/);"),
  check('Session expiry is positive and no longer than 12h', 'const remaining=Date.parse(pm.response.json().expires_at)-Date.now(); pm.expect(remaining).to.be.above(0); pm.expect(remaining).to.be.at.most(43200000);'),
] });
add('05 — Duplicate account', 'POST', '/api/auth/register', { noauth: true, body: '{{fitlifeRegistrationBody}}', status: 409 });
add('06 — Login fresh session', 'POST', '/api/auth/login', { noauth: true,
  body: { email: '{{fitlifeEmail}}', password: '{{fitlifePassword}}' }, tests: [
    "if (pm.response.code !== 200) { pm.execution.setNextRequest(null); } else pm.variables.set('fitlifeRunToken',pm.response.json().token);",
    check('Login retains the account ID', "pm.expect(pm.response.json().user.user_id).to.eql(pm.variables.get('fitlifeUserId'));") ] });
add('07 — Reject missing bearer', 'GET', '/api/auth/me', { noauth: true, status: 401 });
add('08 — Current session', 'GET', '/api/auth/me', { tests: [check('Session belongs to this run', "pm.expect(pm.response.json().user.user_id).to.eql(pm.variables.get('fitlifeUserId'));")] });
add('09 — Read profile', 'GET', '/api/profile', { tests: [check('Profile is private and birthday is initially unknown', "const p=pm.response.json().profile; pm.expect(p.user_id).to.eql(pm.variables.get('fitlifeUserId')); pm.expect(p.date_of_birth).to.eql(null); pm.expect(p).not.to.have.property('password_hash');")] });
add('10 — Patch name, birthday and email', 'PATCH', '/api/profile', {
  body: { full_name: 'Hồ sơ đã cập nhật', date_of_birth: '2000-05-15', email: '{{fitlifeEmail}}' }, tests: [check('Birthday and email persisted', "const p=pm.response.json().profile; pm.expect(p.full_name).to.eql('Hồ sơ đã cập nhật'); pm.expect(p.date_of_birth).to.eql('2000-05-15'); pm.expect(p.email).to.eql(pm.variables.get('fitlifeEmail')); pm.expect(p.age).to.be.within(5,100);")] });
add('11 — Invalid calendar date', 'PATCH', '/api/profile', { body: { date_of_birth: '2001-02-29' }, status: 400 });
add('12 — Reject profile privilege injection', 'PATCH', '/api/profile', { body: { role: 'admin', fit_coins: 9999 }, status: 400 });
add('13 — Water create', 'POST', '/api/water-logs', { body: { log_id: '{{fitlifeWaterId}}', amount: 250 }, status: 201,
  tests: [check('Water grants exactly 10 coins', 'const b=pm.response.json(); pm.expect(b.reward_coins).to.eql(10); pm.expect(b.fit_coins).to.eql(10);')] });
add('14 — Water retry', 'POST', '/api/water-logs', { body: { log_id: '{{fitlifeWaterId}}', amount: 250 },
  tests: [check('No duplicate water reward', 'const b=pm.response.json(); pm.expect(b.replayed).to.eql(true); pm.expect(b.reward_coins).to.eql(0);')] });
add('15 — Water read', 'GET', '/api/water-logs', { tests: [check('Water total is 250ml', 'const b=pm.response.json(); pm.expect(b.logs).to.have.lengthOf(1); pm.expect(b.total).to.eql(250);')] });
const workout = { workout_id: '{{fitlifeWorkoutId}}', title: 'Hít đất', category: 'Toàn thân', duration_seconds: 600, calories_burned: 50 };
add('16 — Workout create', 'POST', '/api/workout-logs', { body: workout, status: 201, tests: [check('Workout reward and daily water bonus', 'const b=pm.response.json(); pm.expect(b.reward_coins).to.eql(10); pm.expect(b.fit_coins).to.eql(20); pm.expect(b.target_water).to.eql(2625);')] });
add('17 — Workout retry', 'POST', '/api/workout-logs', { body: workout, tests: [check('Workout is not duplicated', 'const b=pm.response.json(); pm.expect(b.replayed).to.eql(true); pm.expect(b.reward_coins).to.eql(0);')] });
add('18 — Workout read', 'GET', '/api/workout-logs', { tests: [check('Workout totals match', 'const b=pm.response.json(); pm.expect(b.logs).to.have.lengthOf(1); pm.expect(b.total_duration_seconds).to.eql(600); pm.expect(b.total_calories_burned).to.eql(50);')] });
add('19 — Invalid workout date', 'GET', '/api/workout-logs?date=2026-02-30', { status: 400 });
add('20 — Meal create', 'POST', '/api/meal-logs', { body: meal, status: 201, tests: [check('Meal reward increases total to 30', 'const b=pm.response.json(); pm.expect(b.reward_coins).to.eql(10); pm.expect(b.fit_coins).to.eql(30);')] });
add('21 — Meal retry', 'POST', '/api/meal-logs', { body: meal, tests: [check('Meal retry awards zero coins', 'pm.expect(pm.response.json().reward_coins).to.eql(0); pm.expect(pm.response.json().replayed).to.eql(true);')] });
add('22 — Meal read', 'GET', '/api/meal-logs', { tests: [check('Nutrition totals reflect the isolated meal', 'const b=pm.response.json(); pm.expect(b.logs).to.have.lengthOf(1); pm.expect(b.total_calories).to.eql(450); pm.expect(b.total_protein).to.eql(25);')] });
add('23 — Partial meal patch', 'PATCH', '/api/meal-logs/{{fitlifeMealId}}', { body: { calories: 600 }, tests: [check('Partial PATCH preserves omitted fields', "const b=pm.response.json(); pm.expect(b.meal.calories).to.eql(600); pm.expect(b.meal.meal_name).to.eql('Phở bò');")] });
add('24 — Confirm meal quest', 'GET', '/api/quests', { tests: [check('Only water, workout and meal quests are complete', "const qs=pm.response.json().quests; pm.expect(qs).to.have.lengthOf(7); pm.expect(qs.filter(q=>q.is_completed).map(q=>q.quest_key).sort()).to.eql(['q_meal','q_water','q_workout']);")] });
add('25 — Meal delete', 'DELETE', '/api/meal-logs/{{fitlifeMealId}}', { status: 204 });
add('26 — Meal absence', 'GET', '/api/meal-logs', { tests: [check('Deleted meal no longer contributes calories', 'const b=pm.response.json(); pm.expect(b.logs).to.have.lengthOf(0); pm.expect(b.total_calories).to.eql(0);')] });
add('27 — Verify refund balance', 'GET', '/api/profile', { tests: [check('Only meal reward was withdrawn', 'const p=pm.response.json().profile; pm.expect(p.fit_coins).to.eql(20); pm.expect(p.target_water).to.eql(2625);')] });
add('28 — Verify quest reset', 'GET', '/api/quests', { tests: [check('Meal quest reset after last meal deletion', "pm.expect(pm.response.json().quests.find(q=>q.quest_key==='q_meal').is_completed).to.eql(false);")] });
add('29 — Exercise list first page', 'GET', '/api/exercises?limit=2', { tests: [
  check('Exercise catalog is populated and localized', "const b=pm.response.json(); pm.expect(b.data).to.have.lengthOf(2); pm.expect(b.data[0].display_name).to.be.a('string').and.not.empty; pm.expect(b.data[0].gif_url.startsWith('https://')).to.eql(true); pm.expect(b.meta.hasNextPage).to.eql(true);"),
  "if(pm.response.code===200 && pm.response.json().data.length) { const b=pm.response.json(); pm.variables.set('fitlifeExerciseId',b.data[0].exercise_id); pm.variables.set('fitlifeCursor',b.meta.nextAfter); pm.variables.set('fitlifeFirstIds',JSON.stringify(b.data.map(x=>x.exercise_id))); }",
] });
add('30 — Exercise next page', 'GET', '/api/exercises?limit=2&after={{fitlifeCursor}}', { tests: [check('Cursor does not repeat exercises', "const previous=JSON.parse(pm.variables.get('fitlifeFirstIds')); pm.response.json().data.forEach(x=>pm.expect(previous).not.to.include(x.exercise_id));")] });
add('31 — Exercise detail by internal UUID', 'GET', '/api/exercises/{{fitlifeExerciseId}}', { tests: [check('Exercise detail matches selected ID', "pm.expect(pm.response.json().exercise.exercise_id).to.eql(pm.variables.get('fitlifeExerciseId'));")] });
add('32 — Invalid exercise identifier', 'GET', '/api/exercises/not-a-uuid', { status: 400 });
add('33 — Logout registration session', 'POST', '/api/auth/logout', { status: 204,
  pre: ["pm.variables.set('fitlifeLoginToken',pm.variables.get('fitlifeRunToken')); pm.variables.set('fitlifeRunToken',pm.variables.get('fitlifeRegistrationToken'));"] });
add('34 — Revoked registration token', 'GET', '/api/auth/me', { status: 401 });
add('35 — Login session remains active', 'GET', '/api/auth/me', { pre: ["pm.variables.set('fitlifeRunToken',pm.variables.get('fitlifeLoginToken'));"] });
add('36 — Logout remaining session', 'POST', '/api/auth/logout', { status: 204 });
add('37 — Session revoked immediately', 'GET', '/api/auth/me', { status: 401 });
fs.writeFileSync(path.resolve(__dirname, '../api/all-api.postman_collection.json'), JSON.stringify(collection, null, 2) + '\n');
console.log(`Generated ${collection.item.length} requests for every implemented API method.`);
