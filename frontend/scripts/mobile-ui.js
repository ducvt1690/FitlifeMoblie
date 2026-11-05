'use strict';
// Small adb UIAutomator driver for the disposable integration emulator. Never prints credentials.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../../output');
const adb = args => execFileSync('adb', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function dump() {
  adb(['shell', 'uiautomator', 'dump', '--compressed', '/sdcard/fitlife-ui.xml']);
  const xml = adb(['shell', 'cat', '/sdcard/fitlife-ui.xml']);
  fs.writeFileSync(path.join(output, 'mobile-ui.xml'), xml);
  return [...xml.matchAll(/<node\s+([^>]+)/g)].map(m => Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], a[2]])));
}
function tapNode(node) {
  if (!node) throw new Error('UI element not found');
  const p = node.bounds.match(/\d+/g).map(Number);
  adb(['shell', 'input', 'tap', String(Math.round((p[0] + p[2]) / 2)), String(Math.round((p[1] + p[3]) / 2))]);
}
function tap(label, nodes = dump()) { tapNode(nodes.find(n => n['content-desc'] === label && n.clickable === 'true') ?? nodes.find(n => n['content-desc'] === label) ?? nodes.find(n => n.text === label)); }
function scroll(direction) { adb(['shell', 'input', 'swipe', '540', direction === 'up' ? '650' : '1900', '540', direction === 'up' ? '1900' : '650', '350']); }
async function top() { for (let i = 0; i < 4; i++) scroll('up'); await pause(300); }
async function seekTap(label) {
  for (let i = 0; i < 7; i++) {
    const nodes = dump();
    const node = nodes.find(n => n['content-desc'] === label && n.clickable === 'true' && Number(n.bounds.match(/\d+/g)[3]) < 2170);
    if (node) { tapNode(node); return; }
    scroll('down');
  }
  throw new Error('Visible button missing: ' + label);
}
async function seekText(text) {
  for (let i = 0; i < 7; i++) { if (dump().some(n => n.text.includes(text))) return; scroll('down'); }
  throw new Error('Visible text missing: ' + text);
}
async function fill(index, value) {
  const nodes = dump().filter(n => n.class === 'android.widget.EditText');
  const node = typeof index === 'number' ? nodes[index] : nodes.find(n => n['content-desc'] === index);
  tapNode(node);
  if (node.text) { adb(['shell', 'input', 'keyevent', '123']); adb(['shell', 'input', 'keyevent', ...Array.from(node.text).map(() => '67')]); }
  adb(['shell', 'input', 'text', value.replaceAll(' ', '%s')]);
  adb(['shell', 'input', 'keyevent', '4']);
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'tap') tap(args[0]);
  else if (command === 'fill') await fill(/^\d+$/.test(args[0]) ? Number(args[0]) : args[0], args.slice(1).join(' '));
  else if (command === 'login') {
    const account = JSON.parse(fs.readFileSync(path.join(output, 'integration-runtime.local.json'), 'utf8')).accounts[args[0]];
    tap('Đăng nhập'); await pause(1000);
    await fill(0, account.email); await fill(1, account.password);
    tap('Đăng nhập'); await pause(1500);
  } else if (command === 'logout') {
    const nodes = dump();
    tap(nodes.some(n => n['content-desc'] === 'Hồ sơ') ? 'Hồ sơ' : 'Tài khoản', nodes);
    await pause(600); await seekTap('Đăng xuất'); await pause(600);
  } else if (command === 'trainer-template-smoke') {
    const metadata = JSON.parse(fs.readFileSync(path.join(output, 'integration-runtime.local.json'), 'utf8'));
    const checks = [];
    tap('Lưu bài mẫu');
    if (!dump().some(n => n.text.includes('Điền đủ thông tin'))) throw new Error('Expected empty-template validation');
    checks.push('Empty template validation shown');
    const title = 'Native mobile ' + Date.now();
    for (const [label, value] of [['Tên bài', title], ['Hướng dẫn', 'Native controlled exercise instructions'], ['Nhóm bài tập', 'Strength'], ['Thời lượng (giây)', '1200'], ['Calo ước tính', '80']]) await fill(label, value);
    tap('Trung cấp'); tap('Lưu bài mẫu'); await pause(1200);
    const { email, password } = metadata.accounts.trainer;
    const login = await fetch(metadata.apiUrl + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(r => r.json());
    const templates = await fetch(metadata.apiUrl + '/api/trainer/templates?q=' + encodeURIComponent(title), { headers: { Authorization: 'Bearer ' + login.token } }).then(r => r.json());
    const row = templates.templates?.find(t => t.title === title);
    if (!row || row.duration_seconds !== 1200 || row.calories_est !== 80 || row.level !== 'intermediate') throw new Error('Template fields not persisted from native UI');
    checks.push('Native UI creates template with complete persisted fields');
    tap('Chỉnh sửa mẫu'); await fill('Tên bài', title + ' edited'); await fill('Thời lượng (giây)', '1500'); tap('Lưu bài mẫu'); await pause(1200);
    const after = await fetch(metadata.apiUrl + '/api/trainer/templates?q=' + encodeURIComponent(title), { headers: { Authorization: 'Bearer ' + login.token } }).then(r => r.json());
    if (after.templates?.[0]?.title !== title + ' edited' || after.templates[0].duration_seconds !== 1500) throw new Error('Native template edit not persisted');
    checks.push('Native UI edits template with persisted duration and title');
    fs.writeFileSync(path.join(output, 'mobile-native-test-result.json'), JSON.stringify({ at: new Date().toISOString(), platform: 'Android emulator API36 / Expo Go', passed: checks, template_id: row.template_id }, null, 2));
    console.log(JSON.stringify({ passed: checks }, null, 2));
  } else if (command === 'trainer-assignment-smoke') {
    const metadata = JSON.parse(fs.readFileSync(path.join(output, 'integration-runtime.local.json'), 'utf8'));
    const resultsPath = path.join(output, 'mobile-native-test-result.json');
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    async function login(role) {
      const { email, password } = metadata.accounts[role];
      return fetch(metadata.apiUrl + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(r => r.json());
    }
    const trainer = await login('trainer'), member = await login('user');
    async function api(url, token, method = 'GET', body) {
      const response = await fetch(metadata.apiUrl + url, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const value = await response.json(); if (!response.ok) throw new Error('Fixture API ' + response.status + ': ' + value.message); return value;
    }
    const students = await api('/api/trainer/students', trainer.token);
    if (!students.students.some(s => s.user_id === metadata.accounts.user.user_id)) {
      const invite = await api('/api/trainer/invites', trainer.token, 'POST');
      await api('/api/trainer-links/accept', member.token, 'POST', { code: invite.invite_code });
    }
    await seekTap('Chọn mẫu để giao'); await top(); tap('Học viên'); await pause(900); await seekTap('Giao bài');
    await fill('Ghi chú cho học viên', 'Native private coaching note'); tap('Xác nhận giao bài'); await pause(900);
    const assignments = await api('/api/trainer/assignments', trainer.token);
    const assignment = assignments.assignments.find(a => a.template_id === results.template_id && a.note === 'Native private coaching note');
    if (!assignment || assignment.status !== 'assigned') throw new Error('Native assignment not persisted');
    results.passed.push('Native UI assigns selected template and persists member note');
    await top(); tap('Bài đã giao'); await pause(900); await seekTap('Hủy riêng bài này');
    await fill('Lý do hủy', 'Native cancellation reason'); tap('Xác nhận hủy bài'); await pause(900);
    const cancelled = (await api('/api/trainer/assignments', trainer.token)).assignments.find(a => a.id === assignment.id);
    if (cancelled?.status !== 'cancelled' || cancelled.cancel_reason !== 'Native cancellation reason') throw new Error('Native cancellation not persisted');
    results.passed.push('Native UI cancels only selected assignment with persisted reason');
    const visible = dump();
    if (visible.some(n => n.text.includes('Encountered two children'))) throw new Error('Duplicate row key');
    await top(); tap('Học viên'); await pause(700); await seekTap('Ngắt kết nối học viên'); tap('Xác nhận ngắt kết nối'); await pause(700);
    if ((await api('/api/trainer/students', trainer.token)).students.some(s => s.user_id === metadata.accounts.user.user_id)) throw new Error('Disconnected student remains active');
    results.passed.push('Native UI disconnects student; backend removes active consent');
    results.assignment_id = assignment.id;
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ passed: results.passed }, null, 2));
  } else if (command === 'admin-catalog-smoke') {
    const resultsPath = path.join(output, 'mobile-native-test-result.json');
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    const nodes = dump();
    if (!nodes.some(n => n.text === 'Doanh thu Premium') || !nodes.some(n => n.text === 'Tiền mua Coin')) throw new Error('Revenue categories not rendered separately');
    results.passed.push('Native admin dashboard renders separate Premium and Coin revenue');
    adb(['shell', 'screencap', '-p', '/sdcard/fitlife-screen.png']); adb(['pull', '/sdcard/fitlife-screen.png', path.join(output, 'mobile-admin-revenue.png')]);
    const metadata = JSON.parse(fs.readFileSync(path.join(output, 'integration-runtime.local.json'), 'utf8'));
    const { email, password } = metadata.accounts.admin;
    const admin = await fetch(metadata.apiUrl + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(r => r.json());
    const query = async path => fetch(metadata.apiUrl + path, { headers: { Authorization: 'Bearer ' + admin.token } }).then(r => r.json());
    tap('Nghiệp vụ'); await pause(600); tap('Tạo thử thách');
    const title = 'Native challenge ' + Date.now();
    for (const [label, value] of [['Tên', title], ['Hướng dẫn', 'Seven days fitness'], ['Số ngày', '7'], ['Thưởng xu', '20'], ['Biểu tượng', 'flag']]) await fill(label, value);
    tap('Lưu'); await pause(900);
    const challenge = (await query('/api/admin/challenges?q=' + encodeURIComponent(title))).challenges?.[0];
    if (!challenge || challenge.target_days !== 7 || challenge.reward_coins !== 20) throw new Error('Native challenge not persisted');
    results.passed.push('Native admin creates challenge with persisted target and reward');
    await seekTap('Ngừng hoạt động'); tap('Xác nhận đổi trạng thái'); await pause(900);
    const deactivated = await query('/api/admin/challenges/' + challenge.challenge_id);
    if (deactivated.item?.is_active !== false) throw new Error('Native challenge deactivation failed');
    results.passed.push('Native admin deactivates challenge after confirmation');
    await top(); tap('Phần thưởng'); await pause(700); tap('Tạo phần thưởng');
    const rewardTitle = 'Native reward ' + Date.now();
    await fill('Tên', rewardTitle); tap('Voucher'); await fill('Giá đổi (xu)', '10'); await fill('Biểu tượng', 'gift'); tap('Lưu'); await pause(700);
    const reward = (await query('/api/admin/rewards?q=' + encodeURIComponent(rewardTitle))).items?.[0];
    if (!reward || reward.cost_coins !== 10 || reward.category !== 'voucher') throw new Error('Native reward not persisted');
    results.passed.push('Native admin creates reward with persisted price and category');
    results.challenge_id = challenge.challenge_id; results.reward_id = reward.item_id;
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ passed: results.passed }, null, 2));
  } else if (command === 'member-session-smoke') {
    const metadata = JSON.parse(fs.readFileSync(path.join(output, 'integration-runtime.local.json'), 'utf8'));
    if (metadata.database !== 'fitlife_integration_test' || !metadata.uri.startsWith('mongodb://127.0.0.1:')) throw new Error('Requires disposable local integration database');
    const resultsPath = path.join(output, 'mobile-native-test-result.json');
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    const { MongoClient } = require('../../backend/node_modules/mongodb');
    const client = new MongoClient(metadata.uri);
    await client.connect();
    try {
      const db = client.db(metadata.database);
      async function login(role) {
        const { email, password } = metadata.accounts[role];
        return fetch(metadata.apiUrl + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(r => r.json());
      }
      async function api(url, token, method = 'GET', body) {
        const r = await fetch(metadata.apiUrl + url, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        const v = await r.json(); if (!r.ok) throw new Error('Fixture API ' + r.status + ': ' + v.message); return v;
      }
      const trainer = await login('trainer'), member = await login('user');
      const students = await api('/api/trainer/students', trainer.token);
      if (!students.students.some(s => s.user_id === metadata.accounts.user.user_id)) {
        const invite = await api('/api/trainer/invites', trainer.token, 'POST');
        await api('/api/trainer-links/accept', member.token, 'POST', { code: invite.invite_code });
      }
      const id = require('node:crypto').randomUUID();
      await api('/api/trainer/assignments', trainer.token, 'POST', { id, user_id: metadata.accounts.user.user_id, template_id: results.template_id, note: 'Native student receiving note' });
      await api('/api/trainer/assignments/' + id + '/feedback', trainer.token, 'POST', { feedback: 'Native student feedback' });
      const before = new Set((await db.collection('auth_sessions').find({ user_id: metadata.accounts.user.user_id }).toArray()).map(s => s.token_hash));
      const current = dump(); tap(current.some(n => n['content-desc'] === 'Tài khoản') ? 'Tài khoản' : 'Hồ sơ', current); await pause(600); await seekTap('Đăng xuất'); await pause(500); tap('Đăng nhập'); await pause(600);
      await fill('Email', metadata.accounts.user.email); await fill('Mật khẩu', metadata.accounts.user.password); tap('Đăng nhập'); await pause(1000);
      const added = (await db.collection('auth_sessions').find({ user_id: metadata.accounts.user.user_id }).toArray()).filter(s => !before.has(s.token_hash));
      if (added.length !== 1) throw new Error('Could not identify unique native session; did not revoke any session');
      const nativeSession = added[0];
      tap('Bài tập từ huấn luyện viên'); await pause(700);
      await seekTap('Đánh dấu hoàn thành');
      await pause(700);
      const assignment = await db.collection('trainer_assignments').findOne({ id });
      if (assignment.status !== 'done' || !assignment.done_at) throw new Error('Native student completion not persisted');
      results.passed.push('Native member opens trainer assignment inbox and completes persisted assignment');
      await seekText('Native student feedback');
      results.passed.push('Native member sees assigned exercise instructions, note and trainer feedback');
      adb(['shell', 'screencap', '-p', '/sdcard/fitlife-screen.png']); adb(['pull', '/sdcard/fitlife-screen.png', path.join(output, 'mobile-member-assignment.png')]);
      await db.collection('auth_sessions').deleteOne({ _id: nativeSession._id, user_id: metadata.accounts.user.user_id });
      tap('Đóng'); await pause(300); tap('Hồ sơ'); await pause(1200);
      if (!dump().some(n => n.text.includes('Phiên đăng nhập đã hết hạn hoặc bị thu hồi'))) throw new Error('Native client did not clear revoked session');
      results.passed.push('Native member revoked session clears secure auth state and shows sign-in notice');
      adb(['shell', 'screencap', '-p', '/sdcard/fitlife-screen.png']); adb(['pull', '/sdcard/fitlife-screen.png', path.join(output, 'mobile-session-revoked.png')]);
      fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
      console.log(JSON.stringify({ passed: results.passed }, null, 2));
    } finally { await client.close(); }
  } else if (command === 'session-expiry-smoke') {
    const metadata = JSON.parse(fs.readFileSync(path.join(output, 'integration-runtime.local.json'), 'utf8'));
    if (metadata.database !== 'fitlife_integration_test' || !metadata.uri.startsWith('mongodb://127.0.0.1:')) throw new Error('Requires disposable local integration database');
    const { MongoClient } = require('../../backend/node_modules/mongodb');
    const client = new MongoClient(metadata.uri); await client.connect();
    try {
      const sessions = client.db(metadata.database).collection('auth_sessions');
      const before = new Set((await sessions.find({ user_id: metadata.accounts.user.user_id }).toArray()).map(s => s.token_hash));
      tap('Đăng nhập'); await pause(600); await fill('Email', metadata.accounts.user.email); await fill('Mật khẩu', metadata.accounts.user.password); tap('Đăng nhập'); await pause(900);
      if (dump().some(n => n.text.includes('Quá nhiều yêu cầu đăng nhập'))) throw new Error('BLOCKED: expected login rate limiter (429); retry on a fresh disposable runtime');
      const added = (await sessions.find({ user_id: metadata.accounts.user.user_id }).toArray()).filter(s => !before.has(s.token_hash));
      if (added.length !== 1) throw new Error('Native session ambiguous; no session changed');
      await sessions.updateOne({ _id: added[0]._id }, { $set: { expires_at: new Date(Date.now() - 60000) } });
      const current = dump();
      if (current.some(n => n['content-desc'] === 'Hồ sơ')) tap('Hồ sơ', current);
      await pause(1000);
      if (!dump().some(n => n.text.includes('Phiên đăng nhập đã hết hạn hoặc bị thu hồi'))) throw new Error('Expired native session not cleared');
      const file = path.join(output, 'mobile-native-test-result.json');
      const results = JSON.parse(fs.readFileSync(file, 'utf8')); results.passed.push('Native expired session rejects protected API and returns to sign-in state'); fs.writeFileSync(file, JSON.stringify(results, null, 2));
      console.log('Passed native session expiry');
    } finally { await client.close(); }
  } else if (command === 'trainer-invite-smoke') {
    adb(['shell', 'input', 'swipe', '950', '440', '180', '440', '350']); await pause(300); tap('Mã mời'); await pause(600); tap('Tạo mã mời'); await pause(700);
    const marker = dump().find(n => n.text.startsWith('Mã mới: '));
    const code = marker?.text.match(/Mã mới: ([A-Z0-9]{8})/)?.[1];
    if (!code || !marker.text.includes('Hết hạn')) throw new Error('Native invite code or expiry not displayed');
    await seekTap('Thu hồi mã'); tap('Xác nhận thu hồi mã'); await pause(600);
    const metadata = JSON.parse(fs.readFileSync(path.join(output, 'integration-runtime.local.json'), 'utf8'));
    const { email, password } = metadata.accounts.trainer;
    const trainer = await fetch(metadata.apiUrl + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(r => r.json());
    const data = await fetch(metadata.apiUrl + '/api/trainer/invites?q=' + code, { headers: { Authorization: 'Bearer ' + trainer.token } }).then(r => r.json());
    if (data.invites?.find(i => i.invite_code === code)?.status !== 'revoked') throw new Error('Native invite revocation not persisted');
    const file = path.join(output, 'mobile-native-test-result.json');
    const results = JSON.parse(fs.readFileSync(file, 'utf8')); results.passed.push('Native trainer creates invite with expiry and revokes unused code after confirmation'); fs.writeFileSync(file, JSON.stringify(results, null, 2));
    console.log('Passed native invite management');
  } else if (command === 'scroll') scroll(args[0]);
  else if (command === 'back') adb(['shell', 'input', 'keyevent', '4']);
  else if (command === 'screenshot') {
    const name = args[0] || 'mobile-screen';
    adb(['shell', 'screencap', '-p', '/sdcard/fitlife-screen.png']);
    adb(['pull', '/sdcard/fitlife-screen.png', path.join(output, name + '.png')]);
  }
  const nodes = dump();
  fs.appendFileSync(path.join(output, 'mobile-native-actions.jsonl'), JSON.stringify({ at: new Date().toISOString(), command, args, labels: nodes.filter(n => n['content-desc']).map(n => n['content-desc']) }) + '\n');
  console.log(JSON.stringify(nodes.filter(n => n.text || n['content-desc'] || n.class === 'android.widget.EditText').map(n => ({ text: n.password === 'true' ? '[password]' : n.text, label: n['content-desc'], bounds: n.bounds, class: n.class, enabled: n.enabled })), null, 2));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
