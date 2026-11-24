'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {rehearseMultifileRestore:run}=require('../scripts/m94-multifile-restore-rehearsal.cjs');
const {assessPrivateFixture}=require('../scripts/m95-multifile-consistency-assessment.cjs');
test('complete publication is independently observed without replay',async()=>{
 const {assessment:a}=await run('normal','observe');
 assert.equal(a.disposition,'all-original-observed-no-replay');assert.equal(a.originalCount,3);
 for(const k of ['backupsIntact','stagesConsistent','prefixConsistent','observationAgrees'])assert.equal(a[k],true);
});
test('ordered partial publications remain manual-review only',async()=>{
 for(const [scenario,n] of [['stop-after-one',1],['stop-after-two',2]]){
  const {assessment:a}=await run(scenario,'observe');
  assert.equal(a.disposition,'ordered-partial-publication-review');assert.equal(a.originalCount,n);assert.equal(a.editedCount,3-n);
  assert.equal(a.observationAgrees,true);
 }
});
test('invalid backup, stage and target are classified as inconsistent',async()=>{
 for(const scenario of ['partial-stage','changed-backup','changed-target','drift-after-one']){
  const {assessment:a}=await run(scenario,'observe');
  assert.equal(a.disposition,'inconsistent-manual-review');assert.equal(a.observationAgrees,true);
 }
});
test('target drift between observations invalidates the prior report',async()=>{
 const r=await run('normal','drift-between-observations'),a=r.assessment;
 assert.equal(r.originalCount,3);assert.equal(a.originalCount,2);assert.equal(a.divergentCount,1);
 assert.equal(a.observationAgrees,false);assert.equal(a.disposition,'observation-divergence-refused');
});
test('missing backup after publication prevents favorable assessment',async()=>{
 const {assessment:a}=await run('normal','missing-backup-after-publication');
 assert.equal(a.originalCount,3);assert.equal(a.backupsIntact,false);assert.equal(a.observationAgrees,false);
 assert.equal(a.disposition,'observation-divergence-refused');
});
test('reports stay frozen and never grant recovery authority',async()=>{
 const {assessment:a}=await run('normal','observe');
 assert.ok(Object.isFrozen(a));assert.ok(Object.isFrozen(a.members));
 for(const k of ['independentProcessVerified','recoveryAttempted','automaticReplayAllowed','automaticRollbackAllowed','groupAtomicityProven','durabilityProven','nativeIdentityProven','realFilesInspected','operationsEnabled'])assert.equal(a[k],false);
 assert.equal(a.filesModifiedInGames,0);
 await assert.rejects(assessPrivateFixture('/tmp/private',[]),/M95_FIXTURE_REFUSED/);
 await assert.rejects(run('normal',{}),/M94_FIXTURE_REFUSED/);
});
