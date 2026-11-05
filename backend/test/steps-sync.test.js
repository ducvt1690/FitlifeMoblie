'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');const {once}=require('node:events');
const {MongoMemoryReplSet}=require('mongodb-memory-server');const {MongoClient}=require('mongodb');
test('sensor sync retries/concurrency are idempotent and Web reads the same persisted daily total',async()=>{
 const replica=await MongoMemoryReplSet.create({binary:{version:'8.2.6'},replSet:{count:1}});const client=new MongoClient(replica.getUri());let server;
 try{await client.connect();const db=client.db('steps_sensor_test');await require('../database/mongodb/database').initializeDatabase(db);await require('../database/connection').initializeAuthSessions(db);
 const b={email:randomUUID()+'@fitlife.example',password:'Steps-test-123',confirm_password:'Steps-test-123',full_name:'Steps Tester',gender:'male',age:25,height:170,weight:65,activity_level:'moderate',goal:'maintain'};
 const account=await require('../services/auth.service').createAuthService({db}).register(await require('./verified-registration')(db,b));
 server=require('../app').createApp({db}).listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const headers={Authorization:'Bearer '+account.token,'Content-Type':'application/json'};
 const read=()=>fetch(base+'/api/steps-logs',{headers}).then(r=>r.json());const day=(await read()).date;
 const sync=(body,h=headers)=>fetch(base+'/api/steps-logs/sensor',{method:'PUT',headers:h,body:JSON.stringify(body)});
 assert.equal((await sync({date:day,total:500},{'Content-Type':'application/json'})).status,401);
 const responses=await Promise.all([500,800,800,600].map(total=>sync({date:day,total})));responses.forEach(r=>assert.equal(r.status,200));
 assert.equal((await read()).steps,800);assert.equal(await db.collection('steps_logs').countDocuments(),1);
 assert.equal((await sync({date:day,total:-1})).status,400);assert.equal((await sync({date:'2020-01-01',total:900})).status,409);
 await db.collection('users').updateOne({user_id:account.user.user_id},{$set:{role:'trainer'}});assert.equal((await sync({date:day,total:900})).status,403);
 }finally{if(server)await new Promise(r=>server.close(r));await client.close();await replica.stop();}
});
