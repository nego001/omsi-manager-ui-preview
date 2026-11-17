// M38: directly launch the SAME CI-packaged Electron in the existing
// Ubuntu 24.04 disposable Xvfb job, WITHOUT strace, to distinguish a
// genuine uninstrumented process exit signal from ptrace observations.
// Never changes AppArmor, sysctl, process sandbox, or any user mod.
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';

const REFUSAL='M38_UNTRACED_EXIT_CONTROL_REFUSED';
const refuse=()=>{throw Error(REFUSAL);};
const allowedSignals=new Set(['SIGTRAP','SIGKILL','SIGTERM','SIGSYS',
 'SIGSEGV','SIGABRT','SIGILL','SIGBUS']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(x,ks)=>plain(x)&&Object.keys(x).length===ks.length&&
 ks.every(k=>Object.hasOwn(x,k));
const validExit=x=>exact(x,['exitCode','exitSignal','timedOut'])&&
 (x.exitCode===null||(Number.isSafeInteger(x.exitCode)&&
  x.exitCode>=0&&x.exitCode<=255))&&
 (x.exitSignal===null||allowedSignals.has(x.exitSignal))&&
 typeof x.timedOut==='boolean'&&
 (x.timedOut||(
  (x.exitCode===null)!==(x.exitSignal===null)
 ));

export function compareM38DirectAndInstrumentedSignals(observation){
 if(!exact(observation,['runner','untraced','traced'])||
    observation.runner!=='ubuntu-24.04'||
    !validExit(observation.untraced)||
    !exact(observation.traced,[
     'schema','sigtrapSignalRecords','tracerTerminatedBySignal',
     'tracingTimedOut','apparmorCausesSigtrapProven',
     'rendererSandboxVerified','strictUbuntu24GateWaived'
    ])||
    observation.traced.schema!=='M33_UBUNTU24_SANITIZED_SYSCALL_TRACE_V1'||
    !Number.isSafeInteger(observation.traced.sigtrapSignalRecords)||
    observation.traced.sigtrapSignalRecords<0||
    observation.traced.sigtrapSignalRecords>100000||
    typeof observation.traced.tracerTerminatedBySignal!=='boolean'||
    typeof observation.traced.tracingTimedOut!=='boolean'||
    observation.traced.apparmorCausesSigtrapProven!==false||
    observation.traced.rendererSandboxVerified!==false||
    observation.traced.strictUbuntu24GateWaived!==false)refuse();

 const direct=observation.untraced;
 const sigtrap=direct.exitSignal==='SIGTRAP'&&!direct.timedOut;
 let status;
 if(direct.timedOut)status='untracedTimedOutNoSignalConclusion';
 else if(sigtrap)status='untracedSIGTRAPConfirmedAsExitSignal';
 else if(direct.exitCode===133)status='untracedExitCode133NotSignalProof';
 else status='untracedExitNotSIGTRAPComparisonNeeded';

 return Object.freeze({
  schema:'M38_UBUNTU24_UNTRACED_VS_PTRACE_EXIT_V1',
  source:'same-ci-runner-same-verified-package-separate-executions',
  runner:'ubuntu-24.04',
  status,
  untracedObservedExitCode:direct.exitCode,
  untracedObservedSignal:direct.exitSignal,
  untracedTimedOut:direct.timedOut,
  untracedSIGTRAPExitSignalObserved:sigtrap,
  tracedSIGTRAPMarkerCount:observation.traced.sigtrapSignalRecords,
  tracedObserverReportedSignal:observation.traced.tracerTerminatedBySignal,
  tracedTimedOut:observation.traced.tracingTimedOut,
  sameRunnerPackageButDistinctProcessExecutions:true,
  sameXvfbJobContext:true,
  rawStderrOrTraceEmitted:false,
  untracedSignalIndependentOfPtrace:true,
  causalityBetweenCapIndexAndSIGTRAPProven:false,
  apparmorCausesSIGTRAPProven:false,
  rendererSandboxIndependentlyVerified:false,
  nativeWindowMappedVerifiedByThisControl:false,
  strictUbuntu24NativeGatePassed:false,
  strictNativeGateWaived:false,
  apparmorPolicyChanged:false,
  sysctlChanged:false,
  sandboxBypassApplied:false,
  mergeAuthorized:false,
  releaseAuthorized:false,
  installationAuthorized:false
 });
}

export async function runM38UntracedControl(binary,workspace){
 // Only called from the already-gated M33 real CI runner, never from
 // arbitrary user input or local host. Its binary was realpath+X_OK
 // checked and the CI archive SHA-256 verified by preceding steps.
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.M33_RUNNER!=='ubuntu-24.04'||
    typeof process.env.DISPLAY!=='string'||
    !/^:\d{1,4}(?:\.\d{1,2})?$/.test(process.env.DISPLAY)||
    typeof binary!=='string'||!binary.endsWith('/OMSI-Manager-Preview')||
    typeof workspace!=='string')refuse();
 const home=join(workspace,'untraced-home');
 for(const sub of ['','config','cache','data','runtime']){
  mkdirSync(sub?join(home,sub):home,{recursive:true,mode:0o700});
 }
 const env={
  PATH:'/usr/bin:/bin',LANG:'C',CI:'true',DISPLAY:process.env.DISPLAY,
  XAUTHORITY:process.env.XAUTHORITY||'',HOME:home,
  XDG_CONFIG_HOME:join(home,'config'),XDG_CACHE_HOME:join(home,'cache'),
  XDG_DATA_HOME:join(home,'data'),XDG_RUNTIME_DIR:join(home,'runtime'),
  XDG_SESSION_TYPE:'x11',XDG_CURRENT_DESKTOP:'GNOME',
  WAYLAND_DISPLAY:'',LIBGL_ALWAYS_SOFTWARE:'1',OMSI_MANAGER_DEV_PREVIEW:'0'
 };
 return await new Promise((resolve,reject)=>{
  let child,finished=false,timedOut=false;
  try{
   child=spawn(binary,['--ozone-platform=x11'],{
    cwd:dirname(binary),detached:true,shell:false,env,
    stdio:['ignore','ignore','ignore']
   });
  }catch{reject(Error(REFUSAL));return;}
  const killGroup=()=>{
   if(Number.isSafeInteger(child.pid)&&child.pid>0){
    try{process.kill(-child.pid,'SIGKILL');}catch{}
   }
  };
  const timer=setTimeout(()=>{timedOut=true;killGroup();},8500);
  child.once('error',()=>{
   if(finished)return;
   finished=true;clearTimeout(timer);killGroup();
   reject(Error(REFUSAL));
  });
  child.once('close',(exitCode,exitSignal)=>{
   if(finished)return;
   finished=true;clearTimeout(timer);killGroup();
   resolve({exitCode,exitSignal,timedOut});
  });
 });
}
