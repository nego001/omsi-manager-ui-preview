import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {classifyM40DirectExit as direct}
 from './auto-x11-cross-runner-direct-exit.mjs';
import {compareM40DirectLinuxRunnerExits as compare}
 from './auto-x11-cross-runner-exit-compare.mjs';

const refusal=/^Error: M40_TWO_RUNNER_COMPARISON_REFUSED$/;
const directRefusal=/^Error: M40_DIRECT_RUNNER_OBSERVATION_REFUSED$/;
const result=(runner,exitCode=null,exitSignal='SIGTRAP',timedOut=false)=>
 direct({runner,exitCode,exitSignal,timedOut});
const pair=(a=result('ubuntu-22.04',0,null),
 b=result('ubuntu-24.04'))=>({
 schema:'M40_DIRECT_CROSS_RUNNER_INPUT_V1',
 scope:'two-disposable-linux-runner-exit-observations',
 observations:[{...a},{...b}]
});
function locked(r){
 assert.equal(r.schema,'M40_DIRECT_LINUX_CROSS_RUNNER_COMPARISON_V1');
 assert.equal(r.twoDistinctLinuxRunnerLabelsObserved,true);
 assert.equal(r.sameUnsignedCIArtifactNameUsed,true);
 for(const k of [
  'actualPackageBytesIndependentlyAcquired',
  'nativeWindowOwnershipProvenByThisComparison',
  'rendererConfinementIndependentlyVerified',
  'thisComparisonDeterminesAppArmorCausality',
  'thisComparisonCertifiesUbuntu24StrictGate',
  'nativeUbuntu24StrictGateWaived','hostPolicyChanged',
  'sandboxBypassApplied','realOMSIModRead','mergeAuthorized',
  'releaseAuthorized','installationAuthorized'
 ])assert.equal(r[k],false,k);
 assert.ok(Object.isFrozen(r));
}
test('same-package Linux runners can show an untraced 24-only SIGTRAP signal',()=>{
 const r=compare(pair());
 assert.equal(r.status,'ubuntu24SIGTRAPAndUbuntu22DifferentDirectExit');
 assert.equal(r.ubuntu22SIGTRAPObserved,false);
 assert.equal(r.ubuntu24SIGTRAPObserved,true);
 locked(r);
});
test('Ubuntu22 timeout does not prove that its window or renderer passed',()=>{
 const a=result('ubuntu-22.04',null,'SIGKILL',true);
 const r=compare(pair(a));
 assert.equal(r.status,'oneOrBothRunnerObservationsTimedOut');
 assert.equal(r.ubuntu22SIGTRAPObserved,false);
 assert.equal(r.ubuntu24SIGTRAPObserved,true);
 assert.equal(r.nativeWindowOwnershipProvenByThisComparison,false);
 locked(r);
});
test('Ubuntu24 timeout is not classified as a native SIGTRAP observation',()=>{
 const b=result('ubuntu-24.04',null,'SIGKILL',true);
 const r=compare(pair(undefined,b));
 assert.equal(r.status,'oneOrBothRunnerObservationsTimedOut');
 assert.equal(r.ubuntu24SIGTRAPObserved,false);
 locked(r);
});
test('SIGTRAP on both 22.04 and 24.04 does not waive mandatory gate',()=>{
 const r=compare(pair(result('ubuntu-22.04')));
 assert.equal(r.status,'bothLinuxRunnersDirectSIGTRAP');
 assert.equal(r.ubuntu22SIGTRAPObserved,true);
 assert.equal(r.ubuntu24SIGTRAPObserved,true);
 locked(r);
});
test('direct Ubuntu22 SIGTRAP alone remains a distinct comparison state',()=>{
 const r=compare(pair(result('ubuntu-22.04'),
  result('ubuntu-24.04',1,null)));
 assert.equal(r.status,'ubuntu22DirectSIGTRAPButUbuntu24Not');
 locked(r);
});
test('neither runner ending in SIGTRAP remains noncertifying',()=>{
 const r=compare(pair(result('ubuntu-22.04',1,null),
   result('ubuntu-24.04',null,'SIGSYS')));
 assert.equal(r.status,'neitherDirectRunnerTerminatedWithSIGTRAP');
 assert.equal(r.ubuntu24SIGTRAPObserved,false);locked(r);
});
test('numeric exit code 133 is NOT equivalent to true SIGTRAP signal',()=>{
 const r=compare(pair(result('ubuntu-22.04',133,null),
   result('ubuntu-24.04',133,null)));
 assert.equal(r.ubuntu22SIGTRAPObserved,false);
 assert.equal(r.ubuntu24SIGTRAPObserved,false);
 assert.equal(r.ubuntu24ExitCategory,'exitCode133NotSignalProof');
 locked(r);
});
test('individual direct runner exit classifier refuses fake runner and exits',()=>{
 for(const runner of ['ubuntu-20.04','ubuntu-latest','Ubuntu 24.04',null]){
  assert.throws(()=>direct({runner,exitCode:0,exitSignal:null,timedOut:false}),directRefusal);
 }
 for(const exitCode of [-1,256,2.5,'133',true]){
  assert.throws(()=>direct({runner:'ubuntu-22.04',exitCode,exitSignal:null,timedOut:false}),directRefusal);
 }
});
test('direct runner exit classifier refuses simultaneous exit code and signal',()=>{
 const src={runner:'ubuntu-24.04',exitCode:133,exitSignal:'SIGTRAP',timedOut:false};
 assert.throws(()=>direct(src),directRefusal);
});
test('direct runner exit classifier refuses unrecognized signal and ambiguous null',()=>{
 for(const signal of ['TRAP','CUSTOM',false,5]){
  assert.throws(()=>direct({runner:'ubuntu-24.04',exitCode:null,exitSignal:signal,timedOut:false}),directRefusal);
 }
 assert.throws(()=>direct({runner:'ubuntu-24.04',exitCode:null,exitSignal:null,timedOut:false}),directRefusal);
});
test('pair labels swapped, duplicated or missing are refused',()=>{
 const a=pair();a.observations.reverse();
 assert.throws(()=>compare(a),refusal);
 const b=pair();b.observations[1].runner='ubuntu-22.04';
 assert.throws(()=>compare(b),refusal);
 const c=pair();c.observations.pop();
 assert.throws(()=>compare(c),refusal);
});
test('a fabricated category cannot override recomputation from exit data',()=>{
 const a=pair();a.observations[1].category='clean-sandbox-passed';
 assert.throws(()=>compare(a),refusal);
 const b=pair();b.observations[1].category='directOtherExitCode';
 assert.throws(()=>compare(b),refusal);
});
test('unsupported policy, sandbox, release or merge claims are all refused',()=>{
 for(const k of [
  'independentArtifactOriginCertified','actualX11WindowMappedMeasured',
  'rendererSandboxIndependentlyVerified',
  'signalReproducesCausalAppArmorDenial',
  'kernelCapabilityQueryCausesCrashProven','nativeUbuntu24StrictGatePassed',
  'strictNativeGateWaived','apparmorPolicyChanged','sysctlChanged',
  'sandboxBypassApplied','realOMSIModRead','mergeAuthorized',
  'releaseAuthorized','installationAuthorized'
 ]){
  const a=pair();a.observations[1][k]=true;
  assert.throws(()=>compare(a),refusal,k);
 }
});
test('missing archive hash precheck and uninstrumented launch evidence refused',()=>{
 const a=pair();a.observations[0].archiveChecksumCheckedInPriorCIStep=false;
 assert.throws(()=>compare(a),refusal);
 const b=pair();b.observations[1].executedWithoutPtrace=false;
 assert.throws(()=>compare(b),refusal);
});
test('unexpected user paths, token or source schema refused',()=>{
 const a=pair();a.secret='/home/omsi/private';
 assert.throws(()=>compare(a),refusal);
 const b=pair();b.observations[0].stdout='private-token';
 assert.throws(()=>compare(b),refusal);
 const c=pair();c.observations[1].source='another-binary';
 assert.throws(()=>compare(c),refusal);
});
test('missing or malformed outer envelope refused without losing blocker',()=>{
 for(const x of [undefined,null,false,true,[],{},new Date(),'sandbox',42]){
  assert.throws(()=>compare(x),refusal);
 }
 const a=pair();a.schema='CERTIFIED_REAL_SANDBOX';
 assert.throws(()=>compare(a),refusal);
});
test('result never includes stderr, PIDs, runner home or executable arguments',()=>{
 const s=JSON.stringify(compare(pair()));
 for(const secret of [
  '/home/private','pid','stderr','stdout','--no-sandbox',
  'CLONE_NEWUSER','Bearer','githubToken','test-results/m40'
 ])assert.equal(s.includes(secret),false,secret);
 locked(compare(pair()));
});
test('CLI cannot be invoked offline to fabricate successful runner comparison',()=>{
 for(const script of [
  './auto-x11-cross-runner-direct-exit.mjs',
  './auto-x11-cross-runner-exit-compare.mjs'
 ]){
  const x=spawnSync(process.execPath,[script],{
   cwd:new URL('.',import.meta.url).pathname,
   encoding:'utf8',timeout:3000,maxBuffer:1000,
   env:{CI:'false',GITHUB_ACTIONS:'false',PATH:'/usr/bin:/bin'}
  });
  assert.equal(x.status,1);
  assert.equal(x.stdout,'');
  assert.match(x.stderr,script.includes('compare')?
    /M40_TWO_RUNNER_COMPARISON_REFUSED/:/M40_DIRECT_RUNNER_OBSERVATION_REFUSED/);
 }
});
