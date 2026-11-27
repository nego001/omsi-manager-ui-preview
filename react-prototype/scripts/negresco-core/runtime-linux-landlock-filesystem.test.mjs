import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../../native-lab/negresco-linux-landlock-filesystem.py',import.meta.url));
test('Linux Landlock disposable filesystem permits selected reads and refuses writes and outside reads',t=>{
 if(process.platform!=='linux'){t.diagnostic('Linux Landlock laboratory not executed on this host.');return;}
 const p=spawnSync('python3',['-I','-B',script],{encoding:'utf8',timeout:35000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);assert.ok(Number.isSafeInteger(r.abi)&&r.abi>=3);
 assert.deepEqual(r,{
  scope:'disposable-linux-landlock-filesystem',mechanism:'Landlock',abi:r.abi,
  positiveBefore:true,positiveAfter:true,allowedRead:true,allowedList:true,
  outsideReadRefused:true,outsideListRefused:true,writeRefused:true,truncateRefused:true,
  createRefused:true,deleteRefused:true,refusal:'EACCES',fixturesUnchanged:true,
  inheritedDescriptorsVerified:false,universalFilesystemIsolationVerified:false,
  readerIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Linux Landlock filesystem: '+JSON.stringify(r));
});
