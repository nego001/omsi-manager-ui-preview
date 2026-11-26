import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
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
