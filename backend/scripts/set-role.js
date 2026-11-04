'use strict';

// Controlled role bootstrap for operators with database access:
//   node scripts/set-role.js <email> <user|admin>
// The public API never grants roles.
const { randomUUID } = require('node:crypto');
const { loadConfig } = require('../config');
const { connectDatabase } = require('../database/connection');

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !['user', 'admin'].includes(role)) {
    console.error('Cách dùng: node scripts/set-role.js <email> <user|admin>');
    process.exitCode = 1;
    return;
  }
  const { client, db } = await connectDatabase(loadConfig());
  try {
    const now = new Date();
    const user = await db.collection('users').findOneAndUpdate({ email: email.trim().toLowerCase() },
      { $set: { role, updated_at: now } }, { projection: { user_id: 1, role: 1 } });
    if (!user) {
      console.error('Không tìm thấy tài khoản. Hãy đăng ký trước rồi chạy lại.');
      process.exitCode = 1;
      return;
    }
    // Sessions issued under the old role are dropped so the new role applies on the next login.
    await db.collection('auth_sessions').deleteMany({ user_id: user.user_id });
    await db.collection('admin_logs').insertOne({ log_id: randomUUID(), admin_id: user.user_id, action: `set_role_${role}`,
      target_type: 'user', target_id: user.user_id, note: 'Cấp quyền bằng script vận hành', created_at: now, updated_at: now });
    console.log(`Đã đổi role ${user.role} → ${role}. Đăng nhập lại để dùng quyền mới.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  // Never print the URI or raw driver errors.
  console.error(`Không đổi được role (${error.name || 'Error'}). Kiểm tra cấu hình MongoDB.`);
  process.exitCode = 1;
});
