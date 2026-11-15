// An executable SPECIFICATION for a future isolated native recovery adapter.
// No filesystem access, IPC, journal, OS locks, bytes, authentic proof or
// operational authorization exists in this module. All claims are untrusted.
import {
 isSyntheticQuarantineReviewForMatrix,snapshotSyntheticQuarantineReview,
 type SyntheticQuarantineReview
} from './synthetic-quarantine-review';
import {
 snapshotSyntheticStorageFailureMatrix,type SyntheticStorageFailureMatrix
} from './synthetic-storage-failure-matrix';

export type SyntheticNativeClaimValue='declared'|'missing';
export type SyntheticNativeProbe=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';capturedEpoch:number;
 fileIdentity:SyntheticNativeClaimValue;
 journalDurability:SyntheticNativeClaimValue;
 freshByteAnalysis:SyntheticNativeClaimValue;
 userAuthorization:SyntheticNativeClaimValue;
}>;
export type SyntheticNativeGateId='fileIdentity'|'journalDurability'|
 'freshByteAnalysis'|'userAuthorization';
export type SyntheticNativeGate=Readonly<{
 id:SyntheticNativeGateId;label:string;requirement:string;
 claimed:boolean;nativeVerified:false;
}>;
export type SyntheticNativeBoundary=Readonly<{
 scope:'synthetic-native-recovery-boundary';
 nativeAdapterConnected:false;operationsEnabled:false;
}>;
export type SyntheticNativeBoundaryStatus='claim-rejected'|'review-invalidated'|
 'stale-epoch'|'incomplete-declarations'|'untrusted-declarations';
export type SyntheticNativeBoundarySnapshot=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';status:SyntheticNativeBoundaryStatus;
 capturedEpoch:number;currentEpoch:number;reviewCurrent:boolean;
 originalMatrixStillQuarantined:boolean;declaredGates:number;
 gates:readonly SyntheticNativeGate[];
 nativeFileIdentityVerified:false;nativeJournalDurabilityVerified:false;
 freshNativeByteAnalysisVerified:false;explicitNativeAuthorizationVerified:false;
 durableRecoveryProven:false;claimsAreAttestations:false;
 approvedForOperations:false;operationsEnabled:false;
 oldEvidenceReusable:false;realBytesRead:0;realFilesModified:0;
 notice:string;
}>;
type BoundaryState=Readonly<{
 matrix:SyntheticStorageFailureMatrix;review:SyntheticQuarantineReview;
 epoch:number;totalAttempts:number;
}>;
const boundaries=new WeakMap<object,BoundaryState>();
const definitions=Object.freeze([
 Object.freeze({id:'fileIdentity',label:'Identidade do arquivo',
  requirement:'Reabrir por handle nativo autorizado, rejeitar links e conferir identidade antes/depois da leitura.'}),
 Object.freeze({id:'journalDurability',label:'Durabilidade da gravação',
  requirement:'Comprovar ordem, confirmação e sincronização durável em armazenamento isolado, inclusive após queda.'}),
 Object.freeze({id:'freshByteAnalysis',label:'Reanálise dos bytes',
  requirement:'Ler novamente conteúdo permitido e refazer todos os verificadores sem reaproveitar o parecer anterior.'}),
 Object.freeze({id:'userAuthorization',label:'Permissão específica',
  requirement:'Receber autorização real e limitada ao ato solicitado, independente da análise e nunca implícita.'})
] as const);

function strictProbe(raw:unknown):SyntheticNativeProbe|null{
 try{
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
     Object.getPrototypeOf(raw)!==Object.prototype)return null;
  const expected=['schemaVersion','source','capturedEpoch',
   'fileIdentity','journalDurability','freshByteAnalysis','userAuthorization'];
  const received=Reflect.ownKeys(raw);
  if(received.length!==expected.length||
     received.some(k=>typeof k!=='string'||!expected.includes(k)))return null;
  const descriptors=Object.getOwnPropertyDescriptors(raw);
  for(const key of expected){
   const d=descriptors[key];
   if(!d||!d.enumerable||!Object.prototype.hasOwnProperty.call(d,'value'))return null;
  }
  const val=(key:string):unknown=>descriptors[key].value as unknown;
  const epoch=val('capturedEpoch');
  if(val('schemaVersion')!==1||val('source')!=='synthetic-fixture'||
    typeof epoch!=='number'||!Number.isSafeInteger(epoch)||epoch<0)return null;
  const valid=(key:string):boolean=>val(key)==='declared'||val(key)==='missing';
  if(!['fileIdentity','journalDurability','freshByteAnalysis','userAuthorization'].every(valid))return null;
  // Construct a new object only from own DATA descriptors, never accessors.
  return Object.freeze({
   schemaVersion:1,source:'synthetic-fixture',capturedEpoch:epoch,
   fileIdentity:val('fileIdentity') as SyntheticNativeClaimValue,
   journalDurability:val('journalDurability') as SyntheticNativeClaimValue,
   freshByteAnalysis:val('freshByteAnalysis') as SyntheticNativeClaimValue,
   userAuthorization:val('userAuthorization') as SyntheticNativeClaimValue
  });
 }catch{
  // Hostile proxies, getters, unknown prototypes and malformed values fail closed.
  return null;
 }
}
export function createSyntheticNativeRecoveryBoundary(
 matrix:SyntheticStorageFailureMatrix,review:SyntheticQuarantineReview
):SyntheticNativeBoundary{
 if(!isSyntheticQuarantineReviewForMatrix(review,matrix))
  throw Error('Revisão fictícia não vinculada à matriz informada.');
 const current=snapshotSyntheticStorageFailureMatrix(matrix);
 if(!current.quarantined&&!current.corruptionDetected&&!current.historyWindowExceeded)
  throw Error('Contrato nativo só é apresentado após incidente fictício.');
 const handle:SyntheticNativeBoundary=Object.freeze({
  scope:'synthetic-native-recovery-boundary',
  nativeAdapterConnected:false,operationsEnabled:false
 });
 boundaries.set(handle,Object.freeze({
  matrix,review,epoch:current.epoch,totalAttempts:current.totalAttempts
 }));
 return handle;
}
export function inspectSyntheticNativeRecoveryClaims(
 handle:SyntheticNativeBoundary,raw:unknown
):SyntheticNativeBoundarySnapshot{
 const state=handle&&typeof handle==='object'?boundaries.get(handle):undefined;
 if(!state)throw Error('Contrato nativo fictício não emitido.');
 const matrix=snapshotSyntheticStorageFailureMatrix(state.matrix);
 const review=snapshotSyntheticQuarantineReview(state.review);
 const probe=strictProbe(raw);
 const reviewCurrent=review.reviewCurrent&&matrix.leaseOwner===null&&
  matrix.epoch===state.epoch&&matrix.totalAttempts===state.totalAttempts;
 const status:SyntheticNativeBoundaryStatus=
  !reviewCurrent?'review-invalidated':
  !probe?'claim-rejected':
  probe.capturedEpoch!==state.epoch?'stale-epoch':
  definitions.some(x=>probe[x.id]!=='declared')?
   'incomplete-declarations':'untrusted-declarations';
 const gates=Object.freeze(definitions.map(d=>Object.freeze({
  id:d.id,label:d.label,requirement:d.requirement,
  claimed:probe!==null&&probe[d.id]==='declared',
  nativeVerified:false as const
 })));
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,
  status,capturedEpoch:state.epoch,currentEpoch:matrix.epoch,reviewCurrent,
  originalMatrixStillQuarantined:matrix.quarantined,
  declaredGates:gates.filter(g=>g.claimed).length,gates,
  nativeFileIdentityVerified:false as const,
  nativeJournalDurabilityVerified:false as const,
  freshNativeByteAnalysisVerified:false as const,
  explicitNativeAuthorizationVerified:false as const,
  durableRecoveryProven:false as const,claimsAreAttestations:false as const,
  approvedForOperations:false as const,operationsEnabled:false as const,
  oldEvidenceReusable:false as const,realBytesRead:0 as const,
  realFilesModified:0 as const,
  notice:'Declarações estruturais não são comprovação nativa. Identidade, gravação durável, nova leitura e autorização continuam pendentes; operações bloqueadas.'
 });
}
