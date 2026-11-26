import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../../native-lab/negresco-windows-job-descendant.ps1',import.meta.url));
test('Windows private job active process limit rejects additional suspended child with matched controls',t=>{
 if(process.platform!=='win32'){
  t.diagnostic('Windows active process limit laboratory not executed on this host.');
  return;
 }
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:60000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.ok(['create-refused-5','create-refused-1816','created-but-terminated-before-resume'].includes(r.descendantAttemptOutcome));
 assert.deepEqual(r,{
  scope:'disposable-windows-job-descendant',activeProcessLimit:1,outsideJobPositiveControl:true,
  descendantAttemptOutcome:r.descendantAttemptOutcome,insideJobRaisedLimitPositiveControl:true,
  controlChildMembershipVerified:true,restoredLimitVerified:true,descendantLimitObserved:true,allChildrenCreatedSuspended:true,
  aggregateAllocationRefusalVerified:false,readerLimitIntegrated:false,osIsolationVerified:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Windows active process limit: '+r.descendantAttemptOutcome+'; same-job positive control verified; no production qualification.');
});
