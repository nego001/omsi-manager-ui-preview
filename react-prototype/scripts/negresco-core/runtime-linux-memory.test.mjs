import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bindExecutedResource} from './runtime-resource-test-binding.mjs';
const script=fileURLToPath(new URL('../../native-lab/negresco-linux-memory-fixture.py',import.meta.url));
test('Linux native address-space limit denies allocation between successful controls',t=>{
 if(process.platform!=='linux'){
  t.diagnostic('Linux RLIMIT_AS laboratory not executed on this host; no native memory qualification.');
  return;
 }
 const p=spawnSync('python3',['-I','-B',script],{encoding:'utf8',timeout:10000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.deepEqual(r,{
  scope:'disposable-linux-memory-fixture',mechanism:'RLIMIT_AS',limitBytes:134217728,positiveBeforeBytes:8388608,
  refusedRequestBytes:134217728,refusal:'ENOMEM',positiveAfterBytes:8388608,addressSpaceLimitObserved:true,
  hardRssLimitVerified:false,readerLimitIntegrated:false,processTreeLimitVerified:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Native resource binding: '+JSON.stringify(bindExecutedResource('linuxAddress',r,script)));
 t.diagnostic('Linux RLIMIT_AS: 128 MiB address-space limit; 8 MiB accepted, 128 MiB refused with ENOMEM, 8 MiB accepted again; no Reader or RSS qualification.');
});
