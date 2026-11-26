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
 assert.deepEqual(r,{
  scope:'disposable-windows-cpu-fixture',mechanism:'JobObjectJobUserTime',controlSeconds:8,limitSeconds:2,
  naturalExitCode:77,quotaExitCode:1816,beforeUserTicks:r.beforeUserTicks,limitedUserTicks:r.limitedUserTicks,afterUserTicks:r.afterUserTicks,
  jobSignaled:true,positiveBefore:true,positiveAfter:true,cpuTimeLimitObserved:true,
  cpuRateThrottleVerified:false,processTreeLimitVerified:false,readerLimitIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Windows Job CPU: 2 s user-mode budget, quota exit 1816, job signaled, matched controls; observed user ticks '+r.beforeUserTicks+'/'+r.limitedUserTicks+'/'+r.afterUserTicks+'; no production qualification.');
});
