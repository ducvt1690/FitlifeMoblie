'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { before, after, test } = require('node:test');
const { MongoClient } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { initializeDatabase } = require('../database/mongodb/database');
const { initializeAuthSessions } = require('../database/connection');
const { normalizeExercise } = require('../database/mongodb/scripts/import-exercisedb-v1');
const { CACHE_PATH, prepareDemoExercises } = require('../scripts/prepare-demo-exercises');
const { createAuthService } = require('../services/auth.service');
const { createWorkoutPlanService } = require('../services/workout-plan.service');
const verifiedRegistration = require('./verified-registration');

let replica, client, catalog;
before(async () => {
  catalog = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
}, { timeout: 240000 });
after(async () => { if (client) await client.close(); if (replica) await replica.stop(); });

async function database() {
  const db = client.db('fitlife_demo_catalog_' + randomUUID().replaceAll('-', ''));
  await initializeDatabase(db);
  await initializeAuthSessions(db);
  return db;
}

function fixture(sourceId, now = new Date()) {
  return { ...normalizeExercise(catalog.exercises[0], now), source_exercise_id: sourceId,
    exercise_id: randomUUID(), created_at: now };
}

test('demo cache upserts 30 real records, preserves references and unrelated rows, and is idempotent', async () => {
  const db = await database();
  const oldDate = new Date('2020-01-01T00:00:00Z');
  const first = { ...normalizeExercise(catalog.exercises[0], oldDate), exercise_id: randomUUID(), created_at: oldDate };
  const qa = ['QA0', 'QA1', 'QA2'].map(id => fixture(id));
  const other = fixture('other-catalog-item');
  await db.collection('exercises').insertMany([first, ...qa, other]);
  const originalId = first.exercise_id;
  const report = await prepareDemoExercises(db);
  assert.equal(report.selected, 30);
  assert.equal(report.inserted, 29);
  assert.equal(report.deactivatedFixtures, 3);
  assert.ok(Object.values(report.coverage).every(count => count > 0));
  const kept = await db.collection('exercises').findOne({ exercise_id: originalId });
  assert.deepEqual(kept.created_at, oldDate);
  assert.equal(kept.source_exercise_id, first.source_exercise_id);
  assert.ok(kept.name_vi);
  assert.ok(kept.instructions_vi.length);
  assert.equal(await db.collection('exercises').countDocuments(), 34);
  for (const row of qa) {
    const saved = await db.collection('exercises').findOne({ exercise_id: row.exercise_id });
    assert.equal(saved.is_active, false);
    assert.equal(saved.gif_url, row.gif_url);
  }
  assert.equal((await db.collection('exercises').findOne({ exercise_id: other.exercise_id })).is_active, true);
  const ids = await db.collection('exercises').find().project({ _id: 0, exercise_id: 1, source_exercise_id: 1 }).sort({ source_exercise_id: 1 }).toArray();
  const repeated = await prepareDemoExercises(db);
  assert.equal(repeated.inserted, 0);
  assert.equal(repeated.deactivatedFixtures, 0);
  assert.deepEqual(await db.collection('exercises').find().project({ _id: 0, exercise_id: 1, source_exercise_id: 1 }).sort({ source_exercise_id: 1 }).toArray(), ids);
});

test('invalid cache cannot modify rows, deactivate fixtures or delete data', async () => {
  const db = await database();
  await db.collection('exercises').insertMany(['QA0', 'QA1', 'QA2'].map(id => fixture(id)));
  const original = await db.collection('exercises').find().sort({ source_exercise_id: 1 }).toArray();
  const clone = () => structuredClone(catalog);
  const invalid = [];
  let value = clone(); value.exercises.pop(); invalid.push(value);
  value = clone(); value.exercises[1] = structuredClone(value.exercises[0]); invalid.push(value);
  value = clone(); delete value.exercises.at(-1).gifUrl; invalid.push(value);
  value = clone(); value.exercises.at(-1).instructions = ['x'.repeat(2001)]; invalid.push(value);
  value = clone(); value.exercises.forEach(row => { row.bodyParts = ['chest']; row.targetMuscles = ['pectorals']; }); invalid.push(value);
  for (const bad of invalid) {
    await assert.rejects(prepareDemoExercises(db, { catalog: bad }));
    assert.deepEqual(await db.collection('exercises').find().sort({ source_exercise_id: 1 }).toArray(), original);
  }
});

test('real cached catalog supplies exercises for every exposed workout focus', async () => {
  const db = await database();
  await prepareDemoExercises(db);
  const registered = await createAuthService({ db }).register(await verifiedRegistration(db, {
    email: `${randomUUID()}@fitlife.example`, password: 'Demo-catalog-test-123', confirm_password: 'Demo-catalog-test-123',
    full_name: 'Catalog test', gender: 'male', age: 23, height: 170, weight: 65,
    activity_level: 'moderate', goal: 'maintain', timezone: 'Asia/Ho_Chi_Minh',
  }));
  const user = await db.collection('users').findOne({ user_id: registered.user.user_id });
  const now = new Date();
  await db.collection('memberships').insertOne({ user_id: user.user_id,
    premium_until: new Date(+now + 86400000), created_at: now, updated_at: now });
  const service = createWorkoutPlanService({ db });
  for (const split of service.options().splits) {
    for (const day of split.days) {
      const { plan } = await service.create(user, { split: split.value, focus: day.value, minutes: 30 });
      assert.ok(plan.items.length > 0, split.value + '/' + day.value);
      assert.ok(plan.items.every(item => !item.name.startsWith('QA ')), split.value + '/' + day.value);
    }
  }
});
