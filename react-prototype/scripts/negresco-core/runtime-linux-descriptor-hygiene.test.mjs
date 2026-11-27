import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bindExecutedResource} from './runtime-resource-test-binding.mjs';
const script=fileURLToPath(new URL('../../native-lab/negresco-linux-descriptor-hygiene.py',import.meta.url));
test('Linux disposable child closes inherited file and socket before restrictions with exact pipe allowlist',t=>{
 if(process.platform!=='linux'){t.diagnostic('Linux descriptor hygiene laboratory not executed on this host.');return;}
 const p=spawnSync('python3',['-I','-B',script],{encoding:'utf8',timeout:25000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);assert.ok(Number.isSafeInteger(r.abi)&&r.abi>=3);
 assert.deepEqual(r,{
  scope:'disposable-linux-descriptor-hygiene',mechanism:'close_range+seccomp+Landlock',
  abi:r.abi,positiveFileControl:true,positiveSocketControl:true,preexistingDescriptorsObserved:true,
  closeRangeSucceeded:true,exactPipeAllowlistVerified:true,preopenedFileClosed:true,
  preconnectedSocketClosed:true,receiverEofObserved:true,outsideReopenRefused:true,
  newSocketRefused:true,allowedRead:true,fixtureUnchanged:true,
  readerIntegrated:false,automaticProductionHygieneVerified:false,allNetworkDeniedVerified:false,
  universalFilesystemIsolationVerified:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Native permission binding: '+JSON.stringify(bindExecutedResource('linuxDescriptorHygiene',r,script)));
 t.diagnostic('Linux descriptor hygiene: '+JSON.stringify(r));
});
