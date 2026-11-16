// M34: keep PRCTL EINVAL separate from explicit CLONE_NEWUSER denial.
// This classifies the SAME disposable, instrumented trace as M33.
// Does not collect new secrets or claim AppArmor cause or sandbox proof.
import {classifyM33SyscallTrace} from './auto-x11-sigtrap-syscalls.mjs';

const REFUSAL='M34_PRCTL_CONTEXT_REFUSED';
const refuse=()=>{throw Error(REFUSAL);};
const OPERATIONS=Object.freeze([
 'setNoNewPrivs','getNoNewPrivs','setSeccomp','getSeccomp',
 'capBsetRead','otherPrctl'
]);
const RE_PRC=/^(?:\[\s*pid\s+\d+\]\s+)?prctl\((PR_[A-Z0-9_]+|0x[0-9a-fA-F]+|[0-9]+)(?:,|\))/;
const RE_NS=/^(?:\[\s*pid\s+\d+\]\s+)?(clone3|clone|unshare)\(/;
const RE_ERR=/=\s+-1\s+(EPERM|EACCES|ENOSYS|EINVAL|EAGAIN)\b/;
const MAP=Object.freeze({
 PR_SET_NO_NEW_PRIVS:'setNoNewPrivs',
 PR_GET_NO_NEW_PRIVS:'getNoNewPrivs',
 PR_SET_SECCOMP:'setSeccomp',
 PR_GET_SECCOMP:'getSeccomp',
 PR_CAPBSET_READ:'capBsetRead'
});
const counts=()=>Object.fromEntries(OPERATIONS.map(k=>[k,0]));
export function classifyM34PrctlContext(source){
 let baseline;
 try{baseline=classifyM33SyscallTrace(source);}catch{refuse();}
 if(baseline.schema!=='M33_UBUNTU24_SANITIZED_SYSCALL_TRACE_V1'||
    baseline.apparmorCausesSigtrapProven!==false||
    baseline.strictUbuntu24GateWaived!==false||
    baseline.rendererSandboxVerified!==false)refuse();
 const operations=counts(),invalid=counts();
 let explicitUsernsCalls=0,explicitUsernsAccessDenied=0,
     clone3UsernsCalls=0,unshareUsernsCalls=0,
     noNewPrivsFailures=0,prctlMatched=0;
 for(const raw of source.traceTexts){
  for(const line of raw.split('\n')){
   if(line.length>4096||!line.includes(' = '))continue;
   const match=RE_PRC.exec(line),err=RE_ERR.exec(line);
   if(match){
    const op=Object.hasOwn(MAP,match[1])?MAP[match[1]]:'otherPrctl';
    operations[op]++;prctlMatched++;
    if(err?.[1]==='EINVAL')invalid[op]++;
    if(op==='setNoNewPrivs'&&err&&
       ['EPERM','EACCES','EINVAL'].includes(err[1]))
      noNewPrivsFailures++;
   }
   const userns=RE_NS.exec(line);
   if(userns){
    // The flag must be EXPLICITLY printed within syscall arguments.
    // Missing flags, symbolic output and raw numeric values remain unknown.
    const args=line.slice(0,line.lastIndexOf(' = '));
    if(!args.includes('CLONE_NEWUSER'))continue;
    explicitUsernsCalls++;
    if(userns[1]==='clone3')clone3UsernsCalls++;
    if(userns[1]==='unshare')unshareUsernsCalls++;
    if(err&&['EPERM','EACCES'].includes(err[1]))
      explicitUsernsAccessDenied++;
   }
  }
 }
 // A fully parsed prctl first argument is needed for attribution.
 if(prctlMatched!==baseline.targetedSyscalls.prctl||
    Object.values(invalid).reduce((a,b)=>a+b,0)!==
     baseline.errnoDenialCounts.prctl.EINVAL)refuse();
 const status=baseline.tracingTimedOut?
  'timedOutNoInference':
  explicitUsernsAccessDenied>0?
   'explicitUserNamespaceDenialInInstrumentedTrace':
  baseline.errnoDenialCounts.prctl.EINVAL>0?
   'prctlEINVALWithoutExplicitUserNamespaceDenial':
   'noExplicitUserNamespaceDenialObserved';
 return Object.freeze({
  schema:'M34_UBUNTU24_PRCTL_ERRNO_CONTEXT_V1',
  source:'same-instrumented-trace-as-m33-no-extra-process',
  status,
  prctlCallsClassified:prctlMatched,
  prctlOperationCounts:Object.freeze(operations),
  prctlEINVALByOperation:Object.freeze(invalid),
  explicitUserNamespaceFlaggedCalls:explicitUsernsCalls,
  explicitUserNamespaceAccessDeniedCalls:explicitUsernsAccessDenied,
  explicitClone3UserNamespaceCalls:clone3UsernsCalls,
  explicitUnshareUserNamespaceCalls:unshareUsernsCalls,
  setNoNewPrivsFailureCalls:noNewPrivsFailures,
  m33SigtrapMarkers:baseline.sigtrapSignalRecords,
  m33RecognizedDeniedCalls:baseline.recognizedDeniedCalls,
  m33PrctlEINVALCount:baseline.errnoDenialCounts.prctl.EINVAL,
  noExplicitUserNamespaceDenialIsProofOfNamespaceAccess:false,
  prctlEINVALIsApparmorDenialProof:false,
  prctlEINVALCausesSIGTRAPProven:false,
  ptraceChangesBehaviorPossible:true,
  apparmorCausesSIGTRAPProven:false,
  rendererConfinementVerified:false,
  strictUbuntu24NativeGatePassed:false,
  strictNativeGateWaived:false,
  hostPolicyChanged:false,
  sandboxBypassApplied:false,
  mergeAuthorized:false,
  releaseAuthorized:false,
  installationAuthorized:false
 });
}
