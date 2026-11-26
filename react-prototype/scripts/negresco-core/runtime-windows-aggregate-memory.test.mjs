import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../../native-lab/negresco-windows-aggregate-memory.ps1',import.meta.url));
test('Windows private job rejects aggregate commit while each individual allocation fits',t=>{
 if(process.platform!=='win32'){
  t.diagnostic('Windows aggregate memory laboratory not executed on this host.');
  return;
 }
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:60000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.ok([8,14,1455,1816].includes(r.refusalWin32Code));
 assert.deepEqual(r,{
  scope:'disposable-windows-aggregate-memory',jobLimitBytes:201326592,individualRequestBytes:117440512,
  twoOwnedChildrenAssigned:true,allChildrenSuspended:true,individualProcessLimitConfigured:false,
  positiveBefore:true,firstAllocationHeld:true,combinedAllocationRefused:true,refusalWin32Code:r.refusalWin32Code,
  positiveAfterRelease:true,limitReadbackVerified:true,aggregateCommitLimitObserved:true,
  hardRssLimitVerified:false,readerLimitIntegrated:false,osIsolationVerified:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Windows aggregate memory: 192 MiB job cap, 112 MiB accepted individually, combined request refused with Win32 '+r.refusalWin32Code+', allocation accepted after release; no production qualification.');
});
