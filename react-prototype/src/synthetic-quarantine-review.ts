// A policy for reviewing quarantined SYNTHETIC storage. It cannot release
// the old matrix or restore a previous conclusion. No OS access or persistence.
import {
 isSyntheticStorageMatrixForRecovery,snapshotSyntheticStorageFailureMatrix,
 type SyntheticStorageFailureMatrix
} from './synthetic-storage-failure-matrix';
import {
 snapshotSyntheticOrphanRecovery,isFreshSyntheticOrphanCandidate,
 type SyntheticOrphanRecovery
} from './synthetic-orphan-recovery';
import {
 isIssuedSyntheticReaderLifecycle,areIndependentSyntheticReaderLifecycles,
 snapshotSyntheticReaderLifecycle,type SyntheticReaderLifecycle
} from './synthetic-reader-lifecycle';

export type SyntheticQuarantineReview=Readonly<{
 scope:'synthetic-quarantine-review';revision:number;
 realQuarantineLifted:false;operationsEnabled:false;
}>;
export type SyntheticQuarantineDecision=
 'acknowledgement-required'|'candidate-not-independent'|
 'candidate-incomplete'|'candidate-reused'|'new-fixture-reviewed';
export type SyntheticQuarantineSnapshot=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';
 status:'awaiting-recheck'|'new-fixture-reviewed';
 decision:SyntheticQuarantineDecision|null;
 originalMatrixStillQuarantined:boolean;originalEvidenceInvalidated:true;
 originalEvidenceReusable:false;reviewedNewDeclarations:number;
 independentlyScreenedFixture:boolean;priorFailures:number;
 corruptionDetected:boolean;historyTruncated:boolean;
 realStorageRepaired:false;realLockRecovered:false;
 realIntegrityVerified:false;realCleanupVerified:false;
 actualFilesRechecked:false;realBytesRead:0;operationsEnabled:false;
 freshNativeAnalysisRequired:true;notice:string;
}>;
type State={
 matrix:SyntheticStorageFailureMatrix;recovery:SyntheticOrphanRecovery;
 status:SyntheticQuarantineSnapshot['status'];
 decision:SyntheticQuarantineDecision|null;declarations:number;
};
const issuedReviews=new WeakMap<object,State>();
const usedCandidates=new WeakSet<object>();
function lookup(review:SyntheticQuarantineReview):State{
 const s=review&&typeof review==='object'?issuedReviews.get(review):undefined;
 if(!s)throw Error('Revisão de quarentena fictícia não emitida.');
 return s;
}
function snapshot(s:State):SyntheticQuarantineSnapshot{
 const matrix=snapshotSyntheticStorageFailureMatrix(s.matrix);
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,
  status:s.status,decision:s.decision,
  originalMatrixStillQuarantined:matrix.quarantined,
  originalEvidenceInvalidated:true as const,originalEvidenceReusable:false as const,
  reviewedNewDeclarations:s.status==='new-fixture-reviewed'?s.declarations:0,
  independentlyScreenedFixture:s.status==='new-fixture-reviewed',
  priorFailures:matrix.recoveryFailures,
  corruptionDetected:matrix.corruptionDetected,
  historyTruncated:matrix.historyWindowExceeded,
  realStorageRepaired:false as const,realLockRecovered:false as const,
  realIntegrityVerified:false as const,realCleanupVerified:false as const,
  actualFilesRechecked:false as const,realBytesRead:0 as const,
  operationsEnabled:false as const,freshNativeAnalysisRequired:true as const,
  notice:'A nova triagem é somente uma demonstração. A matriz anterior continua bloqueada quando estava em quarentena; nenhuma análise real foi aprovada.'
 });
}
export function createSyntheticQuarantineReview(
 matrix:SyntheticStorageFailureMatrix,recovery:SyntheticOrphanRecovery
):SyntheticQuarantineReview{
 if(!isSyntheticStorageMatrixForRecovery(matrix,recovery))
  throw Error('Matriz e recuperação fictícias sem origem idêntica.');
 const current=snapshotSyntheticStorageFailureMatrix(matrix);
 if(current.leaseOwner!==null)
  throw Error('Matriz ainda possui sessão fictícia ativa.');
 if(!current.quarantined&&!current.corruptionDetected&&!current.historyWindowExceeded)
  throw Error('Matriz sem falha que justifique revisão de quarentena.');
 const origin=snapshotSyntheticOrphanRecovery(recovery);
 if(!origin.oldEvidenceInvalidated||origin.oldResultReusable)
  throw Error('Evidências fictícias antigas não foram invalidadas.');
 const review:SyntheticQuarantineReview=Object.freeze({
  scope:'synthetic-quarantine-review',revision:origin.revision,
  realQuarantineLifted:false,operationsEnabled:false
 });
 issuedReviews.set(review,{
  matrix,recovery,status:'awaiting-recheck',decision:null,declarations:0
 });
 return review;
}
export function snapshotSyntheticQuarantineReview(review:SyntheticQuarantineReview):SyntheticQuarantineSnapshot{
 return snapshot(lookup(review));
}
export function assessSyntheticQuarantineCandidate(
 review:SyntheticQuarantineReview,candidate:SyntheticReaderLifecycle
):SyntheticQuarantineSnapshot{
 const s=lookup(review);
 if(s.status==='new-fixture-reviewed')return snapshot(s);
 const recovery=snapshotSyntheticOrphanRecovery(s.recovery);
 if(recovery.phase==='acknowledgement-required'){
  s.decision='acknowledgement-required';return snapshot(s);
 }
 if(!isIssuedSyntheticReaderLifecycle(candidate)||
    !areIndependentSyntheticReaderLifecyclesForReview(s.recovery,candidate)){
  s.decision='candidate-not-independent';return snapshot(s);
 }
 if(usedCandidates.has(candidate)){
  s.decision='candidate-reused';return snapshot(s);
 }
 if(!isFreshSyntheticOrphanCandidate(s.recovery,candidate)){
  s.decision='candidate-incomplete';return snapshot(s);
 }
 const outcome=snapshotSyntheticReaderLifecycle(candidate);
 s.status='new-fixture-reviewed';
 s.decision='new-fixture-reviewed';s.declarations=outcome.completedDeclarations;
 usedCandidates.add(candidate);
 return snapshot(s);
}
function areIndependentSyntheticReaderLifecyclesForReview(
 recovery:SyntheticOrphanRecovery,candidate:SyntheticReaderLifecycle
):boolean{
 // A genuine independently issued cycle is checked by the private origin
 // binder inside the recovery module; an incomplete independent candidate
 // must still be distinguished from a forged or stale-cycle candidate.
 return isFreshSyntheticOrphanCandidate(recovery,candidate)||
  isIssuedSyntheticReaderLifecycle(candidate);
}
