'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const { initializeDatabase } = require('../database/mongodb/database');
const { initializeAuthSessions } = require('../database/connection');
const { createAuthService } = require('../services/auth.service');
const { createApp } = require('../app');

test('every protected API rejects missing sessions and every role area rejects foreign roles', async t => {
  const replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const client = new MongoClient(replica.getUri());
  let server;
  try {
    await client.connect();
    const db = client.db('api_boundary_test');
    await initializeDatabase(db); await initializeAuthSessions(db);
    const auth = createAuthService({ db }), tokens = {};
    for (const role of ['user', 'trainer']) {
      const body = { email: `${role}-${randomUUID()}@fitlife.example`, password: 'Boundary-test-123', confirm_password: 'Boundary-test-123', full_name: `Boundary ${role}`, gender: 'male', age: 30, height: 170, weight: 70, activity_level: 'moderate', goal: 'maintain' };
      const r = await auth.register(await require('./verified-registration')(db, body));
      if (role !== 'user') await db.collection('users').updateOne({ user_id: r.user.user_id }, { $set: { role } });
      tokens[role] = r.token;
    }
    const app = createApp({ db, logger: { error() {} } });
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const publicAuth = new Set(['/register/email-code', '/register/verify-email', '/register', '/login', '/logout', '/forgot-password', '/reset-password']);
    for (const layer of app._router.stack.filter(l => l.name === 'router')) {
      const prefix = layer.regexp.source.replaceAll('\\/', '/').split('/?')[0].slice(1);
      for (const entry of layer.handle.stack.filter(l => l.route)) {
        const route = entry.route.path;
        if ((prefix === '/api/auth' && publicAuth.has(route)) || route.startsWith('/vnpay/')) continue;
        const url = prefix + (route === '/' ? '' : route.replace(/:[^/]+/g, randomUUID()));
        for (const method of Object.keys(entry.route.methods).map(m => m.toUpperCase())) {
          await t.test(`${method} ${prefix}${route} authentication`, async () => {
            const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, ...(!['GET', 'HEAD'].includes(method) ? { body: '{}' } : {}) });
            assert.equal(response.status, 401, `${method} ${url}`);
            const data = await response.json();
            assert.equal(data.success, false); assert.equal(Object.hasOwn(data, 'stack'), false);
          });
          // The shared exercise catalog is intentionally readable by all signed-in roles.
          if (prefix === '/api/auth' || prefix === '/api/profile' || prefix === '/api/exercises') continue;
          const foreignToken = prefix.startsWith('/api/admin') || prefix.startsWith('/api/trainer') && prefix !== '/api/trainer-links' ? tokens.user : tokens.trainer;
          await t.test(`${method} ${prefix}${route} authorization`, async () => {
            const response = await fetch(base + url, { method, headers: { Authorization: `Bearer ${foreignToken}`, 'Content-Type': 'application/json' }, ...(!['GET', 'HEAD'].includes(method) ? { body: '{}' } : {}) });
            assert.equal(response.status, 403, `${method} ${url}`);
            assert.equal((await response.json()).success, false);
          });
        }
      }
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await client.close(); await replica.stop();
  }
});
