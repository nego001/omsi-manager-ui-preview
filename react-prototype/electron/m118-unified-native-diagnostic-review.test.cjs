'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {createUnifiedReview:review,dependencySummary}=require('../scripts/m118-unified-native-diagnostic-review.cjs');
const run=(file,...args)=>{
 const p=spawnSync('python3',['-I','-S','-B',path.join(__dirname,'..','native-lab',file),...args],{encoding:'utf8',timeout:15000,maxBuffer:16384});
 assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);
};
test('actual Linux lab outputs produce a count-only combined review, not authority',{skip:process.platform!=='linux',timeout:45000},()=>{
 const data={reader:run('m111-linux-dirfd-config-reader.py'),format:run('m111-linux-dirfd-config-reader.py','--test-format-m115'),dependencies:run('m116-linux-dependency-metadata.py')};
 const r=review('linux',data);
 assert.equal(r.reader.fixtureCases,12);assert.equal(r.format.rows.length,2);assert.equal(r.dependencies.observedCases,7);
 assert.equal(r.coverageGaps,0);assert.equal(r.linkedSameFileIdentityVerified,false);assert.equal(r.contentReadAuthorized,false);
 assert.throws(()=>review('linux',{...data,format:{...data.format,operationsEnabled:true}}));
 assert.throws(()=>review('win32',data));
 assert.doesNotMatch(JSON.stringify(r),/fixtureBase64|\.o3d|\.cfg|\.bus/);
 console.log('M119_LINUX_UNIFIED_REVIEW',JSON.stringify(r));
});
function windowsDeps(){
 return {schema:'omsi-m117-windows-dependency-metadata-fixture-v1',nativeDirectoryEnumerationByHandle:true,dependencyContentsRead:false,realModValidated:false,atomicContainmentProven:false,operationsEnabled:false,
 cases:Object.entries({exact:'exact-observed','case-only':'case-only-observed',missing:'not-observed-in-directory',ambiguous:'fixture-unavailable',link:'fixture-unavailable',directory:'not-regular-path',hardlink:'not-regular-path'}).map(([scenario,outcome])=>({scenario,outcome}))};
}
test('Windows fixture gaps are preserved; fabricated coverage, missing rows and extra data refuse',()=>{
 const d=windowsDeps(),r=dependencySummary('win32',d);
 assert.equal(r.observedCases,5);assert.deepEqual(r.unavailableCases,['ambiguous','link']);assert.equal(r.partialBudgetFixtureCovered,false);
 assert.throws(()=>dependencySummary('win32',{...d,cases:d.cases.slice(1)}));
 assert.throws(()=>dependencySummary('win32',{...d,cases:d.cases.map(c=>c.scenario==='exact'?{...c,outcome:'fixture-unavailable'}:c)}));
 assert.throws(()=>dependencySummary('win32',{...d,dependencyContentsRead:true}));
 assert.throws(()=>dependencySummary('win32',{...d,path:'private'}));
});
