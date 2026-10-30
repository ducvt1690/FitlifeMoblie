'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const { createApp } = require('../app');
const { parseCorsOrigins } = require('../utils/cors-options');

test('CORS permits only configured web origins and native/Postman requests without Origin', async t => {
  // Root and preflight run through Express but perform no database operation.
  const server = createApp({ db: {}, corsOrigins: ['https://fitlife.example'] }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const allowed = await fetch(base, { headers: { Origin: 'https://fitlife.example' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://fitlife.example');
  for (const origin of ['https://untrusted.example', 'https://fitlife.example.attacker.test', 'null']) {
    const denied = await fetch(base, { headers: { Origin: origin } });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    const body = await denied.json();
    assert.equal(body.success, false);
    assert.equal(Object.hasOwn(body, 'stack'), false);
  }
  const native = await fetch(base);
  assert.equal(native.status, 200);
  assert.equal(native.headers.get('access-control-allow-origin'), null);
  const preflight = await fetch(base + '/api/profile', { method: 'OPTIONS', headers: {
    Origin: 'https://fitlife.example', 'Access-Control-Request-Method': 'PATCH',
    'Access-Control-Request-Headers': 'authorization,content-type',
  } });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /authorization/);
});

test('CORS origins reject wildcards, credentials, paths and invalid URLs', () => {
  assert.deepEqual(parseCorsOrigins(' https://fitlife.example/,https://fitlife.example '), ['https://fitlife.example']);
  assert.deepEqual(parseCorsOrigins(''), []);
  for (const value of ['*', 'not-a-url', 'https://user:pass@fitlife.example', 'https://fitlife.example/path',
    'https://fitlife.example?x=1', 'file:///app', 123]) {
    assert.throws(() => parseCorsOrigins(value));
  }
});
