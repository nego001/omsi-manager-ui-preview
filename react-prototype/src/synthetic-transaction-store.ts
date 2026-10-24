// Transaction / double-phase crash-recovery threat model. ALL DATA IN MEMORY.
// No disk, fs, IndexedDB, IPC, native handles, restart, cryptographic MAC or
// real-world atomicity. Even "recorded" means an UNTRUSTED fixture summary.
import {
 isIssuedSyntheticRestartDraft,inspectSyntheticRestartDraft,
 type SyntheticRestartDraft
} from './synthetic-restart-handoff';

export const SYNTHETIC_TX_HISTORY_LIMIT=8;
export type SyntheticTransactionPhase='empty'|'prepared'|'commit-intent'|'recorded'|'interrupted';
export type SyntheticTransactionRecovery='none'|'discarded-prepared'|
 'discarded-intent'|'retained-untrusted'|'empty-untrusted';
export type SyntheticTransactionStore=Readonly<{
 scope:'synthetic-transaction-store';nativeStorageOpened:false;
 operationsEnabled:false;
}>;
export type SyntheticTransactionToken=Readonly<{
 scope:'synthetic-transaction-token';generation:number;
 realWriteAuthorized:false;operationsEnabled:false;
}>;
export type SyntheticTransactionEntry=Readonly<{
 generation:number;declaredEvents:number;
 previousState:'incomplete'|'fixture-only';dataTrusted:false;
}>;
export type SyntheticTransactionSnapshot=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';phase:SyntheticTransactionPhase;
 generation:number;pendingGeneration:number|null;
 committedEntries:readonly SyntheticTransactionEntry[];
 lastRecovery:SyntheticTransactionRecovery;
 discardedPending:boolean;requiresNewAnalysis:true;
 oldEvidenceReusable:false;structureOnlyChecked:true;
 dataTrusted:false;cryptographicIntegrityVerified:false;
 actuallyPersisted:false;processRestarted:false;
 realResourcesCleaned:false;realBytesRead:0;operationsEnabled:false;
 notice:string;
}>;
type Pending={token:SyntheticTransactionToken;draft:SyntheticRestartDraft};
type State={
 phase:SyntheticTransactionPhase;generation:number;
 pending:Pending|null;history:SyntheticTransactionEntry[];
 interruptedFrom:'empty'|'prepared'|'commit-intent'|'recorded'|null;
 lastRecovery:SyntheticTransactionRecovery;discardedPending:boolean;
};
const states=new WeakMap<object,State>();
const issuedTokens=new WeakMap<object,{store:SyntheticTransactionStore;generation:number}>();
const alreadyStaged=new WeakSet<object>();
function stateFor(handle:SyntheticTransactionStore):State{
 const s=handle&&typeof handle==='object'?states.get(handle):undefined;
 if(!s)throw Error('Armazenamento transacional fictício não emitido.');
 return s;
}
function checkpoint(s:State):SyntheticTransactionSnapshot{
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,phase:s.phase,
  generation:s.generation,
  pendingGeneration:s.phase==='prepared'||s.phase==='commit-intent'?s.generation+1:null,
  committedEntries:Object.freeze([...s.history]),lastRecovery:s.lastRecovery,
  discardedPending:s.discardedPending,
  requiresNewAnalysis:true as const,oldEvidenceReusable:false as const,
  structureOnlyChecked:true as const,dataTrusted:false as const,
  cryptographicIntegrityVerified:false as const,actuallyPersisted:false as const,
  processRestarted:false as const,realResourcesCleaned:false as const,
  realBytesRead:0 as const,operationsEnabled:false as const,
  notice:'Registro transacional fictício em memória. Não é commit em disco nem autorização para reaproveitar resultados após reinício.'
 });
}
function active(s:State,store:SyntheticTransactionStore,token:SyntheticTransactionToken,
 expected:SyntheticTransactionPhase):Pending{
 const binding=token&&typeof token==='object'?issuedTokens.get(token):undefined;
 if(!binding||binding.store!==store||binding.generation!==s.generation+1||
    s.phase!==expected||s.pending?.token!==token)
  throw Error('Token fictício ausente, antigo, já concluído ou pertencente a outra sessão.');
 return s.pending;
}
export function createSyntheticTransactionStore():SyntheticTransactionStore{
 const store:SyntheticTransactionStore=Object.freeze({
  scope:'synthetic-transaction-store',nativeStorageOpened:false,
  operationsEnabled:false
 });
 states.set(store,{
  phase:'empty',generation:0,pending:null,history:[],
  interruptedFrom:null,lastRecovery:'none',discardedPending:false
 });
 return store;
}
export function snapshotSyntheticTransactionStore(store:SyntheticTransactionStore):SyntheticTransactionSnapshot{
 return checkpoint(stateFor(store));
}
export function prepareSyntheticTransaction(
 store:SyntheticTransactionStore,draft:SyntheticRestartDraft,expectedGeneration:number
):SyntheticTransactionToken{
 const s=stateFor(store);
 if(!Number.isSafeInteger(expectedGeneration)||expectedGeneration<0||
    s.generation!==expectedGeneration)
  throw Error('Versão de transação desatualizada: revisão esperada não confere.');
 if(s.phase!=='empty'&&s.phase!=='recorded')
  throw Error('Sessão tem gravação pendente ou interrupção não conciliada.');
 if(!isIssuedSyntheticRestartDraft(draft)||alreadyStaged.has(draft))
  throw Error('Rascunho fictício não emitido ou já usado em transação.');
 if(inspectSyntheticRestartDraft(draft).status!=='recheck-required')
  throw Error('Contrato de cópia sintética estruturalmente inválido.');
 const token:SyntheticTransactionToken=Object.freeze({
  scope:'synthetic-transaction-token',generation:s.generation+1,
  realWriteAuthorized:false,operationsEnabled:false
 });
 issuedTokens.set(token,{store,generation:token.generation});
 alreadyStaged.add(draft);
 s.pending={token,draft};s.phase='prepared';s.discardedPending=false;
 return token;
}
export function markSyntheticTransactionCommitIntent(
 store:SyntheticTransactionStore,token:SyntheticTransactionToken
):SyntheticTransactionSnapshot{
 const s=stateFor(store);
 active(s,store,token,'prepared');
 s.phase='commit-intent';
 return checkpoint(s);
}
export function confirmSyntheticTransaction(
 store:SyntheticTransactionStore,token:SyntheticTransactionToken
):SyntheticTransactionSnapshot{
 const s=stateFor(store);
 const p=active(s,store,token,'commit-intent');
 // Re-inspect the data on the model's commit boundary. This confirms syntax,
 // not provenance across processes or cryptographic integrity.
 if(inspectSyntheticRestartDraft(p.draft).status!=='recheck-required')
  throw Error('Rascunho sintético inválido durante confirmação.');
 const entry:SyntheticTransactionEntry=Object.freeze({
  generation:s.generation+1,declaredEvents:p.draft.totalEvents,
  previousState:p.draft.previousState,dataTrusted:false
 });
 s.history.push(entry);
 if(s.history.length>SYNTHETIC_TX_HISTORY_LIMIT)s.history.shift();
 s.generation++;s.pending=null;s.phase='recorded';s.lastRecovery='none';
 return checkpoint(s);
}
export function simulateSyntheticTransactionPowerLoss(
 store:SyntheticTransactionStore
):SyntheticTransactionSnapshot{
 const s=stateFor(store);
 if(s.phase==='interrupted')return checkpoint(s);
 s.interruptedFrom=s.phase;
 s.discardedPending=!!s.pending;
 s.pending=null;s.phase='interrupted';
 return checkpoint(s);
}
export function reconcileSyntheticTransactionAfterLoss(
 store:SyntheticTransactionStore
):SyntheticTransactionSnapshot{
 const s=stateFor(store);
 if(s.phase!=='interrupted')return checkpoint(s);
 const reason=s.interruptedFrom;
 s.lastRecovery=reason==='prepared'?'discarded-prepared':
  reason==='commit-intent'?'discarded-intent':
  reason==='recorded'?'retained-untrusted':'empty-untrusted';
 s.phase=s.history.length?'recorded':'empty';
 s.pending=null;s.interruptedFrom=null;
 return checkpoint(s);
}
