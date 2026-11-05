'use strict';
const { randomUUID, randomBytes } = require('node:crypto');
const { HttpError } = require('../utils/http-error');
const { isPlainBody, isUuid, isText } = require('../utils/validate');
const { rules, readFields } = require('../utils/fields');
const { listQuery, pageRows } = require('../utils/list-query');
const { transaction } = require('../database/transaction');
const fail = (status, message) => new HttpError(status, message);
const TEMPLATE_FIELDS = ['title', 'category', 'duration_seconds', 'calories_est', 'level', 'description'];
const templateSpec = {
  title: [rules.text(150), 'Tên bài tập cần 1–150 ký tự.'], category: [rules.text(50), 'Nhóm bài tập cần 1–50 ký tự.'],
  duration_seconds: [rules.int(1, 21600), 'Thời lượng phải từ 1 đến 21600 giây.'],
  calories_est: [rules.int(0, 10000), 'Calo phải từ 0 đến 10000.'],
  level: [rules.oneOf('beginner', 'intermediate', 'advanced'), 'Độ khó không hợp lệ.'],
  description: [rules.text(5000), 'Hướng dẫn cần 1–5000 ký tự.'],
};
const snapshot = row => Object.fromEntries(TEMPLATE_FIELDS.map(k => [k, row[k]]));
const publicRow = row => { if (!row) return row; const { _id, ...rest } = row; return rest; };
// Serialize all trainer mutations with role changes and locks on the same user row.
async function lockTrainer(db, userId, session) {
  const trainer = await db.collection('users').findOneAndUpdate({ user_id: userId, role: 'trainer', is_active: true },
    [{ $set: { updated_at: { $add: ['$updated_at', 1] } } }], { session, returnDocument: 'after' });
  if (!trainer) throw fail(403, 'Huấn luyện viên không còn khả dụng.');
  return trainer;
}
async function cancelPending(db, filter, reason, now, session, actor) {
  return db.collection('trainer_assignments').updateMany({ ...filter, status: 'assigned' }, {
    $set: { status: 'cancelled', cancelled_at: now, cancel_reason: reason, updated_at: now },
    $push: { status_history: { status: 'cancelled', at: now, actor_id: actor, reason } },
  }, { session });
}
function createTrainerService({ db }) {
  const c = name => db.collection(name);
  async function enriched(rows) {
    const [templates, people] = await Promise.all([
      c('workout_templates').find({ template_id: { $in: rows.map(a => a.template_id) } }).toArray(),
      c('users').find({ user_id: { $in: rows.flatMap(a => [a.trainer_id, a.user_id]) } }, { projection: { user_id: 1, full_name: 1 } }).toArray(),
    ]);
    return rows.map(a => ({ ...a, template: a.template_snapshot || publicRow(templates.find(t => t.template_id === a.template_id)),
      trainer_name: people.find(t => t.user_id === a.trainer_id)?.full_name || '',
      student_name: people.find(t => t.user_id === a.user_id)?.full_name || '' }));
  }
  async function activeLink(trainerId, memberId, session) {
    const link = await c('trainer_links').findOneAndUpdate({ trainer_id: trainerId, user_id: memberId, status: 'active' },
      [{ $set: { updated_at: { $add: ['$updated_at', 1] } } }], { session, returnDocument: 'after' });
    if (!link) throw fail(403, 'Học viên chưa đồng ý kết nối hoặc kết nối đã kết thúc.');
    return link;
  }
  const service = {
    async templates(user, query = {}) {
      const p = listQuery(query);
      const filter = { trainer_id: user.user_id };
      if (p.regex) filter.$or = [{ title: p.regex }, { category: p.regex }, { description: p.regex }];
      if (query.status) {
        if (!['active', 'archived', 'inactive'].includes(query.status)) throw fail(400, 'status phải là active hoặc archived.');
        filter.is_active = query.status === 'active';
      }
      if (query.level) { if (!['beginner', 'intermediate', 'advanced'].includes(query.level)) throw fail(400, 'level không hợp lệ.'); filter.level = query.level; }
      return pageRows(c('workout_templates'), 'templates', filter, query);
    },
    async createTemplate(user, body) {
      const fields = readFields(body, templateSpec);
      return transaction(db, async session => {
        await lockTrainer(db, user.user_id, session);
        const now = new Date(), row = { ...fields, template_id: randomUUID(), trainer_id: user.user_id, is_active: true, created_at: now, updated_at: now };
        await c('workout_templates').insertOne(row, { session });
        return { template: publicRow(row) };
      });
    },
    async updateTemplate(user, id, body) {
      if (!isUuid(id)) throw fail(400, 'Mã bài tập không hợp lệ.');
      const fields = readFields(body, { ...templateSpec, is_active: [rules.bool(), 'is_active phải là true/false.'] }, { partial: true });
      return transaction(db, async session => {
        await lockTrainer(db, user.user_id, session);
        const before = await c('workout_templates').findOne({ template_id: id, trainer_id: user.user_id }, { session });
        if (!before) throw fail(404, 'Không tìm thấy bài tập.');
        // Freeze legacy assignment content before the first edit; new assignments always carry a snapshot.
        await c('trainer_assignments').updateMany({ template_id: id, template_snapshot: { $exists: false } }, { $set: { template_snapshot: snapshot(before) } }, { session });
        const row = await c('workout_templates').findOneAndUpdate({ template_id: id, trainer_id: user.user_id }, { $set: { ...fields, updated_at: new Date() } }, { session, returnDocument: 'after', projection: { _id: 0 } });
        return { template: row };
      });
    },
    async deleteTemplate(user, id) {
      if (!isUuid(id)) throw fail(400, 'Mã bài tập không hợp lệ.');
      return transaction(db, async session => {
        await lockTrainer(db, user.user_id, session);
        const row = await c('workout_templates').findOne({ template_id: id, trainer_id: user.user_id }, { session });
        if (!row) throw fail(404, 'Không tìm thấy bài tập.');
        if (await c('trainer_assignments').countDocuments({ template_id: id }, { session, limit: 1 })) {
          await c('workout_templates').updateOne({ template_id: id }, { $set: { is_active: false, updated_at: new Date() } }, { session });
          return { success: true, archived: true, message: 'Đã lưu trữ mẫu; lịch sử bài giao được giữ nguyên.' };
        }
        await c('workout_templates').deleteOne({ template_id: id }, { session });
        return { success: true, archived: false, message: 'Đã xóa mẫu chưa được giao.' };
      });
    },
    async invite(user) {
      return transaction(db, async session => {
        await lockTrainer(db, user.user_id, session);
        const now = new Date(), row = { link_id: randomUUID(), trainer_id: user.user_id, user_id: null,
          invite_code: randomBytes(4).toString('hex').toUpperCase(), status: 'pending', accepted_at: null, ended_at: null, created_at: now, updated_at: now };
        await c('trainer_links').insertOne(row, { session });
        return { invite_code: row.invite_code, invite: { ...publicRow(row), expires_at: new Date(+now + 86400000) } };
      });
    },
    async invites(user, query = {}) {
      const p = listQuery(query), filter = { trainer_id: user.user_id };
      if (p.regex) filter.invite_code = p.regex;
      if (query.status) {
        if (!['pending', 'active', 'ended', 'expired'].includes(query.status)) throw fail(400, 'Trạng thái mã mời không hợp lệ.');
        const cutoff = new Date(Date.now() - 86400000);
        filter.status = query.status === 'expired' ? 'pending' : query.status;
        if (['expired', 'pending'].includes(query.status)) filter.created_at = query.status === 'expired' ? { $lte: cutoff } : { $gt: cutoff };
      }
      const result = await pageRows(c('trainer_links'), 'invites', filter, query);
      result.invites = result.invites.map(row => ({ ...row, expires_at: new Date(+row.created_at + 86400000),
        display_status: row.status === 'pending' && Date.now() - row.created_at >= 86400000 ? 'expired' : row.status }));
      return result;
    },
    async revokeInvite(user, id) {
      if (!isUuid(id)) throw fail(400, 'Mã mời không hợp lệ.');
      return transaction(db, async session => {
        await lockTrainer(db, user.user_id, session);
        const now = new Date();
        const row = await c('trainer_links').findOneAndUpdate({ trainer_id: user.user_id, link_id: id, status: 'pending' },
          { $set: { status: 'ended', ended_at: now, updated_at: now } }, { session });
        if (!row) throw fail(404, 'Không tìm thấy mã mời chưa sử dụng.');
        return { success: true };
      });
    },
    async accept(user, body) {
      if (!isPlainBody(body, ['code']) || typeof body.code !== 'string' || !/^\s*[A-Z0-9]{8}\s*$/i.test(body.code)) throw fail(400, 'Mã mời gồm 8 ký tự.');
      return transaction(db, async session => {
        const row = await c('trainer_links').findOne({ invite_code: body.code.trim().toUpperCase(), status: 'pending' }, { session });
        if (!row || Date.now() - row.created_at >= 86400000) throw fail(400, 'Mã mời không hợp lệ hoặc hết hạn.');
        const trainer = await lockTrainer(db, row.trainer_id, session);
        const member = await c('users').findOneAndUpdate({ user_id: user.user_id, role: 'user', is_active: true }, [{ $set: { updated_at: { $add: ['$updated_at', 1] } } }], { session });
        if (!member) throw fail(403, 'Tài khoản học viên không còn khả dụng.');
        if (await c('trainer_links').findOne({ trainer_id: row.trainer_id, user_id: user.user_id, status: 'active' }, { session })) throw fail(409, 'Bạn đã kết nối huấn luyện viên này.');
        const now = new Date();
        const changed = await c('trainer_links').updateOne({ link_id: row.link_id, status: 'pending' }, { $set: { user_id: user.user_id, status: 'active', accepted_at: now, updated_at: now } }, { session });
        if (!changed.modifiedCount) throw fail(409, 'Mã mời đã được sử dụng.');
        return { success: true, trainer_name: trainer.full_name };
      });
    },
    async students(user, query = {}) {
      const p = listQuery(query, ['created_at', 'full_name']);
      const filter = { trainer_id: user.user_id, status: 'active' };
      const pipeline = [{ $match: filter }, { $lookup: { from: 'users', localField: 'user_id', foreignField: 'user_id', as: 'student' } },
        { $unwind: '$student' }, { $match: { 'student.role': 'user', 'student.is_active': true } },
        { $project: { _id: 0, user_id: 1, link_id: 1, full_name: '$student.full_name', accepted_at: 1, created_at: 1 } },
        ...(p.regex ? [{ $match: { full_name: p.regex } }] : [])];
      const [result] = await c('trainer_links').aggregate([...pipeline, { $facet: {
        rows: [{ $sort: { ...p.sort, user_id: 1 } }, { $skip: p.skip }, { $limit: p.page_size }], count: [{ $count: 'total' }],
      } }]).toArray();
      return { students: result.rows, page: p.page, page_size: p.page_size, total: result.count[0]?.total || 0 };
    },
    async assignments(user, query = {}) {
      const p = listQuery(query, ['assigned_at', 'created_at']);
      const filter = { trainer_id: user.user_id };
      if (query.status) { if (!['assigned', 'done', 'cancelled'].includes(query.status)) throw fail(400, 'Trạng thái bài giao không hợp lệ.'); filter.status = query.status; }
      if (query.user_id) { if (!isUuid(query.user_id)) throw fail(400, 'user_id không hợp lệ.'); filter.user_id = query.user_id; }
      if (p.regex) filter.$or = [{ 'template_snapshot.title': p.regex }, { note: p.regex }];
      const result = await pageRows(c('trainer_assignments'), 'assignments', filter, query, ['assigned_at', 'created_at']);
      result.assignments = await enriched(result.assignments);
      return result;
    },
    async assign(user, body) {
      if (!isPlainBody(body, ['id', 'user_id', 'template_id', 'note']) || !isUuid(body.user_id) || !isUuid(body.template_id)
        || (body.id !== undefined && !isUuid(body.id)) || (body.note !== undefined && !isText(body.note, 2000, 0))) throw fail(400, 'Thông tin giao bài không hợp lệ.');
      const id = body.id || randomUUID(), note = (body.note || '').trim();
      return transaction(db, async session => {
        await lockTrainer(db, user.user_id, session);
        const link = await activeLink(user.user_id, body.user_id, session);
        const existing = await c('trainer_assignments').findOne({ id }, { session, projection: { _id: 0 } });
        if (existing) {
          if (existing.trainer_id !== user.user_id || existing.user_id !== body.user_id || existing.template_id !== body.template_id || existing.note !== note) throw fail(409, 'id đã được sử dụng cho yêu cầu khác.');
          return { assignment: existing, replayed: true };
        }
        const member = await c('users').findOne({ user_id: body.user_id, role: 'user', is_active: true }, { session });
        const template = await c('workout_templates').findOneAndUpdate({ trainer_id: user.user_id, template_id: body.template_id, is_active: true },
          [{ $set: { updated_at: { $add: ['$updated_at', 1] } } }], { session, returnDocument: 'after' });
        if (!member || !template) throw fail(404, 'Học viên hoặc bài tập không khả dụng.');
        const now = new Date(), row = { id, trainer_id: user.user_id, user_id: body.user_id, template_id: body.template_id,
          link_id: link.link_id, template_snapshot: snapshot(template), note, assigned_at: now, status: 'assigned', done_at: null,
          created_at: now, updated_at: now, status_history: [{ status: 'assigned', at: now, actor_id: user.user_id, reason: '' }] };
        await c('trainer_assignments').insertOne(row, { session });
        return { assignment: publicRow(row), replayed: false };
      });
    },
    async cancel(user, id, body) {
      if (!isUuid(id) || !isPlainBody(body, ['reason']) || !isText(body.reason, 500)) throw fail(400, 'Cần lý do hủy 1–500 ký tự.');
      return transaction(db, async session => {
        await lockTrainer(db, user.user_id, session);
        const row = await c('trainer_assignments').findOne({ id, trainer_id: user.user_id }, { session });
        if (!row) throw fail(404, 'Không tìm thấy bài được giao.');
        await activeLink(user.user_id, row.user_id, session);
        if (row.status !== 'assigned') throw fail(409, 'Chỉ hủy bài đang chờ hoàn thành.');
        await cancelPending(db, { id, trainer_id: user.user_id }, body.reason.trim(), new Date(), session, user.user_id);
        return { success: true, assignment: await c('trainer_assignments').findOne({ id }, { session, projection: { _id: 0 } }) };
      });
    },
    async feedback(user, id, body) {
      if (!isUuid(id) || !isPlainBody(body, ['feedback']) || !isText(body.feedback, 2000)) throw fail(400, 'Phản hồi cần 1–2000 ký tự.');
      return transaction(db, async session => {
        await lockTrainer(db, user.user_id, session);
        const row = await c('trainer_assignments').findOne({ id, trainer_id: user.user_id }, { session });
        if (!row) throw fail(404, 'Không tìm thấy bài được giao.');
        await activeLink(user.user_id, row.user_id, session);
        const now = new Date();
        const assignment = await c('trainer_assignments').findOneAndUpdate({ id }, { $set: { feedback: body.feedback.trim(), feedback_at: now, updated_at: now } }, { session, returnDocument: 'after', projection: { _id: 0 } });
        return { success: true, assignment };
      });
    },
    async progress(user, userId, query = {}) {
      if (!isUuid(userId)) throw fail(400, 'user_id không hợp lệ.');
      const link = await c('trainer_links').findOne({ trainer_id: user.user_id, user_id: userId, status: 'active' });
      if (!link) throw fail(403, 'Học viên chưa đồng ý kết nối.');
      const student = await c('users').findOne({ user_id: userId, role: 'user', is_active: true }, { projection: { _id: 0, user_id: 1, full_name: 1 } });
      if (!student) throw fail(404, 'Học viên không khả dụng.');
      const result = await service.assignments(user, { ...query, user_id: userId });
      const counts = await c('trainer_assignments').aggregate([{ $match: { trainer_id: user.user_id, user_id: userId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]).toArray();
      const summary = { assigned: 0, done: 0, cancelled: 0, total: 0 };
      counts.forEach(x => { summary[x._id] = x.count; summary.total += x.count; });
      return { ...result, student, summary };
    },
    async member(user, query = {}) {
      const links = await c('trainer_links').find({ user_id: user.user_id, status: 'active' }, { projection: { _id: 0 } }).toArray();
      const filter = { user_id: user.user_id };
      if (query.status) { if (!['assigned', 'done', 'cancelled'].includes(query.status)) throw fail(400, 'Trạng thái bài giao không hợp lệ.'); filter.status = query.status; }
      const p = listQuery(query, ['assigned_at', 'created_at']);
      if (p.regex) filter.$or = [{ 'template_snapshot.title': p.regex }, { note: p.regex }];
      const result = await pageRows(c('trainer_assignments'), 'assignments', filter, query, ['assigned_at', 'created_at']);
      const trainers = await c('users').find({ user_id: { $in: links.map(l => l.trainer_id) } }, { projection: { full_name: 1, user_id: 1 } }).toArray();
      return { ...result, links: links.map(l => ({ ...l, trainer_name: trainers.find(t => t.user_id === l.trainer_id)?.full_name || '' })), assignments: await enriched(result.assignments) };
    },
    async end(user, id) {
      if (!isUuid(id)) throw fail(400, 'Mã kết nối không hợp lệ.');
      const owner = user.role === 'trainer' ? { trainer_id: user.user_id } : { user_id: user.user_id };
      return transaction(db, async session => {
        // Link write conflicts with assignment and completion to prevent post-revocation writes.
        const now = new Date(), row = await c('trainer_links').findOneAndUpdate({ link_id: id, ...owner, status: { $in: ['active', 'pending'] } },
          { $set: { status: 'ended', ended_at: now, updated_at: now } }, { session });
        if (!row) throw fail(404, 'Không tìm thấy kết nối.');
        await cancelPending(db, { trainer_id: row.trainer_id, user_id: row.user_id }, 'Kết nối huấn luyện viên đã kết thúc.', now, session, user.user_id);
        return { success: true };
      });
    },
    async done(user, id) {
      if (!isUuid(id)) throw fail(400, 'Mã giao bài không hợp lệ.');
      return transaction(db, async session => {
        const a = await c('trainer_assignments').findOne({ id, user_id: user.user_id }, { session });
        if (!a) throw fail(404, 'Không tìm thấy bài được giao.');
        await activeLink(a.trainer_id, user.user_id, session);
        if (a.status === 'cancelled') throw fail(409, 'Bài được giao đã bị hủy.');
        if (a.status === 'done') return { success: true };
        const now = new Date();
        await c('trainer_assignments').updateOne({ id, user_id: user.user_id, status: 'assigned' }, {
          $set: { status: 'done', done_at: now, updated_at: now }, $push: { status_history: { status: 'done', at: now, actor_id: user.user_id, reason: '' } },
        }, { session });
        return { success: true };
      });
    },
  };
  return service;
}
module.exports = { createTrainerService, cancelPending };
