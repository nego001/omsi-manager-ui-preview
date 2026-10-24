// Ephemeral orphan-recovery model. NO persistent journal, crash recovery,
// native reader, file-system access, real attestation, or operational grants.
import {
 isIssuedSyntheticReaderLifecycle,areIndependentSyntheticReaderLifecycles,
 snapshotSyntheticReaderLifecycle,acknowledgeSyntheticReaderLifecycleLoss,
 type SyntheticReaderLifecycle
} from './synthetic-reader-lifecycle';

export type SyntheticRecoveryPhase='acknowledgement-required'|'fresh-screening-required'|'new-fixture-reported';
export type SyntheticRecoveryAttempt='none'|'unacknowledged'|'not-independent'|'not-complete'|'accepted-fixture';
export type SyntheticOrphanRecovery=Readonly<{
 scope:'synthetic-orphan-recovery';revision:number;
 nativeHandleIssued:false;operationsEnabled:false;
}>;
export type SyntheticOrphanRecoveryCheckpoint=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';revision:number;
 phase:SyntheticRecoveryPhase;lastAttempt:SyntheticRecoveryAttempt;
 oldEvidenceInvalidated:true;oldResultReusable:false;
 freshIndependentScreeningObserved:boolean;freshSyntheticDeclarations:number;
 realFileIdentityVerified:false;realBytesRead:0;realCleanupVerified:false;
 realReanalysisVerified:false;approvedForOperations:false;operationsEnabled:false;
 notice:string;
}>;
type RecoveryState={
 original:SyntheticReaderLifecycle;phase:SyntheticRecoveryPhase;
 lastAttempt:SyntheticRecoveryAttempt;freshDeclarations:number;
};
const recoveries=new WeakMap<object,RecoveryState>();
function stateFor(recovery:SyntheticOrphanRecovery):RecoveryState{
 const state=recovery&&typeof recovery==='object'?recoveries.get(recovery):undefined;
 if(!state)throw Error('Recuperação sintética não emitida.');
 return state;
}
function snapshot(handle:SyntheticOrphanRecovery,state:RecoveryState):SyntheticOrphanRecoveryCheckpoint{
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,revision:handle.revision,
  phase:state.phase,lastAttempt:state.lastAttempt,
  oldEvidenceInvalidated:true as const,oldResultReusable:false as const,
  freshIndependentScreeningObserved:state.phase==='new-fixture-reported',
  freshSyntheticDeclarations:state.phase==='new-fixture-reported'?state.freshDeclarations:0,
  realFileIdentityVerified:false as const,realBytesRead:0 as const,
  realCleanupVerified:false as const,realReanalysisVerified:false as const,
  approvedForOperations:false as const,operationsEnabled:false as const,
  notice:'Recuperação somente fictícia. Análise antiga invalidada; nunca é autorização de leitura, compatibilidade ou instalação.'
 });
}
export function createSyntheticOrphanRecovery(lifecycle:SyntheticReaderLifecycle):SyntheticOrphanRecovery{
 if(!isIssuedSyntheticReaderLifecycle(lifecycle))throw Error('Ciclo sintético não emitido.');
 const current=snapshotSyntheticReaderLifecycle(lifecycle);
 if(current.closeReason!=='process-lost'&&current.closeReason!=='close-interrupted')
  throw Error('Somente sessão abandonada pode iniciar recuperação sintética.');
 if(current.phase!=='interrupted'&&current.phase!=='closed')
  throw Error('Ciclo sintético não está abandonado.');
 const handle:SyntheticOrphanRecovery=Object.freeze({
  scope:'synthetic-orphan-recovery',revision:current.revision,
  nativeHandleIssued:false,operationsEnabled:false
 });
 recoveries.set(handle,{
  original:lifecycle,
  phase:current.phase==='closed'?'fresh-screening-required':'acknowledgement-required',
  lastAttempt:'none',freshDeclarations:0
 });
 return handle;
}
export function snapshotSyntheticOrphanRecovery(handle:SyntheticOrphanRecovery):SyntheticOrphanRecoveryCheckpoint{
 return snapshot(handle,stateFor(handle));
}
export function acknowledgeSyntheticOrphanRecovery(handle:SyntheticOrphanRecovery):SyntheticOrphanRecoveryCheckpoint{
 const s=stateFor(handle);
 if(s.phase!=='acknowledgement-required')return snapshot(handle,s);
 const old=snapshotSyntheticReaderLifecycle(s.original);
 if(old.closeReason!=='process-lost'&&old.closeReason!=='close-interrupted')
  throw Error('Origem não está abandonada.');
 acknowledgeSyntheticReaderLifecycleLoss(s.original);
 s.phase='fresh-screening-required';s.lastAttempt='none';
 return snapshot(handle,s);
}
export function assessFreshSyntheticOrphanAnalysis(
 handle:SyntheticOrphanRecovery,candidate:SyntheticReaderLifecycle
):SyntheticOrphanRecoveryCheckpoint{
 const s=stateFor(handle);
 if(s.phase==='new-fixture-reported')return snapshot(handle,s);
 if(s.phase!=='fresh-screening-required'){
  s.lastAttempt='unacknowledged';return snapshot(handle,s);
 }
 if(!isIssuedSyntheticReaderLifecycle(candidate)||
    !areIndependentSyntheticReaderLifecycles(s.original,candidate)){
  s.lastAttempt='not-independent';return snapshot(handle,s);
 }
 const next=snapshotSyntheticReaderLifecycle(candidate);
 if(next.phase!=='closed'||next.closeReason!=='completed'||
    next.discardedPartialResults||next.revision!==handle.revision){
  s.lastAttempt='not-complete';return snapshot(handle,s);
 }
 s.phase='new-fixture-reported';s.lastAttempt='accepted-fixture';
 s.freshDeclarations=next.completedDeclarations;
 return snapshot(handle,s);
}
