import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFixtureCoreLab as make} from './orchestrator.mjs';
import {MODULES,createFixtureSnapshot} from './snapshot.mjs';
const hash='a'.repeat(64);
function request(sourceDigest=hash,ruleVersion='1.0.0'){
 return {scope:'synthetic-fixture',policyVersion:'1.0.0',fault:'none',
 input:{scope:'synthetic-fixture',sourceDigest,gate:'fixture-pass',
 observations:MODULES.map(moduleId=>({moduleId,ruleVersion,sourceDigest,state:'complete',
 evidence:moduleId==='definitions'?[{game:'omsi',signal:'format-specific'}]:[]}))},
 charges:Object.fromEntries(MODULES.map(id=>[id,{bytes:10,entries:1,steps:1,depth:1}])),
 limits:{bytes:100,entries:10,steps:10,depth:3,durationMs:60000}};
}
function lab(t){const c=make();t.after(()=>c.dispose());return c;}
test('complete pipeline persists exact snapshot, records completion, and serves verified cache hit',async t=>{
 const c=lab(t),r=request(),expected=createFixtureSnapshot(r.input);
 const a=await c.analyze(r);assert.equal(a.state,'completed');assert.equal(a.cacheHit,false);
 assert.deepEqual(a.snapshot,expected);assert.equal(a.operationsEnabled,false);
 const s=c.status();assert.equal(s.database.snapshotCount,1);assert.equal(s.cache.entries,1);
 assert.equal(s.journal.events,3);assert.equal(s.journal.tasks[0].state,'completed');
 const b=await c.analyze(r);assert.equal(b.cacheHit,true);assert.deepEqual(b.snapshot,expected);
 assert.equal(c.status().database.snapshotCount,1);assert.equal(c.status().journal.events,6);
});
test('content and rule change do not reuse old analysis; policy partitions cache',async t=>{
 const c=lab(t);
 await c.analyze(request());const a=await c.analyze(request('b'.repeat(64)));
 const b=await c.analyze(request(hash,'2.0.0'));
 const policy=request();policy.policyVersion='2.0.0';const d=await c.analyze(policy);
 for(const x of [a,b,d])assert.equal(x.cacheHit,false);
 assert.equal(c.status().database.snapshotCount,3);assert.equal(c.status().cache.entries,4);
});
test('exceeded shared budget produces no persisted or reusable snapshot',async t=>{
 const c=lab(t),r=request();r.limits.bytes=69;
 const a=await c.analyze(r);assert.equal(a.state,'budget-refused');assert.equal(a.snapshot,null);
 const s=c.status();assert.equal(s.database.snapshotCount,0);assert.equal(s.cache.entries,0);
 assert.equal(s.journal.tasks[0].state,'failed');assert.equal(s.active,false);
 assert.equal((await c.analyze(request())).state,'completed');
});
test('module failure is not silently published or retried',async t=>{
 const c=lab(t),r=request();r.fault='audio-failure';
 const a=await c.analyze(r);assert.equal(a.state,'failed');assert.equal(a.snapshot,null);
 assert.equal(c.status().database.snapshotCount,0);assert.equal(c.status().cache.entries,0);
 assert.deepEqual(c.status().journal.tasks,[{taskId:'analysis-1',state:'failed'}]);
});
test('cancellation before worker dispatch leaves no publication and releases one-flight',async t=>{
 const c=lab(t),pending=c.analyze(request());
 assert.equal(c.status().active,true);assert.equal(c.cancel(),true);assert.equal(c.cancel(),false);
 await assert.rejects(c.analyze(request()),/REFUSED/);
 const a=await pending;assert.equal(a.state,'cancelled');assert.equal(a.snapshot,null);
 assert.equal(c.status().database.snapshotCount,0);assert.equal(c.status().cache.entries,0);
 assert.equal(c.status().journal.tasks[0].state,'cancelled');assert.equal(c.status().active,false);
 assert.equal((await c.analyze(request())).state,'completed');
});
test('gate refusal, ambiguity, weak and partial observations never hit stale cache',async t=>{
 const c=lab(t);
 for(const change of [r=>r.input.gate='fixture-refused',r=>r.input.observations.pop(),
 r=>r.input.observations[0].evidence=[{game:'ats',signal:'declared'}],
 r=>r.input.observations[2].evidence[0].signal='filename']){
  await c.analyze(request());const r=request();change(r);
  const a=await c.analyze(r);assert.equal(a.cacheHit,false);assert.equal(a.snapshot,null);
  assert.equal(c.status().cache.entries,0);assert.equal(c.status().database.snapshotCount,1);
 }
});
test('conflicting same-key evidence is refused rather than substituted',async t=>{
 const c=lab(t);await c.analyze(request());const r=request();r.input.observations[2].evidence[0].game='ats';
 const a=await c.analyze(r);assert.equal(a.state,'conflict');assert.equal(a.snapshot,null);
 assert.equal(c.status().cache.state,'disabled');assert.equal(c.status().database.snapshotCount,1);
});
test('SQLite reopen retains completed record and terminal journal without replay',async t=>{
 const c=lab(t),a=await c.analyze(request()),before=c.status();
 assert.deepEqual(c.reopen().recovered,[]);assert.deepEqual(c.status().journal,before.journal);
 const b=await c.analyze(request());assert.equal(b.cacheHit,true);assert.equal(b.snapshot.snapshotId,a.snapshot.snapshotId);
});
test('invalid fixture plans refuse before journal mutation; no path or raw SQL API',async t=>{
 const c=lab(t);
 for(const mutate of [r=>r.scope='real-mod',r=>r.path='/secret',r=>r.fault='execute',
 r=>r.charges.audio.bytes=-1,r=>r.limits.durationMs=0,r=>delete r.charges.audio]){
  const r=request();mutate(r);await assert.rejects(c.analyze(r),/REFUSED/);
 }
 assert.equal(c.status().journal.events,0);assert.equal(c.status().database.snapshotCount,0);
 assert.equal(Object.hasOwn(c,'path'),false);assert.equal(Object.hasOwn(c,'exec'),false);
});

test('fault at either publication boundary rolls back snapshot and completed event',async t=>{
 const c=lab(t);
 for(const fault of ['after-snapshot-insert','after-completion-event']){
  const r=request();r.fault=fault;const result=await c.analyze(r);
  assert.equal(result.state,'failed');assert.equal(result.snapshot,null);
  const s=c.status();assert.equal(s.database.snapshotCount,0);assert.equal(s.cache.entries,0);
  assert.equal(s.journal.tasks.at(-1).state,'failed');assert.deepEqual(s.journal.publications,[]);
  assert.deepEqual(c.reopen().recovered,[]);
 }
 const ok=await c.analyze(request());assert.equal(ok.state,'completed');
 assert.deepEqual(c.status().journal.publications,[{taskId:'analysis-3',snapshotId:ok.snapshot.snapshotId}]);
});
test('failed duplicate publication preserves prior successful binding',async t=>{
 const c=lab(t),first=await c.analyze(request()),r=request();r.fault='after-completion-event';
 assert.equal((await c.analyze(r)).state,'failed');
 const s=c.status();assert.equal(s.database.snapshotCount,1);assert.equal(s.cache.entries,0);
 assert.deepEqual(s.journal.publications,[{taskId:'analysis-1',snapshotId:first.snapshot.snapshotId}]);
 assert.equal((await c.analyze(request())).cacheHit,false);
});
