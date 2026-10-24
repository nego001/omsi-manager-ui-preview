import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {createSyntheticValidationReadiness} from '../src/synthetic-validation-readiness';
import {createSyntheticReadAdmissionSession} from '../src/synthetic-read-admission';
import {createSyntheticContainerReview,advanceSyntheticContainerReview,
 issueSyntheticStreamDeclarationSource} from '../src/synthetic-container-screen';
import {createSyntheticStreamReview} from '../src/synthetic-stream-checkpoints';
import {createSyntheticReaderLifecycle,openSyntheticReaderLifecycle,
 stepSyntheticReaderLifecycle,closeSyntheticReaderLifecycle,
 simulateSyntheticReaderLifecycleProcessLoss,type SyntheticReaderLifecycle
} from '../src/synthetic-reader-lifecycle';
import {createSyntheticOrphanRecovery,acknowledgeSyntheticOrphanRecovery,
 type SyntheticOrphanRecovery} from '../src/synthetic-orphan-recovery';
import {createSyntheticRestartDraft} from '../src/synthetic-restart-handoff';
import {
 createSyntheticStorageFailureMatrix,acquireSyntheticStorageLease,
 releaseSyntheticStorageLease,interruptSyntheticStorageRecovery,
 inspectSyntheticStorageRecord,snapshotSyntheticStorageFailureMatrix,
 type SyntheticStorageFailureMatrix
} from '../src/synthetic-storage-failure-matrix';
import {
 createSyntheticQuarantineReview,snapshotSyntheticQuarantineReview,
 assessSyntheticQuarantineCandidate,type SyntheticQuarantineReview
} from '../src/synthetic-quarantine-review';
const readiness=createSyntheticValidationReadiness(createSyntheticDiagnosticDemo()[3].timeline);
const admission=createSyntheticReadAdmissionSession(readiness);
function life(){
 const c=createSyntheticContainerReview(admission,{format:'zip-declared',entries:[
  {path:'def/demo.sii',kind:'file',compression:'deflate',encodedBytes:200,expandedBytes:400},
  {path:'sound/demo.ogg',kind:'file',compression:'deflate',encodedBytes:100,expandedBytes:200}
 ]});
 advanceSyntheticContainerReview(c);advanceSyntheticContainerReview(c);
 const source=issueSyntheticStreamDeclarationSource(c);
 const stream=createSyntheticStreamReview(source,source.entries.map(e=>({
  entryOrdinal:e.ordinal,encodedBytes:e.encodedBytes,
  expandedBytes:e.expandedBytes,elapsedMs:10,endOfEntry:true
 })));
 return createSyntheticReaderLifecycle(stream);
}
function completed(){
 const h=life();openSyntheticReaderLifecycle(h);
 stepSyntheticReaderLifecycle(h);stepSyntheticReaderLifecycle(h);
 closeSyntheticReaderLifecycle(h);return h;
}
function orphan(){
 const h=life();openSyntheticReaderLifecycle(h);
 stepSyntheticReaderLifecycle(h);
 simulateSyntheticReaderLifecycleProcessLoss(h);
 return createSyntheticOrphanRecovery(h);
}
function setup(mode:'quarantine'|'corrupt'|'history'|'normal'|'leased'='quarantine',
 record:SyntheticOrphanRecovery=orphan()){
 const m=createSyntheticStorageFailureMatrix(createSyntheticRestartDraft(record));
 if(mode==='quarantine'){
  for(let i=0;i<3;i++){
   const lease=acquireSyntheticStorageLease(m,'session-a',snapshotSyntheticStorageFailureMatrix(m).epoch);
   if(!lease)throw Error('setup failed');
   interruptSyntheticStorageRecovery(m,lease);
  }
 }else if(mode==='corrupt'){
  const token=acquireSyntheticStorageLease(m,'session-a',0)!;
  inspectSyntheticStorageRecord(m,token,{operationsEnabled:true});
  releaseSyntheticStorageLease(m,token);
 }else if(mode==='history'){
  const token=acquireSyntheticStorageLease(m,'session-a',0)!;
  const draft=createSyntheticRestartDraft(record);
  for(let i=0;i<9;i++)inspectSyntheticStorageRecord(m,token,JSON.parse(JSON.stringify(draft)));
  releaseSyntheticStorageLease(m,token);
 }else if(mode==='leased'){
  acquireSyntheticStorageLease(m,'session-a',0);
 }
 return {m,record};
}
test('matriz em quarentena exige revisão, mas mantém bloqueio original',()=>{
 const {m,record}=setup();
 const review=createSyntheticQuarantineReview(m,record);
 const x=snapshotSyntheticQuarantineReview(review);
 expect(x.status).toBe('awaiting-recheck');expect(x.priorFailures).toBe(3);
 expect(x.originalMatrixStillQuarantined).toBe(true);
 expect(x.originalEvidenceReusable).toBe(false);
 expect(x.operationsEnabled).toBe(false);
});
test('revisão nunca começa em matriz sem incidente',()=>{
 const {m,record}=setup('normal');
 expect(()=>createSyntheticQuarantineReview(m,record)).toThrow('sem falha');
});
test('a matriz deve estar sem sessão ativa antes da revisão',()=>{
 const {m,record}=setup('leased');
 expect(()=>createSyntheticQuarantineReview(m,record)).toThrow('sessão fictícia ativa');
});
test('matriz com corrupção recusada também pode entrar em revisão fictícia',()=>{
 const {m,record}=setup('corrupt');
 const x=snapshotSyntheticQuarantineReview(createSyntheticQuarantineReview(m,record));
 expect(x.corruptionDetected).toBe(true);
 expect(x.originalEvidenceInvalidated).toBe(true);
});
test('janela de histórico acima de oito eventos exige reanálise',()=>{
 const {m,record}=setup('history');
 const x=snapshotSyntheticQuarantineReview(createSyntheticQuarantineReview(m,record));
 expect(x.historyTruncated).toBe(true);
 expect(x.reviewedNewDeclarations).toBe(0);
});
test('uma recuperação que não originou a matriz é recusada por identidade',()=>{
 const {m}=setup(),other=orphan();
 expect(()=>createSyntheticQuarantineReview(m,other)).toThrow('origem idêntica');
});
test('cópia do registro de recuperação não permite pareamento',()=>{
 const {m,record}=setup();
 for(const fake of [{...record},JSON.parse(JSON.stringify(record))]){
  expect(()=>createSyntheticQuarantineReview(m,fake)).toThrow('origem idêntica');
 }
});
test('matriz clonada não pode emitir revisão',()=>{
 const {m,record}=setup();
 expect(()=>createSyntheticQuarantineReview({...m},record)).toThrow('origem idêntica');
});
test('revisão emitida em memória não pode ser falsificada ou clonada',()=>{
 const {m,record}=setup(),review=createSyntheticQuarantineReview(m,record);
 for(const fake of [{...review},JSON.parse(JSON.stringify(review))] as SyntheticQuarantineReview[]){
  expect(()=>snapshotSyntheticQuarantineReview(fake)).toThrow('não emitida');
  expect(()=>assessSyntheticQuarantineCandidate(fake,completed())).toThrow('não emitida');
 }
});
test('envio de nova triagem antes do reconhecimento é recusado',()=>{
 const {m,record}=setup(),review=createSyntheticQuarantineReview(m,record);
 const x=assessSyntheticQuarantineCandidate(review,completed());
 expect(x.decision).toBe('acknowledgement-required');
 expect(x.status).toBe('awaiting-recheck');
 expect(x.reviewedNewDeclarations).toBe(0);
});
test('ciclo inventado ou clonado é recusado mesmo depois de reconhecer abandono',()=>{
 const {m,record}=setup(),review=createSyntheticQuarantineReview(m,record);
 acknowledgeSyntheticOrphanRecovery(record);
 const real=completed();
 for(const fake of [{...real},JSON.parse(JSON.stringify(real)),{}] as SyntheticReaderLifecycle[]){
  expect(assessSyntheticQuarantineCandidate(review,fake).decision).toBe('candidate-not-independent');
 }
});
test('uma nova análise independente mas incompleta não é aceita',()=>{
 const {m,record}=setup(),review=createSyntheticQuarantineReview(m,record);
 acknowledgeSyntheticOrphanRecovery(record);
 const partial=life();openSyntheticReaderLifecycle(partial);stepSyntheticReaderLifecycle(partial);
 const x=assessSyntheticQuarantineCandidate(review,partial);
 expect(x.decision).toBe('candidate-incomplete');
 expect(x.reviewedNewDeclarations).toBe(0);
});
test('nova análise independente encerrada antecipadamente é recusada',()=>{
 const {m,record}=setup(),review=createSyntheticQuarantineReview(m,record);
 acknowledgeSyntheticOrphanRecovery(record);
 const early=life();openSyntheticReaderLifecycle(early);closeSyntheticReaderLifecycle(early);
 expect(assessSyntheticQuarantineCandidate(review,early).decision).toBe('candidate-incomplete');
});
test('triagem independente e completa só registra fixture sem liberar quarentena',()=>{
 const {m,record}=setup(),review=createSyntheticQuarantineReview(m,record);
 acknowledgeSyntheticOrphanRecovery(record);
 const x=assessSyntheticQuarantineCandidate(review,completed());
 expect(x.status).toBe('new-fixture-reviewed');
 expect(x.decision).toBe('new-fixture-reviewed');
 expect(x.reviewedNewDeclarations).toBe(2);
 expect(x.independentlyScreenedFixture).toBe(true);
 expect(x.originalMatrixStillQuarantined).toBe(true);
 expect(snapshotSyntheticStorageFailureMatrix(m).quarantined).toBe(true);
});
test('um candidato já aceito não serve para desbloquear segunda matriz fictícia',()=>{
 const record=orphan();
 const x=setup('quarantine',record),y=setup('quarantine',record);
 const r1=createSyntheticQuarantineReview(x.m,record);
 const r2=createSyntheticQuarantineReview(y.m,record);
 acknowledgeSyntheticOrphanRecovery(record);
 const candidate=completed();
 expect(assessSyntheticQuarantineCandidate(r1,candidate).status).toBe('new-fixture-reviewed');
 expect(assessSyntheticQuarantineCandidate(r2,candidate).decision).toBe('candidate-reused');
});
test('candidato falsificado não impede análise realmente independente futura',()=>{
 const {m,record}=setup(),review=createSyntheticQuarantineReview(m,record);
 acknowledgeSyntheticOrphanRecovery(record);
 assessSyntheticQuarantineCandidate(review,{} as SyntheticReaderLifecycle);
 expect(assessSyntheticQuarantineCandidate(review,completed()).status).toBe('new-fixture-reviewed');
});
test('estado final não muda com submissões repetidas',()=>{
 const {m,record}=setup(),review=createSyntheticQuarantineReview(m,record);
 acknowledgeSyntheticOrphanRecovery(record);
 const first=assessSyntheticQuarantineCandidate(review,completed());
 expect(assessSyntheticQuarantineCandidate(review,completed())).toEqual(first);
 expect(snapshotSyntheticQuarantineReview(review)).toEqual(first);
});
test('a revisão não modifica contadores de falhas nem permite novo lease antigo',()=>{
 const {m,record}=setup(),review=createSyntheticQuarantineReview(m,record);
 const before=snapshotSyntheticStorageFailureMatrix(m);
 acknowledgeSyntheticOrphanRecovery(record);
 assessSyntheticQuarantineCandidate(review,completed());
 expect(snapshotSyntheticStorageFailureMatrix(m)).toEqual(before);
 expect(acquireSyntheticStorageLease(m,'session-a',before.epoch)).toBeNull();
});
test('resumos são congelados sem caminho nem token de arquivo real',()=>{
 const {m,record}=setup(),review=createSyntheticQuarantineReview(m,record);
 acknowledgeSyntheticOrphanRecovery(record);
 const x=assessSyntheticQuarantineCandidate(review,completed());
 expect(Object.isFrozen(review)).toBe(true);
 expect(Object.isFrozen(x)).toBe(true);
 const text=JSON.stringify(x)+JSON.stringify(review);
 for(const path of ['def/demo.sii','sound/demo.ogg','C:\\','revisionTicket','PRIVATE_FILE'])
  expect(text).not.toContain(path);
});
test('qualquer decisão mantém recurso real inacessível e nova análise nativa exigida',()=>{
 const {m,record}=setup(),review=createSyntheticQuarantineReview(m,record);
 const first=assessSyntheticQuarantineCandidate(review,completed());
 acknowledgeSyntheticOrphanRecovery(record);
 const second=assessSyntheticQuarantineCandidate(review,completed());
 for(const x of [first,second]){
  expect(x.realStorageRepaired).toBe(false);expect(x.realLockRecovered).toBe(false);
  expect(x.actualFilesRechecked).toBe(false);expect(x.realCleanupVerified).toBe(false);
  expect(x.realIntegrityVerified).toBe(false);expect(x.realBytesRead).toBe(0);
  expect(x.operationsEnabled).toBe(false);expect(x.freshNativeAnalysisRequired).toBe(true);
 }
});

test('revisão recém-aberta tem fotografia consistente da matriz fictícia',()=>{
 const {m,record}=setup('corrupt');
 const review=createSyntheticQuarantineReview(m,record);
 const x=snapshotSyntheticQuarantineReview(review);
 expect(x.reviewCurrent).toBe(true);
 expect(x.reviewInvalidated).toBe(false);
 expect(snapshotSyntheticQuarantineReview(review)).toEqual(x);
});

test('lease concorrente invalida revisão, mesmo sem avançar geração',()=>{
 const {m,record}=setup('corrupt'),review=createSyntheticQuarantineReview(m,record);
 acknowledgeSyntheticOrphanRecovery(record);
 const before=snapshotSyntheticStorageFailureMatrix(m);
 const lease=acquireSyntheticStorageLease(m,'session-b',before.epoch)!;
 expect(snapshotSyntheticStorageFailureMatrix(m).epoch).toBe(before.epoch);
 const rejected=assessSyntheticQuarantineCandidate(review,completed());
 expect(rejected.decision).toBe('matrix-state-changed');
 expect(rejected.reviewCurrent).toBe(false);
 expect(rejected.reviewedNewDeclarations).toBe(0);
 expect(rejected.status).toBe('awaiting-recheck');
 releaseSyntheticStorageLease(m,lease);
 expect(assessSyntheticQuarantineCandidate(review,completed()).reviewInvalidated).toBe(true);
});

test('mudança posterior revoga apresentação de análise fictícia já aceita',()=>{
 const {m,record}=setup('corrupt'),review=createSyntheticQuarantineReview(m,record);
 acknowledgeSyntheticOrphanRecovery(record);
 expect(assessSyntheticQuarantineCandidate(review,completed()).reviewCurrent).toBe(true);
 expect(snapshotSyntheticQuarantineReview(review).reviewedNewDeclarations).toBe(2);
 const lease=acquireSyntheticStorageLease(m,'session-b',snapshotSyntheticStorageFailureMatrix(m).epoch)!;
 const stale=snapshotSyntheticQuarantineReview(review);
 expect(stale.reviewInvalidated).toBe(true);
 expect(stale.status).toBe('awaiting-recheck');
 expect(stale.reviewedNewDeclarations).toBe(0);
 expect(stale.independentlyScreenedFixture).toBe(false);
 expect(stale.operationsEnabled).toBe(false);
 releaseSyntheticStorageLease(m,lease);
 expect(snapshotSyntheticQuarantineReview(review).reviewInvalidated).toBe(true);
});

test('tentativa recusada depois de quarentena também invalida a revisão antiga',()=>{
 const {m,record}=setup('quarantine'),review=createSyntheticQuarantineReview(m,record);
 const epoch=snapshotSyntheticStorageFailureMatrix(m).epoch;
 expect(acquireSyntheticStorageLease(m,'session-b',epoch)).toBeNull();
 const stale=snapshotSyntheticQuarantineReview(review);
 expect(stale.reviewInvalidated).toBe(true);
 expect(stale.decision).toBe('matrix-state-changed');
 expect(stale.originalMatrixStillQuarantined).toBe(true);
});

test('tentativas em outra matriz não afetam uma revisão independente',()=>{
 const a=setup('corrupt'),b=setup('corrupt');
 const review=createSyntheticQuarantineReview(a.m,a.record);
 const lease=acquireSyntheticStorageLease(b.m,'session-b',snapshotSyntheticStorageFailureMatrix(b.m).epoch)!;
 expect(snapshotSyntheticQuarantineReview(review).reviewCurrent).toBe(true);
 releaseSyntheticStorageLease(b.m,lease);
});

test('a revisão invalidada não consome candidato novo de outra revisão',()=>{
 const {m,record}=setup('corrupt'),review=createSyntheticQuarantineReview(m,record);
 acknowledgeSyntheticOrphanRecovery(record);
 const lease=acquireSyntheticStorageLease(m,'session-b',snapshotSyntheticStorageFailureMatrix(m).epoch)!;
 const candidate=completed();
 expect(assessSyntheticQuarantineCandidate(review,candidate).reviewInvalidated).toBe(true);
 releaseSyntheticStorageLease(m,lease);
 const freshReview=createSyntheticQuarantineReview(m,record);
 expect(assessSyntheticQuarantineCandidate(freshReview,candidate).decision).toBe('new-fixture-reviewed');
});

test('revisão invalidada não revive por clonagem e não libera ações',()=>{
 const {m,record}=setup('corrupt'),review=createSyntheticQuarantineReview(m,record);
 const lease=acquireSyntheticStorageLease(m,'session-b',snapshotSyntheticStorageFailureMatrix(m).epoch)!;
 const x=snapshotSyntheticQuarantineReview(review);
 expect(Object.isFrozen(x)).toBe(true);
 expect(x.originalEvidenceReusable).toBe(false);
 expect(x.actualFilesRechecked).toBe(false);
 expect(x.realStorageRepaired).toBe(false);
 expect(x.operationsEnabled).toBe(false);
 releaseSyntheticStorageLease(m,lease);
 expect(snapshotSyntheticQuarantineReview(review).reviewInvalidated).toBe(true);
});
