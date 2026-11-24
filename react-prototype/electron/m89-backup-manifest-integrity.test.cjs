'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runSyntheticManifestRehearsal:run}=require('../scripts/m88-isolated-backup-rehearsal.cjs');
test('intact manifest, backup and target allow synthetic recovery',async()=>{
 const r=await run();
 assert.equal(r.outcome,'fixture-restored');
 for(const k of ['initialManifestMatched','manifestMatches','backupMatches','targetMatches','restorationAttempted','restoredBytesMatch'])assert.equal(r[k],true);
});
test('same-size backup corruption refuses before restoration',async()=>{
 const r=await run('corrupt-backup');
 assert.equal(r.outcome,'backup-mismatch-refused');
 assert.equal(r.manifestMatches,true);assert.equal(r.backupMatches,false);
 assert.equal(r.restorationAttempted,false);assert.equal(r.refusedTargetUnchanged,true);
});
test('unexpected target content refuses even with intact manifest and backup',async()=>{
 const r=await run('changed-target');
 assert.equal(r.outcome,'target-changed-refused');
 assert.equal(r.manifestMatches,true);assert.equal(r.backupMatches,true);
 assert.equal(r.targetMatches,false);assert.equal(r.refusedTargetUnchanged,true);
});
test('revision, session, role and malformed manifest changes refuse',async()=>{
 for(const scenario of ['manifest-revision','manifest-session','manifest-target','manifest-malformed']){
  const r=await run(scenario);
  assert.equal(r.outcome,'manifest-mismatch-refused');
  assert.equal(r.manifestMatches,false);assert.equal(r.backupMatches,true);assert.equal(r.targetMatches,true);
  assert.equal(r.restorationAttempted,false);assert.equal(r.refusedTargetUnchanged,true);
 }
});
test('coordinated backup and digest rewrite cannot replace original expectation',async()=>{
 const r=await run('manifest-rehash');
 assert.equal(r.outcome,'manifest-mismatch-refused');
 assert.equal(r.manifestMatches,false);assert.equal(r.backupMatches,false);
 assert.equal(r.restorationAttempted,false);assert.equal(r.refusedTargetUnchanged,true);
});
test('isolated reports expose no secret identifiers or authority',async()=>{
 const reports=await Promise.all(['normal','manifest-session','normal'].map(run));
 for(const r of reports){
  assert.ok(Object.isFrozen(r));
  const out=JSON.stringify(r);
  assert.ok(!/[a-f0-9]{32,}/.test(out));
  assert.ok(!out.includes('target.fixture'));assert.ok(!out.includes('backup.fixture'));
  for(const k of ['manifestAuthenticated','crossRestartTrustProven','atomicRestoreProven','durabilityProven','realFilesInspected','realBackupVerified','realRollbackVerified','operationsEnabled'])assert.equal(r[k],false);
  assert.equal(r.filesModifiedInGames,0);
 }
 for(const bad of ['/tmp/other',null,{scenario:'normal'},Buffer.from('normal')])await assert.rejects(run(bad),/M88_FIXTURE_REFUSED/);
});
