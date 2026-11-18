import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {classifyM40DirectExit} from './auto-x11-cross-runner-direct-exit.mjs';
import {classifyM41OwnedX11Window} from './auto-x11-cross-runner-owned-window.mjs';
import {classifyM42UsernsProbe} from './auto-x11-direct-userns-observation.mjs';
import {classifyM43Trials} from './auto-x11-direct-repeatability.mjs';
import {classifyM44} from './auto-x11-direct-stderr-categories.mjs';
import {createM45OperatorHandoff as handoff,verifyM45Handoff as verify}
 from './auto-x11-admin-pilot-readiness.mjs';

const ERR=/M45_OPERATOR_HANDOFF_REFUSED/;
const observed=(runner,mapped)=>{
 const timedOut=runner==='ubuntu-22.04';
 return {
  exit:{runner,exitCode:null,exitSignal:timedOut?'SIGKILL':'SIGTRAP',timedOut},
  witness:{processImageObserved:true,windowTitleObserved:mapped,
   pidAttributed:mapped,mappedUsableWindowObserved:mapped}
 };
};
function fixture(){
 const r22='ubuntu-22.04',r24='ubuntu-24.04';
 const a=observed(r22,true),b=observed(r24,false);
 const m40=(x)=>classifyM40DirectExit(x.exit);
 const m41=(x)=>classifyM41OwnedX11Window({runner:x.exit.runner,flags:x.witness,
  exit:{exitCode:x.exit.exitCode,exitSignal:x.exit.exitSignal,timedOut:x.exit.timedOut}});
 const probe=(runner,restrict,allowed)=>classifyM42UsernsProbe({
  runner,apparmorModule:'enabled',apparmorUsernsRestriction:restrict,
  unprivilegedUsernsSwitch:'enabled',usernsCapacity:'positive',
  nodeProcessApparmorProfile:'unconfined',
  unshareAttempt:allowed?'allowed':'blocked-or-unavailable',
  unshareFailureCategory:allowed?'none':'permission-denied'
 });
 const m44=(runner,timeout,stderr)=>classifyM44({
  runner,exitCode:null,exitSignal:timeout?'SIGKILL':'SIGTRAP',
  timedOut:timeout,stderr,truncated:false
 });
 return {
  m42Input:{
   m40Pair:{schema:'M40_DIRECT_CROSS_RUNNER_INPUT_V1',
    scope:'two-disposable-linux-runner-exit-observations',
    observations:[m40(a),m40(b)]},
   m41Witnesses:[m41(a),m41(b)],
   m42HostProbes:[probe(r22,'disabled',true),probe(r24,'enabled',false)]
  },
  m43Reports:{
   ubuntu22:classifyM43Trials({runner:r22,observations:[a,a,a]}),
   ubuntu24:classifyM43Trials({runner:r24,observations:[b,b,b]})
  },
  m44Reports:{
   ubuntu22:m44(r22,true,'nonfatal warning'),
   ubuntu24:m44(r24,false,'FATAL: unspecified failure')
  }
 };
}
const clone=x=>JSON.parse(JSON.stringify(x));
test('the observed 22 windows / 24 SIGTRAP contrast yields only human review',()=>{
 const result=handoff(fixture());
 assert.equal(result.status,'repeated-host-contrast-for-administrator-review-only');
 assert.equal(result.reviewRequestedOnly,true);
 assert.equal(result.ubuntu22MappedOutOfThree,3);
 assert.equal(result.ubuntu24MappedOutOfThree,0);
 assert.equal(result.ubuntu24SIGTRAPOutOfThree,3);
 assert.equal(verify(result),result);
 assert.ok(Object.isFrozen(result));
});
test('all pilot, rollback, sandbox and release permissions remain false',()=>{
 const r=handoff(fixture());
 for(const key of ['administratorAuthorizedPolicyExperiment',
  'pilotVmIdentityAuthenticated','independentPackageAuthenticityCertified',
  'appSpecificProfileLoaded','abaRollbackVerified',
  'electronRendererSandboxCertified','nativeUbuntu24StrictGatePassed',
  'nativeUbuntu24GateWaived','apparmorCausalityProven',
  'hostPolicyChanged','mergeAuthorized','installationAuthorized',
  'releaseAuthorized','sandboxBypassApplied'])assert.equal(r[key],false,key);
});
test('each administrative blocker remains present even with favorable CI contrast',()=>{
 const r=handoff(fixture());
 assert.equal(r.blockers.length,8);
 assert.ok(r.blockers.includes('administrator-explicit-approval-not-verified'));
 assert.ok(r.blockers.includes('electron-renderer-sandbox-not-independently-verified'));
 assert.ok(r.blockers.includes('baseline-pilot-rollback-not-performed'));
});
test('Ubuntu 24 userns restriction not observed prevents review recommendation',()=>{
 const f=fixture();
 f.m42Input.m42HostProbes[1]=classifyM42UsernsProbe({
  runner:'ubuntu-24.04',apparmorModule:'enabled',
  apparmorUsernsRestriction:'unavailable',unprivilegedUsernsSwitch:'enabled',
  usernsCapacity:'positive',nodeProcessApparmorProfile:'unconfined',
  unshareAttempt:'blocked-or-unavailable',unshareFailureCategory:'permission-denied'
 });
 const r=handoff(f);
 assert.equal(r.reviewRequestedOnly,false);
 assert.equal(r.m42HostContrast,false);
});
test('only two observed windows on Ubuntu22 is insufficient for full repeatability',()=>{
 const f=fixture(),r='ubuntu-22.04';
 f.m43Reports.ubuntu22=classifyM43Trials({runner:r,
  observations:[observed(r,true),observed(r,false),observed(r,true)]});
 const out=handoff(f);
 assert.equal(out.status,'missing-or-divergent-evidence-no-policy-review-conclusion');
 assert.equal(out.m43WindowContrast,false);
});
test('Ubuntu24 SIGTRAP missing in one trial is not three confirmed signals',()=>{
 const f=fixture(),r='ubuntu-24.04';
 const x=observed(r,false),y=observed(r,false);
 y.exit={runner:r,exitCode:null,exitSignal:'SIGKILL',timedOut:true};
 f.m43Reports.ubuntu24=classifyM43Trials({runner:r,observations:[x,y,x]});
 const out=handoff(f);
 assert.equal(out.ubuntu24SIGTRAPOutOfThree,2);
 assert.equal(out.reviewRequestedOnly,false);
});
test('M44 unrecognized stderr remains categorizable, not causal proof',()=>{
 const f=fixture();
 f.m44Reports.ubuntu24=classifyM44({
  runner:'ubuntu-24.04',exitCode:null,exitSignal:'SIGTRAP',
  timedOut:false,stderr:'',truncated:false
 });
 const out=handoff(f);
 assert.equal(out.reviewRequestedOnly,false);
 assert.equal(out.ubuntu24StderrCategory,'no-recognized-diagnostic');
 assert.equal(out.apparmorCausalityProven,false);
});
test('M44 truncation prevents claiming complete diagnostic coverage',()=>{
 const f=fixture();
 f.m44Reports.ubuntu24=classifyM44({
  runner:'ubuntu-24.04',exitCode:null,exitSignal:'SIGTRAP',
  timedOut:false,stderr:'FATAL',truncated:true
 });
 assert.equal(handoff(f).reviewRequestedOnly,false);
});
test('fake M40 category, M41 identity or M42 host report refuses',()=>{
 for(const mutate of [
  x=>{x.m42Input.m40Pair.observations[0].category='safe-to-merge';},
  x=>{x.m42Input.m41Witnesses[0].exactNETWMPIDAttributed=false;},
  x=>{x.m42Input.m42HostProbes[1].hostReadOnly=false;}
 ]){
  const f=clone(fixture());mutate(f);
  assert.throws(()=>handoff(f),ERR);
 }
});
test('wrong or forged runner labels and categories refuse',()=>{
 for(const mutate of [
  x=>{x.m43Reports.ubuntu22.runner='ubuntu-24.04';},
  x=>{x.m44Reports.ubuntu24.stderrCategory='anonymized-path /home/private';},
  x=>{x.m44Reports.ubuntu22.rendererSandboxCertified=true;}
 ]){
  const f=clone(fixture());mutate(f);
  assert.throws(()=>handoff(f),ERR);
 }
});
test('all unexpected outer fields or omitted inputs are rejected',()=>{
 for(const x of [null,undefined,{},false,[],new Date()]){
  assert.throws(()=>handoff(x),ERR);
 }
 const f=fixture();f.privatePid=1234;
 assert.throws(()=>handoff(f),ERR);
});
test('review report refuses forged authorization or simulated sandbox success',()=>{
 for(const key of ['administratorAuthorizedPolicyExperiment',
 'pilotVmIdentityAuthenticated','abaRollbackVerified',
 'electronRendererSandboxCertified','nativeUbuntu24StrictGatePassed',
 'mergeAuthorized','releaseAuthorized']){
  const r=clone(handoff(fixture()));r[key]=true;
  assert.throws(()=>verify(r),ERR,key);
 }
});
test('review report refuses forged status, altered blockers and private content',()=>{
 for(const mutate of [
  r=>{r.status='approved';},
  r=>{r.blockers.pop();},
  r=>{r.blockers[1]='/home/operator';},
  r=>{r.rawStderr='FATAL: secret';},
  r=>{r.ubuntu24SIGTRAPOutOfThree=7;}
 ]){
  const r=clone(handoff(fixture()));mutate(r);
  assert.throws(()=>verify(r),ERR);
 }
});
test('published summary contains no PID, private path, stdout or raw stderr',()=>{
 const s=JSON.stringify(handoff(fixture()));
 for(const token of ['/home/','/etc/apparmor','SIGTRAP: private',
  'PID:', 'stderrRaw:', 'No usable sandbox!','sessionTag','/proc/']){
  assert.equal(s.includes(token),false,token);
 }
});
test('CLI blocks non-CI callers before reading any staged files',()=>{
 const x=spawnSync(process.execPath,['./auto-x11-admin-pilot-readiness.mjs'],{
  cwd:new URL('.',import.meta.url).pathname,
  env:{CI:'false',GITHUB_ACTIONS:'false',PATH:'/usr/bin:/bin'},
  encoding:'utf8',timeout:4000,maxBuffer:1024
 });
 assert.equal(x.status,1);assert.equal(x.stdout,'');
 assert.match(x.stderr,ERR);
});
