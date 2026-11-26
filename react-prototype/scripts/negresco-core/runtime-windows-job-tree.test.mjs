import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bindExecutedResource} from './runtime-resource-test-binding.mjs';
const script=fileURLToPath(new URL('../../native-lab/negresco-windows-job-tree.ps1',import.meta.url));
test('Windows private Job Object closes both owned parent and inherited direct descendant',t=>{
 if(process.platform!=='win32'){t.diagnostic('Windows job tree laboratory not executed on this host.');return;}
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:90000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 for(const k of ['parentExitCode','descendantExitCode'])assert.ok(Number.isInteger(r[k])&&r[k]>=0&&r[k]<=0xffffffff&&![77,78,79,259].includes(r[k]));
 assert.deepEqual(r,{
  scope:'disposable-windows-job-tree',mechanism:'JobObjectKillOnClose',activeProcessLimit:2,
  positiveBefore:true,positiveAfter:true,parentAssignedSuspended:true,descendantInheritedMembership:true,
  bothReadyAndAlive:true,lastJobHandleClosed:true,bothTerminated:true,descendantIdentityHandshake:true,activeCountVerified:true,
  parentExitCode:r.parentExitCode,descendantExitCode:r.descendantExitCode,
  arbitraryTreeVerified:false,readerIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Native lifecycle binding: '+JSON.stringify(bindExecutedResource('windowsJobTree',r,script)));
 t.diagnostic('Windows job tree: '+JSON.stringify(r));
});
