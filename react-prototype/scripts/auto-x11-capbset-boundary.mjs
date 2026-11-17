// M35: read-only capability index boundary interpretation of the SAME
// M33/M34 instrumented trace. Numeric operands only; never infer names
// or AppArmor causality from PR_CAPBSET_READ EINVAL.
const REFUSAL='M35_CAPABILITY_BOUNDARY_REFUSED';
const refuse=()=>{throw Error(REFUSAL);};
const LINE=/^(?:\[\s*pid\s+\d+\]\s+)?prctl\(PR_CAPBSET_READ,\s*/;
const NUM=/^(0x[0-9a-fA-F]+|\d+)(?=\s*[,)]|$)/;
const EINVAL=/=\s+-1\s+EINVAL\b/;
const COMPLETE=/\s=\s/;
const MAX_LINE=4096,MAX_TRACES=64,MAX_BYTES=262144;
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const keys=(o,ks)=>plain(o)&&Object.keys(o).length===ks.length&&ks.every(k=>Object.hasOwn(o,k));
const validCount=n=>Number.isSafeInteger(n)&&n>=0&&n<=200000;

export function interpretM35KernelCapabilityBoundary(input){
 if(!keys(input,['runner','kernelLastCapabilityText','traceTexts','m34'])||
    input.runner!=='ubuntu-24.04'||
    typeof input.kernelLastCapabilityText!=='string'||
    !/^(0|[1-9]\d{0,3})\n?$/.test(input.kernelLastCapabilityText)||
    !Array.isArray(input.traceTexts)||
    input.traceTexts.length<1||input.traceTexts.length>MAX_TRACES||
    !plain(input.m34)||input.m34.schema!=='M34_UBUNTU24_PRCTL_ERRNO_CONTEXT_V1'||
    !plain(input.m34.prctlOperationCounts)||
    !plain(input.m34.prctlEINVALByOperation)||
    !validCount(input.m34.prctlOperationCounts.capBsetRead)||
    !validCount(input.m34.prctlEINVALByOperation.capBsetRead)||
    input.m34.prctlEINVALByOperation.capBsetRead>
      input.m34.prctlOperationCounts.capBsetRead||
    input.m34.strictNativeGateWaived!==false||
    input.m34.apparmorCausesSIGTRAPProven!==false||
    input.m34.rendererConfinementVerified!==false)refuse();
 const last=Number(input.kernelLastCapabilityText.trim());
 if(last>1024)refuse();

 let calls=0,invalid=0,numeric=0,symbolic=0,
     over=0,within=0,invalidOver=0,invalidWithin=0,invalidUnknown=0;
 for(const text of input.traceTexts){
  if(typeof text!=='string'||Buffer.byteLength(text)>MAX_BYTES||text.includes('\0'))refuse();
  const lines=text.split('\n');
  if(lines.length>5001)refuse();
  for(const line of lines){
   if(line.length>MAX_LINE||!COMPLETE.test(line)||!LINE.test(line))continue;
   calls++;
   const isInvalid=EINVAL.test(line);
   if(isInvalid)invalid++;
   const part=line.slice(LINE.exec(line)[0].length);
   const m=NUM.exec(part);
   if(!m){symbolic++;invalidUnknown+=Number(isInvalid);continue;}
   const idx=Number(m[1]);
   if(!Number.isSafeInteger(idx)||idx<0){
    symbolic++;invalidUnknown+=Number(isInvalid);continue;
   }
   numeric++;
   if(idx>last){over++;invalidOver+=Number(isInvalid);}
   else{within++;invalidWithin+=Number(isInvalid);}
  }
 }
 if(calls!==input.m34.prctlOperationCounts.capBsetRead||
    invalid!==input.m34.prctlEINVALByOperation.capBsetRead)refuse();
 let status='noCapReadEINVALObserved';
 if(invalidWithin>0)status='inRangeCapReadEINVALRequiresInvestigation';
 else if(invalidUnknown>0)status='symbolicCapabilityOperandsNeedIndependentDecode';
 else if(invalidOver>0)status='outOfRangeCapReadEINVALPatternObserved';

 return Object.freeze({
  schema:'M35_CAPBSET_READ_BOUNDARY_OBSERVATION_V1',
  source:'same-readonly-instrumented-trace-and-proc-kernel-bound',
  runner:'ubuntu-24.04',
  status,
  kernelCapabilityBoundReadOnly:true,
  kernelLastCapabilityIndex:last,
  capReadCalls: calls,
  capReadEINVAL:invalid,
  numericIndicesParsed:numeric,
  symbolicOrUnrecognizedOperands:symbolic,
  numericAboveKernelCapabilityBound:over,
  numericWithinKernelCapabilityBound:within,
  EINVALAboveKernelCapabilityBound:invalidOver,
  EINVALWithinKernelCapabilityBound:invalidWithin,
  EINVALWithUnparsedOperand:invalidUnknown,
  sumsAgreeWithM34:true,
  traceCanAffectProcessBehavior:true,
  invalidIndexRootCauseIndependentlyProven:false,
  EINVALImpliesAppArmorDenial:false,
  EINVALCausedSIGTRAP:false,
  apparmorCausesSIGTRAPProven:false,
  rendererSandboxCertified:false,
  strictUbuntu24NativeGatePassed:false,
  nativeGateWaived:false,
  policyChanged:false,
  realModRead:false,
  mergeAuthorized:false,
  releaseAuthorized:false,
  installationAuthorized:false
 });
}
