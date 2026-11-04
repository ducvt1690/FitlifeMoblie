'use strict';

const { HttpError } = require('../utils/http-error');
const fail = (status, message) => new HttpError(status, message);
const MAX_LIMIT = 100;

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function parseLimit(value) {
  if (value === undefined) return 25;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw fail(400, 'limit phải là số nguyên từ 1 đến 100.');
  return limit;
}

function cleanFilter(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > 100) throw fail(400, `${field} không hợp lệ.`);
  return value.trim().toLowerCase();
}

function cleanCursor(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 100) throw fail(400, 'after không hợp lệ.');
  return value.trim();
}

function createExerciseService({ db }) {
  return {
    async list(query = {}) {
      const limit = parseLimit(query.limit);
      // Source IDs are case-sensitive; do not lowercase the cursor.
      const after = query.after === undefined ? undefined : cleanCursor(query.after);
      const q = cleanFilter(query.q, 'q');
      const bodyPart = cleanFilter(query.body_part, 'body_part');
      const equipment = cleanFilter(query.equipment, 'equipment');
      const targetMuscle = cleanFilter(query.target_muscle, 'target_muscle');
      const filter = { source: 'exercisedb_v1', is_active: true };
      if (after) filter.source_exercise_id = { $gt: after };
      if (bodyPart) filter.body_parts = bodyPart;
      if (equipment) filter.equipments = equipment;
      if (targetMuscle) filter.target_muscles = targetMuscle;
      if (q) {
        const regex = new RegExp(escapeRegex(q), 'i');
        filter.$or = [{ name: regex }, { body_parts: regex }, { equipments: regex }, { target_muscles: regex }];
      }
      const rows = await db.collection('exercises').find(filter, { projection: { _id: 0 } })
        .sort({ source_exercise_id: 1 }).limit(limit + 1).toArray();
      const hasNextPage = rows.length > limit;
      if (hasNextPage) rows.pop();
      return { success: true, data: rows.map(row => ({ ...row,
        display_name: row.name_vi || row.name,
        display_body_parts: row.body_parts_vi?.length ? row.body_parts_vi : row.body_parts,
        display_equipments: row.equipments_vi?.length ? row.equipments_vi : row.equipments,
        display_target_muscles: row.target_muscles_vi?.length ? row.target_muscles_vi : row.target_muscles,
        display_secondary_muscles: row.secondary_muscles_vi?.length ? row.secondary_muscles_vi : row.secondary_muscles,
        display_instructions: row.instructions_vi?.length ? row.instructions_vi : row.instructions,
      })),
        meta: { limit, hasNextPage, nextAfter: hasNextPage ? rows.at(-1)?.source_exercise_id : null } };
    },

    async get(exerciseId) {
      if (typeof exerciseId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(exerciseId)) {
        throw fail(400, 'exerciseId không hợp lệ.');
      }
      const row = await db.collection('exercises').findOne({ exercise_id: exerciseId, is_active: true }, { projection: { _id: 0 } });
      if (!row) throw fail(404, 'Không tìm thấy bài tập.');
      return { success: true, exercise: { ...row,
        display_name: row.name_vi || row.name,
        display_body_parts: row.body_parts_vi?.length ? row.body_parts_vi : row.body_parts,
        display_equipments: row.equipments_vi?.length ? row.equipments_vi : row.equipments,
        display_target_muscles: row.target_muscles_vi?.length ? row.target_muscles_vi : row.target_muscles,
        display_secondary_muscles: row.secondary_muscles_vi?.length ? row.secondary_muscles_vi : row.secondary_muscles,
        display_instructions: row.instructions_vi?.length ? row.instructions_vi : row.instructions,
      } };
    },
  };
}

module.exports = { createExerciseService };
