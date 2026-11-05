'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const metadata = JSON.parse(fs.readFileSync(path.resolve(root, '../output/integration-runtime.local.json'), 'utf8'));
const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), 'start', '--localhost', '--port', '8081'], {
  cwd: root, env: { ...process.env, EXPO_PUBLIC_API_URL: metadata.apiUrl }, stdio: 'inherit',
});
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
