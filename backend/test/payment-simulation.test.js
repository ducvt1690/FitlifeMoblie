'use strict';
const assert=require('node:assert/strict');const {before,after,test}=require('node:test');const {randomUUID}=require('node:crypto');const {once}=require('node:events');
const {MongoMemoryReplSet}=require('mongodb-memory-server');const {MongoClient}=require('mongodb');
const {createApp}=require('../app');const {createAuthService}=require('../services/auth.service');const {createAdminService}=require('../services/admin.service');
const {createPaymentService,PRODUCTS,SIMULATION_BANK}=require('../services/payment.service');const {loadPaymentConfig}=require('../utils/payment-config');
let replica,client,db,server,base;
const config={simulation:true,environment:'sandbox',webAppUrl:'http://localhost:5173',publicApiUrl:'http://localhost:5000'};
before(async()=>{replica=await MongoMemoryReplSet.create({binary:{version:'8.2.6'},replSet:{count:1}});client=new MongoClient(replica.getUri());await client.connect();db=client.db('payment_simulation_test');await require('../database/mongodb/database').initializeDatabase(db);await require('../database/connection').initializeAuthSessions(db);server=createApp({db,payments:config}).listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;});
after(async()=>{if(server)await new Promise(r=>server.close(r));if(client)await client.close();if(replica)await replica.stop();});
async function member(){const b={email:randomUUID()+'@fitlife.example',password:'Simulation-test-123',confirm_password:'Simulation-test-123',full_name:'Simulation tester',gender:'male',age:26,height:170,weight:65,activity_level:'moderate',goal:'maintain'};return createAuthService({db}).register(await require('./verified-registration')(db,b));}
async function api(path,user,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};}
const create=(u,product)=>api('/api/payments/orders',u,'POST',{order_id:randomUUID(),product});
const settle=(u,id,outcome='success')=>api('/api/payments/orders/'+id+'/simulate',u,'POST',{outcome});
test('all four packages grant exactly their server-defined benefits and never become real revenue',async()=>{
 for(const [product,benefit]of Object.entries(PRODUCTS)){
  const u=await member(),created=await create(u,product);assert.equal(created.status,201);assert.equal(created.body.simulated,true);assert.equal(created.body.payment_url,null);
  const result=await settle(u,created.body.order.order_id);assert.equal(result.status,200);assert.equal(result.body.order.simulated,true);assert.equal(result.body.order.bank_code,SIMULATION_BANK);
  const row=await db.collection('users').findOne({user_id:u.user.user_id});assert.equal(row.fit_coins,benefit.coins);
  const membership=await db.collection('memberships').findOne({user_id:u.user.user_id});if(benefit.premium_days)assert.ok(membership.premium_until>Date.now()+((benefit.premium_days*86400-10)*1000));else assert.equal(membership,null);
 }
 const admin=createAdminService({db});const revenue=await admin.revenue();assert.equal(revenue.total.amount_vnd,0);assert.equal(revenue.excluded.simulated.count,4);assert.equal((await admin.overview()).counts.revenue_vnd,0);
});
test('concurrent simulation retries credit only once and retain an immutable outcome',async()=>{
 const u=await member(),{body}=await create(u,'coins_200');const results=await Promise.all([settle(u,body.order.order_id),settle(u,body.order.order_id)]);results.forEach(r=>assert.equal(r.status,200));
 assert.equal((await db.collection('users').findOne({user_id:u.user.user_id})).fit_coins,200);assert.equal((await settle(u,body.order.order_id,'failed')).status,409);
});
test('failed and expired simulations never grant benefits',async()=>{
 const u=await member(),failed=await create(u,'premium_year');assert.equal((await settle(u,failed.body.order.order_id,'failed')).body.order.status,'failed');
 const expired=await create(u,'coins_550');await db.collection('payment_orders').updateOne({order_id:expired.body.order.order_id},{$set:{expires_at:new Date(0)}});assert.equal((await settle(u,expired.body.order.order_id)).status,409);
 assert.equal((await db.collection('users').findOne({user_id:u.user.user_id})).fit_coins,0);assert.equal(await db.collection('memberships').findOne({user_id:u.user.user_id}),null);
});
test('simulation checks ownership, role, authentication, payload and existing order provider',async()=>{
 const u=await member(),other=await member(),created=await create(u,'coins_200'),id=created.body.order.order_id;
 assert.equal((await settle(null,id)).status,401);assert.equal((await settle(other,id)).status,404);
 assert.equal((await api('/api/payments/orders/'+id+'/simulate',u,'POST',{outcome:'success',amount_vnd:1})).status,400);
 await db.collection('payment_orders').updateOne({order_id:id},{$set:{bank_code:null}});assert.equal((await settle(u,id)).status,404);
 await db.collection('users').updateOne({user_id:u.user.user_id},{$set:{role:'trainer'}});assert.equal((await settle(u,id)).status,403);
});
test('disabled/production modes cannot simulate and default config never enables it',async()=>{
 assert.equal(loadPaymentConfig({}).simulation,false);assert.equal(loadPaymentConfig({PAYMENT_SIMULATION:'1'}).simulation,true);
 assert.throws(()=>loadPaymentConfig({PAYMENT_SIMULATION:'1',NODE_ENV:'production'}));assert.throws(()=>loadPaymentConfig({PAYMENT_SIMULATION:'1',VNP_ENV:'production'}));
 await assert.rejects(createPaymentService({db}).simulate({user_id:randomUUID()},randomUUID(),{outcome:'success'}),{httpStatus:404});
 await assert.rejects(createPaymentService({db,config:{simulation:true,environment:'production'}}).simulate({user_id:randomUUID()},randomUUID(),{outcome:'success'}),{httpStatus:404});
});
