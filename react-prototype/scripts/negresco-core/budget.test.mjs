import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFixtureBudget as budget} from './budget.mjs';
import {createFixtureQueue as queue} from './queue.mjs';
const limits={scope:'synthetic-fixture',bytes:100,entries:10,steps:20,depth:3,durationMs:1000};
const charge=(bytes=0,entries=0,steps=1,depth=0)=>({bytes,entries,steps,depth});
const refuse=/CORE_FIXTURE_BUDGET_REFUSED/;
test('modules share one cumulative budget; depth is a peak, not a sum',()=>{
 const b=budget(limits,()=>0),a=b.openModule('structure'),c=b.openModule('audio');
 a.consume(charge(40,4,5,2));c.consume(charge(60,6,15,3));
 const s=b.snapshot();assert.deepEqual(s.consumed,charge(100,10,20,3));assert.equal(s.state,'active');
 assert.equal(s.modules.length,2);assert.equal(s.realReadsPerformed,false);
 assert.throws(()=>c.consume(charge()),refuse);assert.equal(b.snapshot().reason,'steps');
});
test('overshoot atomically refuses the entire charge and revokes every handle',()=>{
 const b=budget(limits,()=>0),a=b.openModule('metadata'),c=b.openModule('resources');
 a.consume(charge(50,3,1));const before=b.snapshot().consumed;
 assert.throws(()=>c.consume(charge(51,1,1)),refuse);
 assert.deepEqual(b.snapshot().consumed,before);assert.equal(b.snapshot().state,'exhausted');
 assert.equal(b.snapshot().reason,'bytes');assert.equal(a.signal.aborted,true);
 assert.throws(()=>a.checkpoint(),refuse);assert.throws(()=>b.openModule('audio'),refuse);
});
test('entries, steps and depth have independent enforced logical limits',()=>{
 for(const [value,reason] of [[charge(0,11,1),'entries'],[charge(0,0,21),'steps'],[charge(0,0,1,4),'depth']]){
  const b=budget(limits,()=>0);assert.throws(()=>b.openModule('audio').consume(value),refuse);
  assert.equal(b.snapshot().reason,reason);assert.deepEqual(b.snapshot().consumed,charge(0,0,0,0));
 }
});
test('global deadline starts at creation, not each module',()=>{
 let now=10;const b=budget(limits,()=>now),a=b.openModule('structure');
 now=1009;assert.equal(a.checkpoint(),true);const c=b.openModule('audio');
 now=1010;assert.throws(()=>c.checkpoint(),refuse);
 assert.equal(b.snapshot().state,'expired');assert.equal(a.signal.aborted,true);
});
test('invalid or reversed monotonic clock fails closed',()=>{
 let now=10;const b=budget(limits,()=>now);now=9;
 assert.equal(b.snapshot().reason,'clock-invalid');assert.equal(b.signal.aborted,true);
 assert.throws(()=>budget(limits,()=>NaN),refuse);
});
test('closing one module never refunds or renews its allocation',()=>{
 const b=budget(limits,()=>0),a=b.openModule('audio');a.consume(charge(12,1,1));
 assert.equal(a.close(),true);assert.equal(a.close(),false);
 assert.throws(()=>a.consume(charge()),refuse);assert.throws(()=>b.openModule('audio'),refuse);
 assert.equal(b.snapshot().consumed.bytes,12);assert.equal(b.snapshot().state,'active');
});
test('global cancellation and closure are irreversible',()=>{
 for(const method of ['cancel','close']){
  const b=budget(limits,()=>0),a=b.openModule('structure');
  assert.equal(b[method](),true);assert.equal(b[method](),false);assert.equal(a.signal.aborted,true);
  assert.throws(()=>a.consume(charge()),refuse);
  assert.equal(b.snapshot().state,method==='cancel'?'cancelled':'closed');
 }
});
test('malformed inputs and accessors refuse without charge or secret exposure',()=>{
 assert.throws(()=>budget({...limits,scope:'real-mod'},()=>0),refuse);
 assert.throws(()=>budget({...limits,bytes:Infinity},()=>0),refuse);
 const b=budget(limits,()=>0),a=b.openModule('structure');
 assert.throws(()=>b.openModule('../secret'),refuse);
 for(const x of [charge(-1),charge(0,0,0),charge(0,0,1.5),{...charge(),path:'/secret'},charge(Number.MAX_SAFE_INTEGER)]){
  assert.throws(()=>a.consume(x),refuse);
 }
 let invoked=false;const x=charge();Object.defineProperty(x,'bytes',{get(){invoked=true;return 0;},enumerable:true});
 assert.throws(()=>a.consume(x),refuse);assert.equal(invoked,false);
 assert.deepEqual(b.snapshot().consumed,charge(0,0,0,0));assert.equal(b.snapshot().state,'active');
 assert.equal(JSON.stringify(b.snapshot()).includes('secret'),false);
});
test('snapshots are immutable and detached from subsequent charges',()=>{
 const b=budget(limits,()=>0),a=b.openModule('structure');const s=b.snapshot();
 a.consume(charge(3,1,1));assert.equal(s.consumed.bytes,0);
 for(const x of [s,s.limits,s.consumed,s.modules,s.modules[0]])assert.ok(Object.isFrozen(x));
 assert.equal(s.operationsEnabled,false);assert.equal(s.osResourceLimitsEnforced,false);
});
test('queue workers cannot each spend the full global analysis budget',async()=>{
 const b=budget(limits,()=>0),q=queue({scope:'synthetic-fixture',parallelism:2,memoryUnits:2,workUnits:2,maxJobs:2});
 const first=q.enqueue({id:'structure',priority:'high',memoryUnits:1,workUnits:1},()=>b.openModule('structure').consume(charge(60)));
 const second=q.enqueue({id:'audio',priority:'normal',memoryUnits:1,workUnits:1},()=>b.openModule('audio').consume(charge(60)));
 assert.equal((await first).state,'completed');assert.equal((await second).state,'failed');
 assert.equal(b.snapshot().state,'exhausted');assert.equal(b.snapshot().consumed.bytes,60);
 assert.equal(q.snapshot().memoryReserved,0);
});
