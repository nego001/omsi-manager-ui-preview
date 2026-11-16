import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyM34PrctlContext as classify}
 from './auto-x11-prctl-context.mjs';

const REFUSE=/^Error: M34_PRCTL_CONTEXT_REFUSED$/;
const v=(...traces)=>({
 runner:'ubuntu-24.04',traceTexts:traces,
 tracerExit:{exitCode:1,exitSignal:null,timedOut:false}
});
const locked=r=>{
 assert.equal(r.schema,'M34_UBUNTU24_PRCTL_ERRNO_CONTEXT_V1');
 assert.equal(r.source,'same-instrumented-trace-as-m33-no-extra-process');
 for(const key of [
  'noExplicitUserNamespaceDenialIsProofOfNamespaceAccess',
  'prctlEINVALIsApparmorDenialProof',
  'prctlEINVALCausesSIGTRAPProven',
  'apparmorCausesSIGTRAPProven',
  'rendererConfinementVerified',
  'strictUbuntu24NativeGatePassed','strictNativeGateWaived',
  'hostPolicyChanged','sandboxBypassApplied',
  'mergeAuthorized','releaseAuthorized','installationAuthorized'
 ])assert.equal(r[key],false,key);
 assert.equal(r.ptraceChangesBehaviorPossible,true);
 assert.ok(Object.isFrozen(r));
 assert.ok(Object.isFrozen(r.prctlOperationCounts));
 assert.ok(Object.isFrozen(r.prctlEINVALByOperation));
};
test('PRCTL EINVAL with SIGTRAP is not evidence of denied namespaces',()=>{
 const r=classify(v(
  'prctl(PR_CAPBSET_READ, CAP_SYS_ADMIN) = -1 EINVAL (Invalid argument)\n'+
  'prctl(PR_SET_NAME, "private") = -1 EINVAL (Invalid argument)\n'+
  'clone3({flags=CLONE_VM}, 88) = 300\n'+
  '--- SIGTRAP {si_code=SI_KERNEL} ---\n'));
 assert.equal(r.status,'prctlEINVALWithoutExplicitUserNamespaceDenial');
 assert.equal(r.prctlCallsClassified,2);
 assert.equal(r.m33PrctlEINVALCount,2);
 assert.equal(r.prctlEINVALByOperation.capBsetRead,1);
 assert.equal(r.prctlEINVALByOperation.otherPrctl,1);
 assert.equal(r.explicitUserNamespaceAccessDeniedCalls,0);
 assert.equal(r.m33SigtrapMarkers,1);locked(r);
});
test('explicit unshare CLONE_NEWUSER EPERM is a separate instrumented observation',()=>{
 const r=classify(v('unshare(CLONE_NEWUSER) = -1 EPERM (Operation not permitted)\n'));
 assert.equal(r.status,'explicitUserNamespaceDenialInInstrumentedTrace');
 assert.equal(r.explicitUserNamespaceFlaggedCalls,1);
 assert.equal(r.explicitUnshareUserNamespaceCalls,1);
 assert.equal(r.explicitUserNamespaceAccessDeniedCalls,1);
 assert.equal(r.prctlCallsClassified,0);locked(r);
});
test('clone3 CLONE_NEWUSER EACCES counted, nonnamespace clone not counted',()=>{
 const r=classify(v(
  'clone3({flags=CLONE_NEWUSER|SIGCHLD}, 88) = -1 EACCES (Permission denied)\n'+
  'clone3({flags=CLONE_VM}, 88) = -1 EPERM (Operation not permitted)\n'));
 assert.equal(r.explicitClone3UserNamespaceCalls,1);
 assert.equal(r.explicitUserNamespaceFlaggedCalls,1);
 assert.equal(r.explicitUserNamespaceAccessDeniedCalls,1);
 assert.equal(r.status,'explicitUserNamespaceDenialInInstrumentedTrace');
 locked(r);
});
test('PR_SET_NO_NEW_PRIVS EINVAL is not independent proof sandbox failed',()=>{
 const r=classify(v(
  'prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) = -1 EINVAL (Invalid argument)\n'+
  'prctl(PR_GET_NO_NEW_PRIVS, 0, 0, 0, 0) = 0\n'+
  'prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, 0x123) = 0\n'+
  'prctl(PR_GET_SECCOMP, 0, 0, 0, 0) = 0\n'));
 assert.equal(r.setNoNewPrivsFailureCalls,1);
 assert.equal(r.prctlOperationCounts.setNoNewPrivs,1);
 assert.equal(r.prctlOperationCounts.getNoNewPrivs,1);
 assert.equal(r.prctlOperationCounts.setSeccomp,1);
 assert.equal(r.prctlOperationCounts.getSeccomp,1);
 assert.equal(r.prctlEINVALByOperation.setNoNewPrivs,1);
 locked(r);
});
test('unshare nonnamespace operations cannot be promoted as userns denial',()=>{
 const r=classify(v(
  'unshare(CLONE_FILES) = -1 EPERM (Operation not permitted)\n'+
  'prctl(PR_SET_NAME, "a") = -1 EINVAL (Invalid argument)\n'));
 assert.equal(r.status,'prctlEINVALWithoutExplicitUserNamespaceDenial');
 assert.equal(r.explicitUserNamespaceFlaggedCalls,0);
 locked(r);
});
test('numeric flags on clone3 are unknown rather than imagined CLONE_NEWUSER',()=>{
 const r=classify(v('clone3({flags=0x10000000}, 88) = -1 EPERM (Operation not permitted)\n'));
 assert.equal(r.explicitUserNamespaceFlaggedCalls,0);
 assert.equal(r.explicitUserNamespaceAccessDeniedCalls,0);
 assert.equal(r.status,'noExplicitUserNamespaceDenialObserved');locked(r);
});
test('only recognized explicit flags, not private stderr or comments, count',()=>{
 const r=classify(v(
  'write(2,"CLONE_NEWUSER",13) = 13\n'+
  'openat(AT_FDCWD,"/private/CLONE_NEWUSER",0) = -1 EPERM\n'));
 assert.equal(r.explicitUserNamespaceFlaggedCalls,0);locked(r);
});
test('unknown numeric and novel PRCTL operations are counted as other',()=>{
 const r=classify(v(
  'prctl(0x53564d41, 0, 0, 0, 0) = -1 EINVAL (Invalid argument)\n'+
  'prctl(PR_SET_VMA, 0, 0, 0, 0) = -1 EINVAL (Invalid argument)\n'));
 assert.equal(r.prctlCallsClassified,2);
 assert.equal(r.prctlOperationCounts.otherPrctl,2);
 assert.equal(r.prctlEINVALByOperation.otherPrctl,2);
 locked(r);
});
test('PID-prefixed strace lines are supported without exposing process ids',()=>{
 const r=classify(v('[pid 98765] prctl(PR_GET_SECCOMP) = 2\n'+
  '[pid 98765] unshare(CLONE_NEWUSER) = -1 EPERM (Operation not permitted)\n'));
 assert.equal(r.prctlOperationCounts.getSeccomp,1);
 assert.equal(r.explicitUserNamespaceAccessDeniedCalls,1);
 const exported=JSON.stringify(r);
 assert.ok(!exported.includes('98765'));locked(r);
});
test('unfinished and resumed strace calls are not interpreted as denial',()=>{
 const r=classify(v(
  'prctl(PR_GET_SECCOMP <unfinished ...>\n'+
  '<... prctl resumed>) = -1 EINVAL\n'+
  'clone3({flags=CLONE_NEWUSER} <unfinished ...>\n'));
 assert.equal(r.prctlCallsClassified,0);
 assert.equal(r.explicitUserNamespaceFlaggedCalls,0);locked(r);
});
test('timeout is inconclusive even with explicit denied syscalls',()=>{
 const input=v('unshare(CLONE_NEWUSER) = -1 EPERM\n');
 input.tracerExit={exitCode:null,exitSignal:'SIGKILL',timedOut:true};
 const r=classify(input);
 assert.equal(r.status,'timedOutNoInference');
 assert.equal(r.explicitUserNamespaceAccessDeniedCalls,1);
 locked(r);
});
test('M33 source validation still rejects wrong runners and forged metadata',()=>{
 for(const bad of [null,[],{},'fake',true]){
  assert.throws(()=>classify(bad),REFUSE);
 }
 const a=v('prctl(PR_GET_SECCOMP) = 2\n');a.runner='ubuntu-22.04';
 assert.throws(()=>classify(a),REFUSE);
 const b=v('prctl(PR_GET_SECCOMP) = 2\n');b.privateTracePath='/home/user';
 assert.throws(()=>classify(b),REFUSE);
});
test('ambiguous unmatched PRCTL operation refuses rather than false subtype',()=>{
 const r=v('prctl("private symbolic operation", 0) = -1 EINVAL\n');
 assert.throws(()=>classify(r),REFUSE);
});
test('fixed sanitized output does not leak SHA, PIDs, user paths or raw arguments',()=>{
 const raw='prctl(PR_SET_NAME,"/home/secret/person",0) = -1 EINVAL (Invalid argument)\n';
 const report=JSON.stringify(classify(v(raw)));
 for(const secret of ['/home/secret','person','PR_SET_NAME','PR_CAP_SYS_ADMIN',
                      'traceTexts','--no-sandbox','ghp_']){
  assert.equal(report.includes(secret),false,secret);
 }
 locked(classify(v(raw)));
});
test('no trace target calls remains noncertifying and cannot pass release',()=>{
 const r=classify(v('+++ exited with 1 +++\n'));
 assert.equal(r.status,'noExplicitUserNamespaceDenialObserved');
 assert.equal(r.m33RecognizedDeniedCalls,0);
 assert.equal(r.prctlCallsClassified,0);locked(r);
});
