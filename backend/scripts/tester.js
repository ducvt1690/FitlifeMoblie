'use strict';

// Creates (or resets) one short-password tester account with Premium, for logging in quickly on a phone.
//   npm run tester
// Reads TESTER_EMAIL and TESTER_PASSWORD from backend/.env. Never use this account outside testing.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { randomBytes } = require('node:crypto');
const { loadConfig } = require('../config');
const { connectDatabase } = require('../database/connection');
const { hashPassword } = require('../auth/password');
const { createAuthService } = require('../services/auth.service');

const PREMIUM_DAYS = 30;

async function main() {
  const file = path.join(__dirname, '..', '.env');
  const env = { ...(fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {}), ...process.env };
  const email = env.TESTER_EMAIL?.trim().toLowerCase();
  const password = env.TESTER_PASSWORD;
  if (!email || !password) {
    console.error('Thêm TESTER_EMAIL và TESTER_PASSWORD vào backend/.env rồi chạy lại.');
    process.exitCode = 1;
    return;
  }
  const { client, db } = await connectDatabase(loadConfig());
  try {
    let user = await db.collection('users').findOne({ email }, { projection: { user_id: 1, role: 1 } });
    if (!user) {
      // Registration requires 8+ characters, so register with a throwaway one and set the short password below.
      const created = await createAuthService({ db }).register({ email, password: randomBytes(16).toString('hex'),
        full_name: 'Tester', gender: 'male', age: 21, height: 170, weight: 65, activity_level: 'moderate', goal: 'gain' });
      user = created.user;
    }
    if (user.role === 'admin') throw new Error('Email này là admin, chọn email khác cho tester.');
    const now = new Date();
    await db.collection('users').updateOne({ user_id: user.user_id },
      { $set: { password_hash: await hashPassword(password), is_active: true, updated_at: now } });
    await db.collection('memberships').updateOne({ user_id: user.user_id },
      { $set: { premium_until: new Date(now.getTime() + PREMIUM_DAYS * 86400000), updated_at: now },
        $setOnInsert: { user_id: user.user_id, created_at: now } }, { upsert: true });
    console.log(`Tester sẵn sàng (Premium ${PREMIUM_DAYS} ngày). Đăng nhập bằng TESTER_EMAIL / TESTER_PASSWORD trong backend/.env.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  // Never print the URI or raw driver errors.
  console.error(error.message?.startsWith('Email này') ? error.message : `Không tạo được tester (${error.name || 'Error'}).`);
  process.exitCode = 1;
});
