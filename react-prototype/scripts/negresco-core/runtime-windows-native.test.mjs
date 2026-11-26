import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../../native-lab/negresco-windows-relative-fixture.ps1',import.meta.url));
test('Windows relative native handle fixture cases; other hosts explicitly unqualified',t=>{
 if(process.platform!=='win32'){
  t.diagnostic('Windows native relative-handle cases not executed on this platform; no native qualification.');
  return;
 }
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:60000,maxBuffer:16384,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const result=JSON.parse(p.stdout);
 const parent=result.cases?.[11];
 assert.ok(['parent-substitution-detected','parent-substitution-os-blocked-5','parent-substitution-os-blocked-32','parent-substitution-os-blocked-33'].includes(parent),'unverified parent substitution outcome');
 assert.deepEqual(result,{scope:'disposable-windows-fixture',cases:[
  'nested-regular-same-handle','parent-junction','leaf-junction','traversal','absolute','alternate-stream','hardlink','directory','size-cap',
  'in-place-mutation','file-replacement',parent,'sibling-unchanged'
 ],nativeRelativeHandleObserved:true,atomicContainmentProven:false,abaRuledOut:false,realReadsPerformed:false,operationsEnabled:false,releaseAuthorized:false});
 t.diagnostic('Windows native fixture cases: 13/13; '+parent+'; no production qualification.');
});

test('Windows PowerShell fixture parses before native qualification',t=>{
 if(process.platform!=='win32'){t.diagnostic('PowerShell parser unavailable in Linux matrix; Windows syntax gate not executed.');return;}
 const command='$ErrorActionPreference="Stop"; $tokens=$null; $errors=$null; [void][System.Management.Automation.Language.Parser]::ParseFile($env:NEGRESCO_TEST_SCRIPT,[ref]$tokens,[ref]$errors); if($errors.Count -ne 0){[Console]::Error.WriteLine("NEGRESCO_FIXTURE_SYNTAX_REFUSED"); exit 3}; exit 0';
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{env:{...process.env,NEGRESCO_TEST_SCRIPT:script},encoding:'utf8',timeout:15000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);
});
