'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {rehearseMultifileRestore:run}=require('../scripts/m94-multifile-restore-rehearsal.cjs');
test('explicit reversal recovers pre-restore edited bytes for one or two published members',async()=>{
 for(const [scenario,n] of [['stop-after-one',1],['stop-after-two',2]]){
  const r=await run(scenario,'observe','explicit');
  assert.equal(r.publishedCount,n);
  assert.equal(r.rollback.outcome,'all-edited-observed');
  assert.equal(r.rollback.rollbackCount,n);
  assert.equal(r.rollback.allEditedObserved,true);
 }
});
test('complete and inconsistent transactions are not eligible for this partial reversal',async()=>{
 for(const scenario of ['normal','partial-stage','drift-after-one']){
  const {rollback:r}=await run(scenario,'observe','explicit');
  assert.equal(r.outcome,'ineligible-state-refused');assert.equal(r.rollbackCount,0);
 }
});
test('loss of pre-restore controller anchor refuses before rollback',async()=>{
 const {rollback:r}=await run('stop-after-two','observe','lost-anchor');
 assert.equal(r.outcome,'independent-anchor-unavailable');assert.equal(r.rollbackCount,0);
});
test('changed target or corrupted rollback stage refuses before first rename',async()=>{
 for(const [mode,outcome] of [['changed-target','target-or-backup-divergence-refused'],['corrupt-rollback-stage','rollback-stage-divergence-refused']]){
  const {rollback:r}=await run('stop-after-two','observe',mode);
  assert.equal(r.outcome,outcome);assert.equal(r.rollbackCount,0);assert.equal(r.allEditedObserved,false);
 }
});
test('drift after first reverse publication stops further reversal',async()=>{
 const {rollback:r}=await run('stop-after-two','observe','drift-after-first-reversal');
 assert.equal(r.outcome,'partial-rollback-refused');assert.equal(r.rollbackCount,1);assert.equal(r.allEditedObserved,false);
});
test('explicit rehearsal cannot grant production permissions and default does not roll back',async()=>{
 const defaultResult=await run('stop-after-one','observe');assert.equal(defaultResult.rollback,undefined);
 const {rollback:r}=await run('stop-after-one','observe','explicit');
 for(const k of ['automaticRollbackAttempted','groupAtomicityProven','durabilityProven','realFilesInspected','operationsEnabled'])assert.equal(r[k],false);
 assert.equal(r.filesModifiedInGames,0);assert.ok(Object.isFrozen(r));
 await assert.rejects(run('stop-after-one','none','explicit'),/M94_FIXTURE_REFUSED/);
 await assert.rejects(run('stop-after-one','observe',{}),/M94_FIXTURE_REFUSED/);
});
