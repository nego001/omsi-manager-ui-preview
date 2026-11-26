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

test('issued report integrity checks reject copies and foreign bridge reports',async()=>{
 const a=create(),b=create(),r=(await a.analyze(request())).report;
 assert.equal(a.verify(r),true);assert.equal(b.verify(r),false);
 assert.equal(a.verify({...r}),false);assert.equal(a.verify(JSON.parse(JSON.stringify(r))),false);
 let invoked=false;const fake={get bridgeDigest(){invoked=true;return r.bridgeDigest}};
 assert.equal(a.verify(fake),false);assert.equal(invoked,false);
 assert.throws(()=>a.project({...r},{sector:'library',offset:0,limit:0}),refuse);
 a.dispose();assert.equal(a.verify(r),false);b.dispose();
});
test('diagnostics projection paginates stable findings with shared identity',async()=>{
 const b=create(),x=request();x.files[0].bytes=Buffer.from('@include "one.sui"\n@include "two.sui"\n@include "three.sui"');
 const r=(await b.analyze(x)).report,p=b.project(r,{sector:'diagnostics',offset:0,limit:2});
 assert.equal(p.total,3);assert.equal(p.nextOffset,2);assert.equal(p.findings.length,2);
 const q=b.project(r,{sector:'diagnostics',offset:p.nextOffset,limit:2});
 assert.equal(q.nextOffset,null);assert.deepEqual([...p.findings,...q.findings],r.fusion.findings);
 assert.equal(q.bridgeDigest,r.bridgeDigest);assert.equal(q.core.snapshotId,r.snapshot.snapshotId);
 assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.findings));b.dispose();
});
test('sector projections disclose only allowed evidence and never authorize actions',async()=>{
 const b=create(),r=(await b.analyze(request())).report;
 for(const sector of ['library','planner','studio']){
  const p=b.project(r,{sector,offset:0,limit:0});assert.equal(p.operationsEnabled,false);
  assert.equal(Object.hasOwn(p,'findings'),false);assert.equal(Object.hasOwn(p,'summary'),sector==='library');
  assert.equal(p.core.snapshotId,r.snapshot.snapshotId);
  if(sector==='planner')assert.equal(p.core.planAvailable,false);
  if(sector==='studio')assert.equal(p.core.audioWorkspace,false);
 }
 b.dispose();
});
test('invalid projection requests and pagination bounds fail closed',async()=>{
 const b=create(),r=(await b.analyze(request())).report;
 for(const q of [{sector:'diagnostics',offset:-1,limit:1},{sector:'diagnostics',offset:2,limit:1},{sector:'diagnostics',offset:0,limit:65},{sector:'library',offset:0,limit:1},{sector:'installer',offset:0,limit:0},{sector:'library',offset:0,limit:0,operationsEnabled:true}])
  assert.throws(()=>b.project(r,q),refuse);
 assert.deepEqual(b.project(r,{sector:'diagnostics',offset:1,limit:1}).findings,[]);
 let called=false;const q={sector:'library',offset:0,limit:0};Object.defineProperty(q,'offset',{get(){called=true;return 0}});
 assert.throws(()=>b.project(r,q),refuse);assert.equal(called,false);b.dispose();
});
test('invalid budget contract rejected before acceptance and explicit policy depth charged',async()=>{
 const b=create(),x=request();x.budget.durationMs=0;await assert.rejects(b.analyze(x),refuse);assert.equal(b.status().acceptedJobs,0);
 const y=request();y.textureRoots=['a/b/c'];y.budget.depth=2;
 assert.equal((await b.analyze(y)).state,'budget-refused');b.dispose();
});

test('end-to-end malformed binary leaf cannot become a validated or actionable diagnostic',async()=>{
 const b=create(),x=request();
 const wav=Buffer.alloc(46);wav.write('RIFF');wav.writeUInt32LE(38,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(2,40);
 x.roots=['sound.cfg'];x.files=[{path:'sound.cfg',bytes:Buffer.from('[sound]\nengine.wav'),cfgKind:'sound'},{path:'engine.wav',bytes:wav,cfgKind:null}];
 const good=(await b.analyze(x)).report;assert.equal(good.fusion.summary.fixtureStatus,'no-discovered-findings');
 wav[0]|=128;
 const bad=(await b.analyze(x)).report;assert.ok(b.verify(bad));assert.notEqual(bad.bridgeDigest,good.bridgeDigest);
 assert.deepEqual(bad.fusion.findings.map(f=>f.code).sort(),['MATCHED_UNREADABLE_TARGET','UNREADABLE_SUBSET']);
 assert.equal(bad.snapshot.status,'incomplete');assert.equal(bad.cacheEligible,false);assert.equal(bad.persistencePerformed,false);
 const page=b.project(bad,{sector:'diagnostics',offset:0,limit:64});assert.equal(page.total,2);assert.equal(page.operationsEnabled,false);
 b.dispose();
});
