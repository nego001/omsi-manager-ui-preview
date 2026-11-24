'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {admitNativeFixture:admit}=require('../scripts/m114-native-reader-evidence-boundary.cjs');
const cases=['normal','maximum','empty','oversized','directory-instead','hardlink','reparse','parent-replaced','file-replaced','changed-during-read','cancel-before','cancel-during-read'];
function windowsExample(){
 return {schema:'omsi-m112-windows-handle-fixture-v1',relativeNativeOpenUsed:true,nativeFileIdChecked:true,
  nativeIdentityVerifiedForRealMods:false,atomicContainmentProven:false,abaRuledOut:false,osDeadlineProven:false,realModRead:false,operationsEnabled:false,
  cases:cases.map(scenario=>{
   const normal=['normal','maximum'].includes(scenario),partial=['changed-during-read','cancel-during-read'].includes(scenario);
   return {scenario,outcome:normal?'matching-two-snapshots':'refused',opened:normal||partial||scenario==='file-replaced'?1:0,
    readCalls:scenario==='maximum'?32:normal?6:partial?1:0,bytesRead:scenario==='maximum'?131072:normal?16386:partial?4096:0};
  })};
}
test('actual Linux lab output satisfies common review boundary without granting authority',{skip:process.platform!=='linux',timeout:20000},()=>{
 const run=spawnSync('python3',['-I','-S','-B',path.join(__dirname,'..','native-lab','m111-linux-dirfd-config-reader.py')],{encoding:'utf8',timeout:15000,maxBuffer:16384});
 assert.equal(run.status,0,run.stderr);
 const result=admit('linux',JSON.parse(run.stdout));
 assert.equal(result.matchingSnapshots,2);assert.equal(result.refusals,10);assert.equal(result.fixtureCoverageComplete,true);
 assert.equal(result.contentReadAuthorized,false);assert.equal(result.productionReaderAvailable,false);
});
test('unavailable reparse fixture remains an explicit gap, not a verified refusal',()=>{
 const raw=windowsExample();
 raw.cases.find(c=>c.scenario==='reparse').outcome='fixture-unavailable';
 const result=admit('win32',raw);
 assert.equal(result.refusals,9);assert.equal(result.unavailableCases,1);assert.equal(result.fixtureCoverageComplete,false);
 assert.equal(result.independentlyVerified,false);assert.equal(result.contentReadAuthorized,false);
});
test('forged flags, incomplete cases, mismatched platform, raw path and impossible counters refuse',()=>{
 const raw=windowsExample();
 assert.equal(admit('win32',raw).operationsEnabled,false);
 for(const v of [{...raw,operationsEnabled:true},{...raw,path:'/private'},{...raw,cases:raw.cases.slice(1)},
  {...raw,cases:[...raw.cases.slice(1),raw.cases[1]]},{...raw,cases:raw.cases.map(c=>c.scenario==='hardlink'?{...c,bytesRead:1}:c)},
  {...raw,cases:raw.cases.map(c=>c.scenario==='maximum'?{...c,readCalls:2}:c)}])
  assert.throws(()=>admit('win32',v),/M114_NATIVE_EVIDENCE_REFUSED/);
 assert.throws(()=>admit('linux',raw));assert.throws(()=>admit('darwin',raw));
});
