'use strict';

const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { MongoClient } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { initializeDatabase } = require('../database');
const { importExercises, normalizeExercise } = require('../scripts/import-exercisedb-v1');

let replica;
let client;

before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = new MongoClient(replica.getUri());
  await client.connect();
}, { timeout: 240000 });

after(async () => { if (client) await client.close(); if (replica) await replica.stop(); });

function page(after) {
  const rows = [
    { exerciseId: '01qpYSe', name: 'upward facing dog', gifUrl: 'https://static.exercisedb.dev/media/01qpYSe.gif',
      bodyParts: ['back'], equipments: ['bodyweight'], targetMuscles: ['erector spinae'], secondaryMuscles: ['deltoids'], instructions: ['Step:1 Move.'] },
    { exerciseId: '03lzqwk', name: 'assisted hanging knee raise', gifUrl: 'https://static.exercisedb.dev/media/03lzqwk.gif',
      bodyParts: ['waist'], equipments: ['assisted'], targetMuscles: ['abdominals'], secondaryMuscles: ['hip flexors'], instructions: [] },
    { exerciseId: '05Cf2v8', name: 'impossible dips', gifUrl: 'https://static.exercisedb.dev/media/05Cf2v8.gif',
      bodyParts: ['chest'], equipments: ['bodyweight'], targetMuscles: ['pectorals'], secondaryMuscles: [], instructions: ['Step:1 Lower.'] },
  ];
  return after ? { success: true, meta: { total: 3, hasNextPage: false, hasPreviousPage: true, previousCursor: '03lzqwk' }, data: [rows[2]] }
    : { success: true, meta: { total: 3, hasNextPage: true, hasPreviousPage: false, nextCursor: '03lzqwk' }, data: rows.slice(0, 2) };
}

test('ExerciseDB importer follows after cursors and upserts without duplicating source records', async () => {
  const db = client.db(`exercise_import_${Date.now()}`);
  await initializeDatabase(db);
  const logs = [];
  const fakeFetch = async url => ({ ok: true, async json() {
    return page(new URL(url).searchParams.get('after'));
  } });
  const first = await importExercises(db, { fetchImpl: fakeFetch, selectedIds: null, throttleMs: 0,
    now: new Date('2026-10-30T00:00:00Z'), logger: { info: value => logs.push(value) } });
  assert.deepEqual(first, { source: 'exercisedb_v1', pages: 2, fetched: 3, selected: 3, expectedTotal: 3, stored: 3 });
  assert.equal(logs.length, 2);
  const original = await db.collection('exercises').findOne({ source_exercise_id: '01qpYSe' });
  assert.equal(original.name, 'upward facing dog');
  assert.equal(original.gif_url.endsWith('.gif'), true);
  assert.equal(original.created_at.toISOString(), '2026-10-30T00:00:00.000Z');
  const second = await importExercises(db, { fetchImpl: fakeFetch, selectedIds: null, throttleMs: 0,
    now: new Date('2026-10-31T00:00:00Z'), logger: { info() {} } });
  assert.equal(second.stored, 3);
  assert.equal(await db.collection('exercises').countDocuments(), 3);
  const retried = await db.collection('exercises').findOne({ source_exercise_id: '01qpYSe' });
  assert.equal(retried.exercise_id, original.exercise_id);
  assert.equal(retried.created_at.toISOString(), original.created_at.toISOString());
  assert.equal(retried.synced_at.toISOString(), '2026-10-31T00:00:00.000Z');
  await db.dropDatabase();
});

test('ExerciseDB normalization strips invalid array entries and rejects missing media identity', () => {
  const normalized = normalizeExercise({ exerciseId: 'abc', name: '  Squat ', gifUrl: ' https://example.test/a.gif ',
    bodyParts: [' legs ', null, 1], equipments: [], targetMuscles: ['quadriceps'], secondaryMuscles: [], instructions: [' Step:1 '] }, new Date('2026-10-30T00:00:00Z'));
  assert.deepEqual(normalized.body_parts, ['legs']);
  assert.equal(normalized.name, 'Squat');
  assert.equal(normalized.gif_url, 'https://example.test/a.gif');
  assert.throws(() => normalizeExercise({ exerciseId: 'missing-name', gifUrl: 'x' }), /missing identity or media/);
});
