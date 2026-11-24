'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
function report(labels,extra={}){
 return {status:'ok',game:'ets2',mode:'read-only',selectionMode:'parent-folder',limited:false,
  folderName:'private-folder',groups:[{key:'mods',found:true,limited:false,directories:labels.length,packageCandidates:0,
  inventory:labels.map(label=>({kind:'directory',label})),...extra}]};
}
test('M139 compares exact group/type/name observations without identity or content claims',async()=>{
 const {captureLocalObservation:capture,compareLocalObservations:compare}=await import('../src/local-inventory-comparison.mjs');
 const a=capture(report(['Bus A','Bus B']),'ets2'),b=capture(report(['Bus B','Bus C']),'ets2');
 const v=compare(a,b);
 assert.equal(v.shared,1);assert.deepEqual(v.onlyReference.map(x=>x.label),['Bus A']);
 assert.deepEqual(v.onlyCurrent.map(x=>x.label),['Bus C']);assert.equal(v.partial,false);
 for(const k of ['sameLocationVerified','contentCompared','operationsEnabled'])assert.equal(v[k],false);
 assert.ok(Object.isFrozen(a.rows));assert.ok(!JSON.stringify(a).includes('private-folder'));
});
test('M139 partial evidence, scope mismatch, invalid names and duplicate rows',async()=>{
 const {captureLocalObservation:capture,compareLocalObservations:compare}=await import('../src/local-inventory-comparison.mjs');
 const a=capture(report(['a'],{directories:3}),'ets2');
 assert.equal(a.partial,true);
 assert.equal(compare(a,capture(report(['b']),'ets2')).partial,true);
 assert.equal(compare(a,capture({...report(['b']),selectionMode:'direct-mod-folder'},'ets2')),null);
 assert.equal(capture(report(['a','a']),'ets2'),null);
 assert.equal(capture(report(['../secret']),'ets2'),null);
 assert.equal(capture(report(['a']),'ats'),null);
 assert.equal(capture(report(['a'],{inventory:undefined}),'ets2'),null);
});
