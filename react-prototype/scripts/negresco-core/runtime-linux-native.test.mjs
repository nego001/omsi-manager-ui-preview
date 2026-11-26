import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../../native-lab/negresco-linux-openat2-fixture.py',import.meta.url));
test('Linux openat2 disposable native cases; other hosts explicitly unqualified',t=>{
 if(process.platform!=='linux'){
  t.diagnostic('Linux native openat2 not executed on this platform; no native qualification.');
  return;
 }
 const p=spawnSync('python3',['-I','-B',script],{encoding:'utf8',timeout:15000,maxBuffer:16384,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.deepEqual(r,{scope:'disposable-linux-fixture',cases:[
  'nested-regular-same-handle','leaf-symlink','parent-symlink','traversal','absolute','hardlink','fifo','directory','size-cap',
  'in-place-mutation','file-replacement','parent-substitution','sibling-unchanged'
 ],nativeOpenat2Observed:true,atomicContainmentProven:false,abaRuledOut:false,realReadsPerformed:false,operationsEnabled:false,releaseAuthorized:false});
 t.diagnostic('Linux native fixture cases: 13/13; no production qualification.');
});
