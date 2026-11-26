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
 assert.deepEqual(JSON.parse(p.stdout),{scope:'disposable-windows-fixture',cases:[
  'nested-regular-same-handle','parent-junction','leaf-junction','traversal','absolute','alternate-stream','hardlink','directory','size-cap',
  'in-place-mutation','file-replacement','parent-substitution','sibling-unchanged'
 ],nativeRelativeHandleObserved:true,atomicContainmentProven:false,abaRuledOut:false,realReadsPerformed:false,operationsEnabled:false,releaseAuthorized:false});
 t.diagnostic('Windows native fixture cases: 13/13; no production qualification.');
});
