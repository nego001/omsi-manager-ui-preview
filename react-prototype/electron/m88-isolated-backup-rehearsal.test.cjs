'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runSyntheticBackupRehearsal:run}=require('../scripts/m88-isolated-backup-rehearsal.cjs');
test('real disposable file backup and restore compare original bytes',async()=>{
 const r=await run();
 assert.equal(r.outcome,'fixture-restored');
 assert.equal(r.initialBackupMatched,true);
 assert.equal(r.backupMatchedBeforeRestore,true);
 assert.equal(r.targetGenerationMatched,true);
 assert.equal(r.restorationAttempted,true);
 assert.equal(r.restoredBytesMatch,true);
 assert.equal(r.fileSyncRequested,true);
});
test('same-size corrupted backup refuses before target modification',async()=>{
 const r=await run('corrupt-backup');
 assert.equal(r.outcome,'backup-mismatch-refused');
 assert.equal(r.initialBackupMatched,true);
 assert.equal(r.backupMatchedBeforeRestore,false);
 assert.equal(r.restorationAttempted,false);
 assert.equal(r.refusedTargetUnchanged,true);
});
test('changed target generation refuses to overwrite unrelated revision',async()=>{
 const r=await run('changed-target');
 assert.equal(r.outcome,'target-changed-refused');
 assert.equal(r.backupMatchedBeforeRestore,true);
 assert.equal(r.targetGenerationMatched,false);
 assert.equal(r.restorationAttempted,false);
 assert.equal(r.refusedTargetUnchanged,true);
});
test('arbitrary caller paths, bytes and forged options are refused',async()=>{
 for(const value of ['/tmp/private','C:\\Users\\private',Buffer.from('normal'),{scenario:'normal',target:'private'},null])
  await assert.rejects(run(value),/M88_FIXTURE_REFUSED/);
});
test('parallel rehearsals are isolated and reports contain no path or digest',async()=>{
 const reports=await Promise.all(['normal','corrupt-backup','changed-target','normal'].map(run));
 assert.deepEqual(reports.map(r=>r.outcome),['fixture-restored','backup-mismatch-refused','target-changed-refused','fixture-restored']);
 for(const r of reports){
  assert.ok(Object.isFrozen(r));
  const out=JSON.stringify(r);
  assert.ok(!out.includes('target.fixture'));assert.ok(!out.includes('backup.fixture'));
  assert.ok(!/[a-f0-9]{64}/.test(out));
  for(const key of ['realFilesInspected','realBackupVerified','realRollbackVerified','operationsEnabled','atomicRestoreProven','durabilityProven'])assert.equal(r[key],false);
  assert.equal(r.filesModifiedInGames,0);
 }
});
