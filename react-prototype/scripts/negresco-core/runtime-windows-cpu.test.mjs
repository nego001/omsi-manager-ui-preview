import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../../native-lab/negresco-windows-cpu-fixture.ps1',import.meta.url));
test('Windows native job CPU time budget terminates owned child between matched controls',t=>{
 if(process.platform!=='win32'){
  t.diagnostic('Windows job CPU time laboratory not executed on this host.');
  return;
 }
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:90000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 for(const k of ['beforeUserTicks','limitedUserTicks','afterUserTicks'])assert.ok(Number.isSafeInteger(r[k]));
 assert.ok(r.beforeUserTicks>=45000000&&r.afterUserTicks>=45000000);
 assert.ok(r.limitedUserTicks>=20000000&&r.limitedUserTicks<45000000);
 assert.ok(Number.isInteger(r.limitedExitCode)&&r.limitedExitCode>=0&&r.limitedExitCode<=0xffffffff&&![77,78,259].includes(r.limitedExitCode));
 assert.deepEqual(r,{
  scope:'disposable-windows-cpu-fixture',mechanism:'JobObjectJobUserTime',controlSeconds:8,limitSeconds:2,
  naturalExitCode:77,limitedExitCode:r.limitedExitCode,documentedQuotaExitObserved:r.limitedExitCode===1816,beforeUserTicks:r.beforeUserTicks,limitedUserTicks:r.limitedUserTicks,afterUserTicks:r.afterUserTicks,
  jobSignaled:true,controlJobsUnsignaled:true,positiveBefore:true,positiveAfter:true,cpuTimeLimitObserved:true,
  cpuRateThrottleVerified:false,processTreeLimitVerified:false,readerLimitIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Windows Job CPU: 2 s user-mode budget, job signaled only in limited trial; actual exit '+r.limitedExitCode+'; documented quota exit observed '+r.documentedQuotaExitObserved+'; observed user ticks '+r.beforeUserTicks+'/'+r.limitedUserTicks+'/'+r.afterUserTicks+'; no production qualification.');
});
