// M37: recognize only explicit NUMERIC capability indexes annotated by
// strace with the exact token "/* CAP_??? */" in PR_CAPBSET_READ.
// Uses the same CI trace as M33-M36; no extra Electron, raw log output,
// host changes, sandbox bypass, AppArmor cause claim or installer operation.
import {interpretM36NamedCapabilityIndexes} from './auto-x11-symbolic-capabilities.mjs';

const REFUSAL='M37_ANNOTATED_CAPABILITY_REFUSED';
const refuse=()=>{throw Error(REFUSAL);};
const PREFIX=/^(?:\[\s*pid\s+\d+\]\s+)?prctl\(PR_CAPBSET_READ,\s*/;
const EXACT=/^(0x[0-9a-fA-F]+|(?:0|[1-9]\d*))\s+\/\*\s*CAP_\?\?\?\s*\*\/\s*\)\s+=\s+(-1\s+EINVAL\b|[0-9]+(?:\s|$))/;
const EINVAL=/=\s+-1\s+EINVAL\b/;
const COMPLETE=/\s=\s/;

export function classifyM37AnnotatedCapabilityIndexes(input){
 let prior;
 try{prior=interpretM36NamedCapabilityIndexes(input);}catch{refuse();}
 if(prior.schema!=='M36_LINUX_SYMBOLIC_CAPABILITY_BOUNDARY_V1'||
    prior.symbolicCountsReconciledWithM35!==true||
    prior.nativeGateWaived!==false||
    prior.apparmorCausesSIGTRAPProven!==false||
    prior.chromiumRendererSandboxCertified!==false||
    prior.unrecognizedSymbolicOrAnnotatedOperands<0||
    prior.unrecognizedSymbolicEINVAL<0)refuse();

 let parsed=0,above=0,within=0,invalidAbove=0,invalidWithin=0;
 for(const raw of input.traceTexts){
  for(const line of raw.split('\n')){
   if(line.length>4096||!COMPLETE.test(line))continue;
   const start=PREFIX.exec(line);
   if(!start)continue;
   const body=line.slice(start[0].length);
   const m=EXACT.exec(body);
   if(!m)continue;
   const index=Number(m[1]);
   if(!Number.isSafeInteger(index)||index<0||index>0xffffffff)continue;
   parsed++;
   const invalid=EINVAL.test(line);
   if(index>prior.kernelLastCapabilityIndex){
    above++;invalidAbove+=Number(invalid);
   }else{
    within++;invalidWithin+=Number(invalid);
   }
  }
 }
 if(parsed>prior.unrecognizedSymbolicOrAnnotatedOperands||
    invalidAbove+invalidWithin>prior.unrecognizedSymbolicEINVAL||
    parsed>prior.totalCapReadCalls||
    invalidAbove+invalidWithin>prior.totalCapReadEINVAL)refuse();
 const remaining=prior.unrecognizedSymbolicOrAnnotatedOperands-parsed,
       remainingEINVAL=prior.unrecognizedSymbolicEINVAL-invalidAbove-invalidWithin;
 const status=invalidWithin>0?
  'annotatedInRangeCapabilityEINVALNeedsReview':
  remainingEINVAL>0?
  'someEINVALOperandsStillUnresolved':
  invalidAbove>0?
  'allUnrecognizedEINVALHaveExplicitAboveBoundIndex':
  'noAnnotatedCapabilityEINVALObserved';
 return Object.freeze({
  schema:'M37_UBUNTU24_ANNOTATED_CAPABILITY_BOUNDARY_V1',
  source:'same-disposable-instrumented-trace-as-m33-m36',
  runner:'ubuntu-24.04',
  status,
  kernelLastCapabilityIndex:prior.kernelLastCapabilityIndex,
  totalCapReadCalls:prior.totalCapReadCalls,
  totalCapReadEINVAL:prior.totalCapReadEINVAL,
  namesRecognizedByM36:prior.recognizedSymbolicCapabilityOperands,
  unknownAfterM36:prior.unrecognizedSymbolicOrAnnotatedOperands,
  decodedExplicitCAPUnknownNumericAnnotations:parsed,
  annotatedNumericAboveKernelBound:above,
  annotatedNumericWithinKernelBound:within,
  annotatedEINVALAboveKernelBound:invalidAbove,
  annotatedEINVALWithinKernelBound:invalidWithin,
  unknownOperandsStillUnresolved:remaining,
  EINVALOperandsStillUnresolved:remainingEINVAL,
  noRawTraceOrCapabilityOperandsEmitted:true,
  annotatedNumbersNotGuessed:true,
  priorCountsPreserved:true,
  tracerMayInfluenceProcess:true,
  invalidCapabilityIndexIsCompatibleWithEINVAL:true,
  invalidIndexExplainsSIGTRAPProven:false,
  apparmorDeniedTheseCallsProven:false,
  apparmorCausesSIGTRAPProven:false,
  chromiumRendererSandboxCertified:false,
  nativeStrictUbuntu24GatePassed:false,
  nativeGateWaived:false,
  hostPolicyChanged:false,
  sandboxBypassApplied:false,
  mergeAuthorized:false,
  releaseAuthorized:false,
  installationAuthorized:false
 });
}
