'use strict';
const { randomInt, randomUUID } = require('node:crypto');
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { isUuid } = require('../utils/validate');
const { rules, readFields } = require('../utils/fields');
const { withLiveTargets } = require('./session.service');
const { createStatsService } = require('./stats.service');
const fail = (status, message) => new HttpError(status, message);

const MAX_PENDING_INVITES = 10;
// No 0/O or 1/I so codes can be read aloud and typed without confusion.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newInviteCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const STUDENT_FIELDS = { _id: 0, user_id: 1, full_name: 1, email: 1, gender: 1, goal: 1, activity_level: 1 };

const templateSpec = {
  title: [rules.text(150), 'Tên giáo án cần 1–150 ký tự.'],
  category: [rules.text(50), 'Loại bài tập cần 1–50 ký tự.'],
  duration_seconds: [rules.int(60, 86400), 'Thời lượng phải từ 1 phút đến 24 giờ.'],
  calories_est: [rules.int(0, 10000), 'Calo ước tính phải từ 0 đến 10000.'],
  level: [rules.oneOf(...LEVELS), 'Mức độ phải là beginner, intermediate hoặc advanced.'],
  description: [rules.text(5000), 'Mô tả cần 1–5000 ký tự.'],
};

// Lock the trainer row so concurrent writes for the same trainer serialize, and refuse locked or demoted accounts.
async function lockTrainer(db, trainerId, session, now) {
  const trainer = await db.collection('users').findOneAndUpdate({ user_id: trainerId, role: 'trainer', is_active: true },
    { $set: { updated_at: now } }, { session, returnDocument: 'after' });
  if (!trainer) throw fail(403, 'Tài khoản huấn luyện viên không còn khả dụng.');
  return trainer;
}

// Ending a link always closes the open assignments of that pair, so access ends with it.
async function cancelOpenAssignments(db, filter, now, session) {
  return db.collection('trainer_assignments').updateMany({ ...filter, status: 'assigned' },
    { $set: { status: 'cancelled', updated_at: now } }, { session });
}

async function withNames(db, rows, field, as) {
  const ids = [...new Set(rows.map(row => row[field]).filter(Boolean))];
  const users = await db.collection('users').find({ user_id: { $in: ids } }, { projection: STUDENT_FIELDS }).toArray();
  const byId = new Map(users.map(user => [user.user_id, user]));
  return rows.map(row => ({ ...row, [as]: byId.get(row[field]) ?? null }));
}

async function withTemplates(db, rows) {
  const ids = [...new Set(rows.map(row => row.template_id))];
  const templates = await db.collection('workout_templates').find({ template_id: { $in: ids } }, { projection: { _id: 0 } }).toArray();
  const byId = new Map(templates.map(t => [t.template_id, t]));
  return rows.map(row => ({ ...row, template: byId.get(row.template_id) ?? null }));
}

function createTrainerService({ db }) {
  const stats = createStatsService({ db });
  const links = () => db.collection('trainer_links');
  const templates = () => db.collection('workout_templates');
  const assignments = () => db.collection('trainer_assignments');

  async function ownTemplate(trainerId, templateId, session) {
    if (!isUuid(templateId)) throw fail(400, 'template_id không hợp lệ.');
    const template = await templates().findOne({ template_id: templateId, trainer_id: trainerId }, { session, projection: { _id: 0 } });
    if (!template) throw fail(404, 'Không tìm thấy giáo án của bạn.');
    return template;
  }

  return {
    async overview(trainer) {
      const id = trainer.user_id;
      const [students, pending, activeTemplates, open, done] = await Promise.all([
        links().countDocuments({ trainer_id: id, status: 'active' }),
        links().countDocuments({ trainer_id: id, status: 'pending' }),
        templates().countDocuments({ trainer_id: id, is_active: true }),
        assignments().countDocuments({ trainer_id: id, status: 'assigned' }),
        assignments().countDocuments({ trainer_id: id, status: 'done' }),
      ]);
      return { success: true, counts: { students, pending_invites: pending, templates: activeTemplates, open_assignments: open, done_assignments: done } };
    },

    async listLinks(trainer) {
      const rows = await links().find({ trainer_id: trainer.user_id, status: { $in: ['pending', 'active'] } }, { projection: { _id: 0 } })
        .sort({ status: 1, created_at: -1 }).toArray();
      const open = await assignments().aggregate([
        { $match: { trainer_id: trainer.user_id, status: 'assigned' } },
        { $group: { _id: '$user_id', count: { $sum: 1 } } },
      ]).toArray();
      const openByUser = new Map(open.map(row => [row._id, row.count]));
      const named = await withNames(db, rows, 'user_id', 'student');
      return { success: true, links: named.map(link => ({ ...link, open_assignments: openByUser.get(link.user_id) ?? 0 })) };
    },

    async createInvite(trainer) {
      return transaction(db, async session => {
        const now = new Date();
        await lockTrainer(db, trainer.user_id, session, now);
        if (await links().countDocuments({ trainer_id: trainer.user_id, status: 'pending' }, { session }) >= MAX_PENDING_INVITES) {
          throw fail(409, `Bạn đang có ${MAX_PENDING_INVITES} mã mời chưa dùng. Hủy bớt trước khi tạo mã mới.`);
        }
        let code = newInviteCode();
        while (await links().findOne({ invite_code: code }, { session })) code = newInviteCode();
        const link = { link_id: randomUUID(), trainer_id: trainer.user_id, user_id: null, invite_code: code,
          status: 'pending', accepted_at: null, ended_at: null, created_at: now, updated_at: now };
        await links().insertOne(link, { session });
        delete link._id;
        return { success: true, message: `Mã mời: ${code}. Gửi mã này cho học viên để họ chấp nhận.`, link };
      });
    },

    async endLink(trainer, linkId) {
      if (!isUuid(linkId)) throw fail(400, 'link_id không hợp lệ.');
      return transaction(db, async session => {
        const now = new Date();
        await lockTrainer(db, trainer.user_id, session, now);
        const link = await links().findOne({ link_id: linkId, trainer_id: trainer.user_id, status: { $in: ['pending', 'active'] } }, { session });
        if (!link) throw fail(404, 'Không tìm thấy kết nối đang mở.');
        await links().updateOne({ link_id: linkId }, { $set: { status: 'ended', ended_at: now, updated_at: now } }, { session });
        const cancelled = link.user_id
          ? (await cancelOpenAssignments(db, { trainer_id: trainer.user_id, user_id: link.user_id }, now, session)).modifiedCount : 0;
        return { success: true, message: link.status === 'pending' ? 'Đã hủy mã mời.' : 'Đã kết thúc kết nối với học viên.', cancelled_assignments: cancelled };
      });
    },

    async listTemplates(trainer) {
      const rows = await templates().find({ trainer_id: trainer.user_id }, { projection: { _id: 0 } }).sort({ is_active: -1, updated_at: -1 }).toArray();
      return { success: true, templates: rows };
    },

    async createTemplate(trainer, body) {
      const { template_id: templateId, ...rest } = body ?? {};
      if (!isUuid(templateId)) throw fail(400, 'Cần template_id UUID.');
      const input = readFields(rest, templateSpec);
      return transaction(db, async session => {
        const now = new Date();
        await lockTrainer(db, trainer.user_id, session, now);
        const existing = await templates().findOne({ template_id: templateId }, { session, projection: { _id: 0 } });
        if (existing) {
          if (existing.trainer_id !== trainer.user_id) throw fail(409, 'template_id đã được sử dụng.');
          return { success: true, replayed: true, template: existing };
        }
        const template = { template_id: templateId, trainer_id: trainer.user_id, ...input, is_active: true, created_at: now, updated_at: now };
        await templates().insertOne(template, { session });
        delete template._id;
        return { success: true, replayed: false, message: 'Đã tạo giáo án.', template };
      });
    },

    async updateTemplate(trainer, templateId, body) {
      const changes = readFields(body, { ...templateSpec, is_active: [rules.bool(), 'is_active phải là true/false.'] }, { partial: true });
      return transaction(db, async session => {
        const now = new Date();
        await lockTrainer(db, trainer.user_id, session, now);
        await ownTemplate(trainer.user_id, templateId, session);
        const template = await templates().findOneAndUpdate({ template_id: templateId }, { $set: { ...changes, updated_at: now } },
          { session, returnDocument: 'after', projection: { _id: 0 } });
        return { success: true, message: 'Đã cập nhật giáo án.', template };
      });
    },

    async listAssignments(trainer, status) {
      if (status !== undefined && !['assigned', 'done', 'cancelled'].includes(status)) throw fail(400, 'status không hợp lệ.');
      const rows = await assignments().find({ trainer_id: trainer.user_id, ...(status ? { status } : {}) }, { projection: { _id: 0 } })
        .sort({ assigned_at: -1 }).limit(200).toArray();
      return { success: true, assignments: await withNames(db, await withTemplates(db, rows), 'user_id', 'student') };
    },

    // Only members who accepted this trainer's invite can receive work; the retry key is the assignment id.
    async assign(trainer, body) {
      const input = readFields(body, {
        id: [rules.uuid(), 'Cần id UUID cho bài giao.'],
        user_id: [rules.text(128), 'Cần user_id của học viên.'],
        template_id: [rules.uuid(), 'Cần template_id UUID.'],
        note: [rules.note(2000), 'Ghi chú tối đa 2000 ký tự.'],
      });
      return transaction(db, async session => {
        const now = new Date();
        await lockTrainer(db, trainer.user_id, session, now);
        const existing = await assignments().findOne({ id: input.id }, { session, projection: { _id: 0 } });
        if (existing) {
          if (existing.trainer_id !== trainer.user_id || existing.user_id !== input.user_id || existing.template_id !== input.template_id) {
            throw fail(409, 'id đã được sử dụng cho bài giao khác.');
          }
          return { success: true, replayed: true, assignment: existing };
        }
        if (!await links().findOne({ trainer_id: trainer.user_id, user_id: input.user_id, status: 'active' }, { session })) {
          throw fail(403, 'Học viên chưa chấp nhận kết nối với bạn.');
        }
        if (!await db.collection('users').findOne({ user_id: input.user_id, role: 'user', is_active: true }, { session })) {
          throw fail(409, 'Tài khoản học viên không còn hoạt động.');
        }
        const template = await ownTemplate(trainer.user_id, input.template_id, session);
        if (!template.is_active) throw fail(409, 'Giáo án đã ngừng sử dụng.');
        if (await assignments().findOne({ trainer_id: trainer.user_id, user_id: input.user_id, template_id: input.template_id, status: 'assigned' }, { session })) {
          throw fail(409, 'Học viên đang có bài này chưa hoàn thành.');
        }
        const assignment = { ...input, trainer_id: trainer.user_id, assigned_at: now, status: 'assigned', done_at: null, created_at: now, updated_at: now };
        await assignments().insertOne(assignment, { session });
        delete assignment._id;
        return { success: true, replayed: false, message: `Đã giao "${template.title}".`, assignment };
      });
    },

    async cancelAssignment(trainer, id) {
      if (!isUuid(id)) throw fail(400, 'id không hợp lệ.');
      return transaction(db, async session => {
        const now = new Date();
        await lockTrainer(db, trainer.user_id, session, now);
        const assignment = await assignments().findOneAndUpdate({ id, trainer_id: trainer.user_id, status: 'assigned' },
          { $set: { status: 'cancelled', updated_at: now } }, { session, returnDocument: 'after', projection: { _id: 0 } });
        if (!assignment) throw fail(404, 'Không tìm thấy bài đang giao.');
        return { success: true, message: 'Đã hủy bài giao.', assignment };
      });
    },

    // Health data is shared only while the link is active and at least one assignment is still open.
    async student(trainer, userId, days) {
      if (typeof userId !== 'string' || !userId || userId.length > 128) throw fail(400, 'user_id không hợp lệ.');
      const link = await links().findOne({ trainer_id: trainer.user_id, user_id: userId, status: 'active' }, { projection: { _id: 0 } });
      if (!link) throw fail(403, 'Bạn không có quyền xem học viên này.');
      const stored = await db.collection('users').findOne({ user_id: userId, role: 'user', is_active: true }, { projection: { password_hash: 0 } });
      if (!stored) throw fail(404, 'Tài khoản học viên không còn hoạt động.');
      const history = await assignments().find({ trainer_id: trainer.user_id, user_id: userId }, { projection: { _id: 0 } })
        .sort({ assigned_at: -1 }).limit(100).toArray();
      const student = { user_id: stored.user_id, full_name: stored.full_name, email: stored.email, goal: stored.goal };
      const result = { success: true, link, student, assignments: await withTemplates(db, history), health: null };
      if (!history.some(row => row.status === 'assigned')) return result;
      const user = await withLiveTargets(db, stored);
      const summary = await stats.summary(user, days);
      result.health = { gender: user.gender, age: user.age, height: user.height, weight: user.weight,
        activity_level: user.activity_level, target_water: user.target_water, target_calories: user.target_calories,
        streak_days: summary.streak_days, today: summary.today, days: summary.days };
      return result;
    },
  };
}
module.exports = { createTrainerService, cancelOpenAssignments, withNames, withTemplates };
