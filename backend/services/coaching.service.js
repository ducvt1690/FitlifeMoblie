'use strict';
const { transaction } = require('../database/transaction');
const { HttpError } = require('../utils/http-error');
const { isUuid, isPlainBody } = require('../utils/validate');
const { lockMember } = require('./quest.service');
const { cancelOpenAssignments, withNames, withTemplates } = require('./trainer.service');
const fail = (status, message) => new HttpError(status, message);

// The member's side of trainer coaching: accept invites, end links, finish or decline assigned work.
function createCoachingService({ db }) {
  const links = () => db.collection('trainer_links');
  const assignments = () => db.collection('trainer_assignments');

  async function updateAssignment(member, id, status, message) {
    if (!isUuid(id)) throw fail(400, 'id không hợp lệ.');
    return transaction(db, async session => {
      const now = new Date();
      await lockMember(db, member.user_id, session, now);
      const assignment = await assignments().findOneAndUpdate({ id, user_id: member.user_id, status: 'assigned' },
        { $set: { status, done_at: status === 'done' ? now : null, updated_at: now } },
        { session, returnDocument: 'after', projection: { _id: 0 } });
      if (!assignment) throw fail(404, 'Không tìm thấy bài đang được giao cho bạn.');
      return { success: true, message, assignment };
    });
  }

  return {
    async overview(member) {
      const [active, rows] = await Promise.all([
        links().find({ user_id: member.user_id, status: 'active' }, { projection: { _id: 0, invite_code: 0 } }).sort({ accepted_at: -1 }).toArray(),
        assignments().find({ user_id: member.user_id }, { projection: { _id: 0 } }).sort({ status: 1, assigned_at: -1 }).limit(100).toArray(),
      ]);
      return { success: true,
        links: await withNames(db, active, 'trainer_id', 'trainer'),
        assignments: await withNames(db, await withTemplates(db, rows), 'trainer_id', 'trainer') };
    },

    async accept(member, body) {
      if (!isPlainBody(body, ['code']) || typeof body.code !== 'string') throw fail(400, 'Cần mã mời (code).');
      const code = body.code.trim().toUpperCase();
      if (!/^[A-Z0-9]{8}$/.test(code)) throw fail(400, 'Mã mời gồm 8 ký tự chữ và số.');
      return transaction(db, async session => {
        const now = new Date();
        const user = await lockMember(db, member.user_id, session, now);
        const link = await links().findOne({ invite_code: code, status: 'pending' }, { session });
        if (!link) throw fail(404, 'Mã mời không đúng hoặc đã được sử dụng.');
        const trainer = await db.collection('users').findOne({ user_id: link.trainer_id, role: 'trainer', is_active: true }, { session });
        if (!trainer) throw fail(409, 'Huấn luyện viên này không còn hoạt động.');
        if (await links().findOne({ trainer_id: link.trainer_id, user_id: user.user_id, status: 'active' }, { session })) {
          throw fail(409, 'Bạn đã kết nối với huấn luyện viên này.');
        }
        await links().updateOne({ link_id: link.link_id }, { $set: { user_id: user.user_id, status: 'active', accepted_at: now, updated_at: now } }, { session });
        return { success: true, message: `Đã kết nối với ${trainer.full_name}.`, trainer: { user_id: trainer.user_id, full_name: trainer.full_name } };
      });
    },

    async endLink(member, linkId) {
      if (!isUuid(linkId)) throw fail(400, 'link_id không hợp lệ.');
      return transaction(db, async session => {
        const now = new Date();
        await lockMember(db, member.user_id, session, now);
        const link = await links().findOneAndUpdate({ link_id: linkId, user_id: member.user_id, status: 'active' },
          { $set: { status: 'ended', ended_at: now, updated_at: now } }, { session });
        if (!link) throw fail(404, 'Không tìm thấy kết nối đang mở.');
        const { modifiedCount } = await cancelOpenAssignments(db, { trainer_id: link.trainer_id, user_id: member.user_id }, now, session);
        return { success: true, message: 'Đã ngắt kết nối. Huấn luyện viên không còn xem được nhật ký của bạn.', cancelled_assignments: modifiedCount };
      });
    },

    complete: (member, id) => updateAssignment(member, id, 'done', 'Đã hoàn thành bài tập được giao.'),
    decline: (member, id) => updateAssignment(member, id, 'cancelled', 'Đã từ chối bài tập.'),
  };
}
module.exports = { createCoachingService };
