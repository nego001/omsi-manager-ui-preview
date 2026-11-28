import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bindExecutedResource} from './runtime-resource-test-binding.mjs';
const script=fileURLToPath(new URL('../../native-lab/negresco-linux-cpu-fixture.py',import.meta.url));
test('Linux native CPU time limit signals soft threshold and terminates at hard threshold',t=>{
 if(process.platform!=='linux'){
  t.diagnostic('Linux RLIMIT_CPU laboratory not executed on this host.');
  return;
 }
 const p=spawnSync('python3',['-I','-B',script],{encoding:'utf8',timeout:55000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.deepEqual(r,{
  scope:'disposable-linux-cpu-fixture',mechanism:'RLIMIT_CPU',softSeconds:1,hardSeconds:2,
  positiveBefore:true,softSignal:'SIGXCPU',softHandlerExit:77,hardSignal:'SIGKILL',positiveAfter:true,
  cpuTimeLimitObserved:true,cpuRateThrottleVerified:false,processTreeLimitVerified:false,
  readerLimitIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Native CPU binding: '+JSON.stringify(bindExecutedResource('linuxCpuTime',r,script)));
 t.diagnostic('Linux RLIMIT_CPU: 1 s soft SIGXCPU, 2 s hard SIGKILL, positive controls before and after; no CPU rate or Reader qualification.');
});
