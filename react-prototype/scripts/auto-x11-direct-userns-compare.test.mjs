import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {classifyM40DirectExit} from './auto-x11-cross-runner-direct-exit.mjs';
import {classifyM41OwnedX11Window} from './auto-x11-cross-runner-owned-window.mjs';
import {
 classifyM42UsernsProbe
} from './auto-x11-direct-userns-observation.mjs';
import {
 compareM42HostUsernsAndDirectWindows as compare
} from './auto-x11-direct-userns-compare.mjs';

const REFUSE=/M42_DIRECT_USERNS_CROSS_RUNNER_REFUSED/;
const PROBE_REFUSE=/M42_DIRECT_RUNNER_USERNS_REFUSED/;
const probe=(runner,restriction,denied=true)=>classifyM42UsernsProbe({
 runner,
 apparmorModule:'enabled',apparmorUsernsRestriction:restriction,
 unprivilegedUsernsSwitch:'enabled',
 usernsCapacity:'positive',
 nodeProcessApparmorProfile:'unconfined',
 unshareAttempt:denied?'blocked-or-unavailable':'allowed',
 unshareFailureCategory:denied?'permission-denied':'none'
});
function pair(a='disabled',b='enabled',denied22=false,denied24=true){
 const x=classifyM40DirectExit({
  runner:'ubuntu-22.04',exitCode:null,exitSignal:'SIGKILL',timedOut:true
 });
 const y=classifyM40DirectExit({
  runner:'ubuntu-24.04',exitCode:null,exitSignal:'SIGTRAP',timedOut:false
 });
 const witness=(runner,exit,mapped)=>classifyM41OwnedX11Window({
  runner,exit:{
   exitCode:exit.exitCode,exitSignal:exit.exitSignal,
   timedOut:exit.timedOut
  },
  flags:{
   processImageObserved:true,windowTitleObserved:mapped,
   pidAttributed:mapped,mappedUsableWindowObserved:mapped
  }
 });
 return {
  m40Pair:{
   schema:'M40_DIRECT_CROSS_RUNNER_INPUT_V1',
   scope:'two-disposable-linux-runner-exit-observations',
   observations:[{...x},{...y}]
  },
  m41Witnesses:[
   {...witness('ubuntu-22.04',x,true)},
   {...witness('ubuntu-24.04',y,false)}
  ],
  m42HostProbes:[
   {...probe('ubuntu-22.04',a,denied22)},
   {...probe('ubuntu-24.04',b,denied24)}
  ]
 };
}
function locked(r){
 assert.equal(r.schema,'M42_DIRECT_HOST_USERNS_CROSS_RUNNER_COMPARISON_V1');
 assert.equal(r.m41AndM40ReportsValidated,true);
 assert.equal(r.comparedSameTwoRunnerLabels,true);
 assert.equal(r.noAppArmorSettingsWereChanged,true);
 for(const k of [
  'policyDifferenceProvesSIGTRAPCause',
  'usernsDeniedIsProofOfApparmorCause',
  'NodeHostProbeProvesElectronRendererConfinement',
  'nativeUbuntu24X11GatePassed','nativeUbuntu24GateWaived',
  'binaryOriginIndependentlyVerified',
  'realModRead','mergeAuthorized','releaseAuthorized',
  'installationAuthorized'
 ])assert.equal(r[k],false,k);
 assert.ok(Object.isFrozen(r));
}
test('22 disabled vs 24 enabled is only a host configuration contrast',()=>{
 const r=compare(pair());
 assert.equal(r.status,
  'ubuntu24RestrictsUsernsWhileUbuntu22DoesNotInSameBuildContexts');
 assert.equal(r.ubuntu22OwnedMappedWindowObserved,true);
 assert.equal(r.ubuntu24OwnedMappedWindowObserved,false);
 assert.equal(r.ubuntu24DirectSIGTRAPObserved,true);
 locked(r);
});
test('both denied unshare cannot be credited automatically to AppArmor',()=>{
 const r=compare(pair('enabled','enabled',true,true));
 assert.equal(r.status,'bothDirectRunnersDeniedUnshareWithoutCausality');
 assert.equal(r.ubuntu22UnshareCategory,'permission-denied');
 assert.equal(r.ubuntu24UnshareCategory,'permission-denied');locked(r);
});
test('22 allowed and 24 denied with 24 restriction unavailable is inconclusive causally',()=>{
 const r=compare(pair('unavailable','unavailable',false,true));
 assert.equal(r.status,
  'ubuntu22UnshareAllowedUbuntu24NotAllowedReasonUnresolved');
 locked(r);
});
test('unknown restriction with other failure categories is unresolved',()=>{
 const p=pair('unavailable','unknown',true,true);
 p.m42HostProbes[1]={...probe('ubuntu-24.04','unknown')};
 const r=compare(p);
 assert.equal(r.status,'bothDirectRunnersDeniedUnshareWithoutCausality');
 locked(r);
});
test('a process confinement category is not proof about Electron renderer',()=>{
 const p=pair();p.m42HostProbes[0].nodeProcessApparmorProfile='confined-enforce';
 const r=compare(p);
 assert.equal(r.NodeHostProbeProvesElectronRendererConfinement,false);
 locked(r);
});
test('unshare success cannot coexist with permission denied',()=>{
 const p=pair();p.m42HostProbes[0].unshareAttempt='allowed';
 assert.throws(()=>compare(p),REFUSE);
});
test('direct host probe refuses unknown labels and accidental extra metadata',()=>{
 const a={runner:'ubuntu-24.04',apparmorModule:'enabled',
  apparmorUsernsRestriction:'enabled',unprivilegedUsernsSwitch:'enabled',
  usernsCapacity:'positive',nodeProcessApparmorProfile:'unconfined',
  unshareAttempt:'allowed',unshareFailureCategory:'none'};
 assert.equal(classifyM42UsernsProbe(a).hostReadOnly,true);
 for(const [name,value] of [
  ['apparmorModule','profile /home/private'],
  ['nodeProcessApparmorProfile','/etc/apparmor/secret'],
  ['usernsCapacity','42'],
  ['unshareFailureCategory','permission-denied']
 ]){
  const x={...a,[name]:value};
  assert.throws(()=>classifyM42UsernsProbe(x),PROBE_REFUSE);
 }
 assert.throws(()=>classifyM42UsernsProbe({...a,secretPath:'/home/user'}),PROBE_REFUSE);
});
test('runner records must appear once in 22,24 order',()=>{
 const p=pair();p.m42HostProbes.reverse();
 assert.throws(()=>compare(p),REFUSE);
 const q=pair();q.m42HostProbes.pop();
 assert.throws(()=>compare(q),REFUSE);
});
test('forged release and policy-approval fields fail closed',()=>{
 for(const field of ['strictUbuntu24NativeGatePassed','strictNativeGateWaived',
  'apparmorPolicyChanged','sysctlChanged','sandboxBypassApplied',
  'electronRendererSandboxCertified','mergeAuthorized',
  'releaseAuthorized','installationAuthorized']){
  const p=pair();p.m42HostProbes[1][field]=true;
  assert.throws(()=>compare(p),REFUSE,field);
 }
});
test('mismatched window witness and direct signal must refuse host correlation',()=>{
 const p=pair();p.m41Witnesses[1].observedChildExitSignal='SIGSYS';
 assert.throws(()=>compare(p),REFUSE);
 const q=pair();q.m40Pair.observations[0].category='fake-safe';
 assert.throws(()=>compare(q),REFUSE);
});
test('unrecognized, missing or extra outer report data fail closed',()=>{
 for(const value of [null,undefined,{},false,[],new Date(),'trusted']){
  assert.throws(()=>compare(value),REFUSE);
 }
 const p=pair();p.userHome='/home/user';
 assert.throws(()=>compare(p),REFUSE);
});
test('comparison never includes raw stderr, PID, user path or policy evidence',()=>{
 const report=JSON.stringify(compare(pair()));
 for(const word of ['/home/runner','/proc/self','/etc/apparmor',
                     'PID:', 'stderr','xwininfo','Bearer ','CAP_SYS_ADMIN']){
  assert.equal(report.includes(word),false,word);
 }
 locked(compare(pair()));
});
test('direct and paired CLIs refuse execution outside authorized CI runner',()=>{
 for(const file of ['auto-x11-direct-userns-observation.mjs',
                      'auto-x11-direct-userns-compare.mjs']){
  const r=spawnSync(process.execPath,['./'+file],{
   cwd:new URL('.',import.meta.url).pathname,
   env:{PATH:'/usr/bin:/bin',CI:'false',GITHUB_ACTIONS:'false'},
   encoding:'utf8',timeout:4000,maxBuffer:1024
  });
  assert.equal(r.status,1,file);
  assert.equal(r.stdout,'',file);
  assert.match(r.stderr,
    file.includes('compare')?REFUSE:PROBE_REFUSE,file);
 }
});
