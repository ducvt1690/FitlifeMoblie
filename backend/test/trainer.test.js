'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const { initializeDatabase } = require('../database/mongodb/database');
const { initializeAuthSessions } = require('../database/connection');
const { createAuthService } = require('../services/auth.service');
const { createTrainerService } = require('../services/trainer.service');
test('trainer templates, consent, assignments and revocation isolate owners', async () => {
  const replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const client = new MongoClient(replica.getUri());
  try {
    await client.connect();
    const db = client.db('trainer_test');
    await initializeDatabase(db);
    await initializeAuthSessions(db);
    const auth = createAuthService({ db }),
      s = createTrainerService({ db });
    async function user(role) {
      const body = {
        email: randomUUID() + '@fitlife.example',
        password: 'Trainer-test-123',
        confirm_password: 'Trainer-test-123',
        full_name: role,
        gender: 'male',
        age: 23,
        height: 170,
        weight: 65,
        activity_level: 'moderate',
        goal: 'maintain',
      };
      const r = await auth.register(await require('./verified-registration')(db, body));
      await db.collection('users').updateOne({ user_id: r.user.user_id }, { $set: { role } });
      return { ...r.user, role };
    }
    const a = await user('trainer'),
      b = await user('trainer'),
      m = await user('user'),
      other = await user('user');
    const t = (
      await s.createTemplate(a, {
        title: 'Test',
        category: 'Fitness',
        description: 'Practice',
        duration_seconds: 1800,
        calories_est: 150,
        level: 'beginner',
      })
    ).template;
    assert.equal((await s.templates(b)).templates.length, 0);
    await assert.rejects(s.updateTemplate(b, t.template_id, { is_active: false }), { httpStatus: 404 });
    await assert.rejects(s.assign(a, { user_id: m.user_id, template_id: t.template_id }), {
      httpStatus: 403,
    });
    const invite = await s.invite(a);
    await s.accept(m, { code: invite.invite_code });
    await assert.rejects(s.accept(other, { code: invite.invite_code }), { httpStatus: 400 });
    assert.equal((await s.students(a)).students.length, 1);
    assert.equal((await s.students(b)).students.length, 0);
    await assert.rejects(s.assign(b, { user_id: m.user_id, template_id: t.template_id }), {
      httpStatus: 403,
    });
    const assignment = (await s.assign(a, { user_id: m.user_id, template_id: t.template_id })).assignment;
    await assert.rejects(s.done(other, assignment.id), { httpStatus: 404 });
    await s.done(m, assignment.id);
    await s.done(m, assignment.id);
    const cancelled = (await s.assign(a, { user_id: m.user_id, template_id: t.template_id })).assignment;
    await db
      .collection('trainer_assignments')
      .updateOne({ id: cancelled.id }, { $set: { status: 'cancelled' } });
    await assert.rejects(s.done(m, cancelled.id), { httpStatus: 409 });
    assert.equal((await s.assignments(a)).assignments.find((x) => x.id === assignment.id).status, 'done');
    const link = (await s.member(m)).links[0];
    await s.end(m, link.link_id);
    assert.equal((await s.students(a)).students.length, 0);
    await assert.rejects(s.assign(a, { user_id: m.user_id, template_id: t.template_id }), {
      httpStatus: 403,
    });
    await assert.rejects(s.createTemplate(a, { title: 'x', role: 'admin' }), { httpStatus: 400 });
  } finally {
    await client.close();
    await replica.stop();
  }
});

test('revocation serializes with in-flight assignment; HTTP routes reject other roles', async () => {
  const replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const client = new MongoClient(replica.getUri());
  let server;
  try {
    await client.connect();
    const db = client.db('trainer_race_test');
    await initializeDatabase(db);
    await initializeAuthSessions(db);
    const auth = createAuthService({ db }),
      service = createTrainerService({ db });
    async function account(role) {
      const body = {
        email: randomUUID() + '@fitlife.example',
        password: 'Trainer-test-123',
        confirm_password: 'Trainer-test-123',
        full_name: role,
        gender: 'male',
        age: 23,
        height: 170,
        weight: 65,
        activity_level: 'moderate',
        goal: 'maintain',
      };
      const r = await auth.register(await require('./verified-registration')(db, body));
      await db.collection('users').updateOne({ user_id: r.user.user_id }, { $set: { role } });
      return { ...r.user, role, token: r.token };
    }
    const trainer = await account('trainer'),
      member = await account('user'),
      admin = await account('admin');
    const template = (
      await service.createTemplate(trainer, {
        title: 'Race fixture',
        category: 'Fitness',
        description: 'Practice',
        duration_seconds: 1800,
        calories_est: 150,
        level: 'beginner',
      })
    ).template;
    await service.accept(member, { code: (await service.invite(trainer)).invite_code });
    const link = (await service.member(member)).links[0];
    let inserted, release;
    const reachedInsert = new Promise((r) => {
        inserted = r;
      }),
      allowInsert = new Promise((r) => {
        release = r;
      });
    const testDb = {
      client: db.client,
      collection(name) {
        const c = db.collection(name);
        if (name !== 'trainer_assignments') return c;
        return new Proxy(c, {
          get(target, key) {
            if (key === 'insertOne')
              return async (...args) => {
                inserted();
                await allowInsert;
                return target.insertOne(...args);
              };
            const value = target[key];
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      },
    };
    const assigning = createTrainerService({ db: testDb }).assign(trainer, {
      user_id: member.user_id,
      template_id: template.template_id,
    });
    await reachedInsert;
    const ending = service.end(member, link.link_id);
    // Give revocation time to reach its conflicting write while the assignment is paused.
    await Promise.race([ending, new Promise((r) => setTimeout(r, 100))]);
    release();
    await Promise.all([assigning, ending]);
    assert.equal((await db.collection('trainer_links').findOne({ link_id: link.link_id })).status, 'ended');
    assert.equal(
      await db
        .collection('trainer_assignments')
        .countDocuments({ trainer_id: trainer.user_id, user_id: member.user_id, status: 'assigned' }),
      0,
    );
    await service.accept(member, { code: (await service.invite(trainer)).invite_code });
    const next = (await service.member(member)).links[0];
    const ends = await Promise.allSettled([
      service.end(member, next.link_id),
      service.end(trainer, next.link_id),
    ]);
    assert.equal(ends.filter((x) => x.status === 'fulfilled').length, 1);
    assert.equal(ends.find((x) => x.status === 'rejected').reason.httpStatus, 404);
    server = require('../app')
      .createApp({ db, logger: { error() {} } })
      .listen(0, '127.0.0.1');
    await require('node:events').once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port;
    async function status(path, token) {
      const r = await fetch(base + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
      await r.text();
      return r.status;
    }
    assert.equal(await status('/api/trainer/templates'), 401);
    assert.equal(await status('/api/trainer/templates', member.token), 403);
    assert.equal(await status('/api/trainer/templates', admin.token), 403);
    assert.equal(await status('/api/trainer/templates', trainer.token), 200);
    assert.equal(await status('/api/trainer-links', trainer.token), 403);
    assert.equal(await status('/api/trainer-links', member.token), 200);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await client.close();
    await replica.stop();
  }
});
