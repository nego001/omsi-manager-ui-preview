'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compareFixturePlatforms:compare}=require('../scripts/m119-cross-platform-fixture-comparison.cjs');
function input(platform,gaps=false){
 const linux=platform==='linux';
 const readerNames=linux?['normal','maximum','symlink','fifo','hardlink','oversized','empty','parent-replaced','file-replaced','changed-during-read','cancel-before','cancel-during-read']:['normal','maximum','empty','oversized','directory-instead','hardlink','reparse','parent-replaced','file-replaced','changed-during-read','cancel-before','cancel-during-read'];
 const reader={schema:linux?'omsi-m111-linux-dirfd-fixture-v1':'omsi-m112-windows-handle-fixture-v1',
  ...(linux?{nativeDirFdUsed:true}:{relativeNativeOpenUsed:true,nativeFileIdChecked:true}),
  nativeIdentityVerifiedForRealMods:false,atomicContainmentProven:false,abaRuledOut:false,osDeadlineProven:false,realModRead:false,operationsEnabled:false,
  cases:readerNames.map(scenario=>{
   const normal=['normal','maximum'].includes(scenario),partial=['changed-during-read','cancel-during-read'].includes(scenario);
   return {scenario,outcome:normal?'matching-two-snapshots':!linux&&gaps&&scenario==='parent-replaced'?'fixture-unavailable':'refused',
    opened:normal||partial||scenario==='file-replaced'?1:0,readCalls:scenario==='maximum'?32:normal?6:partial?1:0,bytesRead:scenario==='maximum'?131072:normal?16386:partial?4096:0};
  })};
 const format={schema:'omsi-m115-fixed-native-format-fixture-v1',platform,realModRead:false,operationsEnabled:false,
  cases:[['vehicle-definition','[model]\r\nmodel\\vehicle.cfg\r\n[sound]\r\nsound.cfg\r\n'],['vehicle-model','[mesh]\r\nbody.o3d\r\n[mesh]\r\nmissing.o3d\r\n']].map(([role,text])=>({role,fixtureBase64:Buffer.from(text).toString('base64'),opened:1,readCalls:2,bytesRead:2*Buffer.byteLength(text)}))};
 const outcomes={exact:'exact-observed','case-only':'case-only-observed',missing:'not-observed-in-directory',ambiguous:!linux&&gaps?'fixture-unavailable':'ambiguous-case',link:'link-refused',directory:'not-regular-path',...(linux?{limited:'budget-limited'}:{hardlink:'not-regular-path'})};
 const dependencies={schema:linux?'omsi-m116-linux-dependency-metadata-fixture-v1':'omsi-m117-windows-dependency-metadata-fixture-v1',
  ...(linux?{nativeDirectoryDescriptorUsed:true}:{nativeDirectoryEnumerationByHandle:true}),dependencyContentsRead:false,realModValidated:false,atomicContainmentProven:false,operationsEnabled:false,
  cases:Object.entries(outcomes).map(([scenario,outcome])=>({scenario,outcome,...(linux?{entriesScanned:scenario==='limited'?1:6}:{})}))};
 return {reader,format,dependencies};
}
test('synthetic cross-platform comparison preserves gaps and denies parity even with matching formats',()=>{
 const r=compare(input('linux'),input('win32',true));
 assert.equal(r.formatsAgree,true);assert.equal(r.windows.gaps,2);assert.equal(r.windows.dependencyCases,6);assert.equal(r.linux.gaps,0);
 assert.ok(r.differences.includes('windows-reader-fixture-unavailable'));
 assert.ok(r.differences.includes('windows-dependency-ambiguous-unavailable'));
 for(const k of ['fullParityVerified','ciProvenanceVerified','nativeConsentVerified','linkedSameFileIdentityVerified','contentReadAuthorized','operationsEnabled'])assert.equal(r[k],false);
 assert.doesNotMatch(JSON.stringify(r),/fixtureBase64|\.o3d|\.cfg|\.bus/);
});
test('even complete fixture coverage does not imply platform parity; mismatched platform or forged report refuse',()=>{
 const r=compare(input('linux'),input('win32'));
 assert.equal(r.windows.gaps,0);assert.equal(r.fullParityVerified,false);assert.equal(r.differences.length,4);
 assert.throws(()=>compare(input('win32'),input('linux')));
 const w=input('win32');w.reader.operationsEnabled=true;assert.throws(()=>compare(input('linux'),w));
});
