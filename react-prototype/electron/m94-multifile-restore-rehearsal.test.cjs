'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {rehearseMultifileRestore:run}=require('../scripts/m94-multifile-restore-rehearsal.cjs');
test('all three fixed members are restored and backups remain intact',async()=>{
 const r=await run();
 assert.equal(r.outcome,'all-original-observed');assert.equal(r.publishedCount,3);
 assert.equal(r.originalCount,3);assert.equal(r.editedCount,0);assert.equal(r.divergentCount,0);
 assert.equal(r.allPreflightPassed,true);
 assert.ok(r.members.every(m=>m.backupIntact&&!m.stagePresent&&m.state==='original-observed'));
});
test('invalid last member blocks entire batch before first publication',async()=>{
 for(const scenario of ['partial-stage','changed-backup','changed-target']){
  const r=await run(scenario);
  assert.equal(r.reason,'preflight-refused');assert.equal(r.preflightPassedCount,2);
  assert.equal(r.publishedCount,0);assert.equal(r.originalCount,0);
  assert.equal(r.outcome,'no-publication-observed');
  assert.ok(r.members.every(m=>m.stagePresent));
  assert.equal(r.members[0].state,'edited-observed');assert.equal(r.members[1].state,'edited-observed');
 }
});
test('controlled stop after one or two publications exposes mixed state',async()=>{
 for(const [scenario,count] of [['stop-after-one',1],['stop-after-two',2]]){
  const r=await run(scenario);
  assert.equal(r.reason,'controlled-stop');assert.equal(r.outcome,'mixed-state-observed');
  assert.equal(r.originalCount,count);assert.equal(r.editedCount,3-count);
  assert.deepEqual(r.members.map(m=>m.stagePresent),Array.from({length:3},(_,i)=>i>=count));
  assert.equal(r.automaticRollbackAttempted,false);assert.equal(r.externalTerminationTested,false);
 }
});
test('drift in final member after first publication stops remaining batch',async()=>{
 const r=await run('drift-after-one');
 assert.equal(r.allPreflightPassed,true);assert.equal(r.reason,'drift-refused');
 assert.equal(r.publishedCount,1);assert.equal(r.editedCount,1);assert.equal(r.divergentCount,1);
 assert.equal(r.members[2].state,'divergent');assert.equal(r.members[2].stagePresent,true);
 assert.equal(r.automaticRollbackAttempted,false);
});
test('parallel rehearsals are isolated and do not imply real operation authority',async()=>{
 const reports=await Promise.all(['normal','stop-after-one','partial-stage'].map(scenario=>run(scenario)));
 assert.deepEqual(reports.map(r=>r.publishedCount),[3,1,0]);
 for(const r of reports){
  assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.members));
  for(const key of ['automaticRollbackAttempted','externalTerminationTested','groupAtomicityProven','durabilityProven','realFilesInspected','operationsEnabled'])assert.equal(r[key],false);
  assert.equal(r.filesModifiedInGames,0);assert.doesNotMatch(JSON.stringify(r),/\.target|\.backup|\.stage|[a-f0-9]{64}/);
 }
 for(const bad of [null,{},'/tmp/private','unknown'])await assert.rejects(run(bad),/M94_FIXTURE_REFUSED/);
});
