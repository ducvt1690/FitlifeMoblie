'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadEnvFile } = require('node:process');
const { randomUUID } = require('node:crypto');
const { MongoClient } = require('mongodb');
const { ensureExerciseCollection } = require('../exercise-catalog');

const API_URL = 'https://oss.exercisedb.dev/api/v1/exercises';
const PAGE_SIZE = 25;
const DEFAULT_THROTTLE_MS = 800;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Curated starter catalog for FitLife. The source still reports 1,500 records,
// but only these 30 are kept in the application collection.
const POPULAR_SOURCE_IDS = [
  'I4hDWkc', 'lBDjFxJ', 'iYzB0Cz', 'ila4NZS', 'EIeI8Vf', 'A6wtbuL', '3s4NnTh', '1TVoin7',
  'IZVHb27', 'RRWFUcw', '10Z2DXU', '17lJ1kr', '6HmFgmx', 'u0cNiij', 'Pjbc0Kt', 'CosupLu',
  '5VXmnV5', '1ZFqTDN', 'Bn6TXyO', 'XVDdcoj', '4Ml7QFO', 'RJgzwny', 'dK9394r', 'e1e76I2',
  'UVo2Qs2', 'LEprlgG', 'A3P4O0R', '0CXGHya', '0mB6wHO', '01qpYSe',
];

function cleanArray(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim())
    .map(item => item.trim()) : [];
}

function normalizeExercise(row, now) {
  if (!row || typeof row !== 'object' || typeof row.exerciseId !== 'string'
    || typeof row.name !== 'string' || typeof row.gifUrl !== 'string') {
    throw new Error('ExerciseDB returned an exercise with missing identity or media.');
  }
  return {
    source: 'exercisedb_v1',
    source_exercise_id: row.exerciseId,
    name: row.name.trim(),
    gif_url: row.gifUrl.trim(),
    body_parts: cleanArray(row.bodyParts),
    equipments: cleanArray(row.equipments),
    target_muscles: cleanArray(row.targetMuscles),
    secondary_muscles: cleanArray(row.secondaryMuscles),
    instructions: cleanArray(row.instructions),
    is_active: true,
    synced_at: now,
    updated_at: now,
  };
}

async function fetchPage(fetchImpl, after, { sleepImpl = sleep } = {}) {
  const url = new URL(API_URL);
  url.searchParams.set('limit', String(PAGE_SIZE));
  if (after) url.searchParams.set('after', after);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (response.status === 429) {
      const retryAfter = Number(response.headers?.get?.('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000 * (attempt + 1);
      await sleepImpl(Math.min(waitMs, 60000));
      continue;
    }
    if (!response.ok) throw new Error(`ExerciseDB request failed with HTTP ${response.status}.`);
    const payload = await response.json();
    if (!payload?.success || !Array.isArray(payload.data) || !payload.meta) {
      throw new Error('ExerciseDB returned an invalid page.');
    }
    return payload;
  }
  throw new Error('ExerciseDB rate limit persisted after retries.');
}

async function importExercises(db, { fetchImpl = fetch, now = new Date(), logger = console,
  throttleMs = DEFAULT_THROTTLE_MS, sleepImpl = sleep, selectedIds = POPULAR_SOURCE_IDS } = {}) {
  await ensureExerciseCollection(db);
  const collection = db.collection('exercises');
  const selected = selectedIds === null ? null : new Set(selectedIds);
  const seen = new Set();
  let after;
  let pages = 0;
  let fetched = 0;
  let imported = 0;
  let expectedTotal;
  for (;;) {
    if (pages && throttleMs > 0) await sleepImpl(throttleMs);
    const payload = await fetchPage(fetchImpl, after, { sleepImpl });
    pages += 1;
    expectedTotal = payload.meta.total;
    const rows = payload.data.map(row => normalizeExercise(row, now));
    if (!rows.length) break;
    fetched += rows.length;
    for (const row of rows) {
      if (seen.has(row.source_exercise_id)) throw new Error(`ExerciseDB repeated cursor at ${row.source_exercise_id}.`);
      seen.add(row.source_exercise_id);
    }
    const chosen = selected ? rows.filter(row => selected.has(row.source_exercise_id)) : rows;
    const operations = chosen.map(row => ({
      updateOne: {
        filter: { source: row.source, source_exercise_id: row.source_exercise_id },
        update: {
          $set: row,
          $setOnInsert: { exercise_id: randomUUID(), created_at: now },
        },
        upsert: true,
      },
    }));
    if (operations.length) await collection.bulkWrite(operations, { ordered: false });
    imported += chosen.length;
    logger.info?.(`ExerciseDB V1 import: fetched ${fetched}${expectedTotal ? `/${expectedTotal}` : ''}, selected ${imported}`);
    if (!payload.meta.hasNextPage) break;
    const next = payload.meta.nextCursor;
    if (typeof next !== 'string' || !next || next === after) throw new Error('ExerciseDB pagination cursor did not advance.');
    after = next;
  }
  if (selected) await collection.deleteMany({ source: 'exercisedb_v1', source_exercise_id: { $nin: [...selected] } });
  const count = await collection.countDocuments({ source: 'exercisedb_v1' });
  return { source: 'exercisedb_v1', pages, fetched, selected: imported, expectedTotal, stored: count };
}

async function main() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) loadEnvFile(envPath);
  const uri = process.env.MONGODB_URI;
  const name = process.env.MONGODB_DB_NAME;
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri) || /[<>]/.test(uri)) {
    throw new Error('Set a real MONGODB_URI in backend/database/mongodb/.env.');
  }
  if (name !== 'fitlife') throw new Error('MONGODB_DB_NAME must be fitlife.');
  const client = new MongoClient(uri, { appName: 'FitLifeExerciseDBV1Import', serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    await client.db(name).command({ ping: 1 });
    const report = await importExercises(client.db(name));
    console.log(JSON.stringify(report, null, 2));
  } finally { await client.close(); }
}

if (require.main === module) main().catch(error => {
  console.error(`ExerciseDB import failed (${error.name || 'Error'}): ${error.message}`);
  process.exitCode = 1;
});

module.exports = { API_URL, PAGE_SIZE, POPULAR_SOURCE_IDS, normalizeExercise, fetchPage, importExercises };
