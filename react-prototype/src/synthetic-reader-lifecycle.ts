// IN-MEMORY lifecycle threat model. A simulated "open" NEVER opens a real file.
// No fs, native handles, IPC, timers, buffers, content, network or OS permissions.
import {
 isIssuedSyntheticStreamReview,areIndependentlyScreenedSyntheticStreams,advanceSyntheticStreamReview,cancelSyntheticStreamReview,
 snapshotSyntheticStreamReview,type SyntheticStreamReview,type SyntheticStreamCheckpoint
} from './synthetic-stream-checkpoints';

export type LifecyclePhase='created'|'simulated-open'|'ready-to-close'|'closing'|'interrupted'|'closed';
export type LifecycleCloseReason='completed'|'cancelled'|'blocked'|
 'closed-before-open'|'premature-close'|'external-mutation'|'process-lost'|'close-interrupted';
export type SyntheticReaderLifecycle=Readonly<{
 scope:'synthetic-lifecycle-contract';revision:number;
 nativeHandleIssued:false;realResourcesAllocated:false;operationsEnabled:false;
}>;
export type SyntheticReaderLifecycleCheckpoint=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';revision:number;
 phase:LifecyclePhase;closeReason:LifecycleCloseReason|null;
 processedChunks:number;declaredChunks:number;
 completedDeclarations:number;discardedPartialResults:boolean;
 cleanupPerformed:boolean;simulatedLeaseActive:boolean;
 completedCleanupCount:0|1;declaredBytesProcessed:number;
 recoveryRequired:boolean;abandonedWithoutConfirmedClose:boolean;
 realBytesRead:0;nativeHandlesOpen:0;realResourcesAllocated:false;
 realCleanupVerified:false;realFileAccessGranted:false;
 operationsEnabled:false;
}>;
type State={
 stream:SyntheticStreamReview;phase:LifecyclePhase;
 reason:LifecycleCloseReason|null;processed:number;
 staged:number;complete:number;discarded:boolean;cleanupCount:0|1;
};
const state=new WeakMap<object,State>();
const claimedStreams=new WeakSet<object>();
function get(handle:SyntheticReaderLifecycle):State{
 const s=handle&&typeof handle==='object'?state.get(handle):undefined;
 if(!s)throw Error('Ciclo fictício não emitido.');
 return s;
}
function snap(handle:SyntheticReaderLifecycle,s:State):SyntheticReaderLifecycleCheckpoint{
 const stream=snapshotSyntheticStreamReview(s.stream);
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,revision:handle.revision,
  phase:s.phase,closeReason:s.reason,
  processedChunks:s.processed,declaredChunks:stream.totalDeclaredChunks,
  completedDeclarations:s.phase==='closed'&&s.reason==='completed'?s.complete:0,
  discardedPartialResults:s.discarded,
  cleanupPerformed:s.cleanupCount===1,
  simulatedLeaseActive:s.phase==='simulated-open'||s.phase==='ready-to-close'||s.phase==='closing',
  completedCleanupCount:s.cleanupCount,
  declaredBytesProcessed:s.phase==='simulated-open'||s.phase==='ready-to-close'||s.phase==='closing'?s.staged:0,
  recoveryRequired:s.phase==='interrupted',
  abandonedWithoutConfirmedClose:s.reason==='process-lost'||s.reason==='close-interrupted',
  realBytesRead:0 as const,nativeHandlesOpen:0 as const,
  realResourcesAllocated:false as const,realCleanupVerified:false as const,
  realFileAccessGranted:false as const,operationsEnabled:false as const
 });
}
function cleanup(s:State,reason:LifecycleCloseReason,complete=0){
 // This clears only fixture counters. It does NOT demonstrate OS handle cleanup.
 s.reason=reason;s.phase='closed';s.discarded=reason!=='completed';
 s.staged=0;s.complete=reason==='completed'?complete:0;s.cleanupCount=1;
 return s;
}
function synchronize(s:State):boolean{
 const snapshot=snapshotSyntheticStreamReview(s.stream);
 if(snapshot.processedChunks!==s.processed||snapshot.status==='cancelled'||snapshot.status==='blocked'){
  cancelSyntheticStreamReview(s.stream);
  cleanup(s,'external-mutation');return false;
 }
 return true;
}
export function createSyntheticReaderLifecycle(stream:SyntheticStreamReview):SyntheticReaderLifecycle{
 if(!isIssuedSyntheticStreamReview(stream))
  throw Error('Fluxo sintético não emitido.');
 const current=snapshotSyntheticStreamReview(stream);
 if(claimedStreams.has(stream)||current.status!=='pending'||current.processedChunks!==0)
  throw Error('Fluxo fictício já utilizado ou não inicializado.');
 const handle:SyntheticReaderLifecycle=Object.freeze({
  scope:'synthetic-lifecycle-contract',revision:stream.revision,
  nativeHandleIssued:false,realResourcesAllocated:false,operationsEnabled:false
 });
 state.set(handle,{
  stream,phase:'created',reason:null,processed:0,staged:0,complete:0,
  discarded:false,cleanupCount:0
 });
 claimedStreams.add(stream);
 return handle;
}
// Identity is held privately; public lifecycle props are not capabilities.
export function isIssuedSyntheticReaderLifecycle(value:unknown):value is SyntheticReaderLifecycle{
 return !!value&&typeof value==='object'&&state.has(value);
}
export function areIndependentSyntheticReaderLifecycles(previous:unknown,next:unknown):boolean{
 if(!previous||typeof previous!=='object'||!next||typeof next!=='object')return false;
 const a=state.get(previous),b=state.get(next);
 return !!a&&!!b&&areIndependentlyScreenedSyntheticStreams(a.stream,b.stream);
}
export function snapshotSyntheticReaderLifecycle(handle:SyntheticReaderLifecycle):SyntheticReaderLifecycleCheckpoint{
 return snap(handle,get(handle));
}
export function openSyntheticReaderLifecycle(handle:SyntheticReaderLifecycle):SyntheticReaderLifecycleCheckpoint{
 const s=get(handle);
 if(s.phase!=='created')return snap(handle,s);
 if(!synchronize(s))return snap(handle,s);
 s.phase='simulated-open';
 return snap(handle,s);
}
export function stepSyntheticReaderLifecycle(handle:SyntheticReaderLifecycle):SyntheticReaderLifecycleCheckpoint{
 const s=get(handle);
 if(s.phase!=='simulated-open')return snap(handle,s);
 if(!synchronize(s))return snap(handle,s);
 const result: SyntheticStreamCheckpoint=advanceSyntheticStreamReview(s.stream);
 s.processed=result.processedChunks;
 if(result.status==='blocked'||result.status==='cancelled'){
  cleanup(s,'blocked');return snap(handle,s);
 }
 s.staged=result.stagedEncodedBytes;
 if(result.status==='declarations-reviewed'){
  s.complete=result.releasedEntries;
  s.phase='ready-to-close';
 }
 return snap(handle,s);
}
export function cancelSyntheticReaderLifecycle(handle:SyntheticReaderLifecycle):SyntheticReaderLifecycleCheckpoint{
 const s=get(handle);
 if(s.phase==='closed'||s.phase==='interrupted')return snap(handle,s);
 if(!synchronize(s))return snap(handle,s);
 cancelSyntheticStreamReview(s.stream);
 cleanup(s,'cancelled');
 return snap(handle,s);
}
// Two-step close models the dangerous window between declaring a close and
// committing its result. Nothing becomes public in the 'closing' state.
export function beginSyntheticReaderLifecycleClose(handle:SyntheticReaderLifecycle):SyntheticReaderLifecycleCheckpoint{
 const s=get(handle);
 if(s.phase!=='ready-to-close')return snap(handle,s);
 if(!synchronize(s))return snap(handle,s);
 s.phase='closing';
 return snap(handle,s);
}
export function finishSyntheticReaderLifecycleClose(handle:SyntheticReaderLifecycle):SyntheticReaderLifecycleCheckpoint{
 const s=get(handle);
 if(s.phase!=='closing')return snap(handle,s);
 if(!synchronize(s))return snap(handle,s);
 const stream=snapshotSyntheticStreamReview(s.stream);
 if(stream.status!=='declarations-reviewed'){
  cleanup(s,'external-mutation');return snap(handle,s);
 }
 cleanup(s,'completed',stream.releasedEntries);
 return snap(handle,s);
}
// Models loss of the controller before finally/RAII could run. This is NOT a
// real process crash, not proof that the OS closed a native handle, and
// emphatically NOT a successful cleanup.
export function simulateSyntheticReaderLifecycleProcessLoss(handle:SyntheticReaderLifecycle):SyntheticReaderLifecycleCheckpoint{
 const s=get(handle);
 if(s.phase==='closed'||s.phase==='interrupted')return snap(handle,s);
 const duringClose=s.phase==='closing';
 cancelSyntheticStreamReview(s.stream);
 s.phase='interrupted';s.reason=duringClose?'close-interrupted':'process-lost';
 s.staged=0;s.complete=0;s.discarded=true;
 s.cleanupCount=0;
 return snap(handle,s);
}
// Acknowledging an orphan only closes the *local model*. The proof of real
// resource cleanup remains false, and the original stream stays unusable.
export function acknowledgeSyntheticReaderLifecycleLoss(handle:SyntheticReaderLifecycle):SyntheticReaderLifecycleCheckpoint{
 const s=get(handle);
 if(s.phase==='interrupted')s.phase='closed';
 return snap(handle,s);
}
export function closeSyntheticReaderLifecycle(handle:SyntheticReaderLifecycle):SyntheticReaderLifecycleCheckpoint{
 const s=get(handle);
 if(s.phase==='closed'||s.phase==='interrupted')return snap(handle,s);
 if(!synchronize(s))return snap(handle,s);
 if(s.phase==='closing')return finishSyntheticReaderLifecycleClose(handle);
 if(s.phase==='ready-to-close'){
  const stream=snapshotSyntheticStreamReview(s.stream);
  cleanup(s,'completed',stream.releasedEntries);
 }else{
  cancelSyntheticStreamReview(s.stream);
  cleanup(s,s.phase==='created'?'closed-before-open':'premature-close');
 }
 return snap(handle,s);
}
