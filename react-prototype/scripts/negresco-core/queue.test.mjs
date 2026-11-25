import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFixtureQueue as create} from './queue.mjs';
const base={scope:'synthetic-fixture',parallelism:2,memoryUnits:4,workUnits:12,maxJobs:8};
const spec=(id,priority='normal',memoryUnits=2,workUnits=1)=>({id,priority,memoryUnits,workUnits});
const deferred=()=>{let release;const promise=new Promise(r=>{release=r;});return {promise,release};};
const turn=()=>new Promise(r=>setImmediate(r));
const refuse=/CORE_FIXTURE_QUEUE_REFUSED/;
test('strict priority and stable FIFO with bounded concurrency',async()=>{
 const q=create(base),gate=deferred(),order=[];
 const worker=id=>async()=>{order.push(id);await gate.promise;};
 const a=q.enqueue(spec('low','low'),worker('low'));
 const b=q.enqueue(spec('high-one','high'),worker('high-one'));
 const c=q.enqueue(spec('high-two','high'),worker('high-two'));
 const d=q.enqueue(spec('normal'),worker('normal'));
 await turn();assert.deepEqual(order,['high-one','high-two']);assert.equal(q.snapshot().active,2);
 gate.release();await Promise.all([a,b,c,d]);assert.deepEqual(order,['high-one','high-two','normal','low']);
 assert.equal(q.snapshot().active,0);assert.equal(q.snapshot().memoryReserved,0);
});
test('memory reservation blocks a head job rather than bypassing priority',async()=>{
 const q=create(base),gate=deferred(),order=[];
 const a=q.enqueue(spec('first','high',3),async()=>{order.push('first');await gate.promise;});
 const b=q.enqueue(spec('second','normal',3),()=>order.push('second'));
 const c=q.enqueue(spec('third','low',1),()=>order.push('third'));
 await turn();assert.deepEqual(order,['first']);assert.equal(q.snapshot().memoryReserved,3);
 gate.release();await Promise.all([a,b,c]);assert.deepEqual(order,['first','second','third']);
});
test('queued cancellation never calls worker and refunds unspent work',async()=>{
 const q=create({...base,workUnits:2});let ran=false;
 const a=q.enqueue(spec('discard','normal',1,2),()=>{ran=true;});
 assert.equal(q.cancel('discard'),true);assert.equal((await a).state,'cancelled');assert.equal(ran,false);
 const b=await q.enqueue(spec('replacement','normal',1,2),()=>{});
 assert.equal(b.state,'completed');assert.equal(q.snapshot().workSpent,2);
});
test('running cancellation keeps reservation until actual settlement',async()=>{
 const q=create({...base,parallelism:1}),gate=deferred();let signal,second=false;
 const a=q.enqueue(spec('first'),async ctx=>{signal=ctx.signal;await gate.promise;});
 const b=q.enqueue(spec('second'),()=>{second=true;});
 await turn();assert.equal(q.cancel('first'),true);assert.equal(signal.aborted,true);
 await turn();assert.equal(q.snapshot().jobs[0].state,'cancelling');assert.equal(q.snapshot().active,1);
 assert.equal(q.snapshot().memoryReserved,2);assert.equal(second,false);assert.equal(q.cancel('first'),false);
 gate.release();assert.equal((await a).state,'cancelled');assert.equal((await b).state,'completed');
 assert.equal(q.snapshot().workSpent,2);assert.equal(q.snapshot().memoryReserved,0);
});
test('cancelled worker rejection is cancelled, ordinary errors are sanitized',async()=>{
 const q=create(base);const gate=deferred();
 const a=q.enqueue(spec('cancel'),async()=>{await gate.promise;throw Error('/private/secret');});
 const b=q.enqueue(spec('fail'),()=>{throw Error('/private/secret');});
 await turn();q.cancel('cancel');gate.release();
 assert.equal((await a).state,'cancelled');assert.equal((await b).state,'failed');
 assert.equal(JSON.stringify(q.snapshot()).includes('secret'),false);
});
test('lifetime work budget includes queued work and never refunds started work',async()=>{
 const q=create({...base,workUnits:3});
 const a=q.enqueue(spec('first','normal',1,2),()=>{});
 assert.throws(()=>q.enqueue(spec('over','normal',1,2),()=>{}),refuse);
 await a;assert.throws(()=>q.enqueue(spec('over','normal',1,2),()=>{}),refuse);
 await q.enqueue(spec('last'),()=>{});assert.equal(q.snapshot().workSpent,3);
});
test('closed queue rejects new jobs and cancels pending and running jobs',async()=>{
 const q=create({...base,parallelism:1}),gate=deferred();
 const a=q.enqueue(spec('active'),()=>gate.promise);const b=q.enqueue(spec('queued'),()=>{throw Error('unexpected');});
 await turn();assert.equal(q.close(),true);assert.equal(q.close(),false);
 assert.equal((await b).state,'cancelled');assert.equal(q.snapshot().closed,true);
 assert.equal(q.snapshot().active,1);assert.throws(()=>q.enqueue(spec('new'),()=>{}),refuse);
 gate.release();assert.equal((await a).state,'cancelled');assert.equal(q.snapshot().active,0);
});
test('malformed inputs, duplicate IDs, job cap and forged capabilities refuse',async()=>{
 assert.throws(()=>create({...base,scope:'real-mod'}),refuse);
 assert.throws(()=>create({...base,parallelism:9}),refuse);
 const q=create({...base,maxJobs:1});
 for(const x of [spec('../path'),spec('bad','urgent'),spec('bad','normal',5),spec('bad','normal',1,0),{...spec('bad'),operationsEnabled:true}]){
  assert.throws(()=>q.enqueue(x,()=>{}),refuse);
 }
 let invoked=false;const x=spec('getter');Object.defineProperty(x,'id',{get(){invoked=true;return 'getter';},enumerable:true});
 assert.throws(()=>q.enqueue(x,()=>{}),refuse);assert.equal(invoked,false);
 await q.enqueue(spec('one'),()=>{});assert.throws(()=>q.enqueue(spec('one'),()=>{}),refuse);
 assert.throws(()=>q.enqueue(spec('two'),()=>{}),refuse);
});
test('immutable sanitized snapshots never expose worker or abort handles',async()=>{
 const q=create(base);const a=q.enqueue(spec('job'),()=>{});
 const s=q.snapshot();assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.jobs)&&Object.isFrozen(s.jobs[0]));
 assert.equal(s.osResourceLimitsEnforced,false);assert.equal(s.operationsEnabled,false);
 assert.equal(Object.hasOwn(s.jobs[0],'controller'),false);assert.equal(Object.hasOwn(s.jobs[0],'worker'),false);
 await a;assert.equal(s.jobs[0].state,'queued');assert.equal(q.snapshot().jobs[0].state,'completed');
});
