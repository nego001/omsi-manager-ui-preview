import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFixtureReaderBridge as bridge} from './reader-bridge.mjs';
const refuse=/CORE_FIXTURE_READER_REFUSED/;
const create=()=>bridge({scope:'synthetic-fixture',maxJobs:8});
const request=()=>({scope:'synthetic-fixture',roots:['a.sui'],files:[{path:'a.sui',bytes:Buffer.from('@include "missing.sui"'),cfgKind:null}],encoding:'utf-8',textureRoots:[],limits:{maxBytes:8192,maxEntries:16,maxReferences:16,maxGraphBytes:65536,maxFindings:16,maxReportBytes:65536},budget:{bytes:8192,entries:16,steps:128,depth:32,durationMs:10000}});
test('bridge delivers actual reader findings and an incomplete Core snapshot',async()=>{
 const b=create(),r=await b.analyze(request());assert.equal(r.state,'fixture-report-ready');
 assert.equal(r.report.fusion.findings[0].code,'MISSING_REFERENCE');
 assert.equal(r.report.snapshot.sourceDigest,r.report.fusion.graphDigest);
 assert.equal(r.report.snapshot.status,'incomplete');assert.equal(r.report.snapshot.gameCandidate,null);
 for(const p of Object.values(r.report.projections)){assert.equal(p.snapshotId,r.report.snapshot.snapshotId);assert.equal(p.operationsEnabled,false);}
 for(const k of ['cacheEligible','persistencePerformed','realSecurityGateVerified','realReadsPerformed','operationsEnabled','productionIntegrated'])assert.equal(r.report[k],false);
 assert.equal(b.status().active,false);b.dispose();
});
test('bridge logical budget preflight denies oversized requests without report',async()=>{
 for(const patch of [{bytes:1},{steps:1},{depth:0}]){
  const b=create(),x=request();Object.assign(x.budget,patch);
  const r=await b.analyze(x);assert.equal(r.state,'budget-refused');assert.equal(r.report,null);b.dispose();
 }
});
test('reader refusal and report caps cannot publish a partial report',async()=>{
 for(const change of [x=>x.files[0].path='../a.sui',x=>x.limits.maxFindings=0,x=>x.limits.maxReportBytes=1]){
  const b=create(),x=request();change(x);const r=await b.analyze(x);
  assert.equal(r.state,'failed');assert.equal(r.report,null);b.dispose();
 }
});
test('cancellation before dispatch suppresses report and permits a fresh job',async()=>{
 const b=create(),pending=b.analyze(request());assert.equal(b.cancel(),true);
 const r=await pending;assert.equal(r.state,'cancelled');assert.equal(r.report,null);
 assert.equal((await b.analyze(request())).state,'fixture-report-ready');b.dispose();
});
test('input buffers copied before queue dispatch and output deterministic',async()=>{
 const b=create(),x=request(),pending=b.analyze(x);x.files[0].bytes.fill(0);
 const r=await pending,s=await b.analyze(request());assert.deepEqual(r,s);assert.ok(Object.isFrozen(r.report)&&Object.isFrozen(r.report.projections));b.dispose();
});
test('single-flight, job cap and closed bridge enforced',async()=>{
 const b=bridge({scope:'synthetic-fixture',maxJobs:1}),p=b.analyze(request());
 await assert.rejects(b.analyze(request()),refuse);assert.throws(()=>b.dispose(),refuse);await p;
 await assert.rejects(b.analyze(request()),refuse);assert.equal(b.dispose(),true);assert.equal(b.dispose(),false);
 await assert.rejects(b.analyze(request()),refuse);
});
test('real scope, forged evidence and accessor fields denied',async()=>{
 const b=create();await assert.rejects(b.analyze({...request(),scope:'real-mod'}),refuse);
 await assert.rejects(b.analyze({...request(),snapshot:{operationsEnabled:true}}),refuse);
 let called=false;const x=request();Object.defineProperty(x,'files',{get(){called=true;return []}});
 await assert.rejects(b.analyze(x),refuse);assert.equal(called,false);assert.equal(b.status().acceptedJobs,0);b.dispose();
});
