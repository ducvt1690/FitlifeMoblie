'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { before, beforeEach, after, test } = require('node:test');
const { MongoClient, BSON } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { collections } = require('../schema');
const { initializeDatabase, verifyDatabase } = require('../database');
const { seedCatalogs, seedDemo, DEMO_USER_ID } = require('../seed');
const { initializeAuthSessions } = require('../../../database/connection');
const { simplifyDatabase, planSimplification } = require('../simplify');
let replica, client, db, directory;
before(async () => {
 replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
 client = new MongoClient(replica.getUri()); await client.connect();
 directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitlife-simplify-'));
}, { timeout: 240000 });
after(async () => { if(client)await client.close();if(replica)await replica.stop(); });
beforeEach(async () => {
 db = client.db('fitlife'); await db.dropDatabase(); await client.db('fitlife_demo').dropDatabase();
 await initializeDatabase(db); await seedCatalogs(db); await seedDemo(db,client,'simplification-test-password');
 await initializeAuthSessions(db);
 for(const name of ['users','trainer_assignments','user_challenges']) {
  const definition = structuredClone(collections.find(entry=>entry.name===name));
  definition.validator.$jsonSchema.properties.revision={bsonType:'int',minimum:0};
  await db.command({collMod:name,validator:definition.validator});
  await db.collection(name).updateMany({},{$set:{revision:0}});
 }
 for(const name of ['trainer_connections','challenge_checkins','request_operations','admin_audit_logs']) await db.createCollection(name);
 const purchase=await db.collection('purchases').findOne();
 await db.collection('user_inventory').insertOne({purchase_id:purchase.purchase_id,user_id:purchase.user_id,item_id:purchase.item_id,item_category:purchase.item_category,status:'owned'});
 await db.collection('__fitlife_v2_users').insertMany(await db.collection('users').find().toArray());
 await db.collection('__fitlife_migrations').insertOne({_id:'v3_app_web_contract',status:'complete'});
 await client.db('fitlife_demo').collection('example').insertOne({keptInLocalBackup:true});
});
test('plan writes nothing and names only removable collections', async()=>{
 const before=await db.listCollections().toArray();const user=await db.collection('users').findOne();
 const coreCounts=await Promise.all(collections.map(def=>db.collection(def.name).countDocuments()));
 const p=await simplifyDatabase(db,client);assert.equal(p.applied,false);assert.deepEqual(p.issues,[]);
 assert.equal(p.retainedDocuments,coreCounts.reduce((sum,count)=>sum+count,0));assert.ok(p.removeCollections.includes('user_inventory'));
 assert.deepEqual(await db.listCollections().toArray(),before);assert.deepEqual(await db.collection('users').findOne(),user);
});
test('simplification preserves all core documents and auth sessions, exports backups and removes only approved extras/demo',async()=>{
 await db.collection('users').updateOne({user_id:DEMO_USER_ID},{$set:{date_of_birth:'2003-10-20'}});
 const before=await db.collection('users').findOne({user_id:DEMO_USER_ID});
 const result=await simplifyDatabase(db,client,{apply:true,backupDirectory:directory,deleteDemo:true});
 assert.equal(result.applied,true);assert.equal(result.audit.ok,true);assert.equal(result.visibleCollections.length,18);
 const after=await db.collection('users').findOne({user_id:DEMO_USER_ID});delete before.revision;assert.deepEqual(after,before);
 assert.equal(await db.collection('purchases').countDocuments(),1);assert.equal(result.deletedDemoDatabase,true);
 const names=(await client.db('admin').admin().listDatabases({nameOnly:true})).databases.map(row=>row.name);
 assert.equal(names.includes('fitlife_demo'),false);
 const backup=BSON.EJSON.parse(fs.readFileSync(path.join(result.backupDirectory,'fitlife.ejson'),'utf8'));
 assert.equal(backup.find(row=>row.name==='users').documents[0].revision,0);
 assert.ok(fs.existsSync(path.join(result.backupDirectory,'fitlife_demo.ejson')));
 assert.equal((await verifyDatabase(db)).ok,true);
 const rerun=await planSimplification(db);assert.deepEqual(rerun.removeCollections,[]);assert.equal(rerun.removedFieldValues,0);
});
test('active v3 consent or inventory usage stops simplification instead of silently discarding it',async()=>{
 await db.collection('trainer_connections').insertOne({status:'accepted'});
 await db.collection('user_inventory').updateOne({},{$set:{status:'equipped'}});
 const report=await simplifyDatabase(db,client,{apply:true,backupDirectory:directory});
 assert.equal(report.applied,false);assert.ok(report.issues.some(issue=>issue.includes('real activity')));
 assert.ok(report.issues.some(issue=>issue.includes('usage state')));assert.equal((await db.collection('users').findOne()).revision,0);
});
test('transaction failure rolls back field removals and keeps auxiliary collections',async()=>{
 const real=db.collection.bind(db);
 db.collection=(name,...args)=>{const c=real(name,...args);if(name==='trainer_assignments')c.updateMany=async()=>{throw new Error('injected failure');};return c;};
 await assert.rejects(simplifyDatabase(db,client,{apply:true,backupDirectory:directory}),/injected failure/);
 db.collection=real;
 assert.equal((await db.collection('users').findOne()).revision,0);assert.equal(await db.collection('user_inventory').countDocuments(),1);
});
test('another database name cannot be targeted by simplification',async()=>{
 await assert.rejects(simplifyDatabase(client.db('unrelated'),client,{apply:true,backupDirectory:directory}),/only accepts the fitlife/);
});
