// M39: repeat M38's direct, non-ptrace Electron execution on the SAME
// disposable CI runner with distinct temporary HOME/XDG directories.
// Measures exit-signal repeatability only: never identifies a SIGTRAP cause,
// certifies a renderer, or overrides strict native Ubuntu 24.04 CI.
import {runM38UntracedControl} from './auto-x11-untraced-exit-control.mjs';
import {join} from 'node:path';

const REFUSAL='M39_UNTRACED_REPEATABILITY_REFUSED';
const refuse=()=>{throw Error(REFUSAL);};
const allowed=new Set(['SIGTRAP','SIGKILL','SIGTERM','SIGSYS',
 'SIGSEGV','SIGABRT','SIGILL','SIGBUS']);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const exact=(v,k)=>plain(v)&&Object.keys(v).length===k.length&&
 k.every(name=>Object.hasOwn(v,name));
const EXIT_FIELDS=['exitCode','exitSignal','timedOut'];
function validExit(v){
 if(!exact(v,EXIT_FIELDS)||typeof v.timedOut!=='boolean')return false;
 if(v.exitCode!==null&&
    (!Number.isSafeInteger(v.exitCode)||v.exitCode<0||v.exitCode>255))
  return false;
 if(v.exitSignal!==null&&!allowed.has(v.exitSignal))return false;
 return v.timedOut||((v.exitCode===null)!==(v.exitSignal===null));
}

export function classifyM39UntracedSIGTRAPRepeatability(observation){
 if(!exact(observation,['runner','baselineM38','additionalDirectRuns'])||
    observation.runner!=='ubuntu-24.04'||
    !exact(observation.baselineM38,[
     'schema','untracedObservedExitCode','untracedObservedSignal',
     'untracedTimedOut','untracedSIGTRAPExitSignalObserved',
     'strictUbuntu24NativeGatePassed','strictNativeGateWaived',
     'apparmorCausesSIGTRAPProven','rendererSandboxIndependentlyVerified',
     'mergeAuthorized','installationAuthorized'
    ])||
    observation.baselineM38.schema!=='M38_UBUNTU24_UNTRACED_VS_PTRACE_EXIT_V1'||
    observation.baselineM38.strictUbuntu24NativeGatePassed!==false||
    observation.baselineM38.strictNativeGateWaived!==false||
    observation.baselineM38.apparmorCausesSIGTRAPProven!==false||
    observation.baselineM38.rendererSandboxIndependentlyVerified!==false||
    observation.baselineM38.mergeAuthorized!==false||
    observation.baselineM38.installationAuthorized!==false||
    typeof observation.baselineM38.untracedSIGTRAPExitSignalObserved!=='boolean'||
    !validExit({
     exitCode:observation.baselineM38.untracedObservedExitCode,
     exitSignal:observation.baselineM38.untracedObservedSignal,
     timedOut:observation.baselineM38.untracedTimedOut
    })||
    observation.baselineM38.untracedSIGTRAPExitSignalObserved!==(
     observation.baselineM38.untracedObservedSignal==='SIGTRAP'&&
     !observation.baselineM38.untracedTimedOut
    )||
    !Array.isArray(observation.additionalDirectRuns)||
    observation.additionalDirectRuns.length!==3||
    !observation.additionalDirectRuns.every(validExit))refuse();

 const events=[
  {
   exitCode:observation.baselineM38.untracedObservedExitCode,
   exitSignal:observation.baselineM38.untracedObservedSignal,
   timedOut:observation.baselineM38.untracedTimedOut
  },...observation.additionalDirectRuns
 ];
 const signals=Object.freeze({
  SIGTRAP:events.filter(v=>!v.timedOut&&v.exitSignal==='SIGTRAP').length,
  otherSignal:events.filter(v=>!v.timedOut&&v.exitSignal!==null&&
    v.exitSignal!=='SIGTRAP').length,
  code133:events.filter(v=>!v.timedOut&&v.exitSignal===null&&
    v.exitCode===133).length,
  otherExitCode:events.filter(v=>!v.timedOut&&v.exitSignal===null&&
    v.exitCode!==133).length,
  timeout:events.filter(v=>v.timedOut).length
 });
 const status=signals.timeout>0?'repeatabilityIncompleteDueToTimeout':
  signals.SIGTRAP===4?'fourNonPtraceSIGTRAPSignalsObserved':
  signals.SIGTRAP>0?'mixedUntracedExitOutcomesNeedReview':
  signals.code133>0?'numericExit133WithoutDirectSIGTRAPSignals':
  'noUntracedSIGTRAPSignalAcrossFourObservations';

 return Object.freeze({
  schema:'M39_UBUNTU24_NON_PTRACE_SIGTRAP_REPEATABILITY_V1',
  source:'four-untraced-exit-observations-one-disposable-ci-runner',
  runner:'ubuntu-24.04',
  status,
  totalDirectExecutions:4,
  priorM38DirectExecutions:1,
  additionalM39DirectExecutions:3,
  observedUntracedExitCategoryCounts:signals,
  allFourUntracedSIGTRAPSignalsObserved:signals.SIGTRAP===4,
  directExecsUseDistinctTemporaryHomes:true,
  sameXvfbRunnerSharedAcrossAttempts:true,
  fileBytesIndependentlyVerifiedBeforeEveryAttempt:false,
  crossRunnerReproductionVerified:false,
  rootCauseOfSIGTRAPProven:false,
  apparmorCausesSIGTRAPProven:false,
  kernelCapabilityReadExplainsSIGTRAPProven:false,
  ChromiumRendererSandboxCertified:false,
  nativeX11WindowVerifiedByThisTest:false,
  strictUbuntu24NativeGatePassed:false,
  strictNativeGateWaived:false,
  hostPolicyChanged:false,
  sandboxBypassApplied:false,
  realModRead:false,
  mergeAuthorized:false,
  releaseAuthorized:false,
  installationAuthorized:false
 });
}

export async function runM39AdditionalUntracedTrials(binary,workspace){
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.M33_RUNNER!=='ubuntu-24.04'||
    typeof binary!=='string'||!binary.endsWith('/OMSI-Manager-Preview')||
    typeof workspace!=='string')refuse();
 const trials=[];
 for(let i=0;i<3;i++){
  // runM38 already applies non-root, CI-only, DISPLAY, and executable
  // guards, suppresses stdio and kills the child process group on exit.
  // Each trial gets its own HOME/XDG, not the prior M38 one.
  trials.push(await runM38UntracedControl(binary,
   join(workspace,'m39-disposable-trial-'+(i+1))));
 }
 return trials;
}
