import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {classifyM39UntracedSIGTRAPRepeatability as classify}
 from './auto-x11-untraced-repeatability.mjs';

const refusal=/^Error: M39_UNTRACED_REPEATABILITY_REFUSED$/;
const trap=()=>({exitCode:null,exitSignal:'SIGTRAP',timedOut:false});
const code133=()=>({exitCode:133,exitSignal:null,timedOut:false});
const other=()=>({exitCode:1,exitSignal:null,timedOut:false});
const timeout=()=>({exitCode:null,exitSignal:'SIGKILL',timedOut:true});
const make=(repeats=[trap(),trap(),trap()],baseline=trap())=>({
 runner:'ubuntu-24.04',
 baselineM38:{
  schema:'M38_UBUNTU24_UNTRACED_VS_PTRACE_EXIT_V1',
  untracedObservedExitCode:baseline.exitCode,
  untracedObservedSignal:baseline.exitSignal,
  untracedTimedOut:baseline.timedOut,
  untracedSIGTRAPExitSignalObserved:baseline.exitSignal==='SIGTRAP'&&!baseline.timedOut,
  strictUbuntu24NativeGatePassed:false,
  strictNativeGateWaived:false,
  apparmorCausesSIGTRAPProven:false,
  rendererSandboxIndependentlyVerified:false,
  mergeAuthorized:false,
  installationAuthorized:false
 },
 additionalDirectRuns:repeats
});
function safety(r){
 assert.equal(r.schema,'M39_UBUNTU24_NON_PTRACE_SIGTRAP_REPEATABILITY_V1');
 assert.equal(r.totalDirectExecutions,4);
 assert.equal(r.additionalM39DirectExecutions,3);
 assert.equal(r.priorM38DirectExecutions,1);
 assert.equal(r.sameXvfbRunnerSharedAcrossAttempts,true);
 assert.ok(Object.isFrozen(r));
 assert.ok(Object.isFrozen(r.observedUntracedExitCategoryCounts));
 for(const k of [
  'fileBytesIndependentlyVerifiedBeforeEveryAttempt',
  'crossRunnerReproductionVerified','rootCauseOfSIGTRAPProven',
  'apparmorCausesSIGTRAPProven',
  'kernelCapabilityReadExplainsSIGTRAPProven',
  'ChromiumRendererSandboxCertified','nativeX11WindowVerifiedByThisTest',
  'strictUbuntu24NativeGatePassed','strictNativeGateWaived',
  'hostPolicyChanged','sandboxBypassApplied','realModRead',
  'mergeAuthorized','releaseAuthorized','installationAuthorized'
 ])assert.equal(r[k],false,k);
}
test('four genuine direct SIGTRAP signals give a noncausal repeatability category',()=>{
 const r=classify(make());
 assert.equal(r.status,'fourNonPtraceSIGTRAPSignalsObserved');
 assert.equal(r.allFourUntracedSIGTRAPSignalsObserved,true);
 assert.equal(r.observedUntracedExitCategoryCounts.SIGTRAP,4);
 assert.equal(r.observedUntracedExitCategoryCounts.timeout,0);
 safety(r);
});
test('mixed signals cannot be misreported as four reproducible SIGTRAPs',()=>{
 const r=classify(make([trap(),{exitCode:null,exitSignal:'SIGSEGV',timedOut:false},trap()]));
 assert.equal(r.status,'mixedUntracedExitOutcomesNeedReview');
 assert.equal(r.observedUntracedExitCategoryCounts.SIGTRAP,3);
 assert.equal(r.observedUntracedExitCategoryCounts.otherSignal,1);
 assert.equal(r.allFourUntracedSIGTRAPSignalsObserved,false);safety(r);
});
test('SIGTRAP in M38 but only different ordinary exits in repeats stays mixed',()=>{
 const r=classify(make([other(),other(),other()]));
 assert.equal(r.status,'mixedUntracedExitOutcomesNeedReview');
 assert.equal(r.observedUntracedExitCategoryCounts.otherExitCode,3);safety(r);
});
test('any timeout is classified as incomplete, not consistent even with three traps',()=>{
 const r=classify(make([trap(),timeout(),trap()]));
 assert.equal(r.status,'repeatabilityIncompleteDueToTimeout');
 assert.equal(r.observedUntracedExitCategoryCounts.timeout,1);
 assert.equal(r.observedUntracedExitCategoryCounts.SIGTRAP,3);safety(r);
});
test('baseline timeout also remains inconclusive rather than SIGTRAP',()=>{
 const r=classify(make([trap(),trap(),trap()],timeout()));
 assert.equal(r.status,'repeatabilityIncompleteDueToTimeout');
 assert.equal(r.observedUntracedExitCategoryCounts.timeout,1);safety(r);
});
test('four ordinary code 133 exits are not child SIGTRAP signal proof',()=>{
 const r=classify(make([code133(),code133(),code133()],code133()));
 assert.equal(r.status,'numericExit133WithoutDirectSIGTRAPSignals');
 assert.equal(r.observedUntracedExitCategoryCounts.SIGTRAP,0);
 assert.equal(r.observedUntracedExitCategoryCounts.code133,4);
 assert.equal(r.allFourUntracedSIGTRAPSignalsObserved,false);safety(r);
});
test('a numeric 133 and other non-signal exit are not mislabeled as all numeric',()=>{
 const r=classify(make([other(),code133(),other()],other()));
 assert.equal(r.status,'numericExit133WithoutDirectSIGTRAPSignals');
 assert.equal(r.observedUntracedExitCategoryCounts.code133,1);
 assert.equal(r.observedUntracedExitCategoryCounts.otherExitCode,3);safety(r);
});
test('no SIGTRAP and no numeric 133 stays a noncausal comparison',()=>{
 const r=classify(make([other(),other(),other()],other()));
 assert.equal(r.status,'noUntracedSIGTRAPSignalAcrossFourObservations');
 assert.equal(r.observedUntracedExitCategoryCounts.SIGTRAP,0);safety(r);
});
test('valid SIGSYS and SIGILL are separate signals, never SIGTRAP',()=>{
 const signals=['SIGSYS','SIGILL','SIGABRT'];
 const repeats=signals.map(exitSignal=>({exitCode:null,exitSignal,timedOut:false}));
 const r=classify(make(repeats,other()));
 assert.equal(r.observedUntracedExitCategoryCounts.otherSignal,3);
 assert.equal(r.observedUntracedExitCategoryCounts.SIGTRAP,0);safety(r);
});
test('fewer or more than 3 additional attempts fail closed',()=>{
 for(const runs of [[],[trap(),trap()],[trap(),trap(),trap(),trap()],'SIGTRAP',null]){
  const x=make();x.additionalDirectRuns=runs;
  assert.throws(()=>classify(x),refusal);
 }
});
test('mismatched baseline M38 signal/trap boolean refuses forged prior evidence',()=>{
 const a=make();a.baselineM38.untracedSIGTRAPExitSignalObserved=false;
 assert.throws(()=>classify(a),refusal);
 const b=make();b.baselineM38.untracedObservedSignal='SIGSEGV';
 assert.throws(()=>classify(b),refusal);
});
test('unauthorized M38 waiver, renderer proof or merge metadata refuse',()=>{
 for(const key of [
  'strictUbuntu24NativeGatePassed','strictNativeGateWaived',
  'apparmorCausesSIGTRAPProven','rendererSandboxIndependentlyVerified',
  'mergeAuthorized','installationAuthorized'
 ]){
  const x=make();x.baselineM38[key]=true;
  assert.throws(()=>classify(x),refusal,key);
 }
});
test('malformed exit status, timeout and extra stdout fields refuse',()=>{
 const cases=[
  {exitCode:999,exitSignal:null,timedOut:false},
  {exitCode:'0',exitSignal:null,timedOut:false},
  {exitCode:null,exitSignal:null,timedOut:false},
  {exitCode:133,exitSignal:'SIGTRAP',timedOut:false},
  {exitCode:null,exitSignal:'FAKE',timedOut:false},
  {exitCode:null,exitSignal:'SIGTRAP',timedOut:'false'},
  {...trap(),stderr:'/home/person/private/secret'}
 ];
 for(const bad of cases){
  const x=make();x.additionalDirectRuns[0]=bad;
  assert.throws(()=>classify(x),refusal);
 }
});
test('no extra runner provenance, path or security policy claims permitted',()=>{
 const x=make();x.runner='ubuntu-22.04';
 assert.throws(()=>classify(x),refusal);
 const y=make();y.hostPath='/home/user';
 assert.throws(()=>classify(y),refusal);
 const z=make();z.baselineM38.verifiedIndependentAuditor=true;
 assert.throws(()=>classify(z),refusal);
});
test('null and inherited-prototype envelopes refuse rather than certify',()=>{
 for(const item of [null,undefined,[],{},'SIGTRAP',false,42,new Date()]){
  assert.throws(()=>classify(item),refusal);
 }
 const inherited=Object.create({runner:'ubuntu-24.04'});
 inherited.baselineM38=make().baselineM38;
 inherited.additionalDirectRuns=[trap(),trap(),trap()];
 assert.throws(()=>classify(inherited),refusal);
});
test('sanitized result contains no PID, home, sensitive strings or argv',()=>{
 const r=classify(make()),s=JSON.stringify(r);
 for(const secret of [
  '/home/private','--ozone-platform=x11','pid:','stderr','traceTexts',
  'CLONE_NEWUSER','githubToken','CAP_SYS_ADMIN'
 ])assert.equal(s.includes(secret),false,secret);
 safety(r);
});
test('extra actual-trial producer refuses outside the authorized disposable CI',()=>{
 const snippet="import {runM39AdditionalUntracedTrials} from './auto-x11-untraced-repeatability.mjs';"+
  "try{await runM39AdditionalUntracedTrials('/tmp/OMSI-Manager-Preview','/tmp');"+
  "process.exit(9)}catch(e){console.log(e.message)}";
 const r=spawnSync(process.execPath,['--input-type=module','-e',snippet],{
  cwd:new URL('.',import.meta.url).pathname,
  env:{PATH:'/usr/bin:/bin',CI:'false',GITHUB_ACTIONS:'false',
   M33_RUNNER:'ubuntu-24.04'},
  encoding:'utf8',timeout:4000,maxBuffer:1024
 });
 assert.equal(r.status,0);
 assert.equal(r.stdout.trim(),'M39_UNTRACED_REPEATABILITY_REFUSED');
 assert.equal(r.stderr,'');
});
