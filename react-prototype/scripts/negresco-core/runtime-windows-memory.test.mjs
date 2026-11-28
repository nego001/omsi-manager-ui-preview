import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bindExecutedResource} from './runtime-resource-test-binding.mjs';
const script=fileURLToPath(new URL('../../native-lab/negresco-windows-memory-fixture.ps1',import.meta.url));
test('Windows native job process commit limit denies allocation between successful controls',t=>{
 if(process.platform!=='win32'){
  t.diagnostic('Windows Job Object memory laboratory not executed on this host; no native memory qualification.');
  return;
 }
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:60000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.ok([8,14,1455,1816].includes(r.refusalWin32Code));
 assert.deepEqual(r,{
  scope:'disposable-windows-memory-fixture',mechanism:'JobObjectProcessMemory',limitBytes:536870912,
  positiveBeforeBytes:8388608,refusedRequestBytes:536870912,refusalWin32Code:r.refusalWin32Code,
  positiveAfterBytes:8388608,processCommitLimitObserved:true,hardRssLimitVerified:false,
  readerLimitIntegrated:false,processTreeLimitVerified:false,killOnJobCloseVerified:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Native resource binding: '+JSON.stringify(bindExecutedResource('windowsProcess',r,script)));
 t.diagnostic('Windows Job Object: 512 MiB process commit limit; 8 MiB accepted, 512 MiB refused with Win32 '+r.refusalWin32Code+', 8 MiB accepted again; no Reader or RSS qualification.');
});
