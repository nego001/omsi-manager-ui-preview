import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../../native-lab/negresco-windows-job-lifecycle.ps1',import.meta.url));
test('Windows private job admits suspended owned child and closes it on final handle release',t=>{
 if(process.platform!=='win32'){
  t.diagnostic('Windows job lifecycle laboratory not executed on this host; no native lifecycle qualification.');
  return;
 }
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:60000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.ok(Number.isInteger(r.childExitCode)&&r.childExitCode>=0&&r.childExitCode<=0xffffffff&&r.childExitCode!==259&&r.childExitCode!==77);
 assert.deepEqual(r,{
  scope:'disposable-windows-job-lifecycle',jobCommitLimitBytes:536870912,activeProcessLimit:1,
  limitsReadBack:true,suspendedAssignmentObserved:true,ownedChildReadyObserved:true,ownedChildAliveBeforeClose:true,
  ownedChildTerminatedAfterClose:true,childExitCode:r.childExitCode,aggregateAllocationRefusalVerified:false,
  descendantLimitVerified:false,readerLimitIntegrated:false,osIsolationVerified:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Windows Job Object lifecycle: suspended assignment, 512 MiB aggregate limit readback, one-process setting readback, ready live child terminated on last handle close; no descendant or aggregate allocation qualification.');
});
