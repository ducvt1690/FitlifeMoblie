'use strict';
const { randomUUID } = require('node:crypto');
const { localDay } = require('../auth/registration');
const { HttpError } = require('../utils/http-error');
const { isDate, isPlainBody } = require('../utils/validate');
const { lockMember } = require('./quest.service');

const MAX_DAY = 200000;

// One running total per member and local day; each POST adds to it.
function createStepsService({ db }) {
  const steps = () => db.collection('steps_logs');
  return {
    async sync(member, body) {
      if (!isPlainBody(body, ['date', 'total']) || !isDate(body.date) || !Number.isInteger(body.total) || body.total < 0 || body.total > MAX_DAY) throw new HttpError(400, 'Ngày hoặc tổng số bước không hợp lệ.');
      const now = new Date(), user = await lockMember(db, member.user_id, undefined, now);
      if (body.date !== localDay(now, user.timezone)) throw new HttpError(409, 'Chỉ đồng bộ bước chân của ngày hiện tại.');
      const filter = { user_id: user.user_id, step_date: body.date };
      const update = { $max: { steps: body.total }, $set: { updated_at: now }, $setOnInsert: { steps_id: randomUUID(), ...filter, created_at: now } };
      try { await steps().updateOne(filter, update, { upsert: true }); }
      catch(e) { if(e.code !== 11000) throw e; await steps().updateOne(filter, update); }
      return this.get(user, body.date);
    },
    async get(user, requestedDate) {
      const date = requestedDate ?? localDay(new Date(), user.timezone);
      if (!isDate(date)) throw new HttpError(400, 'Ngày không hợp lệ. Dùng định dạng YYYY-MM-DD.');
      const log = await steps().findOne({ user_id: user.user_id, step_date: date }, { projection: { _id: 0 } });
      return { success: true, date, steps: log?.steps ?? 0 };
    },
    async add(member, body) {
      if (!isPlainBody(body, ['amount']) || !Number.isInteger(body.amount) || body.amount < 1 || body.amount > 50000) {
        throw new HttpError(400, 'Cần amount là số bước nguyên từ 1 đến 50000.');
      }
      const now = new Date();
      const user = await lockMember(db, member.user_id, undefined, now);
      const day = localDay(now, user.timezone);
      // The filter keeps the daily total under the validator maximum.
      const log = await steps().findOneAndUpdate({ user_id: user.user_id, step_date: day, steps: { $lte: MAX_DAY - body.amount } }, {
        $inc: { steps: body.amount }, $set: { updated_at: now },
        $setOnInsert: { steps_id: randomUUID(), user_id: user.user_id, step_date: day, created_at: now },
      }, { upsert: true, returnDocument: 'after', projection: { _id: 0 } }).catch(error => {
        if (error.code === 11000) throw new HttpError(409, `Tối đa ${MAX_DAY} bước mỗi ngày.`);
        throw error;
      });
      return { success: true, date: day, steps: log.steps };
    },
  };
}
module.exports = { createStepsService };
