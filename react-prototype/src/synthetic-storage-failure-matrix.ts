// Failure-injection MATRIX, strictly in memory. This is neither a filesystem
// lock nor a persistent transaction journal. No native I/O, disk or real mods.
import {
 isIssuedSyntheticRestartDraft,isSyntheticRestartDraftForRecovery,inspectSyntheticRestartDraft,
 type SyntheticRestartDraft
} from './synthetic-restart-handoff';
import type {SyntheticOrphanRecovery} from './synthetic-orphan-recovery';

export const SYNTHETIC_STORAGE_FAILURE_LIMITS=Object.freeze({
 retainedAttempts:8,maxRecoveryFailures:3,maxAttempts:64
});
export type SyntheticStorageActor='session-a'|'session-b';
export type SyntheticStorageOutcome=
 'none'|'structural-copy-untrusted'|'corrupt-record-rejected'|
 'lease-conflict'|'stale-epoch'|'recovery-interrupted'|
 'quarantined'|'history-limit-reached';
export type SyntheticStorageFailureMatrix=Readonly<{
 scope:'synthetic-storage-failure-matrix';
 nativeFileHandles:0;operationsEnabled:false;
}>;
export type SyntheticStorageLease=Readonly<{
 scope:'synthetic-storage-lease';actor:SyntheticStorageActor;epoch:number;
 realLockAcquired:false;operationsEnabled:false;
}>;
export type SyntheticStorageAttempt=Readonly<{
 attempt:number;outcome:SyntheticStorageOutcome;
 actor:SyntheticStorageActor|null;epoch:number;
 dataTrusted:false;
}>;
export type SyntheticStorageMatrixSnapshot=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';phase:'available'|'leased'|'quarantined';
 epoch:number;leaseOwner:SyntheticStorageActor|null;
 recoveryFailures:number;quarantined:boolean;
 retainedAttempts:readonly SyntheticStorageAttempt[];
 totalAttempts:number;droppedAttempts:number;lastOutcome:SyntheticStorageOutcome;
 corruptionDetected:boolean;historyWindowExceeded:boolean;
 lastIncompleteDiscarded:boolean;oldEvidenceReusable:false;
 realLockHeld:false;cryptographicIntegrityVerified:false;
 persistenceVerified:false;realProcessRestarted:false;
 realBytesRead:0;operationsEnabled:false;requiresNewAnalysis:true;
}>;
type State={
 epoch:number;originDraft:SyntheticRestartDraft;owner:SyntheticStorageActor|null;active:SyntheticStorageLease|null;
 failures:number;quarantined:boolean;attemptCount:number;
 attempts:SyntheticStorageAttempt[];last:SyntheticStorageOutcome;
 corrupt:boolean;discarded:boolean;
};
const matrixStates=new WeakMap<object,State>();
const issuedLeases=new WeakMap<object,{matrix:SyntheticStorageFailureMatrix;epoch:number;actor:SyntheticStorageActor}>();
function get(matrix:SyntheticStorageFailureMatrix):State{
 const state=matrix&&typeof matrix==='object'?matrixStates.get(matrix):undefined;
 if(!state)throw Error('Matriz de falhas fictícia não emitida.');
 return state;
}
function ensureCapacity(s:State){
 if(s.attemptCount>=SYNTHETIC_STORAGE_FAILURE_LIMITS.maxAttempts)
  throw Error('Limite global de tentativas fictícias atingido.');
}
function log(s:State,outcome:SyntheticStorageOutcome,actor:SyntheticStorageActor|null){
 // This is bounded even if the UI sends a storm of invalid requests.
 ensureCapacity(s);
 const entry:SyntheticStorageAttempt=Object.freeze({
  attempt:s.attemptCount+1,outcome,actor,epoch:s.epoch,dataTrusted:false
 });
 s.attemptCount++;s.last=outcome;s.attempts.push(entry);
 if(s.attempts.length>SYNTHETIC_STORAGE_FAILURE_LIMITS.retainedAttempts)s.attempts.shift();
}
function isActor(value:unknown):value is SyntheticStorageActor{
 return value==='session-a'||value==='session-b';
}
function requireLease(matrix:SyntheticStorageFailureMatrix,lease:SyntheticStorageLease):State{
 const s=get(matrix);
 const binding=lease&&typeof lease==='object'?issuedLeases.get(lease):undefined;
 if(!binding||binding.matrix!==matrix||binding.epoch!==s.epoch||
    binding.actor!==s.owner||s.active!==lease||s.quarantined)
  throw Error('Sessão, geração ou token fictício não vigente.');
 return s;
}
function snapshot(s:State):SyntheticStorageMatrixSnapshot{
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,
  phase:s.quarantined?'quarantined' as const:s.owner?'leased' as const:'available' as const,
  epoch:s.epoch,leaseOwner:s.owner,recoveryFailures:s.failures,
  quarantined:s.quarantined,retainedAttempts:Object.freeze([...s.attempts]),
  totalAttempts:s.attemptCount,droppedAttempts:s.attemptCount-s.attempts.length,
  lastOutcome:s.last,corruptionDetected:s.corrupt,
  historyWindowExceeded:s.attemptCount>SYNTHETIC_STORAGE_FAILURE_LIMITS.retainedAttempts,
  lastIncompleteDiscarded:s.discarded,
  oldEvidenceReusable:false as const,realLockHeld:false as const,
  cryptographicIntegrityVerified:false as const,persistenceVerified:false as const,
  realProcessRestarted:false as const,realBytesRead:0 as const,
  operationsEnabled:false as const,requiresNewAnalysis:true as const
 });
}
export function createSyntheticStorageFailureMatrix(draft:SyntheticRestartDraft):SyntheticStorageFailureMatrix{
 if(!isIssuedSyntheticRestartDraft(draft)||
    inspectSyntheticRestartDraft(draft).status!=='recheck-required')
  throw Error('Rascunho fictício não emitido ou inválido.');
 const handle:SyntheticStorageFailureMatrix=Object.freeze({
  scope:'synthetic-storage-failure-matrix',nativeFileHandles:0,operationsEnabled:false
 });
 matrixStates.set(handle,{
  epoch:0,originDraft:draft,owner:null,active:null,failures:0,quarantined:false,
  attempts:[],attemptCount:0,last:'none',corrupt:false,discarded:false
 });
 return handle;
}
// Identity-bound pairing for the optional quarantine review. Neither the
// matrix nor the draft are proofs of any filesystem origin.
export function isSyntheticStorageMatrixForRecovery(
 matrix:unknown,recovery:unknown
):boolean{
 if(!matrix||typeof matrix!=='object')return false;
 const s=matrixStates.get(matrix);
 return !!s&&isSyntheticRestartDraftForRecovery(s.originDraft,recovery);
}
export function snapshotSyntheticStorageFailureMatrix(
 matrix:SyntheticStorageFailureMatrix
):SyntheticStorageMatrixSnapshot{
 return snapshot(get(matrix));
}
export function acquireSyntheticStorageLease(
 matrix:SyntheticStorageFailureMatrix,actor:SyntheticStorageActor,expectedEpoch:number
):SyntheticStorageLease|null{
 const s=get(matrix);
 if(!isActor(actor)||!Number.isSafeInteger(expectedEpoch)||expectedEpoch<0)
  throw Error('Identidade ou geração sintética inválida.');
 if(s.quarantined){
  log(s,'quarantined',actor);return null;
 }
 if(s.owner){
  log(s,'lease-conflict',actor);return null;
 }
 if(s.epoch!==expectedEpoch){
  log(s,'stale-epoch',actor);return null;
 }
 const lease:SyntheticStorageLease=Object.freeze({
  scope:'synthetic-storage-lease',actor,epoch:expectedEpoch,
  realLockAcquired:false,operationsEnabled:false
 });
 s.owner=actor;s.active=lease;
 issuedLeases.set(lease,{matrix,epoch:s.epoch,actor});
 return lease;
}
export function inspectSyntheticStorageRecord(
 matrix:SyntheticStorageFailureMatrix,lease:SyntheticStorageLease,raw:unknown
):SyntheticStorageMatrixSnapshot{
 const s=requireLease(matrix,lease);
 ensureCapacity(s);
 const check=inspectSyntheticRestartDraft(raw);
 if(check.status==='rejected'){
  s.corrupt=true;log(s,'corrupt-record-rejected',s.owner);
 }else log(s,'structural-copy-untrusted',s.owner);
 return snapshot(s);
}
export function releaseSyntheticStorageLease(
 matrix:SyntheticStorageFailureMatrix,lease:SyntheticStorageLease
):SyntheticStorageMatrixSnapshot{
 const s=requireLease(matrix,lease);
 s.owner=null;s.active=null;s.epoch++;
 return snapshot(s);
}
export function interruptSyntheticStorageRecovery(
 matrix:SyntheticStorageFailureMatrix,lease:SyntheticStorageLease
):SyntheticStorageMatrixSnapshot{
 const s=requireLease(matrix,lease);
 ensureCapacity(s);
 // A simulated crash always invalidates the lease and its attempted result.
 s.failures++;s.discarded=true;s.owner=null;s.active=null;s.epoch++;
 if(s.failures>=SYNTHETIC_STORAGE_FAILURE_LIMITS.maxRecoveryFailures)s.quarantined=true;
 log(s,'recovery-interrupted',null);
 return snapshot(s);
}
