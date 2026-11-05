import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStepCounterSession } from '../src/features/home/stepCounterSession.js';

function fixture(options = {}) {
  let listener, state, removed = 0;
  const writes = [];
  const counter = createStepCounterSession({
    pedometer: { isAvailableAsync: async () => true, getPermissionsAsync: async () => ({ granted: true }), watchStepCount: fn => { listener = fn; return { remove() { removed++; } }; }, ...options.pedometer },
    read: options.read || (async () => ({ date: '2026-11-05', steps: 100 })),
    write: options.write || (async body => { writes.push(body); return { steps: body.total }; }),
    onChange: value => { state = value; }, timeoutMs: 30, permissionTimeoutMs: 30,
    ...(options.platform ? {platform:options.platform} : {}),
  });
  return { counter, writes, event: steps => listener({steps}), state: () => state, removed: () => removed };
}
test('zero/new/unchanged sensor events only sync newly measured steps', async () => {
  const f = fixture(); await f.counter.start();
  assert.equal(f.state().phase,'waiting'); await f.counter.sync(); assert.equal(f.writes.length,0);
  f.event(0); await f.counter.sync(); assert.equal(f.writes.length,0);
  f.event(4); assert.equal(f.state().total,104); assert.equal(f.state().phase,'counting');
  await f.counter.sync(); await f.counter.sync(); assert.equal(f.writes.length,1);assert.equal(f.writes[0].total,104);
  f.counter.dispose();
});
test('hung backend stops loading with a usable error, never starts sensor', async () => {
  const f=fixture({read:()=>new Promise(()=>{})});await f.counter.start();assert.equal(f.state().phase,'error');assert.match(f.state().error,/máy chủ/);f.counter.dispose();
});
test('browser and missing hardware report unsupported without a network request',async()=>{
  for(const options of [{platform:'web'},{pedometer:{isAvailableAsync:async()=>false}}]) {
    const f=fixture({...options,read:async()=>{assert.fail('must not read API');}});await f.counter.start();assert.equal(f.state().phase,'unsupported');f.counter.dispose();
  }
});
test('denied permissions never start sensor and explain the missing permission',async()=>{
  const f=fixture({pedometer:{getPermissionsAsync:async()=>({granted:false,canAskAgain:false})},read:async()=>assert.fail('must not read API')});await f.counter.start();assert.equal(f.state().phase,'denied');f.counter.dispose();
});
test('permission dialog background event does not cancel a not-yet-running sensor',async()=>{
  let resolve;const f=fixture({pedometer:{getPermissionsAsync:async()=>({granted:false}),requestPermissionsAsync:()=>new Promise(r=>{resolve=r;})}});
  const pending=f.counter.start();await new Promise(r=>setTimeout(r,0));f.counter.background();resolve({granted:true});await pending;assert.equal(f.state().phase,'waiting');f.counter.dispose();
});
test('unmount or cancellation during loading cannot attach a late sensor',async()=>{
  let resolve;let attached=0;const f=fixture({read:()=>new Promise(r=>{resolve=r;}),pedometer:{watchStepCount:()=>{attached++;return {remove(){}};}}});
  const pending=f.counter.start();await new Promise(r=>setTimeout(r,0));f.counter.dispose();resolve({date:'2026-11-05',steps:0});await pending;assert.equal(attached,0);
});
test('steps arriving during sync remain dirty; failed sync remains retryable',async()=>{
  let finish;const writes=[];let fail=true;
  const f=fixture({write:body=>{writes.push(body.total);if(fail){fail=false;return Promise.reject(new Error('offline'));}return new Promise(r=>{finish=()=>r({steps:body.total});});}});
  await f.counter.start();f.event(3);await f.counter.sync();assert.equal(f.state().syncMessage,'offline');
  const pending=f.counter.sync();f.event(8);finish();await pending;const next=f.counter.sync();finish();await next;
  assert.deepEqual(writes,[103,103,108]);f.counter.dispose();
});
