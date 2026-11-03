'use strict';

// Extend the existing smoke collection; keep the original collection unchanged.
const fs = require('node:fs');
const path = require('node:path');
const baseline = require('../api/all-api.postman_collection.json');
const collection = structuredClone(baseline);
collection.info.name = 'FitLife — Review full API + bug reproductions';
collection.info.description = 'Run with npm run test:postman:review. Disposable MongoDB only; the runner supplies trainer/admin/other-user fixtures. The REGRESSION requests assert desired behavior and intentionally expose unresolved bugs. No live AI or Atlas calls.';
const logout = collection.item.splice(32);
function add(name, method, endpoint, { body, status = 200, role, tests = [], pre = [] } = {}) {
  const request = { method, header: [], url: '{{baseUrl}}' + endpoint };
  if (role) request.auth = { type: 'bearer', bearer: [{ key: 'token', value: '{{review' + role + 'Token}}', type: 'string' }] };
  if (body !== undefined) {
    request.header.push({ key: 'Content-Type', value: 'application/json' });
    request.body = { mode: 'raw', raw: JSON.stringify(body), options: { raw: { language: 'json' } } };
  }
  const event = [];
  if (pre.length) event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: pre } });
  event.push({ listen: 'test', script: { type: 'text/javascript', exec: [
    `pm.test(${JSON.stringify(name + ' HTTP ' + status)}, () => pm.response.to.have.status(${status}));`, ...tests,
  ] } });
  collection.item.push({ name, request, event });
}
const check = (name, code) => `pm.test(${JSON.stringify(name)}, () => { ${code} });`;
const remember = (variable, expression) => `if (pm.response.code < 300) pm.variables.set('${variable}', ${expression});`;
for (const role of ['Trainer', 'Admin', 'Other']) {
  add(`Login ${role} fixture`, 'POST', '/api/auth/login', { body: { email: `{{review${role}Email}}`, password: '{{reviewPassword}}' }, tests: [
    remember(`review${role}Token`, 'pm.response.json().token'),
  ] });
}
for (const endpoint of ['/api/sleep-logs', '/api/mood-logs', '/api/bmi-records', '/api/challenges', '/api/rewards', '/api/stats', '/api/chat/sessions', '/api/coaching']) {
  add(`Missing auth ${endpoint}`, 'GET', endpoint, { status: 401, role: 'Missing' });
}
add('Member denied trainer', 'GET', '/api/trainer/overview', { status: 403 });
add('Member denied admin', 'GET', '/api/admin/overview', { status: 403 });
add('Trainer denied member', 'GET', '/api/quests', { status: 403, role: 'Trainer' });
add('Trainer denied admin', 'GET', '/api/admin/overview', { status: 403, role: 'Trainer' });
add('Admin denied trainer', 'GET', '/api/trainer/overview', { status: 403, role: 'Admin' });
add('Sleep initial', 'GET', '/api/sleep-logs');
add('Sleep save', 'PUT', '/api/sleep-logs', { body: { hours: 7.5, quality: 'Sâu' }, tests: [check('Sleep awards once', 'pm.expect(pm.response.json().reward_coins).to.eql(10);'), remember('reviewSleepId', 'pm.response.json().log.sleep_id')] });
add('Sleep update', 'PUT', '/api/sleep-logs', { body: { hours: 8, quality: 'Bình thường' }, tests: [check('Sleep upsert keeps ID without reward', "const b=pm.response.json(); pm.expect(b.reward_coins).to.eql(0); pm.expect(b.log.sleep_id).to.eql(pm.variables.get('reviewSleepId'));")] });
add('Sleep invalid', 'PUT', '/api/sleep-logs', { body: { hours: 25, quality: 'Sâu' }, status: 400 });
add('Mood initial', 'GET', '/api/mood-logs');
add('Mood save', 'PUT', '/api/mood-logs', { body: { mood_label: 'Vui', note: 'Review' }, tests: [check('Mood awards once', 'pm.expect(pm.response.json().reward_coins).to.eql(10);')] });
add('Mood invalid', 'PUT', '/api/mood-logs', { body: { mood_label: '' }, status: 400 });
add('BMI write', 'POST', '/api/bmi-records', { status: 201, tests: [remember('reviewBmiId', 'pm.response.json().record.record_id')] });
add('BMI history', 'GET', '/api/bmi-records', { tests: [check('BMI record persisted', "pm.expect(pm.response.json().records.map(r=>r.record_id)).to.include(pm.variables.get('reviewBmiId'));")] });
add('BMI invalid limit', 'GET', '/api/bmi-records?limit=366', { status: 400 });
add('Daily checkin', 'POST', '/api/quests/checkin', { tests: [check('Checkin awards 10', 'pm.expect(pm.response.json().reward_coins).to.eql(10);')] });
add('Daily checkin retry', 'POST', '/api/quests/checkin', { tests: [check('Checkin retry awards zero', 'pm.expect(pm.response.json().reward_coins).to.eql(0);')] });
add('Stats 7 days', 'GET', '/api/stats?days=7', { tests: [check('Stats aggregate actual logs', 'const b=pm.response.json(); pm.expect(b.days).to.have.lengthOf(7); pm.expect(b.days.at(-1).water_ml).to.eql(250); pm.expect(b.days.at(-1).sleep_hours).to.eql(8);')] });
add('Stats invalid range', 'GET', '/api/stats?days=40', { status: 400 });
add('Chat send', 'POST', '/api/chat/messages', { status: 201, body: { session_id: '{{reviewSessionId}}', message_id: '{{reviewMessageId}}', content: 'Hôm nay uống nước bao nhiêu?' }, pre: ["['Session','Message','Challenge','Reward','Purchase','Template','Assignment'].forEach(k=>pm.variables.set('review'+k+'Id',pm.variables.replaceIn('{{$guid}}')));"], tests: [check('Rules reply and q_chat reward', "const b=pm.response.json(); pm.expect(b.reply.ai_engine).to.eql('fitlife-rules'); pm.expect(b.reward_coins).to.eql(10);")] });
add('Chat sessions', 'GET', '/api/chat/sessions', { tests: [check('Rules mode disclosed', 'pm.expect(pm.response.json().ai_enabled).to.eql(false);')] });
add('Chat history', 'GET', '/api/chat/sessions/{{reviewSessionId}}/messages', { tests: [check('Chat contains both turns', 'pm.expect(pm.response.json().messages).to.have.lengthOf(2);')] });
add('Chat cross-user read denied', 'GET', '/api/chat/sessions/{{reviewSessionId}}/messages', { role: 'Other', status: 404 });
add('Chat cross-user write denied', 'POST', '/api/chat/messages', { role: 'Other', status: 404, body: { session_id: '{{reviewSessionId}}', message_id: '{{$guid}}', content: 'Not mine' } });
add('REGRESSION chat retry must recover reply', 'POST', '/api/chat/messages', { body: { session_id: '{{reviewSessionId}}', message_id: '{{reviewMessageId}}', content: 'Hôm nay uống nước bao nhiêu?' }, tests: [check('Retry returns the stored reply after a lost response', 'const b=pm.response.json(); pm.expect(b.replayed).to.eql(true); pm.expect(b.reply).to.be.an("object");')] });
add('Admin overview', 'GET', '/api/admin/overview', { role: 'Admin' });
add('Admin accounts', 'GET', '/api/admin/accounts?role=user&page=1', { role: 'Admin', tests: [check('Accounts hide passwords', 'pm.response.json().accounts.forEach(a=>pm.expect(a).not.to.have.property("password_hash"));')] });
add('Admin create challenge', 'POST', '/api/admin/challenges', { role: 'Admin', status: 201, body: { challenge_id: '{{reviewChallengeId}}', title: 'Review one day', description: 'Disposable fixture', target_days: 1, reward_coins: 30, badge_icon: 'flag', is_active: true } });
add('Admin update challenge', 'PATCH', '/api/admin/challenges/{{reviewChallengeId}}', { role: 'Admin', body: { title: 'Review updated', note: 'Review' } });
add('Admin list challenges', 'GET', '/api/admin/challenges', { role: 'Admin' });
add('Member list challenges', 'GET', '/api/challenges');
add('Join challenge', 'POST', '/api/challenges/{{reviewChallengeId}}/join', { status: 201 });
add('Duplicate challenge join', 'POST', '/api/challenges/{{reviewChallengeId}}/join', { status: 409 });
add('Complete challenge', 'POST', '/api/challenges/{{reviewChallengeId}}/checkin', { tests: [check('One-day completion awards 30', 'pm.expect(pm.response.json().reward_coins).to.eql(30);')] });
add('Rejoin completed challenge', 'POST', '/api/challenges/{{reviewChallengeId}}/join', { status: 201 });
add('REGRESSION no same-day repeat challenge reward', 'POST', '/api/challenges/{{reviewChallengeId}}/checkin', { status: 409 });
add('Admin create reward', 'POST', '/api/admin/rewards', { role: 'Admin', status: 201, body: { item_id: '{{reviewRewardId}}', title: 'Review badge', category: 'badge', cost_coins: 10, icon: 'star', is_available: true } });
add('Admin update reward', 'PATCH', '/api/admin/rewards/{{reviewRewardId}}', { role: 'Admin', body: { title: 'Review badge updated' } });
add('Admin list rewards', 'GET', '/api/admin/rewards', { role: 'Admin' });
add('Member list rewards', 'GET', '/api/rewards');
add('Purchase reward', 'POST', '/api/rewards/{{reviewRewardId}}/purchase', { status: 201, body: { purchase_id: '{{reviewPurchaseId}}' }, tests: [remember('reviewAfterPurchaseCoins', 'pm.response.json().fit_coins')] });
add('Purchase retry', 'POST', '/api/rewards/{{reviewRewardId}}/purchase', { body: { purchase_id: '{{reviewPurchaseId}}' }, tests: [check('Purchase retry does not debit twice', "const b=pm.response.json(); pm.expect(b.replayed).to.eql(true); pm.expect(b.fit_coins).to.eql(Number(pm.variables.get('reviewAfterPurchaseCoins')));")] });
add('Duplicate badge purchase denied', 'POST', '/api/rewards/{{reviewRewardId}}/purchase', { status: 409, body: { purchase_id: '{{$guid}}' } });
add('REGRESSION ownership beyond 100 purchases', 'GET', '/api/rewards', { role: 'Other', tests: [check('Old owned theme remains owned after 101 voucher purchases', "pm.expect(pm.response.json().items.find(i=>i.item_id===pm.variables.get('reviewOldThemeId')).owned).to.eql(true);")] });
add('Admin transactions', 'GET', '/api/admin/transactions?page=1', { role: 'Admin' });
add('Admin logs', 'GET', '/api/admin/logs?page=1', { role: 'Admin', tests: [check('Catalog edits are audited', 'pm.expect(pm.response.json().logs.length).to.be.above(0);')] });
add('Trainer overview', 'GET', '/api/trainer/overview', { role: 'Trainer' });
add('Trainer list links', 'GET', '/api/trainer/links', { role: 'Trainer' });
add('Trainer create invite', 'POST', '/api/trainer/links', { role: 'Trainer', status: 201, tests: [remember('reviewInvite', 'pm.response.json().link.invite_code'), remember('reviewLinkId', 'pm.response.json().link.link_id')] });
add('Trainer denied unrelated student', 'GET', '/api/trainer/students/{{fitlifeUserId}}', { role: 'Trainer', status: 403 });
add('Member accepts invite', 'POST', '/api/coaching/links', { status: 201, body: { code: '{{reviewInvite}}' } });
add('Member coaching overview', 'GET', '/api/coaching');
add('Trainer create template', 'POST', '/api/trainer/templates', { role: 'Trainer', status: 201, body: { template_id: '{{reviewTemplateId}}', title: 'Review plan', category: 'Strength', duration_seconds: 600, calories_est: 50, level: 'beginner', description: 'Review instructions' } });
add('Trainer update template', 'PATCH', '/api/trainer/templates/{{reviewTemplateId}}', { role: 'Trainer', body: { title: 'Updated review plan' } });
add('Trainer list templates', 'GET', '/api/trainer/templates', { role: 'Trainer' });
const assignment = { id: '{{reviewAssignmentId}}', user_id: '{{fitlifeUserId}}', template_id: '{{reviewTemplateId}}', note: 'Review' };
add('Trainer assigns plan', 'POST', '/api/trainer/assignments', { role: 'Trainer', status: 201, body: assignment });
add('Trainer list assignments', 'GET', '/api/trainer/assignments', { role: 'Trainer' });
add('Trainer reads linked student health', 'GET', '/api/trainer/students/{{fitlifeUserId}}?days=7', { role: 'Trainer', tests: [check('Open work grants health access', 'pm.expect(pm.response.json().health.days).to.have.lengthOf(7);')] });
add('Other member cannot complete assignment', 'POST', '/api/coaching/assignments/{{reviewAssignmentId}}/complete', { role: 'Other', status: 404 });
add('Member completes assignment', 'POST', '/api/coaching/assignments/{{reviewAssignmentId}}/complete', { tests: [check('Assignment completed', 'pm.expect(pm.response.json().assignment.status).to.eql("done");')] });
add('Trainer health access closes after completion', 'GET', '/api/trainer/students/{{fitlifeUserId}}', { role: 'Trainer', tests: [check('Health is hidden without open work', 'pm.expect(pm.response.json().health).to.eql(null);')] });
const freshAssignment = () => ["pm.variables.set('reviewAssignmentId',pm.variables.replaceIn('{{$guid}}'));" ];
add('Assign to decline', 'POST', '/api/trainer/assignments', { role: 'Trainer', status: 201, body: assignment, pre: freshAssignment() });
add('Member declines assignment', 'POST', '/api/coaching/assignments/{{reviewAssignmentId}}/decline');
add('Assign to cancel', 'POST', '/api/trainer/assignments', { role: 'Trainer', status: 201, body: assignment, pre: freshAssignment() });
add('Trainer cancels assignment', 'POST', '/api/trainer/assignments/{{reviewAssignmentId}}/cancel', { role: 'Trainer' });
add('Member ends trainer link', 'DELETE', '/api/coaching/links/{{reviewLinkId}}');
add('Trainer access revoked', 'GET', '/api/trainer/students/{{fitlifeUserId}}', { role: 'Trainer', status: 403 });
add('Trainer creates invite to cancel', 'POST', '/api/trainer/links', { role: 'Trainer', status: 201, tests: [remember('reviewLinkId', 'pm.response.json().link.link_id')] });
add('Trainer cancels invite', 'DELETE', '/api/trainer/links/{{reviewLinkId}}', { role: 'Trainer' });
add('Admin locks other account', 'PATCH', '/api/admin/accounts/{{reviewOtherId}}', { role: 'Admin', body: { is_active: false, note: 'Review lock' } });
add('Locked token rejected', 'GET', '/api/auth/me', { role: 'Other', status: 401 });
add('Admin unlocks other account', 'PATCH', '/api/admin/accounts/{{reviewOtherId}}', { role: 'Admin', body: { is_active: true, note: 'Review unlock' } });
add('Revoked token stays invalid after unlock', 'GET', '/api/auth/me', { role: 'Other', status: 401 });
collection.item.push(...logout);
fs.writeFileSync(path.resolve(__dirname, '../api/review-api.postman_collection.json'), JSON.stringify(collection, null, 2) + '\n');
console.log(`Generated review collection: ${collection.item.length} requests.`);
