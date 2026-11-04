'use strict';
// Grows the exercise catalog from ExerciseDB v1 with a balanced, gym-focused selection, and has the AI write
// Vietnamese names, a short description, steps and "feel the muscle" tips for every exercise (old ones included).
// Usage: node scripts/expand-exercises.js [catalog.json] — the optional file is a saved copy of the ExerciseDB list.
// Progress is saved next to this script's working dir in .expand-exercises.json so a rerun resumes.
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const { aiConfig, complete } = require('../services/ai.client');
const { definition } = require('../database/mongodb/exercise-catalog');

const API_URL = 'https://oss.exercisedb.dev/api/v1/exercises';
const QUOTA = { back: 40, chest: 35, shoulders: 35, 'upper arms': 45, 'upper legs': 50, 'lower legs': 12, waist: 35, cardio: 15, 'lower arms': 8 };
const EQUIPMENT_RANK = ['barbell', 'dumbbell', 'cable', 'bodyweight', 'leverage machine', 'smith machine', 'EZ bar', 'kettlebell', 'resistance band', 'weighted', 'assisted', 'sled machine', 'rope', 'medicine ball', 'stability ball'];
const NOISE = /\b(v\. ?\d|version|pov|female|male|\(.*\))/i;
const FAMOUS = new RegExp(['bench press', 'chest press', 'fly', 'push-?up', 'dip', 'crossover', 'pec deck', 'pullover', 'pull-?up', 'chin-?up',
  'pulldown', 'bent over row', 'seated row', 't-bar row', 'one arm row', 'cable row', 'deadlift', 'shrug', 'hyperextension', 'back extension',
  'face pull', 'shoulder press', 'overhead press', 'military press', 'arnold press', 'lateral raise', 'front raise', 'rear delt', 'upright row',
  'curl', 'hammer', 'triceps extension', 'pushdown', 'skull', 'kickback', 'close-grip bench', 'full squat', 'front squat', 'goblet squat',
  'hack squat', 'split squat', 'lunge', 'leg press', 'leg extension', 'leg curl', 'hip thrust', 'glute bridge', 'step-?up', 'good morning',
  'calf raise', 'crunch', 'plank', 'leg raise', 'sit-?up', 'russian twist', 'mountain climber', 'burpee', 'jumping jack', 'high knee', 'swing',
  'wood ?chop', 'farmer', 'jump rope', 'jump squat', 'box jump'].map(w => `\\b${w}`).join('|'), 'i');
const ODD = /yoga|pose|sphinx|frankenstein|stretch|guillotine|scapula|snatch|jerk|clean|zercher|jefferson|sissy|kneeling|on knees/i;
const BODY_VI = { back: 'Lưng', chest: 'Ngực', shoulders: 'Vai', 'upper legs': 'Đùi', 'lower legs': 'Bắp chân', waist: 'Bụng và eo',
  'upper arms': 'Bắp tay', 'lower arms': 'Cẳng tay', cardio: 'Cardio', neck: 'Cổ' };
const EQUIPMENT_VI = { bodyweight: 'Trọng lượng cơ thể', barbell: 'Tạ đòn', dumbbell: 'Tạ đơn', cable: 'Cáp', 'leverage machine': 'Máy tập',
  'smith machine': 'Máy Smith', 'EZ bar': 'Thanh EZ', kettlebell: 'Tạ ấm', 'resistance band': 'Dây kháng lực', weighted: 'Tạ thêm',
  assisted: 'Máy hỗ trợ', 'sled machine': 'Máy đạp đùi', rope: 'Dây', 'medicine ball': 'Bóng tạ', 'stability ball': 'Bóng tập',
  roller: 'Con lăn', 'bosu ball': 'Bóng bosu', 'suspension trainer': 'Dây treo', 'ab wheel': 'Con lăn bụng', 'olympic barbell': 'Tạ đòn',
  'trap bar': 'Thanh trap', towel: 'Khăn', 'stationary bike': 'Xe đạp tập', 'elliptical machine': 'Máy elip', 'stepmill machine': 'Máy leo bậc',
  'ski ergometer': 'Máy trượt tuyết', 'upper body ergometer': 'Máy quay tay', hammer: 'Búa', tire: 'Lốp xe', 'tennis ball': 'Bóng tennis' };
const STATE = '.expand-exercises.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const short = list => (Array.isArray(list) ? list : []).filter(s => typeof s === 'string' && s.trim()).map(s => s.trim());

async function fetchCatalog() {
  const all = [];
  let after = null;
  do {
    const url = new URL(API_URL);
    url.searchParams.set('limit', '25');
    if (after) url.searchParams.set('after', after);
    let response;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.status !== 429) break;
      await sleep(5000 * (attempt + 1));
    }
    if (!response.ok) throw new Error(`ExerciseDB HTTP ${response.status}`);
    const page = await response.json();
    all.push(...page.data);
    after = page.meta?.hasNextPage ? page.meta.nextCursor : null;
    await sleep(700);
  } while (after);
  return all;
}

// Well-known gym lifts first, then common equipment and short plain names. Same-name variants are kept once,
// and no target muscle takes more than 70% of its body part so the list stays varied.
function select(catalog, existing, existingNames = new Set()) {
  const score = e => (FAMOUS.test(e.name) ? 0 : 100) + (ODD.test(e.name) ? 200 : 0) + (NOISE.test(e.name) ? 40 : 0)
    + (EQUIPMENT_RANK.indexOf(e.equipments[0]) + 1 || 40) * 2 + e.name.split(/[\s-]+/).length * 3;
  const key = e => e.name.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  const seen = new Set(existingNames);
  const picked = [];
  for (const [part, quota] of Object.entries(QUOTA)) {
    const rows = catalog.filter(e => e.bodyParts[0] === part && !existing.has(e.exerciseId) && EQUIPMENT_RANK.includes(e.equipments[0]))
      .sort((a, b) => score(a) - score(b));
    const perTarget = new Map();
    const cap = Math.max(4, Math.ceil(quota * 0.7));
    let take = 0;
    for (const e of rows) {
      if (take >= quota) break;
      const target = e.targetMuscles[0];
      if (seen.has(key(e)) || (perTarget.get(target) ?? 0) >= cap) continue;
      seen.add(key(e));
      perTarget.set(target, (perTarget.get(target) ?? 0) + 1);
      picked.push(e);
      take += 1;
    }
  }
  return picked;
}

async function liveGif(url) {
  try { return (await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) })).ok; } catch { return false; }
}

async function pool(items, size, fn) {
  const out = [];
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

const SYSTEM = `Bạn là huấn luyện viên thể hình người Việt. Với mỗi bài tập (tiếng Anh), viết nội dung tiếng Việt tự nhiên, chính xác, ngắn gọn.
Trả về JSON {"items":[{"i":0,"name_vi":"tên bài","description_vi":"1–2 câu: bài này tập gì, lợi ích chính","instructions_vi":["3–5 bước ngắn"],
"tips_vi":["2–3 mẹo để cảm nhận cơ đúng hoặc lỗi hay gặp, mỗi mẹo dưới 25 từ"],"target_muscles_vi":["..."],"secondary_muscles_vi":["..."]}]}.
Tên bài dùng cách gọi phổ biến ở phòng gym Việt Nam, giữ thuật ngữ quen thuộc (Squat, Deadlift, Plank, Lunge) khi người Việt vẫn dùng.
Muscle dịch theo thứ tự đầu vào. Không thêm chữ ngoài JSON.`;

async function localize(ai, batch) {
  const content = batch.map((e, i) => `${i}. ${e.name} | dụng cụ: ${e.equipments.join(', ')} | cơ chính: ${e.targetMuscles.join(', ')}`
    + ` | cơ phụ: ${e.secondaryMuscles.join(', ')} | cách làm: ${e.instructions.join(' ').replace(/Step:\d+ /g, '').slice(0, 500)}`).join('\n');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const out = await complete(ai, { system: SYSTEM, json: true, maxTokens: 9000, messages: [{ role: 'user', content }] });
      const rows = Array.isArray(out?.items) ? out.items : [];
      const result = {};
      for (const r of rows) {
        const e = batch[r?.i];
        if (!e || typeof r.name_vi !== 'string' || !r.name_vi.trim() || typeof r.description_vi !== 'string') continue;
        result[e.exerciseId] = { name_vi: r.name_vi.trim().slice(0, 200), description_vi: r.description_vi.trim().slice(0, 600),
          instructions_vi: short(r.instructions_vi).slice(0, 8), tips_vi: short(r.tips_vi).slice(0, 4).map(t => t.slice(0, 500)),
          target_muscles_vi: short(r.target_muscles_vi).slice(0, 20), secondary_muscles_vi: short(r.secondary_muscles_vi).slice(0, 20) };
      }
      if (Object.keys(result).length >= batch.length * 0.8) return result;
    } catch (error) {
      console.warn(`  batch retry ${attempt + 1}: ${error.name}`);
    }
    await sleep(3000);
  }
  return {};
}

async function main() {
  const env = dotenv.parse(fs.readFileSync('.env'));
  const ai = aiConfig(env);
  if (!ai.apiKey) throw new Error('Cần AI_API_KEY trong .env.');
  const catalog = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : await fetchCatalog();
  const client = await MongoClient.connect(env.MONGODB_URI);
  try {
    const db = client.db(env.MONGODB_DB_NAME);
    const col = db.collection('exercises');
    await db.command({ collMod: 'exercises', validator: definition.validator,
      validationLevel: definition.validationLevel, validationAction: definition.validationAction });

    const current = await col.find({}, { projection: { _id: 0, source_exercise_id: 1, gif_url: 1, description_vi: 1 } }).toArray();
    const existing = new Set(current.map(e => e.source_exercise_id));
    const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { vi: {} };

    // Old exercises whose GIF is gone at the source stop being offered.
    const dead = (await pool(current, 10, async e => ((await liveGif(e.gif_url)) ? null : e.source_exercise_id))).filter(Boolean);
    if (dead.length) await col.updateMany({ source_exercise_id: { $in: dead } }, { $set: { is_active: false, updated_at: new Date() } });
    console.log(`existing ${current.length}, dead GIFs deactivated: ${dead.length}`);

    const candidates = select(catalog, existing);
    const alive = (await pool(candidates, 10, async e => ((await liveGif(e.gifUrl)) ? e : null))).filter(Boolean);
    console.log(`selected ${candidates.length}, with live GIF ${alive.length}`);

    const byId = new Map(catalog.map(e => [e.exerciseId, e]));
    const needText = [...current.filter(e => !e.description_vi && !dead.includes(e.source_exercise_id)).map(e => byId.get(e.source_exercise_id)).filter(Boolean), ...alive]
      .filter(e => !state.vi[e.exerciseId]);
    const batches = [];
    for (let i = 0; i < needText.length; i += 12) batches.push(needText.slice(i, i + 12));
    let doneBatches = 0;
    await pool(batches, 3, async batch => {
      Object.assign(state.vi, await localize(ai, batch));
      fs.writeFileSync(STATE, JSON.stringify(state));
      console.log(`  AI ${++doneBatches}/${batches.length}`);
    });

    const now = new Date();
    let updated = 0;
    for (const e of current) {
      const vi = state.vi[e.source_exercise_id];
      if (!vi || e.description_vi) continue;
      await col.updateOne({ source_exercise_id: e.source_exercise_id }, { $set: { description_vi: vi.description_vi, tips_vi: vi.tips_vi, updated_at: now } });
      updated += 1;
    }
    const docs = alive.filter(e => state.vi[e.exerciseId]).map(e => ({
      exercise_id: randomUUID(), source: 'exercisedb_v1', source_exercise_id: e.exerciseId, name: e.name.trim(), gif_url: e.gifUrl,
      body_parts: e.bodyParts, equipments: e.equipments, target_muscles: e.targetMuscles, secondary_muscles: e.secondaryMuscles,
      instructions: e.instructions, ...state.vi[e.exerciseId],
      body_parts_vi: e.bodyParts.map(b => BODY_VI[b] ?? b), equipments_vi: e.equipments.map(q => EQUIPMENT_VI[q] ?? q),
      is_active: true, synced_at: now, created_at: now, updated_at: now,
    }));
    if (docs.length) await col.bulkWrite(docs.map(d => ({ updateOne: { filter: { source: d.source, source_exercise_id: d.source_exercise_id },
      update: { $setOnInsert: d }, upsert: true } })), { ordered: false });
    console.log(`old exercises described: ${updated}, new exercises: ${docs.length}, active now: ${await col.countDocuments({ is_active: true })}`);
  } finally {
    await client.close();
  }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { select };
