'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runSyntheticPublication:run}=require('../scripts/m93-isolated-restore-publication.cjs');
test('synced stage replaces edited fixture via same-directory rename',async()=>{
 const r=await run();
 assert.equal(r.outcome,'fixture-publication-observed');
 for(const key of ['targetMatches','backupMatches','stageMatches','renameCompleted','restoredBytesMatch','stageConsumed'])assert.equal(r[key],true);
 if(process.platform==='linux'){
  assert.ok(['sync-returned','unsupported'].includes(r.directorySyncStatus));
  assert.equal(r.directorySyncObserved,r.directorySyncStatus==='sync-returned');
 }else{
  assert.equal(r.directorySyncStatus,'not-tested-on-platform');assert.equal(r.directorySyncObserved,false);
 }
});
test('partial staging cannot replace complete target',async()=>{
 const r=await run('partial-stage');
 assert.equal(r.outcome,'stage-refused');assert.equal(r.stageMatches,false);
 assert.equal(r.renameCompleted,false);assert.equal(r.refusedTargetUnchanged,true);
 assert.equal(r.stageConsumed,false);assert.equal(r.directorySyncStatus,'not-attempted');
});
test('changed or missing destination is not overwritten or recreated',async()=>{
 for(const scenario of ['changed-target','missing-target']){
  const r=await run(scenario);
  assert.equal(r.outcome,'target-refused');assert.equal(r.targetMatches,false);
  assert.equal(r.renameCompleted,false);assert.equal(r.refusedTargetUnchanged,true);
 }
});
test('same-size backup corruption prevents publication',async()=>{
 const r=await run('changed-backup');
 assert.equal(r.outcome,'backup-refused');assert.equal(r.backupMatches,false);
 assert.equal(r.stageMatches,true);assert.equal(r.renameCompleted,false);assert.equal(r.refusedTargetUnchanged,true);
});
test('parallel rehearsals remain isolated and never attest atomicity or real operations',async()=>{
 const reports=await Promise.all(['normal','partial-stage','normal'].map(run));
 assert.deepEqual(reports.map(r=>r.outcome),['fixture-publication-observed','stage-refused','fixture-publication-observed']);
 for(const r of reports){
  assert.ok(Object.isFrozen(r));
  for(const key of ['concurrentVisibilityProven','atomicRestoreProven','durabilityProven','nativeIdentityProven','realFilesInspected','operationsEnabled'])assert.equal(r[key],false);
  assert.equal(r.filesModifiedInGames,0);
  assert.doesNotMatch(JSON.stringify(r),/target\.fixture|backup\.fixture|[a-f0-9]{64}/);
 }
 for(const bad of [null,{},'/tmp/private','unknown'])await assert.rejects(run(bad),/M93_FIXTURE_REFUSED/);
});
