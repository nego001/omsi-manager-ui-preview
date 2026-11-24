'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
test('M142 unknown is not a zero verified inventory; error is distinct',async()=>{
 const {summarizeLocalDiagnostics}=await import('../src/local-diagnostic-summary.mjs');
 const a=summarizeLocalDiagnostics({ets2:{status:'error',message:'/private/path'}});
 assert.equal(a.observedGames,0);assert.equal(a.attentionGames,1);
 assert.deepEqual(a.rows.map(r=>r.state),['unknown','unavailable','unknown']);
 assert.ok(!JSON.stringify(a).includes('/private/path'));
 for(const k of ['contentVerified','compatibilityVerified','operationsEnabled'])assert.equal(a[k],false);
});
test('M142 aggregates observed metadata and flags partial coverage and ignored links',async()=>{
 const {summarizeLocalDiagnostics}=await import('../src/local-diagnostic-summary.mjs');
 const a=summarizeLocalDiagnostics({omsi:{status:'ok',game:'omsi',mode:'read-only',recognized:true,limited:true,groups:[
  {found:true,limited:true,inventory:[{label:'PRIVATE_NAME'}],directories:2,packageCandidates:0,linksSkipped:3},
  {found:false,limited:false,inventory:[],directories:0,packageCandidates:0,linksSkipped:0}
 ]}});
 assert.equal(a.observedGames,1);assert.equal(a.attentionGames,1);
 assert.deepEqual(a.rows[0],{game:'omsi',state:'partial',names:1,links:3,missingGroups:1,limited:true,namesOmitted:true,inventoryCollected:true});
 assert.ok(!JSON.stringify(a).includes('PRIVATE_NAME'));
});
