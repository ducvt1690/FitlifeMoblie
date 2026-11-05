'use strict';

// Starts three independent clients/services; business rules remain in Express.
const { spawn } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const integration = process.argv.includes('--integration');
const apiPort = integration ? (process.env.FITLIFE_TEST_API_PORT || '5500') : String(require('../backend/config').loadConfig().port);
const apiUrl = process.env.FITLIFE_CLIENT_API_URL || `http://localhost:${apiPort}`;
const env = { ...process.env, VITE_API_URL: apiUrl, EXPO_PUBLIC_API_URL: apiUrl };
// For a phone use FITLIFE_CLIENT_API_URL=http://<computer LAN IP>:<API port>.
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
}
function launch(name, file, args, cwd) {
  const child = spawn(process.execPath, [path.join(root, file), ...args], { cwd: path.join(root, cwd), env, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.once('error', error => { console.error(`${name}: ${error.message}`); stop(1); });
  child.once('exit', code => { if (!stopping) { console.error(`${name} stopped (${code}).`); stop(code || 1); } });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop());
console.log(`API ${apiUrl} | Web http://localhost:5173 | Expo :8081${integration ? ' | disposable integration database' : ''}`);
launch('API', integration ? 'backend/scripts/start-integration-api.js' : 'backend/server.js', [], 'backend');
launch('Web', 'web/node_modules/vite/bin/vite.js', ['--host', '0.0.0.0', '--port', '5173', '--strictPort'], 'web');
launch('Expo', 'frontend/node_modules/expo/bin/cli', ['start', '--port', '8081', '--lan'], 'frontend');
