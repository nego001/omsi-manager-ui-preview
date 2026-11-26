import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bindExecutedResource} from './runtime-resource-test-binding.mjs';
const script=fileURLToPath(new URL('../../native-lab/negresco-windows-cpu-fixture.ps1',import.meta.url));
test('Windows native job CPU time budget terminates owned child between matched controls',t=>{
 if(process.platform!=='win32'){
  t.diagnostic('Windows job CPU time laboratory not executed on this host.');
  return;
 }
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:150000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 for(const k of ['beforeUserTicks','limitedUserTicks','afterUserTicks'])assert.ok(Number.isSafeInteger(r[k]));
 assert.ok(r.beforeUserTicks>=100000000&&r.afterUserTicks>=100000000);
 assert.ok(r.limitedUserTicks>=20000000&&r.limitedUserTicks<100000000);
 assert.ok([1816,3221225540].includes(r.limitedExitCode));
 assert.deepEqual(r,{
  scope:'disposable-windows-cpu-fixture',mechanism:'JobObjectJobUserTime',controlSeconds:20,limitSeconds:2,naturalCompletionCpuSeconds:10,
  naturalExitCode:77,limitedExitCode:r.limitedExitCode,documentedQuotaExitObserved:r.limitedExitCode===1816,ntStatusQuotaExitObserved:r.limitedExitCode===3221225540,beforeUserTicks:r.beforeUserTicks,limitedUserTicks:r.limitedUserTicks,afterUserTicks:r.afterUserTicks,
  jobSignaled:true,controlJobsUnsignaled:true,positiveBefore:true,positiveAfter:true,cpuTimeLimitObserved:true,
  cpuRateThrottleVerified:false,processTreeLimitVerified:false,readerLimitIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Native CPU binding: '+JSON.stringify(bindExecutedResource('windowsCpuTime',r,script)));
 t.diagnostic('Windows Job CPU: 2 s user-mode budget, job signaled only in limited trial; actual exit '+r.limitedExitCode+'; documented quota exit observed '+r.documentedQuotaExitObserved+'; observed user ticks '+r.beforeUserTicks+'/'+r.limitedUserTicks+'/'+r.afterUserTicks+'; no production qualification.');
});
