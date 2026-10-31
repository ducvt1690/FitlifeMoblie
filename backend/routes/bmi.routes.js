'use strict';
const express = require('express');
const { localDay } = require('../auth/registration');
const { transaction } = require('../database/transaction');
const { createRequireAuth, requireMember } = require('../middleware/require-auth');
const { asyncHandler } = require('../utils/async-handler');
const { HttpError } = require('../utils/http-error');
const { calculateBmi, upsertBmi } = require('../utils/bmi');
const { lockMember } = require('../services/quest.service');

// BMI is always computed by the server from the saved profile; the body is ignored.
function createBmiRouter({ db }) {
  const router = express.Router();
  router.use(createRequireAuth({ db }), requireMember);
  router.get('/', asyncHandler(async (req, res) => {
    const limit = req.query.limit === undefined ? 30 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 365) throw new HttpError(400, 'limit phải là số nguyên từ 1 đến 365.');
    const { user } = req.auth;
    const records = await db.collection('bmi_history').find({ user_id: user.user_id }, { projection: { _id: 0 } })
      .sort({ record_date: -1 }).limit(limit).toArray();
    res.json({ success: true, current: { weight: user.weight, height: user.height, ...calculateBmi(user.weight, user.height) }, records });
  }));
  router.post('/', asyncHandler(async (req, res) => {
    const record = await transaction(db, async session => {
      const now = new Date();
      const user = await lockMember(db, req.auth.user.user_id, session, now);
      return upsertBmi(db, user, localDay(now, user.timezone), now, session);
    });
    res.status(201).json({ success: true, record });
  }));
  return router;
}
module.exports = { createBmiRouter };
