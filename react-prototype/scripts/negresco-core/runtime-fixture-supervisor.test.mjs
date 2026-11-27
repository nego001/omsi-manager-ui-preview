import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,ChildProcess} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createFixtureProcessSupervisor as create} from './runtime-fixture-supervisor.mjs';
const request=(scenario='missing-reference')=>({scope:'synthetic-fixture',scenario});
const refuse=/CORE_RUNTIME_WORKER_REFUSED/;
test('separate process executes actual Reader and returns bounded diagnostic only',async()=>{
 const s=create(),r=await s.analyze(request());
 assert.equal(r.state,'fixture-worker-report');assert.notEqual(r.report.workerPid,process.pid);
 assert.deepEqual(r.report.findings,['MISSING_REFERENCE']);
 assert.equal(r.report.fixtureStatus,'fixture-reference-errors');
 for(const k of ['osIsolationVerified','resourceLimitsVerified','realReadsPerformed','operationsEnabled','productionIntegrated'])assert.equal(r.report[k],false);
 assert.equal(r.report.separateProcessObserved,true);assert.ok(Object.isFrozen(r.report.findings));
 const {reportDigest,...body}=r.report;assert.equal(reportDigest,createHash('sha256').update(JSON.stringify(body)).digest('hex'));
 assert.equal(s.status().active,false);s.dispose();
});
test('clean synthetic job has no findings and independent job identity',async()=>{
 const s=create(),a=await s.analyze(request('clean-reference')),b=await s.analyze(request('clean-reference'));
 assert.equal(a.state,'fixture-worker-report');assert.equal(b.state,'fixture-worker-report');
 assert.deepEqual(a.report.findings,[]);assert.equal(a.report.fixtureStatus,'no-discovered-findings');
 assert.notEqual(a.report.jobId,b.report.jobId);assert.equal(a.report.bridgeDigest,b.report.bridgeDigest);s.dispose();
});
test('supervisor refuses real scope caller paths commands and accessors',async()=>{
 const s=create();
 for(const x of [{...request(),scope:'real-mod'},{...request(),path:'/tmp'},{...request(),scenario:'execute'},{...request(),operationsEnabled:true}])await assert.rejects(s.analyze(x),refuse);
 let invoked=false;const x=request();Object.defineProperty(x,'scenario',{get(){invoked=true;return 'clean-reference';}});
 await assert.rejects(s.analyze(x),refuse);assert.equal(invoked,false);assert.equal(s.status().acceptedJobs,0);s.dispose();
});
test('single flight and disposal prevent overlapping jobs or use after close',async()=>{
 const s=create(),p=s.analyze(request());await assert.rejects(s.analyze(request()),refuse);assert.throws(()=>s.dispose(),refuse);
 assert.equal((await p).state,'fixture-worker-report');assert.equal(s.dispose(),true);assert.equal(s.dispose(),false);
 await assert.rejects(s.analyze(request()),refuse);
});
test('worker rejects malformed wire and nonfixture commands without output',()=>{
 const worker=fileURLToPath(new URL('./runtime-fixture-worker.mjs',import.meta.url));
 for(const input of ['{}','x'.repeat(257),'{"scope":"real-mod","scenario":"clean-reference","jobId":"'+ 'a'.repeat(32)+'"}','{"scope":"synthetic-fixture","scenario":"clean-reference","jobId":"'+ 'a'.repeat(32)+'","path":"a"}']){
  const p=spawnSync(process.execPath,[worker],{input,encoding:'utf8',timeout:10000,maxBuffer:4096,windowsHide:true});assert.equal(p.error,undefined);assert.equal(p.status,3);assert.equal(p.stdout,'');assert.equal(p.stderr,'');
 }
});

test('cancellation is job-bound and discards all results until owned child closes',async()=>{
 const s=create(),p=s.analyze(request());
 const id=s.status().activeJobId;
 assert.match(id,/^[a-f0-9]{32}$/);
 assert.equal(s.cancel(id==='0'.repeat(32)?'1'.repeat(32):'0'.repeat(32)),false);
 assert.throws(()=>s.cancel({jobId:id}),refuse);
 assert.equal(s.cancel(id),true);assert.equal(s.cancel(id),false);
 assert.equal(s.status().active,true);assert.equal(s.status().activeJobId,id);
 await assert.rejects(s.analyze(request()),refuse);assert.throws(()=>s.dispose(),refuse);
 const r=await p;assert.deepEqual(r,{state:'fixture-worker-failed',reason:'cancelled',report:null,operationsEnabled:false});
 assert.ok(Object.isFrozen(r));assert.equal(s.status().active,false);assert.equal(s.status().activeJobId,null);
 assert.equal(s.cancel(id),false);assert.equal(s.dispose(),true);assert.equal(s.cancel(id),false);
});
test('supervisor recovers from cancellation and a stale token cannot cancel subsequent work',async()=>{
 const s=create(),first=s.analyze(request()),old=s.status().activeJobId;
 assert.equal(s.cancel(old),true);assert.equal((await first).reason,'cancelled');
 const next=s.analyze(request('clean-reference')),id=s.status().activeJobId;
 assert.notEqual(id,old);assert.equal(s.cancel(old),false);
 const r=await next;assert.equal(r.state,'fixture-worker-report');assert.equal(r.report.jobId,id);assert.deepEqual(r.report.findings,[]);
 assert.equal(s.status().acceptedJobs,2);assert.equal(s.cancel(id),false);s.dispose();
});

test('deadline options are bounded fixture-only own data properties',()=>{
 for(const x of [null,{},[],{timeoutMs:-1},{timeoutMs:15001},{timeoutMs:NaN},{timeoutMs:1.5},{timeoutMs:'50'},{timeoutMs:100,worker:'other'}])assert.throws(()=>create(x),refuse);
 let invoked=false;const x={};Object.defineProperty(x,'timeoutMs',{enumerable:true,get(){invoked=true;return 50;}});
 assert.throws(()=>create(x),refuse);assert.equal(invoked,false);
 for(const n of [0,1,15000])assert.equal(create({timeoutMs:n}).dispose(),true);
});
test('zero deadline discards actual child result and retains single-flight until close',async()=>{
 const s=create({timeoutMs:0}),p=s.analyze(request()),id=s.status().activeJobId;
 assert.equal(s.status().active,true);assert.equal(s.cancel(id),false);
 await assert.rejects(s.analyze(request()),refuse);
 const r=await p;assert.deepEqual(r,{state:'fixture-worker-failed',reason:'timeout',report:null,operationsEnabled:false});
 assert.equal(s.status().active,false);assert.equal(s.status().activeJobId,null);assert.equal(s.dispose(),true);
});
test('expired monotonic deadline wins over late cancellation even when parent timer delivery is blocked',async()=>{
 const s=create({timeoutMs:50}),p=s.analyze(request('clean-reference')),id=s.status().activeJobId;
 // Deliberately stall only this test's event loop; deadline must not depend on timer delivery.
 const until=process.hrtime.bigint()+80000000n;
 while(process.hrtime.bigint()<until)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
 assert.equal(s.cancel(id),false);
 const r=await p;assert.deepEqual(r,{state:'fixture-worker-failed',reason:'timeout',report:null,operationsEnabled:false});
 assert.equal(s.status().active,false);s.dispose();
});

test('watchdog permanently quarantines when child close notification is withheld',async t=>{
 // Fault injection only: delay delivery of the real owned child's close event.
 // No external PID is targeted; this does not simulate OS kill failure.
 const original=ChildProcess.prototype.emit;
 let delayed=null;
 const mock=t.mock.method(ChildProcess.prototype,'emit',function(event,...args){
  if(event==='close'&&this.spawnargs?.some(x=>x.endsWith('runtime-fixture-worker.mjs'))){
   delayed=()=>original.call(this,event,...args);return true;
  }
  return original.call(this,event,...args);
 });
 const s=create({timeoutMs:0});
 try{
  const r=await s.analyze(request());
  assert.deepEqual(r,{state:'fixture-worker-failed',reason:'termination-unconfirmed',report:null,operationsEnabled:false});
  assert.equal(s.status().active,false);assert.equal(s.status().quarantined,true);
  assert.equal(s.status().cleanupPending,true);
  await assert.rejects(s.analyze(request()),refuse);assert.throws(()=>s.dispose(),refuse);
  assert.equal(typeof delayed,'function');
  delayed();delayed=null;
  assert.equal(s.status().cleanupPending,false);assert.equal(s.status().quarantined,true);
  await assert.rejects(s.analyze(request()),refuse);assert.equal(s.dispose(),true);
 }finally{
  mock.mock.restore();
  if(delayed)delayed();
 }
});
test('normal cancellation confirms closure without quarantining the supervisor',async()=>{
 const s=create(),p=s.analyze(request()),id=s.status().activeJobId;
 assert.equal(s.cancel(id),true);assert.equal(s.status().cleanupPending,true);
 assert.equal((await p).reason,'cancelled');
 assert.equal(s.status().cleanupPending,false);assert.equal(s.status().quarantined,false);
 assert.equal((await s.analyze(request('clean-reference'))).state,'fixture-worker-report');
 s.dispose();
});

test('late close cannot avoid quarantine when monotonic cleanup deadline expires before timer dispatch',async t=>{
 // Delay actual close notification, not actual OS termination. Deliver it synchronously
 // after the monotonic grace expires, before the event loop dispatches watchdog timers.
 const original=ChildProcess.prototype.emit;
 let delivered=false,blocked=false;
 const mock=t.mock.method(ChildProcess.prototype,'emit',function(event,...args){
  if(!delivered&&event==='close'&&this.spawnargs?.some(x=>x.endsWith('runtime-fixture-worker.mjs'))){
   delivered=true;
   const end=process.hrtime.bigint()+2100000000n;
   const cell=new Int32Array(new SharedArrayBuffer(4));
   while(process.hrtime.bigint()<end)Atomics.wait(cell,0,0,10);
   blocked=true;
  }
  return original.call(this,event,...args);
 });
 const s=create({timeoutMs:0});
 try{
  const result=await s.analyze(request());
  assert.equal(delivered,true);assert.equal(blocked,true);
  assert.deepEqual(result,{state:'fixture-worker-failed',reason:'termination-unconfirmed',report:null,operationsEnabled:false});
  assert.equal(s.status().quarantined,true);assert.equal(s.status().cleanupPending,false);
  assert.equal(s.status().active,false);
  await assert.rejects(s.analyze(request()),refuse);
  assert.equal(s.dispose(),true);
 }finally{mock.mock.restore();}
});

test('owned worker abrupt termination discards partial output and permits a fresh explicit job after confirmed close',async t=>{
 const original=ChildProcess.prototype.spawn;
 let owned=null,originalEnd=null;
 const mock=t.mock.method(ChildProcess.prototype,'spawn',function(options){
  const value=original.call(this,options);
  if(!owned&&options.args?.some(x=>x.endsWith('runtime-fixture-worker.mjs'))){
   owned=this;
   // Fault injection: hold the first job's input open so the actual child cannot
   // complete normally before the test terminates it using its retained handle.
   originalEnd=this.stdin.end;
   this.stdin.end=function(){return this;};
  }
  return value;
 });
 const s=create();
 try{
  const first=s.analyze(request()),old=s.status().activeJobId;
  assert.ok(owned&&owned.pid>0);
  owned.stdin.end=originalEnd;
  // Synthetic partial wire, not a claim that the worker actually produced it.
  owned.stdout.emit('data',Buffer.from('{"schemaVersion":1'));
  assert.equal(owned.kill('SIGKILL'),true);
  const failed=await first;
  assert.deepEqual(failed,{state:'fixture-worker-failed',reason:'worker-exit',report:null,operationsEnabled:false});
  assert.equal(s.status().cleanupPending,false);assert.equal(s.status().quarantined,false);
  assert.equal(s.status().activeJobId,null);assert.equal(s.status().acceptedJobs,1);
  mock.mock.restore();
  const next=s.analyze(request('clean-reference')),id=s.status().activeJobId;
  assert.notEqual(old,id);assert.equal(s.cancel(old),false);
  const result=await next;assert.equal(result.state,'fixture-worker-report');
  assert.equal(result.report.jobId,id);assert.deepEqual(result.report.findings,[]);
  assert.equal(s.status().acceptedJobs,2);assert.equal(s.dispose(),true);
 }finally{
  mock.mock.restore();
  if(owned&&owned.exitCode===null&&owned.signalCode===null)owned.kill('SIGKILL');
 }
});
test('malformed mixed worker output cannot be published and next job starts with empty output',async t=>{
 const original=ChildProcess.prototype.spawn;
 let injected=false;
 const mock=t.mock.method(ChildProcess.prototype,'spawn',function(options){
  const result=original.call(this,options);
  if(!injected&&options.args?.some(x=>x.endsWith('runtime-fixture-worker.mjs'))){
   injected=true;
   this.once('spawn',()=>this.stdout.emit('data',Buffer.from('{"partial":')));
  }
  return result;
 });
 const s=create();
 try{
  const first=await s.analyze(request());
  assert.equal(injected,true);
  assert.deepEqual(first,{state:'fixture-worker-failed',reason:'invalid-report',report:null,operationsEnabled:false});
  assert.equal(s.status().quarantined,false);assert.equal(s.status().cleanupPending,false);
  mock.mock.restore();
  const second=await s.analyze(request('clean-reference'));
  assert.equal(second.state,'fixture-worker-report');assert.deepEqual(second.report.findings,[]);
  assert.equal(s.status().acceptedJobs,2);assert.equal(s.dispose(),true);
 }finally{mock.mock.restore();}
});
