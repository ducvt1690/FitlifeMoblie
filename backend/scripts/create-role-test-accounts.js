'use strict';
// Operator provisioning, never exposed through public registration.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const { loadConfig } = require('../config');
const { connectDatabase } = require('../database/connection');
const { hashPassword } = require('../auth/password');
const { calculateTargets } = require('../utils/health-targets');
const { transaction } = require('../database/transaction');
const { setOperatorRole } = require('./set-role');
const { createAdminService } = require('../services/admin.service');
const credentialsPath = path.resolve(__dirname, '../../output/atlas-test-accounts.local.json');
async function main() {
  const apply = process.argv.includes('--apply');
  const {client, db} = await connectDatabase(loadConfig());
  try {
    const emails = ['admin.test@fitlife.example', 'trainer.test@fitlife.example'];
    const existing = await db.collection('users').find({email:{$in:emails}}, {projection:{email:1,user_id:1,role:1}}).toArray();
    if (existing.length) {
      if (existing.length===2 && fs.existsSync(credentialsPath)) { console.log(JSON.stringify({created:false,accounts:existing.map(({email,role,user_id})=>({email,role,user_id})),credentialsFile:credentialsPath})); return; }
      throw new Error('Target email already exists. No accounts or passwords were changed.');
    }
    if (!apply) {console.log(JSON.stringify({apply:false,newAccounts:emails,roles:['admin','trainer']}));return;}
    if (fs.existsSync(credentialsPath)) throw new Error('Credentials file already exists; refusing to overwrite.');
    const accounts = [];
    for (const [i,email] of emails.entries()) {
      const password=`FitLife-${randomBytes(9).toString('base64url')}!`;
      const now=new Date(), profile={full_name:i?'Trainer kiểm thử':'Admin kiểm thử',gender:'male',age:25,height:170,weight:65,activity_level:'moderate',goal:'maintain',timezone:'Asia/Ho_Chi_Minh'};
      accounts.push({email,password,user_id:randomUUID(),password_hash:await hashPassword(password),profile,now});
    }
    await transaction(db,async session=>{
      for(const a of accounts) await db.collection('users').insertOne({user_id:a.user_id,email:a.email,password_hash:a.password_hash,...a.profile,...calculateTargets(a.profile),role:'user',is_active:true,fit_coins:0,streak_days:0,created_at:a.now,updated_at:a.now},{session});
    });
    await setOperatorRole(db,accounts[0].email,'admin');
    await createAdminService({db}).updateAccount({user_id:accounts[0].user_id},accounts[1].user_id,{role:'trainer',note:'Tạo tài khoản Trainer kiểm thử theo yêu cầu chủ dự án.'});
    const credentials={database:db.databaseName,created_at:new Date().toISOString(),accounts:accounts.map((a,i)=>({email:a.email,password:a.password,role:i?'trainer':'admin',user_id:a.user_id}))};
    fs.mkdirSync(path.dirname(credentialsPath),{recursive:true});
    fs.writeFileSync(credentialsPath,JSON.stringify(credentials,null,2),{flag:'wx',mode:0o600});
    console.log(JSON.stringify({created:true,accounts:credentials.accounts.map(({password,...a})=>a),credentialsFile:credentialsPath}));
  } finally {await client.close();}
}
if(require.main===module)main().catch(e=>{console.error(e.message==='Target email already exists. No accounts or passwords were changed.'?e.message:`Test account provisioning failed (${e.name}).`);process.exitCode=1;});
