'use strict';
const fs = require('node:fs');
const path = require('node:path');
const items = [];
const assertion = code => ({ listen: 'test', script: { type: 'text/javascript', exec: code } });
function add(name, method, route, { role = 'trainer', body, status = 200, tests = [] } = {}) {
  const expected = Array.isArray(status) ? status : [status];
  items.push({ name, request: { method, header: [
    ...(role ? [{ key: 'Authorization', value: `Bearer {{${role}Token}}` }] : []),
    ...(body ? [{ key: 'Content-Type', value: 'application/json' }] : []),
  ], url: '{{baseUrl}}' + route, ...(body ? { body: { mode: 'raw', raw: JSON.stringify(body), options: { raw: { language: 'json' } } } } : {}) },
  event: [assertion([`pm.test(${JSON.stringify(name + ' status')},()=>pm.expect(${JSON.stringify(expected)}).to.include(pm.response.code));`, ...tests])] });
}
const check = (name, code) => `pm.test(${JSON.stringify(name)},()=>{${code}});`;
for (const role of ['admin', 'trainer', 'user']) add(`Login ${role}`, 'POST', '/api/auth/login', { role: null,
  body: { email: `{{${role}Email}}`, password: '{{testPassword}}' }, tests: [
    `if(pm.response.code===200){const b=pm.response.json();pm.collectionVariables.set('${role}Token',b.token);pm.collectionVariables.set('${role}Id',b.user.user_id);}`] });
for (const route of ['/api/trainer/templates', '/api/trainer/students', '/api/trainer/assignments', '/api/trainer/invites', '/api/admin/revenue', '/api/admin/logs']) add(`Unauthorized ${route}`, 'GET', route, { role: null, status: 401 });
add('Member cannot administer', 'GET', '/api/admin/overview', { role: 'user', status: 403 });
add('Member cannot read Trainer data', 'GET', '/api/trainer/students', { role: 'user', status: 403 });
add('Admin cannot use member consent', 'GET', '/api/trainer-links', { role: 'admin', status: 403 });
const template = { title: 'Postman immutable history', description: 'Controlled integration exercise', category: 'Strength', duration_seconds: 600, calories_est: 50, level: 'beginner' };
add('Reject invalid template', 'POST', '/api/trainer/templates', { body: { ...template, duration_seconds: 0 }, status: 400 });
add('Create template', 'POST', '/api/trainer/templates', { body: template, status: 201, tests: ["pm.collectionVariables.set('templateId',pm.response.json().template.template_id);"] });
add('Template pagination and search', 'GET', '/api/trainer/templates?q=Postman&page=1&page_size=1', { tests: [check('Paginated total', 'const b=pm.response.json();pm.expect(b.total).to.be.at.least(1);pm.expect(b.templates).to.have.lengthOf(1);')] });
add('Invalid page boundary', 'GET', '/api/trainer/templates?page=0', { status: 400 });
add('Empty search', 'GET', '/api/trainer/templates?q=nonexistent-platform-xyz', { tests: [check('Empty result', 'pm.expect(pm.response.json().total).to.eql(0);')] });
add('Create invitation to revoke', 'POST', '/api/trainer/invites', { status: 201, tests: ["pm.collectionVariables.set('revokedCode',pm.response.json().invite_code);"] });
add('Read invitations', 'GET', '/api/trainer/invites', { tests: ["const i=pm.response.json().invites.find(x=>x.invite_code===pm.collectionVariables.get('revokedCode'));pm.collectionVariables.set('inviteId',i.link_id);"] });
add('Revoke unused invitation', 'POST', '/api/trainer/invites/{{inviteId}}/revoke');
add('Revoked invitation refused', 'POST', '/api/trainer-links/accept', { role: 'user', body: { code: '{{revokedCode}}' }, status: 400 });
add('Create consent invitation', 'POST', '/api/trainer/invites', { status: 201, tests: ["pm.collectionVariables.set('inviteCode',pm.response.json().invite_code);"] });
add('Member accepts consent', 'POST', '/api/trainer-links/accept', { role: 'user', body: { code: '{{inviteCode}}' } });
add('Read member connections', 'GET', '/api/trainer-links', { role: 'user', tests: ["pm.collectionVariables.set('linkId',pm.response.json().links[0].link_id);"] });
add('Read students', 'GET', '/api/trainer/students?page_size=1', { tests: [check('Student connection visible', 'pm.expect(pm.response.json().students.some(s=>s.user_id===pm.collectionVariables.get("userId"))).to.eql(true);')] });
const assignment = { id: '{{assignmentId}}', user_id: '{{userId}}', template_id: '{{templateId}}', note: 'Visible only to this Trainer and recipient' };
items.push({ name: 'Prepare assignment UUID', request: { method: 'GET', url: '{{baseUrl}}/health' }, event: [{ listen: 'prerequest', script: { type: 'text/javascript', exec: ["for(const k of ['assignmentId','doneAssignmentId','pendingAssignmentId','challengeId','rewardId','purchaseId'])pm.collectionVariables.set(k,pm.variables.replaceIn('{{$guid}}'));"] } }, assertion([check('Database health', 'pm.expect(pm.response.code).to.eql(200);')])] });
add('Assign exercise', 'POST', '/api/trainer/assignments', { body: assignment, status: [200, 201] });
add('Retry identical assignment', 'POST', '/api/trainer/assignments', { body: assignment, status: [200, 201], tests: [check('Stable assignment identity', 'pm.expect(pm.response.json().assignment.id).to.eql(pm.collectionVariables.get("assignmentId"));')] });
add('Idempotency payload mismatch refused', 'POST', '/api/trainer/assignments', { body: { ...assignment, note: 'Changed payload' }, status: 409 });
add('Edit all template fields', 'PATCH', '/api/trainer/templates/{{templateId}}', { body: { ...template, title: 'Postman edited title', duration_seconds: 900 } });
add('Assignment preserves history', 'GET', '/api/trainer-links', { role: 'user', tests: [check('Immutable assignment snapshot', 'const a=pm.response.json().assignments.find(a=>a.id===pm.collectionVariables.get("assignmentId"));pm.expect(a.template.title).to.eql("Postman immutable history");pm.expect(a.note).to.eql("Visible only to this Trainer and recipient");')] });
add('Cancellation requires reason', 'POST', '/api/trainer/assignments/{{assignmentId}}/cancel', { body: { reason: '' }, status: 400 });
add('Cancel single assignment', 'POST', '/api/trainer/assignments/{{assignmentId}}/cancel', { body: { reason: 'Adjust training plan' } });
add('Cancelled assignment cannot complete', 'POST', '/api/trainer-links/assignments/{{assignmentId}}/done', { role: 'user', status: 409 });
add('Assign for completion', 'POST', '/api/trainer/assignments', { body: { ...assignment, id: '{{doneAssignmentId}}' }, status: [200, 201] });
add('Student completes exercise', 'POST', '/api/trainer-links/assignments/{{doneAssignmentId}}/done', { role: 'user' });
add('Repeated completion is safe', 'POST', '/api/trainer-links/assignments/{{doneAssignmentId}}/done', { role: 'user' });
add('Trainer feedback', 'POST', '/api/trainer/assignments/{{doneAssignmentId}}/feedback', { body: { feedback: 'Good technique, keep this pace.' } });
add('Student progress', 'GET', '/api/trainer/students/{{userId}}/progress');
add('Disconnect student', 'POST', '/api/trainer/links/{{linkId}}/end');
add('Disconnected Trainer cannot assign', 'POST', '/api/trainer/assignments', { body: { ...assignment, id: '{{pendingAssignmentId}}' }, status: 403 });
add('Invite for revoke scenario', 'POST', '/api/trainer/invites', { status: 201, tests: ["pm.collectionVariables.set('inviteCode',pm.response.json().invite_code);"] });
add('Fresh consent', 'POST', '/api/trainer-links/accept', { role: 'user', body: { code: '{{inviteCode}}' } });
add('Assignment before Trainer revoke', 'POST', '/api/trainer/assignments', { body: { ...assignment, id: '{{pendingAssignmentId}}' }, status: [200, 201] });
add('Admin revokes Trainer', 'PATCH', '/api/admin/accounts/{{trainerId}}', { role: 'admin', body: { role: 'user', note: 'Postman revocation invariant' } });
add('Revoked Trainer token refused', 'GET', '/api/trainer/templates', { status: 401 });
add('Revocation ends consent', 'GET', '/api/trainer-links', { role: 'user', tests: [check('No active consent', 'pm.expect(pm.response.json().links).to.have.lengthOf(0);')] });
add('Admin regrants Trainer', 'PATCH', '/api/admin/accounts/{{trainerId}}', { role: 'admin', body: { role: 'trainer', note: 'Postman regrant needs new consent' } });
add('Login regranted Trainer', 'POST', '/api/auth/login', { role: null, body: { email: '{{trainerEmail}}', password: '{{testPassword}}' }, tests: ["pm.collectionVariables.set('trainerToken',pm.response.json().token);"] });
add('Regrant does not restore consent', 'GET', '/api/trainer/students', { tests: [check('No restored students', 'pm.expect(pm.response.json().total).to.eql(0);')] });
add('Historical template archived safely', 'DELETE', '/api/trainer/templates/{{templateId}}', { status: [200, 204] });
const challenge = { challenge_id: '{{challengeId}}', title: 'Postman challenge', description: 'Integration challenge', target_days: 5, reward_coins: 20, badge_icon: 'fitness', is_active: true };
add('Create challenge', 'POST', '/api/admin/challenges', { role: 'admin', body: challenge, status: 201 });
add('Challenge detail', 'GET', '/api/admin/challenges/{{challengeId}}', { role: 'admin' });
add('Edit challenge', 'PATCH', '/api/admin/challenges/{{challengeId}}', { role: 'admin', body: { title: 'Postman updated challenge' } });
add('Deactivate challenge', 'PATCH', '/api/admin/challenges/{{challengeId}}', { role: 'admin', body: { is_active: false } });
add('Search challenges', 'GET', '/api/admin/challenges?q=Postman&page_size=1', { role: 'admin' });
for (const route of ['/api/admin/payments?page=1', '/api/admin/logs?action=change_account_role', '/api/admin/revenue', '/api/admin/overview']) add(`Admin lookup ${route}`, 'GET', route, { role: 'admin' });
add('Reject invalid revenue range', 'GET', '/api/admin/revenue?from=invalid', { role: 'admin', status: 400 });
add('Logout Trainer', 'POST', '/api/auth/logout', { status: 204 });
add('Logged-out token refused', 'GET', '/api/auth/me', { status: 401 });
const collection = { info: { name: 'FitLife — fullstack Trainer Admin regression', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: 'Run against a DISPOSABLE integration database only. Creates and revokes training consent; never target production. Credentials are supplied by environment. Concurrent invariants are covered by node:test.' },
  variable: [{ key: 'baseUrl', value: 'http://127.0.0.1:5500' }, ...['adminEmail', 'trainerEmail', 'userEmail', 'testPassword'].map(key => ({ key, value: '' }))], item: items };
fs.writeFileSync(path.resolve(__dirname, '../api/platform-regression.postman_collection.json'), JSON.stringify(collection, null, 2) + '\n');
console.log(`Generated platform regression: ${items.length} requests.`);
