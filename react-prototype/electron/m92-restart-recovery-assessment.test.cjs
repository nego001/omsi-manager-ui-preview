'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assessSyntheticRestart:run}=require('../scripts/m92-restart-recovery-assessment.cjs');
test('staged fixture has matching independent controller expectation and fresh observations',async()=>{
 const r=await run();
 assert.equal(r.disposition,'staged-fixture-manual-review');
 assert.equal(r.freshProcessesObserved,2);
 for(const k of ['ownedChildTerminationObserved','observationsAgree','anchorRetained','rootMatches','checkpointMatches'])assert.equal(r[k],true);
});
test('incomplete backup and intent do not become staged recovery',async()=>{
 for(const point of ['after-backup','after-intent']){
  const r=await run(point);assert.equal(r.disposition,'incomplete-fixture-review');
  assert.equal(r.checkpointMatches,true);assert.equal(r.recoveryAttempted,false);
 }
});
test('published state is observed without replay',async()=>{
 const r=await run('after-publish');
 assert.equal(r.disposition,'publication-observed-no-replay');assert.equal(r.automaticReplayAllowed,false);
});
test('corrupt backup and inter-observation target change refuse',async()=>{
 const corrupt=await run('after-stage','changed-backup');
 assert.equal(corrupt.disposition,'state-divergence-refused');assert.equal(corrupt.checkpointMatches,false);
 const drift=await run('after-stage','changed-after-first-observation');
 assert.equal(drift.disposition,'state-divergence-refused');assert.equal(drift.observationsAgree,false);
});
test('missing controller anchor cannot be replaced by matching disk observations',async()=>{
 const r=await run('after-stage','lost-controller-anchor');
 assert.equal(r.observationsAgree,true);assert.equal(r.anchorRetained,false);
 assert.equal(r.checkpointMatches,false);assert.equal(r.disposition,'independent-anchor-unavailable');
 for(const k of ['recoveryAttempted','automaticReplayAllowed','oldEvidenceReusable','crossRestartTrustProven','nativeIdentityProven','durabilityProven','realFilesInspected','operationsEnabled'])assert.equal(r[k],false);
 assert.equal(r.filesModifiedInGames,0);
 assert.ok(!/[a-f0-9]{32,}/.test(JSON.stringify(r)));
});
test('caller paths, PIDs and forged observations are refused',async()=>{
 for(const args of [['/tmp/private'],[123],['after-stage',{operationsEnabled:true}],['after-stage','unknown']])
  await assert.rejects(run(...args),/M92_FIXTURE_REFUSED/);
});
