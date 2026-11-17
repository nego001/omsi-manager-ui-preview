import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {compareM38DirectAndInstrumentedSignals as compare}
 from './auto-x11-untraced-exit-control.mjs';

const REFUSAL=/^Error: M38_UNTRACED_EXIT_CONTROL_REFUSED$/;
const mk=(untraced={exitCode:null,exitSignal:'SIGTRAP',timedOut:false},
 tracedOverrides={})=>({
 runner:'ubuntu-24.04',untraced,
 traced:{
  schema:'M33_UBUNTU24_SANITIZED_SYSCALL_TRACE_V1',
  sigtrapSignalRecords:1,
  tracerTerminatedBySignal:true,
  tracingTimedOut:false,
  apparmorCausesSigtrapProven:false,
  rendererSandboxVerified:false,
  strictUbuntu24GateWaived:false,
  ...tracedOverrides
 }
});
const locked=r=>{
 assert.equal(r.schema,'M38_UBUNTU24_UNTRACED_VS_PTRACE_EXIT_V1');
 assert.equal(r.source,'same-ci-runner-same-verified-package-separate-executions');
 assert.equal(r.sameRunnerPackageButDistinctProcessExecutions,true);
 assert.equal(r.sameXvfbJobContext,true);
 assert.equal(r.untracedSignalIndependentOfPtrace,true);
 for(const key of [
  'rawStderrOrTraceEmitted','causalityBetweenCapIndexAndSIGTRAPProven',
  'apparmorCausesSIGTRAPProven','rendererSandboxIndependentlyVerified',
  'nativeWindowMappedVerifiedByThisControl','strictUbuntu24NativeGatePassed',
  'strictNativeGateWaived','apparmorPolicyChanged','sysctlChanged',
  'sandboxBypassApplied','mergeAuthorized','releaseAuthorized',
  'installationAuthorized'
 ])assert.equal(r[key],false,key);
 assert.ok(Object.isFrozen(r));
};
test('untraced SIGTRAP is a real child exit signal, not AppArmor causal proof',()=>{
 const r=compare(mk());
 assert.equal(r.status,'untracedSIGTRAPConfirmedAsExitSignal');
 assert.equal(r.untracedObservedSignal,'SIGTRAP');
 assert.equal(r.untracedSIGTRAPExitSignalObserved,true);
 assert.equal(r.tracedSIGTRAPMarkerCount,1);
 assert.equal(r.untracedObservedExitCode,null);locked(r);
});
test('exit code 133 is not automatically classified as SIGTRAP signal',()=>{
 const r=compare(mk({exitCode:133,exitSignal:null,timedOut:false}));
 assert.equal(r.status,'untracedExitCode133NotSignalProof');
 assert.equal(r.untracedSIGTRAPExitSignalObserved,false);locked(r);
});
test('untraced timeout is inconclusive even if kill result says SIGKILL',()=>{
 const r=compare(mk({exitCode:null,exitSignal:'SIGKILL',timedOut:true}));
 assert.equal(r.status,'untracedTimedOutNoSignalConclusion');
 assert.equal(r.untracedSIGTRAPExitSignalObserved,false);
 assert.equal(r.untracedTimedOut,true);locked(r);
});
test('clean exit 0 does not certify window, native gate or sandbox',()=>{
 const r=compare(mk({exitCode:0,exitSignal:null,timedOut:false},
                         {sigtrapSignalRecords:0}));
 assert.equal(r.status,'untracedExitNotSIGTRAPComparisonNeeded');
 assert.equal(r.nativeWindowMappedVerifiedByThisControl,false);
 assert.equal(r.rendererSandboxIndependentlyVerified,false);locked(r);
});
test('different untraced signal is not converted into SIGTRAP',()=>{
 for(const signal of ['SIGSEGV','SIGABRT','SIGSYS','SIGILL','SIGBUS']){
  const r=compare(mk({exitCode:null,exitSignal:signal,timedOut:false}));
  assert.equal(r.untracedSIGTRAPExitSignalObserved,false,signal);
  assert.equal(r.status,'untracedExitNotSIGTRAPComparisonNeeded');
  locked(r);
 }
});
test('traced marker without untraced signal cannot prove native SIGTRAP',()=>{
 const r=compare(mk({exitCode:1,exitSignal:null,timedOut:false},
                      {sigtrapSignalRecords:4}));
 assert.equal(r.tracedSIGTRAPMarkerCount,4);
 assert.equal(r.untracedSIGTRAPExitSignalObserved,false);locked(r);
});
test('untraced signal without traced marker still stays an independent observation',()=>{
 const r=compare(mk(undefined,{sigtrapSignalRecords:0}));
 assert.equal(r.untracedSIGTRAPExitSignalObserved,true);
 assert.equal(r.tracedSIGTRAPMarkerCount,0);locked(r);
});
test('traced timeout and direct timeout stay separate categories',()=>{
 const r=compare(mk({exitCode:null,exitSignal:'SIGTRAP',timedOut:false},
                     {tracingTimedOut:true}));
 assert.equal(r.tracedTimedOut,true);
 assert.equal(r.untracedTimedOut,false);locked(r);
});
test('inconsistent exit record without signal or code refuses',()=>{
 const x=mk({exitCode:null,exitSignal:null,timedOut:false});
 assert.throws(()=>compare(x),REFUSAL);
});
test('both exit status and signal in non-timeout record refuse',()=>{
 const x=mk({exitCode:133,exitSignal:'SIGTRAP',timedOut:false});
 assert.throws(()=>compare(x),REFUSAL);
});
test('unrecognized or fake signal/exit code refuses',()=>{
 const invalid=[
  {exitCode:1,exitSignal:'KILL',timedOut:false},
  {exitCode:256,exitSignal:null,timedOut:false},
  {exitCode:-1,exitSignal:null,timedOut:false},
  {exitCode:true,exitSignal:null,timedOut:false},
  {exitCode:'133',exitSignal:null,timedOut:false},
  {exitCode:0,exitSignal:null,timedOut:'false'},
  {exitCode:0,exitSignal:null,timedOut:false,stderr:'private'}
 ];
 for(const u of invalid)assert.throws(()=>compare(mk(u)),REFUSAL);
});
test('traced count must be safe and may not claim production certification',()=>{
 const invalid=[
  {sigtrapSignalRecords:-1},{sigtrapSignalRecords:3.2},
  {sigtrapSignalRecords:'1'},{sigtrapSignalRecords:100001},
  {apparmorCausesSigtrapProven:true},
  {rendererSandboxVerified:true},
  {strictUbuntu24GateWaived:true},
  {tracingTimedOut:'false'},{tracerTerminatedBySignal:null},
  {operatorSecret:'/home/user'}
 ];
 for(const bad of invalid)
  assert.throws(()=>compare(mk(undefined,bad)),REFUSAL);
});
test('non-24 runner or extra privileged host metadata refuse',()=>{
 const a=mk();a.runner='ubuntu-22.04';assert.throws(()=>compare(a),REFUSAL);
 const b=mk();b.hostPolicyChanged=true;assert.throws(()=>compare(b),REFUSAL);
});
test('empty and malformed observations fail closed without leaking input',()=>{
 for(const bad of [null,undefined,[],{},'signal',false,1,new Date()])
  assert.throws(()=>compare(bad),REFUSAL);
});
test('sanitized report contains no stderr, PID, private path, argv or SHA256',()=>{
 const r=compare(mk()),s=JSON.stringify(r);
 for(const secret of [
  '/home/private/omsi','traceTexts','stdio','--ozone-platform=x11',
  'gitHubToken','privateStderr','CapSet','pid', 'CLONE_NEWUSER'
 ])assert.ok(!s.includes(secret),secret);
 locked(r);
});
test('running direct comparison locally without CI gates is forbidden',async()=>{
 const code="import {runM38UntracedControl} from './auto-x11-untraced-exit-control.mjs';"+
  "try{await runM38UntracedControl('/tmp/OMSI-Manager-Preview','/tmp');"+
  "process.exit(9)}catch(e){console.log(e.message)}";
 const r=spawnSync(process.execPath,['--input-type=module','-e',code],{
  cwd:new URL('.',import.meta.url).pathname,
  env:{PATH:'/usr/bin:/bin',CI:'false',GITHUB_ACTIONS:'false',M33_RUNNER:'ubuntu-24.04'},
  encoding:'utf8',timeout:4000,maxBuffer:1024
 });
 assert.equal(r.status,0);
 assert.equal(r.stdout.trim(),'M38_UNTRACED_EXIT_CONTROL_REFUSED');
 assert.equal(r.stderr,'');
});
