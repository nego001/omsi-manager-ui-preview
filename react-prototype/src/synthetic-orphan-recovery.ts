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
// Sequential event ledger is a local teaching contract, NOT tamper-evident
// auditing. No timestamps, paths, digests, stored files or native capabilities.
export const SYNTHETIC_RECOVERY_EVENT_LIMIT=48;
export type SyntheticRecoveryEventCode=
 'orphan-detected'|'old-evidence-invalidated'|'previously-acknowledged'|
 'orphan-acknowledged'|'acknowledgement-required'|
 'old-evidence-rejected'|'new-evidence-incomplete'|'new-evidence-recorded';
export type SyntheticRecoveryAuditEvent=Readonly<{
 sequence:number;previousSequence:number|null;
 code:SyntheticRecoveryEventCode;fixtureRevision:number;
 oldEvidenceRevision:1;newEvidenceRevision:2|null;
 phase:SyntheticRecoveryPhase;
 verified:false;operationsEnabled:false;
}>;
export type SyntheticRecoveryAuditProjection=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';fixtureRevision:number;
 originalEvidenceRevision:1;originalEvidenceStatus:'superseded';
 activeEvidenceRevision:2|null;activeEvidenceStatus:'pending'|'fixture-only';
 events:readonly SyntheticRecoveryAuditEvent[];
 eventCount:number;lastSequence:number;
 eventLimit:48;isPersistent:false;isTamperEvident:false;
 cryptographicallyVerified:false;realHistoryVerified:false;
 oldEvidenceReusable:false;realBytesRead:0;
 approvedForOperations:false;operationsEnabled:false;
 notice:string;
}>;
type RecoveryState={
 original:SyntheticReaderLifecycle;phase:SyntheticRecoveryPhase;
 lastAttempt:SyntheticRecoveryAttempt;freshDeclarations:number;
 events:SyntheticRecoveryAuditEvent[];
};
const recoveries=new WeakMap<object,RecoveryState>();
function recordEvent(handle:SyntheticOrphanRecovery,s:RecoveryState,code:SyntheticRecoveryEventCode){
 if(s.events.length>=SYNTHETIC_RECOVERY_EVENT_LIMIT)
  throw Error('Limite do registro fictício atingido; nenhuma transição permitida.');
 const seq=s.events.length+1;
 s.events.push(Object.freeze({
  sequence:seq,previousSequence:seq===1?null:seq-1,
  code,fixtureRevision:handle.revision,
  oldEvidenceRevision:1 as const,
  newEvidenceRevision:s.phase==='new-fixture-reported'?2 as const:null,
  phase:s.phase,verified:false as const,operationsEnabled:false as const
 }));
}
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
 const state:RecoveryState={
  original:lifecycle,
  phase:current.phase==='closed'?'fresh-screening-required':'acknowledgement-required',
  lastAttempt:'none',freshDeclarations:0,events:[]
 };
 recoveries.set(handle,state);
 recordEvent(handle,state,'orphan-detected');
 recordEvent(handle,state,'old-evidence-invalidated');
 if(current.phase==='closed')recordEvent(handle,state,'previously-acknowledged');
 return handle;
}
// Read-only assessment for a quarantine policy. This does not record success
// or restore the previous result, even if the fresh fixture is complete.
export function isIndependentSyntheticOrphanCandidate(
 recovery:unknown,candidate:unknown
):boolean{
 if(!recovery||typeof recovery!=='object'||!candidate||typeof candidate!=='object')return false;
 const s=recoveries.get(recovery);
 return !!s&&isIssuedSyntheticReaderLifecycle(candidate)&&
  areIndependentSyntheticReaderLifecycles(s.original,candidate);
}
export function isFreshSyntheticOrphanCandidate(
 recovery:unknown,candidate:unknown
):boolean{
 if(!recovery||typeof recovery!=='object'||!candidate||typeof candidate!=='object')return false;
 const s=recoveries.get(recovery);
 if(!s||s.phase==='acknowledgement-required'||
    !isIndependentSyntheticOrphanCandidate(recovery,candidate))return false;
 const current=snapshotSyntheticReaderLifecycle(candidate);
 return current.phase==='closed'&&current.closeReason==='completed'&&
  !current.discardedPartialResults&&current.revision===(recovery as SyntheticOrphanRecovery).revision;
}
export function snapshotSyntheticOrphanRecovery(handle:SyntheticOrphanRecovery):SyntheticOrphanRecoveryCheckpoint{
 return snapshot(handle,stateFor(handle));
}
// Public projection is immutable, sequenced, bounded, but NOT a durable or
// cryptographically authenticated audit trail. It exists only in memory.
export function projectSyntheticRecoveryAudit(handle:SyntheticOrphanRecovery):SyntheticRecoveryAuditProjection{
 const s=stateFor(handle);
 const fresh=s.phase==='new-fixture-reported';
 const events=Object.freeze([...s.events]);
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,
  fixtureRevision:handle.revision,originalEvidenceRevision:1 as const,
  originalEvidenceStatus:'superseded' as const,
  activeEvidenceRevision:fresh?2 as const:null,
  activeEvidenceStatus:fresh?'fixture-only' as const:'pending' as const,
  events,eventCount:events.length,lastSequence:events.length,
  eventLimit:48 as const,isPersistent:false as const,
  isTamperEvident:false as const,cryptographicallyVerified:false as const,
  realHistoryVerified:false as const,oldEvidenceReusable:false as const,
  realBytesRead:0 as const,approvedForOperations:false as const,
  operationsEnabled:false as const,
  notice:'Sequência local fictícia: não é trilha de auditoria persistente nem prova de integridade ou recuperação real.'
 });
}
export function acknowledgeSyntheticOrphanRecovery(handle:SyntheticOrphanRecovery):SyntheticOrphanRecoveryCheckpoint{
 const s=stateFor(handle);
 if(s.phase!=='acknowledgement-required')return snapshot(handle,s);
 const old=snapshotSyntheticReaderLifecycle(s.original);
 if(old.closeReason!=='process-lost'&&old.closeReason!=='close-interrupted')
  throw Error('Origem não está abandonada.');
 if(s.events.length>=SYNTHETIC_RECOVERY_EVENT_LIMIT)
  throw Error('Limite do registro fictício atingido; nenhuma transição permitida.');
 acknowledgeSyntheticReaderLifecycleLoss(s.original);
 s.phase='fresh-screening-required';s.lastAttempt='none';
 recordEvent(handle,s,'orphan-acknowledged');
 return snapshot(handle,s);
}
export function assessFreshSyntheticOrphanAnalysis(
 handle:SyntheticOrphanRecovery,candidate:SyntheticReaderLifecycle
):SyntheticOrphanRecoveryCheckpoint{
 const s=stateFor(handle);
 if(s.phase==='new-fixture-reported')return snapshot(handle,s);
 if(s.events.length>=SYNTHETIC_RECOVERY_EVENT_LIMIT)
  throw Error('Limite do registro fictício atingido; nenhuma transição permitida.');
 if(s.phase!=='fresh-screening-required'){
  recordEvent(handle,s,'acknowledgement-required');
  s.lastAttempt='unacknowledged';return snapshot(handle,s);
 }
 if(!isIssuedSyntheticReaderLifecycle(candidate)||
    !areIndependentSyntheticReaderLifecycles(s.original,candidate)){
  recordEvent(handle,s,'old-evidence-rejected');
  s.lastAttempt='not-independent';return snapshot(handle,s);
 }
 const next=snapshotSyntheticReaderLifecycle(candidate);
 if(next.phase!=='closed'||next.closeReason!=='completed'||
    next.discardedPartialResults||next.revision!==handle.revision){
  recordEvent(handle,s,'new-evidence-incomplete');
  s.lastAttempt='not-complete';return snapshot(handle,s);
 }
 recordEvent(handle,s,'new-evidence-recorded');
 s.phase='new-fixture-reported';s.lastAttempt='accepted-fixture';
 s.freshDeclarations=next.completedDeclarations;
 // The terminal event represents the resulting evidence epoch.
 const last=s.events[s.events.length-1];
 s.events[s.events.length-1]=Object.freeze({...last,newEvidenceRevision:2 as const,phase:s.phase});
 return snapshot(handle,s);
}
