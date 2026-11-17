// M33: inspect only fixed, sanitized Linux syscall outcomes from a
// short-lived CI-packaged Electron preview traced in disposable Xvfb.
// ptrace/strace may change behavior: this is NOT causality or sandbox proof.
import {classifyM34PrctlContext} from './auto-x11-prctl-context.mjs';
import {interpretM35KernelCapabilityBoundary} from './auto-x11-capbset-boundary.mjs';
import {interpretM36NamedCapabilityIndexes} from './auto-x11-symbolic-capabilities.mjs';
import {classifyM37AnnotatedCapabilityIndexes} from './auto-x11-annotated-capability-indices.mjs';
import {compareM38DirectAndInstrumentedSignals,runM38UntracedControl}
 from './auto-x11-untraced-exit-control.mjs';
import {classifyM39UntracedSIGTRAPRepeatability,runM39AdditionalUntracedTrials}
 from './auto-x11-untraced-repeatability.mjs';
import {spawn} from 'node:child_process';
import {accessSync,constants,mkdirSync,mkdtempSync,readdirSync,
        readFileSync,realpathSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,sep} from 'node:path';

const REFUSAL='M33_SYSCALL_DIAGNOSTIC_REFUSED';
const refuse=()=>{throw Error(REFUSAL);};
const SYSCALLS=Object.freeze(['clone','clone3','unshare','setns','prctl','seccomp']);
const DENIALS=Object.freeze(['EPERM','EACCES','ENOSYS','EINVAL','EAGAIN']);
const LINE_RE=/^(?:\[\s*pid\s+\d+\]\s+)?(clone3|clone|unshare|setns|prctl|seccomp)\(/;
const RETURN_RE=/=\s+-1\s+(EPERM|EACCES|ENOSYS|EINVAL|EAGAIN)\b/;
const MAX_TRACE_FILES=64,MAX_BYTES_PER_TRACE=262144,MAX_TRACE_LINES=5000;
const MAX_TOTAL_TRACE_BYTES=2097152;
const emptyCounts=()=>Object.fromEntries(SYSCALLS.map(x=>[x,0]));
const emptyDenials=()=>Object.fromEntries(SYSCALLS.map(x=>
 [x,Object.fromEntries(DENIALS.map(y=>[y,0]))]));
const validRunner=r=>r==='ubuntu-24.04';
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const keys=(o,k)=>plain(o)&&Object.keys(o).length===k.length&&
 k.every(x=>Object.hasOwn(o,x));

export function classifyM33SyscallTrace(source){
 if(!keys(source,['runner','traceTexts','tracerExit'])||
    !validRunner(source.runner)||
    !Array.isArray(source.traceTexts)||
    source.traceTexts.length<1||source.traceTexts.length>MAX_TRACE_FILES||
    !keys(source.tracerExit,['exitCode','exitSignal','timedOut'])||
    !(source.tracerExit.exitCode===null||
      (Number.isSafeInteger(source.tracerExit.exitCode)&&
       source.tracerExit.exitCode>=0&&source.tracerExit.exitCode<=255))||
    !(source.tracerExit.exitSignal===null||
      ['SIGKILL','SIGTERM','SIGTRAP','SIGSYS','SIGABRT','SIGSEGV']
       .includes(source.tracerExit.exitSignal))||
    typeof source.tracerExit.timedOut!=='boolean')refuse();

 let total=0,linesRead=0,signals=0,killedByTrap=0;
 const counts=emptyCounts(),denials=emptyDenials();
 for(const raw of source.traceTexts){
  if(typeof raw!=='string'||raw.length>MAX_BYTES_PER_TRACE||
     raw.includes('\0'))refuse();
  total+=Buffer.byteLength(raw);
  if(total>MAX_TOTAL_TRACE_BYTES)refuse();
  const lines=raw.split('\n');
  linesRead+=lines.length;
  if(linesRead>MAX_TRACE_LINES*MAX_TRACE_FILES)refuse();
  for(const line of lines){
   if(line.length>4096)continue;
   if(/^--- SIGTRAP\b/.test(line))signals++;
   if(/^\+\+\+ killed by SIGTRAP \+\+\+$/.test(line))killedByTrap++;
   const match=LINE_RE.exec(line);
   if(!match||!line.includes(' = '))continue;
   const name=match[1];
   counts[name]++;
   const errno=RETURN_RE.exec(line);
   if(errno)denials[name][errno[1]]++;
  }
 }
 const observed=Object.values(counts).reduce((a,b)=>a+b,0);
 const denied=Object.values(denials).reduce((sum,table)=>
  sum+Object.values(table).reduce((a,b)=>a+b,0),0);
 const exitSignal=source.tracerExit.exitSignal;
 const result={
  schema:'M33_UBUNTU24_SANITIZED_SYSCALL_TRACE_V1',
  source:'one-disposable-strace-instrumented-ci-preview-process',
  runner:source.runner,
  observationStatus:source.tracerExit.timedOut?'traceTimedOutNotProof':
   observed===0?'noTargetSyscallsObserved':
   'instrumentedSyscallCategoriesObserved',
  traceFilesInspected:source.traceTexts.length,
  syscallsObserved:observed,
  targetedSyscalls:Object.freeze(counts),
  errnoDenialCounts:Object.freeze(Object.fromEntries(
   SYSCALLS.map(s=>[s,Object.freeze(denials[s])]))),
  recognizedDeniedCalls:denied,
  sigtrapSignalRecords:signals,
  tracedChildKilledBySigtrapMarkers:killedByTrap,
  tracerTerminatedBySignal:exitSignal!==null,
  tracingTimedOut:source.tracerExit.timedOut,
  traceObserverCanAlterProcessBehavior:true,
  directNonTracedCrashReplicatedByThisTrace:false,
  kernelAuditCausalProof:false,
  apparmorCausesSigtrapProven:false,
  rendererSandboxVerified:false,
  nativeX11WindowVerified:false,
  thisDiagnosticIsMandatoryStrictX11Gate:false,
  strictUbuntu24GateWaived:false,
  hostPolicyChanged:false,
  sandboxBypassApplied:false,
  releaseAuthorized:false,
  mergeAuthorized:false,
  installationAuthorized:false
 };
 return Object.freeze(result);
}

const readTraceFiles=(folder)=>{
 const entries=readdirSync(folder,{withFileTypes:true})
  .filter(e=>e.name.startsWith('syscalls.')).sort((a,b)=>a.name.localeCompare(b.name));
 if(entries.length<1||entries.length>MAX_TRACE_FILES)refuse();
 const traceTexts=[];
 for(const entry of entries){
  if(!entry.isFile()||!/^syscalls\.\d{1,12}$/.test(entry.name))refuse();
  const p=join(folder,entry.name),stat=statSync(p);
  if(!stat.isFile()||stat.size>MAX_BYTES_PER_TRACE)refuse();
  traceTexts.push(readFileSync(p,'utf8'));
 }
 return traceTexts;
};

const runStrace=async(bin,workspace)=>{
 const home=join(workspace,'home');
 for(const child of ['','config','cache','data','runtime']){
  mkdirSync(child?join(home,child):home,{recursive:true,mode:0o700});
 }
 const prefix=join(workspace,'syscalls');
 const env={
  PATH:'/usr/bin:/bin',LANG:'C',CI:'true',DISPLAY:process.env.DISPLAY,
  XAUTHORITY:process.env.XAUTHORITY||'',
  HOME:home,XDG_CONFIG_HOME:join(home,'config'),
  XDG_CACHE_HOME:join(home,'cache'),XDG_DATA_HOME:join(home,'data'),
  XDG_RUNTIME_DIR:join(home,'runtime'),XDG_SESSION_TYPE:'x11',
  XDG_CURRENT_DESKTOP:'GNOME',WAYLAND_DISPLAY:'',
  LIBGL_ALWAYS_SOFTWARE:'1',OMSI_MANAGER_DEV_PREVIEW:'0'
 };
 const args=['-ff','-qq','-s','0',
  '-e','trace=clone,clone3,unshare,setns,prctl,seccomp',
  '-e','signal=SIGTRAP,SIGSYS',
  '-o',prefix,bin,'--ozone-platform=x11'];
 let timedOut=false,exitCode=null,exitSignal=null;
 await new Promise((resolveDone,rejectDone)=>{
  let settled=false,child;
  try{child=spawn('/usr/bin/strace',args,{
   cwd:dirname(bin),detached:true,
   stdio:['ignore','ignore','pipe'],env,shell:false
  });}
  catch{rejectDone(Error(REFUSAL));return;}
  child.stderr?.resume(); // raw strace stderr must never appear in logs
  const timer=setTimeout(()=>{
   timedOut=true;
   try{process.kill(-child.pid,'SIGKILL');}catch{}
  },8500);
  child.on('error',()=>{if(!settled){settled=true;clearTimeout(timer);
    rejectDone(Error(REFUSAL));}});
  child.on('close',(code,signal)=>{
   if(settled)return;
   settled=true;clearTimeout(timer);
   exitCode=code;exitSignal=signal;resolveDone();
  });
 });
 return {exitCode,exitSignal,timedOut};
};

async function main(){
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.M33_RUNNER!=='ubuntu-24.04'||
    typeof process.env.DISPLAY!=='string'||
    !/^:\d{1,4}(?:\.\d{1,2})?$/.test(process.env.DISPLAY))refuse();
 const root=resolve('release/OMSI-Manager-Preview-linux-x64');
 const binary=resolve(root,'OMSI-Manager-Preview');
 const canonicalRoot=realpathSync(root);
 const canonicalBinary=realpathSync(binary);
 if(!canonicalBinary.startsWith(canonicalRoot+sep))refuse();
 accessSync(canonicalBinary,constants.X_OK);
 const temp=mkdtempSync(join(tmpdir(),'omsi-m33-syscall-'),{encoding:'utf8'});
 try{
  const exit=await runStrace(canonicalBinary,temp);
  const files=readTraceFiles(temp);
  const sample={runner:'ubuntu-24.04',traceTexts:files,tracerExit:exit};
  const report=classifyM33SyscallTrace(sample);
  // Static import above avoids an unresolved dynamic import while
  // main() has a pending top-level await. Both parsers inspect the
  // SAME sanitized trace and do not change host security policy.
  const context=classifyM34PrctlContext(sample);
  if(context.m33PrctlEINVALCount!==report.errnoDenialCounts.prctl.EINVAL||
     context.m33SigtrapMarkers!==report.sigtrapSignalRecords||
     context.prctlCallsClassified!==report.targetedSyscalls.prctl)refuse();
  // Fixed categories only: no PIDs, names, paths, raw stderr, argv or SHA.
  // Only this fixed, public kernel numeric boundary is read. Neither
  // trace content nor paths are returned. No host policy or sysctl writes.
  const capLast=readFileSync('/proc/sys/kernel/cap_last_cap','utf8');
  const bound=interpretM35KernelCapabilityBoundary({
   runner:'ubuntu-24.04',kernelLastCapabilityText:capLast,
   traceTexts:files,m34:context
  });
  const named=interpretM36NamedCapabilityIndexes({
   runner:'ubuntu-24.04',kernelLastCapabilityText:capLast,
   traceTexts:files,m34:context
  });
  if(named.totalCapReadCalls!==bound.capReadCalls||
     named.totalCapReadEINVAL!==bound.capReadEINVAL||
     named.unrecognizedSymbolicEINVAL+named.knownSymbolicWithinBoundEINVAL+
       named.knownSymbolicAboveBoundEINVAL!==bound.EINVALWithUnparsedOperand)refuse();
  const annotations=classifyM37AnnotatedCapabilityIndexes({
   runner:'ubuntu-24.04',kernelLastCapabilityText:capLast,
   traceTexts:files,m34:context
  });
  if(annotations.totalCapReadCalls!==named.totalCapReadCalls||
     annotations.totalCapReadEINVAL!==named.totalCapReadEINVAL||
     annotations.unknownAfterM36!==named.unrecognizedSymbolicOrAnnotatedOperands||
     annotations.EINVALOperandsStillUnresolved+
       annotations.annotatedEINVALAboveKernelBound+
       annotations.annotatedEINVALWithinKernelBound!==
       named.unrecognizedSymbolicEINVAL)refuse();
  console.log('M33_SYSCALL_CATEGORIES',JSON.stringify(report));
  console.log('M34_PRCTL_CONTEXT',JSON.stringify(context));
  console.log('M35_CAPABILITY_BOUNDARY',JSON.stringify(bound));
  console.log('M36_SYMBOLIC_CAPABILITIES',JSON.stringify(named));
  console.log('M37_CAPABILITY_ANNOTATIONS',JSON.stringify(annotations));
  if(report.syscallsObserved<1)refuse();
  // Same immutable CI-built binary and existing Xvfb job, this time
  // WITHOUT strace. A separate temporary HOME is used and all raw
  // stdout/stderr is discarded. This is not a native-window gate.
  const untraced=await runM38UntracedControl(canonicalBinary,temp);
  const paired=compareM38DirectAndInstrumentedSignals({
   runner:'ubuntu-24.04',untraced,
   traced:{
    schema:report.schema,
    sigtrapSignalRecords:report.sigtrapSignalRecords,
    tracerTerminatedBySignal:report.tracerTerminatedBySignal,
    tracingTimedOut:report.tracingTimedOut,
    apparmorCausesSigtrapProven:report.apparmorCausesSigtrapProven,
    rendererSandboxVerified:report.rendererSandboxVerified,
    strictUbuntu24GateWaived:report.strictUbuntu24GateWaived
   }
  });
  console.log('M38_UNTRACED_EXIT_CONTROL',JSON.stringify(paired));
  // Three more non-ptrace runs of the same CI package, each with a
  // distinct HOME/XDG. Baseline M38 + these = four exit observations.
  const repeats=await runM39AdditionalUntracedTrials(canonicalBinary,temp);
  const repeated=classifyM39UntracedSIGTRAPRepeatability({
   runner:'ubuntu-24.04',
   baselineM38:{
    schema:paired.schema,
    untracedObservedExitCode:paired.untracedObservedExitCode,
    untracedObservedSignal:paired.untracedObservedSignal,
    untracedTimedOut:paired.untracedTimedOut,
    untracedSIGTRAPExitSignalObserved:paired.untracedSIGTRAPExitSignalObserved,
    strictUbuntu24NativeGatePassed:paired.strictUbuntu24NativeGatePassed,
    strictNativeGateWaived:paired.strictNativeGateWaived,
    apparmorCausesSIGTRAPProven:paired.apparmorCausesSIGTRAPProven,
    rendererSandboxIndependentlyVerified:paired.rendererSandboxIndependentlyVerified,
    mergeAuthorized:paired.mergeAuthorized,
    installationAuthorized:paired.installationAuthorized
   },
   additionalDirectRuns:repeats
  });
  console.log('M39_UNTRACED_SIGTRAP_REPEATABILITY',JSON.stringify(repeated));
 }finally{
  rmSync(temp,{recursive:true,force:true,maxRetries:2});
 }
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{await main();}catch{
  console.error(REFUSAL);process.exitCode=1;
 }
}
