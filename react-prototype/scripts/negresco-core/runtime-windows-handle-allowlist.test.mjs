import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bindExecutedResource} from './runtime-resource-test-binding.mjs';
const script=fileURLToPath(new URL('../../native-lab/negresco-windows-handle-allowlist.ps1',import.meta.url));
test('Windows explicit file handle inheritance list permits only selected fixture handle with matched controls',t=>{
 if(process.platform!=='win32'){t.diagnostic('Windows handle allowlist laboratory not executed on this host.');return;}
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:65000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.deepEqual(r,{
  scope:'disposable-windows-file-handle-allowlist',mechanism:'PROC_THREAD_ATTRIBUTE_HANDLE_LIST',
  positiveBefore:true,positiveAfter:true,bothSourceHandlesInheritable:true,
  explicitHandleListApplied:true,allowedHandleRead:true,omittedHandleRefused:true,
  refusalWin32Code:6,fixturesUnchanged:true,temporaryFilesRemoved:true,
  allHandlesEnumerated:false,inheritedSocketsVerified:false,automaticProductionHygieneVerified:false,
  readerIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Native permission binding: '+JSON.stringify(bindExecutedResource('windowsHandleAllowlist',r,script)));
 t.diagnostic('Windows handle allowlist: '+JSON.stringify(r));
});
