'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {reviewSyntheticReservation:run}=require('../scripts/m99-stale-transaction-reservation-review.cjs');
test('paused owned worker retains reservation and rejects contender without byte changes',async()=>{
 const r=await run('active');
 assert.equal(r.disposition,'owned-worker-paused-reservation-retained');
 assert.equal(r.ownedCheckpointObserved,true);assert.equal(r.ownedTerminationObserved,false);
 assert.equal(r.retryRefused,true);assert.equal(r.reviewUnchanged,true);assert.equal(r.originalCount,1);
});
test('external termination leaves partial transaction and abandoned reservation without automatic reclaim',async()=>{
 const r=await run();
 assert.equal(r.disposition,'owned-worker-exit-observed-review-required');
 assert.equal(r.ownedTerminationObserved,true);assert.equal(r.claimUnchanged,true);
 assert.equal(r.transactionState,'partial-untrusted');assert.equal(r.retryRefused,true);
});
test('changed or removed reservation invalidates review',async()=>{
 for(const scenario of ['changed-claim','missing-claim']){
  const r=await run(scenario);
  assert.equal(r.disposition,'reservation-changed-refused');assert.equal(r.claimUnchanged,false);
  assert.equal(r.reviewUnchanged,true);
  assert.equal(r.retryRefused,scenario==='missing-claim'?null:true);
 }
});
test('corrupt initial claim refuses contender without assuming owner identity',async()=>{
 const r=await run('corrupt-initial-claim');
 assert.equal(r.disposition,'invalid-reservation-refused');assert.equal(r.claimState,'corrupt-untrusted');
 assert.equal(r.ownedCheckpointObserved,false);assert.equal(r.retryRefused,true);
});
test('reports never authorize native locks, reclaim or real operations',async()=>{
 const r=await run();
 for(const k of ['ownerIdentityVerified','nativeLockVerified','claimReclaimAllowed','automaticCleanupAllowed','automaticReplayAllowed','operationsEnabled','realFilesInspected'])assert.equal(r[k],false);
 assert.equal(r.filesModifiedInGames,0);assert.ok(Object.isFrozen(r));
 for(const bad of [null,{},'/tmp/private','unknown'])await assert.rejects(run(bad),/M99_FIXTURE_REFUSED/);
});
