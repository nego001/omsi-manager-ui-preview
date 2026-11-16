import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyM33SyscallTrace as analyze} from './auto-x11-sigtrap-syscalls.mjs';

const REFUSAL=/^Error: M33_SYSCALL_DIAGNOSTIC_REFUSED$/;
const build=(traceTexts=['clone3({flags=CLONE_NEWUSER}, 88) = -1 EPERM (Operation not permitted)\n'])=>({
 runner:'ubuntu-24.04',
 traceTexts,
 tracerExit:{exitCode:1,exitSignal:null,timedOut:false}
});
const locked=r=>{
 assert.equal(r.schema,'M33_UBUNTU24_SANITIZED_SYSCALL_TRACE_V1');
 assert.equal(r.source,'one-disposable-strace-instrumented-ci-preview-process');
 assert.equal(r.traceObserverCanAlterProcessBehavior,true);
 for(const key of [
  'directNonTracedCrashReplicatedByThisTrace','kernelAuditCausalProof',
  'apparmorCausesSigtrapProven','rendererSandboxVerified',
  'nativeX11WindowVerified','thisDiagnosticIsMandatoryStrictX11Gate',
  'strictUbuntu24GateWaived','hostPolicyChanged','sandboxBypassApplied',
  'releaseAuthorized','mergeAuthorized','installationAuthorized'
 ])assert.equal(r[key],false,key);
 assert.equal(Object.isFrozen(r),true);
};

test('Ubuntu 24 trace captures EPERM/ENOSYS categories without inventing cause',()=>{
 const r=analyze(build([
  'clone3({flags=CLONE_NEWUSER}, 88) = -1 EPERM (Operation not permitted)\n'+
  'unshare(CLONE_NEWUSER) = -1 EPERM (Operation not permitted)\n'+
  'seccomp(SECCOMP_SET_MODE_FILTER, 0, ...) = 0\n'+
  '--- SIGTRAP {si_signo=SIGTRAP, si_code=SI_KERNEL} ---\n'+
  '+++ killed by SIGTRAP +++\n',
  'clone(child_stack=NULL, flags=CLONE_VM) = 321\n'+
  'clone3({flags=CLONE_VM}, 88) = -1 ENOSYS (Function not implemented)\n'
 ]));
 assert.equal(r.syscallsObserved,5);
 assert.equal(r.recognizedDeniedCalls,3);
 assert.equal(r.targetedSyscalls.clone3,2);
 assert.equal(r.targetedSyscalls.seccomp,1);
 assert.equal(r.errnoDenialCounts.clone3.EPERM,1);
 assert.equal(r.errnoDenialCounts.clone3.ENOSYS,1);
 assert.equal(r.errnoDenialCounts.unshare.EPERM,1);
 assert.equal(r.sigtrapSignalRecords,1);
 assert.equal(r.tracedChildKilledBySigtrapMarkers,1);
 assert.equal(r.observationStatus,'instrumentedSyscallCategoriesObserved');
 locked(r);
});
test('trace without matching syscalls is inconclusive, not a sandbox pass',()=>{
 const r=analyze(build(['+++ exited with 0 +++\n']));
 assert.equal(r.observationStatus,'noTargetSyscallsObserved');
 assert.equal(r.syscallsObserved,0);
 assert.equal(r.rendererSandboxVerified,false);
 locked(r);
});
test('timeout remains an observation limitation even when syscall counts exist',()=>{
 const v=build();v.tracerExit={exitCode:null,exitSignal:'SIGKILL',timedOut:true};
 const r=analyze(v);
 assert.equal(r.observationStatus,'traceTimedOutNotProof');
 assert.equal(r.tracerTerminatedBySignal,true);
 assert.equal(r.tracingTimedOut,true);
 locked(r);
});
test('different errno classes stay separate and do not imply AppArmor causality',()=>{
 const r=analyze(build([
  'unshare(CLONE_NEWUSER) = -1 EACCES (Permission denied)\n'+
  'unshare(CLONE_NEWUSER) = -1 EINVAL (Invalid argument)\n'+
  'clone3({flags=CLONE_VM}, 88) = -1 EAGAIN (Try again)\n'+
  'setns(7, CLONE_NEWUSER) = -1 EPERM (Operation not permitted)\n'
 ]));
 assert.equal(r.recognizedDeniedCalls,4);
 assert.equal(r.errnoDenialCounts.unshare.EACCES,1);
 assert.equal(r.errnoDenialCounts.unshare.EINVAL,1);
 assert.equal(r.errnoDenialCounts.clone3.EAGAIN,1);
 assert.equal(r.errnoDenialCounts.setns.EPERM,1);
 locked(r);
});
test('strace noise or extra syscalls do not become fake kernel-denial counts',()=>{
 const r=analyze(build([
  'openat(AT_FDCWD, "/home/private", 0) = -1 EPERM\n'+
  'write(2, "sensitive", 42) = -1 EACCES\n'+
  'clone3({flags=0}, 88) = 322\n'+
  '--- SIGSYS {si_signo=SIGSYS} ---\n'
 ]));
 assert.equal(r.syscallsObserved,1);
 assert.equal(r.recognizedDeniedCalls,0);
 assert.equal(r.sigtrapSignalRecords,0);
 locked(r);
});
test('resumed or incomplete trace lines cannot be counted as completed calls',()=>{
 const r=analyze(build([
  'clone3({flags=0}, 88 <unfinished ...>\n'+
  '<... clone3 resumed>) = -1 EPERM (Operation not permitted)\n'+
  'unshare(CLONE_NEWUSER) = -1 EPERM (Operation not permitted)\n'
 ]));
 assert.equal(r.syscallsObserved,1);
 assert.equal(r.recognizedDeniedCalls,1);
 locked(r);
});
test('non-24.04 runners are refused by the strict diagnostic scope',()=>{
 const v=build();v.runner='ubuntu-22.04';
 assert.throws(()=>analyze(v),REFUSAL);
});
test('missing trace, too many trace pieces and fake array types refused',()=>{
 for(const traceTexts of [[],null,'fake',Array(65).fill('clone3() = 1\n')]){
  const v=build();v.traceTexts=traceTexts;
  assert.throws(()=>analyze(v),REFUSAL);
 }
});
test('oversized and embedded NUL trace content refused without echo',()=>{
 for(const raw of [
  'A'.repeat(262145),'unshare() = -1 EPERM\u0000',
 ]){
  assert.throws(()=>analyze(build([raw])),REFUSAL);
 }
});
test('extra path, token or second process identity is refused in envelope',()=>{
 const v=build();v.realModFile='/home/user/omsi/mod.o3d';
 assert.throws(()=>analyze(v),REFUSAL);
 const x=build();x.tracerExit.rawStderr='secret';
 assert.throws(()=>analyze(x),REFUSAL);
});
test('invalid signal names, statuses and forged kernel metadata refused',()=>{
 const invalid=[
  {exitCode:'0',exitSignal:null,timedOut:false},
  {exitCode:true,exitSignal:null,timedOut:false},
  {exitCode:999,exitSignal:null,timedOut:false},
  {exitCode:0,exitSignal:'CUSTOM',timedOut:false},
  {exitCode:0,exitSignal:null,timedOut:'false'},
 ];
 for(const tracerExit of invalid){
  const v=build();v.tracerExit=tracerExit;
  assert.throws(()=>analyze(v),REFUSAL);
 }
});
test('a synthetic SIGTRAP marker never certifies renderer confinement',()=>{
 const r=analyze(build([
  'clone(CLONE_VM) = 42\n--- SIGTRAP {si_code=SI_KERNEL} ---\n'+
  '+++ killed by SIGTRAP +++\n'
 ]));
 assert.equal(r.tracedChildKilledBySigtrapMarkers,1);
 assert.equal(r.apparmorCausesSigtrapProven,false);
 assert.equal(r.rendererSandboxVerified,false);
 locked(r);
});
test('private paths, kernel raw lines and process IDs never leak in result',()=>{
 const privateText='/home/sensitive-person/private_mod_file.ams';
 const raw='clone3({flags=CLONE_NEWUSER}, 88) = -1 EPERM (secret:'+privateText+')\n';
 const report=JSON.stringify(analyze(build([raw])));
 for(const forbidden of [privateText,'CLONE_NEWUSER','secret:','PID=', 'traceTexts'])
  assert.equal(report.includes(forbidden),false,forbidden);
 locked(analyze(build([raw])));
});
test('null, boolean, malformed envelopes and inherited prototypes refused',()=>{
 for(const value of [null,undefined,true,5,[],{},'trace data',new Date()]){
  assert.throws(()=>analyze(value),REFUSAL);
 }
 const object=Object.create({runner:'ubuntu-24.04'});
 object.traceTexts=['clone3() = 0'];
 object.tracerExit={exitCode:0,exitSignal:null,timedOut:false};
 assert.throws(()=>analyze(object),REFUSAL);
});
