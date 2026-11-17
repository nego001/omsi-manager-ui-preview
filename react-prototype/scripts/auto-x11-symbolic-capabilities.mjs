// M36: decode ONLY fixed Linux UAPI capability names (0..40) from the
// very same M33/M34/M35 bounded, instrumented, disposable CI trace.
// Unsupported names or strace expressions remain UNKNOWN. No host writes,
// sandbox changes, real mods, person identifiers or raw trace in output.
import {interpretM35KernelCapabilityBoundary} from './auto-x11-capbset-boundary.mjs';

const REFUSAL='M36_SYMBOLIC_CAPABILITY_REFUSED';
const refuse=()=>{throw Error(REFUSAL);};

// Fixed Linux UAPI constants from include/uapi/linux/capability.h.
// Entries beyond these known constants must not be guessed.
export const M36_CAPABILITY_NAMES=Object.freeze([
 'CAP_CHOWN','CAP_DAC_OVERRIDE','CAP_DAC_READ_SEARCH','CAP_FOWNER',
 'CAP_FSETID','CAP_KILL','CAP_SETGID','CAP_SETUID','CAP_SETPCAP',
 'CAP_LINUX_IMMUTABLE','CAP_NET_BIND_SERVICE','CAP_NET_BROADCAST',
 'CAP_NET_ADMIN','CAP_NET_RAW','CAP_IPC_LOCK','CAP_IPC_OWNER',
 'CAP_SYS_MODULE','CAP_SYS_RAWIO','CAP_SYS_CHROOT','CAP_SYS_PTRACE',
 'CAP_SYS_PACCT','CAP_SYS_ADMIN','CAP_SYS_BOOT','CAP_SYS_NICE',
 'CAP_SYS_RESOURCE','CAP_SYS_TIME','CAP_SYS_TTY_CONFIG','CAP_MKNOD',
 'CAP_LEASE','CAP_AUDIT_WRITE','CAP_AUDIT_CONTROL','CAP_SETFCAP',
 'CAP_MAC_OVERRIDE','CAP_MAC_ADMIN','CAP_SYSLOG','CAP_WAKE_ALARM',
 'CAP_BLOCK_SUSPEND','CAP_AUDIT_READ','CAP_PERFMON','CAP_BPF',
 'CAP_CHECKPOINT_RESTORE'
]);
const indexes=new Map(M36_CAPABILITY_NAMES.map((name,i)=>[name,i]));
const LINE=/^(?:\[\s*pid\s+\d+\]\s+)?prctl\(PR_CAPBSET_READ,\s*/;
const OP=/^(CAP_[A-Z0-9_]+)(?=\s*[,)]|$)/;
const NUM=/^(?:0x[0-9a-fA-F]+|\d+)(?=\s*[,)]|$)/;
const EINVAL=/=\s+-1\s+EINVAL\b/;
const COMPLETE=/\s=\s/;
const MAX_LINE=4096;

export function interpretM36NamedCapabilityIndexes(input){
 let previous;
 try{previous=interpretM35KernelCapabilityBoundary(input);}
 catch{refuse();}
 if(previous.schema!=='M35_CAPBSET_READ_BOUNDARY_OBSERVATION_V1'||
    previous.sumsAgreeWithM34!==true||
    previous.nativeGateWaived!==false||
    previous.apparmorCausesSIGTRAPProven!==false||
    previous.rendererSandboxCertified!==false||
    M36_CAPABILITY_NAMES.length!==41||indexes.size!==41||
    M36_CAPABILITY_NAMES[40]!=='CAP_CHECKPOINT_RESTORE')refuse();

 let known=0,unknown=0,knownInRange=0,knownOutOfRange=0,
     EINVALKnownInRange=0,EINVALKnownOutOfRange=0,EINVALUnknown=0;
 for(const raw of input.traceTexts){
  for(const line of raw.split('\n')){
   if(line.length>MAX_LINE||!COMPLETE.test(line))continue;
   const start=LINE.exec(line);
   if(!start)continue;
   const remainder=line.slice(start[0].length);
   // All numeric complete forms are the M35 parser's responsibility.
   if(NUM.test(remainder))continue;
   const op=OP.exec(remainder);
   const index=op?indexes.get(op[1]):undefined;
   const isInvalid=EINVAL.test(line);
   if(index===undefined){
    unknown++;
    EINVALUnknown+=Number(isInvalid);
   }else{
    known++;
    if(index>previous.kernelLastCapabilityIndex){
      knownOutOfRange++;
      EINVALKnownOutOfRange+=Number(isInvalid);
    }else{
      knownInRange++;
      EINVALKnownInRange+=Number(isInvalid);
    }
   }
  }
 }
 if(known+unknown!==previous.symbolicOrUnrecognizedOperands||
    EINVALKnownInRange+EINVALKnownOutOfRange+EINVALUnknown!==
      previous.EINVALWithUnparsedOperand)refuse();

 const status=EINVALKnownInRange>0?
  'knownSymbolicCapabilityWithinBoundReturnedEINVAL':
  EINVALUnknown>0?
   'unknownSymbolicCapabilityEINVALStillInconclusive':
  EINVALKnownOutOfRange>0?
   'knownSymbolicCapabilityAboveBoundReturnedEINVAL':
   'noSymbolicCapabilityEINVALObserved';

 return Object.freeze({
  schema:'M36_LINUX_SYMBOLIC_CAPABILITY_BOUNDARY_V1',
  source:'same-sanitized-instrumented-ci-trace-as-m33-m35',
  runner:'ubuntu-24.04',
  status,
  knownLinuxUapiCapabilityNames:41,
  kernelLastCapabilityIndex:previous.kernelLastCapabilityIndex,
  totalCapReadCalls:previous.capReadCalls,
  totalCapReadEINVAL:previous.capReadEINVAL,
  numericCapReadOperandsHandledByM35:previous.numericIndicesParsed,
  recognizedSymbolicCapabilityOperands:known,
  unrecognizedSymbolicOrAnnotatedOperands:unknown,
  knownSymbolicIndexesWithinKernelBound:knownInRange,
  knownSymbolicIndexesAboveKernelBound:knownOutOfRange,
  knownSymbolicWithinBoundEINVAL:EINVALKnownInRange,
  knownSymbolicAboveBoundEINVAL:EINVALKnownOutOfRange,
  unrecognizedSymbolicEINVAL:EINVALUnknown,
  symbolicCountsReconciledWithM35:true,
  fixedCapabilityNameTableOnly:true,
  numericOrUnknownCapabilityIndexesNotGuessed:true,
  traceInstrumentationMayChangeBehavior:true,
  recognizedNameImpliesCapabilityGranted:false,
  unknownSymbolicIsProofAboveKernelBound:false,
  capabilityRangeCausesSIGTRAPProven:false,
  apparmorDenialFromPRCTLProven:false,
  apparmorCausesSIGTRAPProven:false,
  chromiumRendererSandboxCertified:false,
  strictUbuntu24NativeGatePassed:false,
  nativeGateWaived:false,
  hostPolicyChanged:false,
  sandboxBypassApplied:false,
  mergeAuthorized:false,
  releaseAuthorized:false,
  installationAuthorized:false
 });
}
