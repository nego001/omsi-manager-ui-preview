import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bindExecutedResource} from './runtime-resource-test-binding.mjs';
const script=fileURLToPath(new URL('../../native-lab/negresco-linux-parent-death.py',import.meta.url));
test('Linux native parent death terminates ready owned direct descendant and monitor reaps it',t=>{
 if(process.platform!=='linux'){t.diagnostic('Linux parent-death laboratory not executed on this host.');return;}
 const p=spawnSync('python3',['-I','-B',script],{encoding:'utf8',timeout:45000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.deepEqual(r,{
  scope:'disposable-linux-parent-death',mechanism:'PR_SET_PDEATHSIG',
  positiveBefore:true,childReadyBeforeParentExit:true,parentNaturalExit:true,
  adoptedDescendantReaped:true,descendantSignal:'SIGKILL',positiveAfter:true,
  pidfdIdentityUsed:true,directDescendantOnly:true,arbitraryTreeVerified:false,
  readerIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Native lifecycle binding: '+JSON.stringify(bindExecutedResource('linuxParentDeath',r,script)));
 t.diagnostic('Linux parent death: ready direct descendant SIGKILL, subreaper waitpid, matched controls; arbitrary tree and Reader integration unverified.');
});
