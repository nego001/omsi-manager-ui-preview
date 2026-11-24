'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {diagnoseSyntheticDependencies:diagnose}=require('../scripts/m82-synthetic-dependency-diagnostics.cjs');
const model=target=>({kind:'vehicle-definition',keyword:'[model]',source:'bus.bus',target});
const mesh=target=>({kind:'vehicle-model',keyword:'[mesh]',source:'model/model.cfg',target});
const run=(files,references,complete=true)=>diagnose({files,references,complete});
test('mixed fixture findings retain fixed order and reference totals',()=>{
 const r=run(['bus.bus','model/model.cfg','model/Body.o3d','model/A.o3d','model/a.o3d'],[
  model('model/model.cfg'),mesh('body.o3d'),mesh('a.o3d'),mesh('missing.o3d'),model('../secret.cfg')]);
 assert.equal(r.state,'fixture-findings');
 assert.deepEqual(r.counts,{high:3,review:1,info:1});
 assert.deepEqual(r.items.map(x=>x.code),['invalid-reference','ambiguous-case','absent-from-fixture','case-only','exact']);
 assert.equal(r.items.reduce((n,x)=>n+x.count,0),r.totalReferences);
 assert.ok(!JSON.stringify(r).includes('secret.cfg'));
});
test('partial inventory cannot create an absent finding',()=>{
 const r=run(['bus.bus'],[model('unknown.cfg')],false);
 assert.equal(r.state,'review-required');assert.equal(r.inventoryComplete,false);
 assert.deepEqual(r.items.map(x=>x.code),['not-observed']);
 assert.deepEqual(r.counts,{high:0,review:1,info:0});
});
test('no evidence and exact-only evidence never claim compatibility',()=>{
 for(const [refs,complete,state] of [[[],true,'no-reference-evidence'],[[model('m.cfg')],true,'observed-exact-only'],[[model('m.cfg')],false,'review-required']]){
  const r=run(['bus.bus','m.cfg'],refs,complete);
  assert.equal(r.state,state);
  assert.equal(r.compatibilityVerified,false);assert.equal(r.operationsEnabled,false);assert.equal(r.realFilesInspected,false);
 }
});
test('unsupported keyword and unconfirmed source stay review findings',()=>{
 const r=run(['bus.bus'],[{kind:'vehicle-definition',keyword:'[sound]',source:'bus.bus',target:'sound.cfg'},mesh('body.o3d')]);
 assert.equal(r.state,'review-required');
 assert.equal(r.counts.high,0);assert.equal(r.counts.review,2);
 assert.deepEqual(r.items.map(x=>x.code),['source-unconfirmed','unsupported-reference']);
});
test('duplicate references count individually; forged verdict fields ignored',()=>{
 const r=diagnose({files:['bus.bus'],references:[model('m.cfg'),model('m.cfg')],complete:true,
  results:['exact'],compatibilityVerified:true,operationsEnabled:true});
 assert.equal(r.items[0].count,2);assert.equal(r.counts.high,2);
 assert.equal(r.compatibilityVerified,false);assert.equal(r.operationsEnabled,false);
});
test('invalid inventories fail rather than manufacturing a report',()=>{
 assert.throws(()=>run(['bus.bus','bus.bus'],[]),/M81D_FIXTURE_REFUSED/);
 assert.throws(()=>diagnose({files:['bus.bus'],references:[],complete:'true'}),/M81D_FIXTURE_REFUSED/);
});
