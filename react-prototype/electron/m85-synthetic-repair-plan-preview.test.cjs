'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPlanningSession:session}=require('../scripts/m85-synthetic-repair-plan-preview.cjs');
const model=target=>({kind:'vehicle-definition',keyword:'[model]',source:'private.bus',target});
const fixture=(references=[model('missing.cfg')],complete=true)=>({files:['private.bus','model.cfg'],references,complete});
test('plan projects manual review only and retains no private target names',()=>{
 const s=session(),p=s.begin(fixture([model('../PRIVATE_TOKEN.cfg'),model('missing.cfg')]));
 assert.equal(p.steps.length,2);assert.equal(p.reviewOccurrences,2);
 assert.ok(p.steps.every(x=>x.executable===false&&x.affectedFilesKnown===false));
 assert.equal(p.repairAllowed,false);assert.equal(p.operationsEnabled,false);
 for(const token of ['PRIVATE_TOKEN','private.bus','missing.cfg'])assert.ok(!JSON.stringify(p).includes(token));
 assert.equal(s.status(p).rehearsalChecklistComplete,false);
});
test('individual acknowledgements and requirement review never authorize execution',()=>{
 const s=session(),p=s.begin(fixture());
 s.reviewStep(p,p.steps[0].id);
 s.reviewRequirement(p,'backup');
 assert.equal(s.status(p).rehearsalChecklistComplete,false);
 const state=s.reviewRequirement(p,'reversal');
 assert.equal(state.rehearsalChecklistComplete,true);
 for(const key of ['backupVerified','rollbackVerified','actualConsentGranted','repairAllowed','operationsEnabled'])assert.equal(state[key],false);
 assert.ok(state.executionBlockers.includes('execution-not-implemented'));
 assert.equal(s.execute,undefined);
});
test('new revision resets review and rejects stale or copied plans',()=>{
 const s=session(),a=s.begin(fixture());
 s.reviewStep(a,a.steps[0].id);s.reviewRequirement(a,'backup');
 const b=s.begin(fixture());
 assert.equal(b.revision,a.revision+1);
 assert.deepEqual(s.status(b).reviewedSteps,[]);
 assert.equal(s.status(b).backupRequirementReviewed,false);
 for(const old of [a,{...b},JSON.parse(JSON.stringify(b))]){
  assert.throws(()=>s.status(old),/M85_PLAN_REFUSED/);
  assert.throws(()=>s.reviewStep(old,b.steps[0].id),/M85_PLAN_REFUSED/);
 }
});
test('unknown review identifiers and cross-session plans fail closed',()=>{
 const s=session(),p=s.begin(fixture()),other=session();
 other.begin(fixture());
 assert.throws(()=>s.reviewStep(p,'forged'),/M85_PLAN_REFUSED/);
 assert.throws(()=>s.reviewRequirement(p,'verified-backup'),/M85_PLAN_REFUSED/);
 assert.throws(()=>other.status(p),/M85_PLAN_REFUSED/);
 s.close();assert.throws(()=>s.status(p),/M85_PLAN_REFUSED/);
});
test('incomplete or empty evidence never becomes a repair recommendation',()=>{
 const s=session(),p=s.begin(fixture([],false));
 assert.deepEqual(p.prerequisites,['inventory-incomplete','no-reference-evidence']);
 s.reviewRequirement(p,'backup');s.reviewRequirement(p,'reversal');
 assert.equal(s.status(p).rehearsalChecklistComplete,false);
 assert.equal(p.repairAllowed,false);
});
test('issued plan and status are immutable and forged consent is ignored',()=>{
 const s=session(),p=s.begin({...fixture(),backupVerified:true,repairAllowed:true,actualConsentGranted:true});
 assert.throws(()=>{p.repairAllowed=true;},TypeError);
 assert.throws(()=>p.steps.push({id:'repair'}),TypeError);
 assert.throws(()=>{p.steps[0].executable=true;},TypeError);
 assert.equal(s.status(p).backupVerified,false);
 assert.equal(s.status(p).actualConsentGranted,false);
});
