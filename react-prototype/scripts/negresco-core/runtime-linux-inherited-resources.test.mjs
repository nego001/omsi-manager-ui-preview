import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bindExecutedResource} from './runtime-resource-test-binding.mjs';
const script=fileURLToPath(new URL('../../native-lab/negresco-linux-inherited-resources.py',import.meta.url));
test('Linux combined restrictions preserve preexisting resource authority until explicit descriptor closure',t=>{
 if(process.platform!=='linux'){t.diagnostic('Linux inherited-resource laboratory not executed on this host.');return;}
 const p=spawnSync('python3',['-I','-B',script],{encoding:'utf8',timeout:25000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);assert.ok(Number.isSafeInteger(r.abi)&&r.abi>=3);
 assert.deepEqual(r,{
  scope:'disposable-linux-inherited-resources',mechanism:'seccomp+Landlock',abi:r.abi,
  preopenedFileReadObserved:true,preconnectedSocketSendObserved:true,parentMarkerObserved:true,
  closedFileRefused:true,closedSocketRefused:true,outsideReopenRefused:true,newSocketRefused:true,
  fixtureUnchanged:true,descriptorBoundaryDemonstrated:true,automaticDescriptorHygieneVerified:false,
  allNetworkDeniedVerified:false,universalFilesystemIsolationVerified:false,readerIntegrated:false,
  operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Native permission binding: '+JSON.stringify(bindExecutedResource('linuxInheritedResources',r,script)));
 t.diagnostic('Linux inherited resources: '+JSON.stringify(r));
});
