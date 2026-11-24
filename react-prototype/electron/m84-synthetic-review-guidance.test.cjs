'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSyntheticReviewGuidance:review}=require('../scripts/m84-synthetic-review-guidance.cjs');
const model=(target,source='bus.bus')=>({kind:'vehicle-definition',keyword:'[model]',source,target});
const mesh=target=>({kind:'vehicle-model',keyword:'[mesh]',source:'model/model.cfg',target});
const run=(files,references,complete=true)=>review({files,references,complete});
test('mixed findings produce ordered manual-only guidance and occurrence totals',()=>{
 const r=run(['bus.bus','model/model.cfg','model/Body.o3d','model/A.o3d','model/a.o3d'],[
  model('model/model.cfg'),mesh('body.o3d'),mesh('a.o3d'),mesh('missing.o3d'),model('../secret.cfg')]);
 assert.deepEqual(r.items.map(x=>x.id),['review-reference-syntax','review-name-collision','review-original-package','review-case-spelling']);
 assert.equal(r.reviewOccurrences,4);assert.equal(r.totalReferences,5);
 assert.equal(r.items.reduce((sum,x)=>sum+x.referenceOccurrences,0),4);
 assert.ok(r.items.every(x=>x.manualReviewOnly===true));
});
test('partial evidence suggests coverage, not restoring an absent file',()=>{
 const r=run(['bus.bus'],[model('missing.cfg')],false);
 assert.deepEqual(r.prerequisites,['inventory-incomplete']);
 assert.deepEqual(r.items.map(x=>x.id),['review-inventory-coverage']);
 assert.equal(r.inventoryComplete,false);
});
test('unsupported grammar and unconfirmed source preserve prerequisites',()=>{
 const r=run(['bus.bus'],[mesh('body.o3d'),{kind:'vehicle-definition',keyword:'[sound]',source:'bus.bus',target:'sound.cfg'}]);
 assert.deepEqual(r.prerequisites,['source-unconfirmed','unsupported-format']);
 assert.deepEqual(r.items.map(x=>x.id),['review-source','review-format-documentation']);
});
test('exact matches and empty evidence do not produce repair actions',()=>{
 const empty=run([],[],false);
 assert.deepEqual(empty.prerequisites,['inventory-incomplete','no-reference-evidence']);
 assert.deepEqual(empty.items,[]);
 const exact=run(['bus.bus','model.cfg'],[model('model.cfg')]);
 assert.deepEqual(exact.items,[]);assert.equal(exact.reviewOccurrences,0);
 for(const r of [empty,exact]){
  assert.equal(r.compatibilityVerified,false);assert.equal(r.repairAllowed,false);assert.equal(r.operationsEnabled,false);
 }
});
test('entry type mismatch and duplicate occurrence aggregation stay manual',()=>{
 const r=run(['bus.bus','model.cfg/child.bin'],[model('model.cfg'),model('model.cfg')]);
 assert.equal(r.items.length,1);assert.equal(r.items[0].id,'review-entry-type');assert.equal(r.items[0].referenceOccurrences,2);
});
test('supplied verdict or arbitrary names never create permission or enter guidance',()=>{
 const r=review({files:['private.bus'],references:[model('../PRIVATE_TOKEN.cfg','private.bus')],complete:true,
  repairAllowed:true,operationsEnabled:true,items:[{command:'PRIVATE_TOKEN'}]});
 for(const key of ['repairAllowed','operationsEnabled','realFilesInspected','compatibilityVerified'])assert.equal(r[key],false);
 const out=JSON.stringify(r);assert.ok(!out.includes('PRIVATE_TOKEN'));assert.ok(!out.includes('private.bus'));
 assert.throws(()=>review({files:['x','x'],references:[],complete:true}),/M81D_FIXTURE_REFUSED/);
});
