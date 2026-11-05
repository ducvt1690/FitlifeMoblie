'use strict';
// Controlled role bootstrap for operators with database access:
//   node scripts/set-role.js <email> <user|admin>
// Trainer grants remain in the authenticated Admin API with a mandatory reason.
const { randomUUID } = require('node:crypto');
const { loadConfig } = require('../config');
const { connectDatabase } = require('../database/connection');
const { transaction } = require('../database/transaction');
const { cancelPending } = require('../services/trainer.service');
async function setOperatorRole(db, email, role) {
  if (typeof email !== 'string' || !email.trim() || !['user', 'admin'].includes(role)) throw new Error('Invalid role bootstrap arguments.');
  return transaction(db, async session => {
    const now = new Date();
    const user = await db.collection('users').findOneAndUpdate({ email: email.trim().toLowerCase() },
      { $set: { role, updated_at: now } }, { session, projection: { user_id: 1, role: 1 } });
    if (!user) return null;
    if (user.role !== role) {
      await db.collection('trainer_links').updateMany({ $or: [{ trainer_id: user.user_id }, { user_id: user.user_id }], status: { $in: ['active', 'pending'] } },
        { $set: { status: 'ended', ended_at: now, updated_at: now } }, { session });
      await cancelPending(db, { $or: [{ trainer_id: user.user_id }, { user_id: user.user_id }] }, 'Quyền tài khoản đã được thay đổi bằng script vận hành.', now, session, user.user_id);
      if (user.role === 'trainer') await db.collection('workout_templates').updateMany({ trainer_id: user.user_id, is_active: true },
        { $set: { is_active: false, updated_at: now } }, { session });
    }
    await db.collection('auth_sessions').deleteMany({ user_id: user.user_id }, { session });
    // This is a database-operator bootstrap event, not an authenticated Admin API action.
    // The target account is retained as the existing bootstrap principal convention.
    await db.collection('admin_logs').insertOne({ log_id: randomUUID(), admin_id: user.user_id, action: `set_role_${role}`,
      target_type: 'user', target_id: user.user_id, previous_role: user.role, new_role: role,
      note: 'Thay đổi quyền bằng script vận hành có quyền database.', created_at: now, updated_at: now }, { session });
    return user;
  });
}
async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !['user', 'admin'].includes(role)) { console.error('Cách dùng: node scripts/set-role.js <email> <user|admin>'); process.exitCode = 1; return; }
  const { client, db } = await connectDatabase(loadConfig());
  try {
    const user = await setOperatorRole(db, email, role);
    if (!user) { console.error('Không tìm thấy tài khoản. Hãy đăng ký trước rồi chạy lại.'); process.exitCode = 1; return; }
    console.log(`Đã đổi role ${user.role} → ${role}. Đăng nhập lại để dùng quyền mới.`);
  } finally { await client.close(); }
}
if (require.main === module) main().catch(error => { console.error(`Không đổi được role (${error.name || 'Error'}). Kiểm tra cấu hình MongoDB và migration.`); process.exitCode = 1; });
module.exports = { setOperatorRole };
