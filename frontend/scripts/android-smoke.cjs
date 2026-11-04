const {
  execFileSync
} = require('node:child_process');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const sdk = process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA, 'Android/Sdk');
const adb = path.join(sdk, 'platform-tools/adb.exe');
const run = (...args) => execFileSync(adb, args, {
  encoding: 'utf8',
  timeout: 20000
});
const delay = ms => new Promise(r => setTimeout(r, ms));
function dump() {
  run('shell', 'uiautomator', 'dump', '/sdcard/fitlife-qa.xml');
  return run('shell', 'cat', '/sdcard/fitlife-qa.xml');
}
function tap(xml, label) {
  const node = [...xml.matchAll(/<node\s[^>]+>/g)].map(m => m[0]).find(n => n.includes(`content-desc="${label}"`) || n.includes(`text="${label}"`));
  assert.ok(node, 'Missing UI element ' + label);
  const [, x1, y1, x2, y2] = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).map(Number);
  run('shell', 'input', 'tap', String(Math.round((x1 + x2) / 2)), String(Math.round((y1 + y2) / 2)));
}
async function waitFor(label) {
  for (let i = 0; i < 15; i++) {
    const xml = dump();
    if (xml.includes(label)) return xml;
    await delay(700);
  }
  throw new Error('Native UI did not show ' + label);
}
(async () => {
  run('reverse', 'tcp:8085', 'tcp:8085');
  run('reverse', 'tcp:5500', 'tcp:5500');
  run('shell', 'am', 'start', '-S', '-W', '-a', 'android.intent.action.VIEW', '-d', 'exp://127.0.0.1:8085', 'host.exp.exponent');
  let xml;
  for(let i=0;i<15;i++){xml=dump();if(xml.includes('Đăng Nhập Ngay')||xml.includes('Local QA user'))break;await delay(700);}
  const restored=xml.includes('Local QA user');
  if(!restored){
  tap(xml, 'Email');
  await delay(500);
  run('shell', 'input', 'text', 'user@merge.example');
  run('shell', 'input', 'keyevent', '4');
  await delay(400);
  xml = dump();
  tap(xml, 'Mật khẩu');
  await delay(500);
  run('shell', 'input', 'text', 'Merge-smoke-test-2026!');
  run('shell', 'input', 'keyevent', '4');
  await delay(400);
  xml = dump();
  tap(xml, 'Đăng Nhập Ngay →');
  }
  xml = await waitFor('Local QA user');
  assert.ok(xml.includes('Home'));
  tap(xml, 'Nhiệm vụ');
  xml = await waitFor('Nhiệm vụ hôm nay');
  assert.ok(xml.includes('Ghi nhận nước uống') || xml.includes('Điểm danh'));
  const out = path.resolve(__dirname, '../../qa-artifacts/android');
  fs.mkdirSync(out, {
    recursive: true
  });
  fs.writeFileSync(path.join(out, 'quests.xml'), xml);
  run('shell', 'screencap', '-p', '/sdcard/fitlife-qa.png');
  run('pull', '/sdcard/fitlife-qa.png', path.join(out, 'quests.png'));
  tap(xml, 'Home');
  xml = await waitFor('Local QA user');
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({
    status: 'PASS',
    device: 'FitLife_API36',
    checks: ['Expo Go SDK 58 loads app', restored?'Stored native session restored by server':'Native login against local Express/MongoDB', 'Server profile loaded', 'Server quest screen opened', 'Home navigation'],
    scope: 'Synthetic account; disposable local MongoDB only'
  }, null, 2));
  console.log('PASS native Android: SDK compatibility, login, server profile, quests and Home navigation.');
})().catch(e => {
  console.error(e.message);
  process.exitCode = 1;
});
