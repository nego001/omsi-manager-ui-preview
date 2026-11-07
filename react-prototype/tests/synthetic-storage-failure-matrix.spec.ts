import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {createSyntheticValidationReadiness} from '../src/synthetic-validation-readiness';
import {createSyntheticReadAdmissionSession} from '../src/synthetic-read-admission';
import {createSyntheticContainerReview,advanceSyntheticContainerReview,issueSyntheticStreamDeclarationSource} from '../src/synthetic-container-screen';
import {createSyntheticStreamReview} from '../src/synthetic-stream-checkpoints';
import {createSyntheticReaderLifecycle,openSyntheticReaderLifecycle,
 simulateSyntheticReaderLifecycleProcessLoss} from '../src/synthetic-reader-lifecycle';
import {createSyntheticOrphanRecovery} from '../src/synthetic-orphan-recovery';
import {createSyntheticRestartDraft,type SyntheticRestartDraft} from '../src/synthetic-restart-handoff';
import {
 createSyntheticStorageFailureMatrix,snapshotSyntheticStorageFailureMatrix,
 acquireSyntheticStorageLease,inspectSyntheticStorageRecord,releaseSyntheticStorageLease,
 interruptSyntheticStorageRecovery,SYNTHETIC_STORAGE_FAILURE_LIMITS,
 type SyntheticStorageLease,type SyntheticStorageFailureMatrix
} from '../src/synthetic-storage-failure-matrix';
const readiness=createSyntheticValidationReadiness(createSyntheticDiagnosticDemo()[3].timeline);
const admission=createSyntheticReadAdmissionSession(readiness);
function draft(){
 const catalog=createSyntheticContainerReview(admission,{format:'zip-declared',entries:[
  {path:'def/fake.sii',kind:'file',compression:'deflate',encodedBytes:100,expandedBytes:300}
 ]});
 advanceSyntheticContainerReview(catalog);
 const source=issueSyntheticStreamDeclarationSource(catalog);
 const e=source.entries[0];
 const stream=createSyntheticStreamReview(source,[{entryOrdinal:e.ordinal,
  encodedBytes:e.encodedBytes,expandedBytes:e.expandedBytes,elapsedMs:5,endOfEntry:true}]);
 const life=createSyntheticReaderLifecycle(stream);
 openSyntheticReaderLifecycle(life);
 simulateSyntheticReaderLifecycleProcessLoss(life);
 return createSyntheticRestartDraft(createSyntheticOrphanRecovery(life));
}
const fixture=draft();
const copy=()=>JSON.parse(JSON.stringify(fixture)) as Record<string,unknown>;
function fresh(){return createSyntheticStorageFailureMatrix(fixture);}
function acquire(matrix:SyntheticStorageFailureMatrix,actor:'session-a'|'session-b'='session-a'){
 const state=snapshotSyntheticStorageFailureMatrix(matrix);
 const token=acquireSyntheticStorageLease(matrix,actor,state.epoch);
 if(!token)throw Error('Lease fictício não concedido');
 return token;
}
test('matriz começa disponível sem lock nem operações reais',()=>{
 const x=snapshotSyntheticStorageFailureMatrix(fresh());
 expect(x.phase).toBe('available');expect(x.epoch).toBe(0);
 expect(x.leaseOwner).toBeNull();expect(x.recoveryFailures).toBe(0);
 expect(x.totalAttempts).toBe(0);expect(x.oldEvidenceReusable).toBe(false);
 expect(x.realLockHeld).toBe(false);expect(x.operationsEnabled).toBe(false);
});
test('origem clonada ou JSON não pode criar matriz de falhas',()=>{
 for(const input of [{...fixture},JSON.parse(JSON.stringify(fixture))] as SyntheticRestartDraft[]){
  expect(()=>createSyntheticStorageFailureMatrix(input)).toThrow('não emitido');
 }
});
test('sessão A pode adquirir apenas um lease fictício por vez',()=>{
 const m=fresh(),token=acquire(m);
 expect(token.actor).toBe('session-a');expect(token.epoch).toBe(0);
 const x=snapshotSyntheticStorageFailureMatrix(m);
 expect(x.phase).toBe('leased');expect(x.leaseOwner).toBe('session-a');
 expect(token.realLockAcquired).toBe(false);
});
test('sessão B não pode tomar lease mantido por A',()=>{
 const m=fresh();acquire(m);
 const b=acquireSyntheticStorageLease(m,'session-b',0);
 expect(b).toBeNull();
 const x=snapshotSyntheticStorageFailureMatrix(m);
 expect(x.lastOutcome).toBe('lease-conflict');
 expect(x.leaseOwner).toBe('session-a');expect(x.epoch).toBe(0);
});
test('sessão B só entra depois que A libera e geração avança',()=>{
 const m=fresh(),a=acquire(m);
 releaseSyntheticStorageLease(m,a);
 expect(acquireSyntheticStorageLease(m,'session-b',0)).toBeNull();
 expect(snapshotSyntheticStorageFailureMatrix(m).lastOutcome).toBe('stale-epoch');
 const b=acquire(m,'session-b');
 expect(b.epoch).toBe(1);
 expect(snapshotSyntheticStorageFailureMatrix(m).leaseOwner).toBe('session-b');
});
test('lease clonado ou falsificado nunca libera a sessão verdadeira',()=>{
 const m=fresh(),token=acquire(m);
 for(const fake of [{...token},JSON.parse(JSON.stringify(token))] as SyntheticStorageLease[]){
  expect(()=>releaseSyntheticStorageLease(m,fake)).toThrow('não vigente');
  expect(()=>inspectSyntheticStorageRecord(m,fake,copy())).toThrow('não vigente');
 }
 expect(snapshotSyntheticStorageFailureMatrix(m).leaseOwner).toBe('session-a');
});
test('lease de uma matriz não opera outra com mesma geração',()=>{
 const a=fresh(),b=fresh(),token=acquire(a);
 expect(()=>inspectSyntheticStorageRecord(b,token,copy())).toThrow('não vigente');
 expect(snapshotSyntheticStorageFailureMatrix(b).totalAttempts).toBe(0);
});
test('mesmo token depois de liberar torna-se obsoleto',()=>{
 const m=fresh(),token=acquire(m);
 releaseSyntheticStorageLease(m,token);
 expect(()=>releaseSyntheticStorageLease(m,token)).toThrow('não vigente');
 expect(()=>inspectSyntheticStorageRecord(m,token,copy())).toThrow('não vigente');
});
test('cópia estruturalmente válida não vira dado confiável',()=>{
 const m=fresh(),token=acquire(m);
 const x=inspectSyntheticStorageRecord(m,token,copy());
 expect(x.lastOutcome).toBe('structural-copy-untrusted');
 expect(x.totalAttempts).toBe(1);expect(x.corruptionDetected).toBe(false);
 expect(x.oldEvidenceReusable).toBe(false);expect(x.requiresNewAnalysis).toBe(true);
});
test('permissão artificial é tratada como registro corrompido',()=>{
 const m=fresh(),token=acquire(m);
 const x=inspectSyntheticStorageRecord(m,token,{...copy(),operationsEnabled:true});
 expect(x.lastOutcome).toBe('corrupt-record-rejected');
 expect(x.corruptionDetected).toBe(true);
 expect(x.operationsEnabled).toBe(false);expect(x.cryptographicIntegrityVerified).toBe(false);
});
test('campos extras, versão errada e evento apagado são recusados',()=>{
 const m=fresh(),token=acquire(m);
 const attempts=[
  {...copy(),path:'C:\\real'},
  {...copy(),schemaVersion:123},
  {...copy(),retainedEvents:[]},
  {...copy(),realVerified:true}
 ];
 for(const invalid of attempts){
  expect(inspectSyntheticStorageRecord(m,token,invalid).lastOutcome).toBe('corrupt-record-rejected');
 }
 expect(snapshotSyntheticStorageFailureMatrix(m).totalAttempts).toBe(4);
});
test('acessores hostis não são executados durante a verificação',()=>{
 const m=fresh(),token=acquire(m);
 const malicious=copy();
 Object.defineProperty(malicious,'totalEvents',{enumerable:true,get(){throw Error('getter executado')}});
 const x=inspectSyntheticStorageRecord(m,token,malicious);
 expect(x.lastOutcome).toBe('corrupt-record-rejected');
});
test('cópias com campos extras não afetam o registro real',()=>{
 const m=fresh(),token=acquire(m);
 inspectSyntheticStorageRecord(m,token,{...copy(),operationsEnabled:true});
 const x=inspectSyntheticStorageRecord(m,token,copy());
 expect(x.lastOutcome).toBe('structural-copy-untrusted');
 expect(x.corruptionDetected).toBe(true);
 expect(x.operationsEnabled).toBe(false);
});
test('queda da recuperação libera lease fictício e descarta qualquer parcial',()=>{
 const m=fresh(),token=acquire(m);
 inspectSyntheticStorageRecord(m,token,copy());
 const x=interruptSyntheticStorageRecovery(m,token);
 expect(x.phase).toBe('available');
 expect(x.lastOutcome).toBe('recovery-interrupted');
 expect(x.recoveryFailures).toBe(1);
 expect(x.leaseOwner).toBeNull();expect(x.lastIncompleteDiscarded).toBe(true);
 expect(x.epoch).toBe(1);
});
test('token de recuperação interrompida não pode ser reutilizado',()=>{
 const m=fresh(),token=acquire(m);
 interruptSyntheticStorageRecovery(m,token);
 expect(()=>inspectSyntheticStorageRecord(m,token,copy())).toThrow('não vigente');
 expect(()=>interruptSyntheticStorageRecovery(m,token)).toThrow('não vigente');
});
test('segunda sessão pode repetir a análise após a primeira falha, sem confiar no passado',()=>{
 const m=fresh(),a=acquire(m);
 interruptSyntheticStorageRecovery(m,a);
 const b=acquire(m,'session-b');
 const x=inspectSyntheticStorageRecord(m,b,copy());
 expect(x.leaseOwner).toBe('session-b');
 expect(x.recoveryFailures).toBe(1);expect(x.oldEvidenceReusable).toBe(false);
});
test('três interrupções independentes colocam a matriz em quarentena',()=>{
 const m=fresh();
 for(let i=0;i<3;i++){
  const token=acquire(m,i%2===0?'session-a':'session-b');
  const x=interruptSyntheticStorageRecovery(m,token);
  expect(x.recoveryFailures).toBe(i+1);
 }
 const final=snapshotSyntheticStorageFailureMatrix(m);
 expect(final.phase).toBe('quarantined');
 expect(final.quarantined).toBe(true);
 expect(final.leaseOwner).toBeNull();
 expect(acquireSyntheticStorageLease(m,'session-b',3)).toBeNull();
 expect(snapshotSyntheticStorageFailureMatrix(m).lastOutcome).toBe('quarantined');
});
test('quarentena não pode ser removida com geração nova ou antiga',()=>{
 const m=fresh();
 for(let i=0;i<3;i++)interruptSyntheticStorageRecovery(m,acquire(m));
 for(const gen of [0,1,3,999]){
  expect(acquireSyntheticStorageLease(m,'session-a',gen)).toBeNull();
 }
 expect(snapshotSyntheticStorageFailureMatrix(m).quarantined).toBe(true);
});
test('histórico preserva últimas oito tentativas e mantém numeração verdadeira',()=>{
 const m=fresh(),token=acquire(m);
 for(let i=0;i<11;i++)inspectSyntheticStorageRecord(m,token,copy());
 const x=snapshotSyntheticStorageFailureMatrix(m);
 expect(x.totalAttempts).toBe(11);
 expect(x.retainedAttempts).toHaveLength(SYNTHETIC_STORAGE_FAILURE_LIMITS.retainedAttempts);
 expect(x.droppedAttempts).toBe(3);
 expect(x.retainedAttempts.map(e=>e.attempt)).toEqual([4,5,6,7,8,9,10,11]);
 expect(x.historyWindowExceeded).toBe(true);
});
test('histórico ainda não esgotado não é marcado falsamente como perdido',()=>{
 const m=fresh(),token=acquire(m);
 for(let i=0;i<8;i++)inspectSyntheticStorageRecord(m,token,copy());
 const x=snapshotSyntheticStorageFailureMatrix(m);
 expect(x.historyWindowExceeded).toBe(false);
 expect(x.droppedAttempts).toBe(0);
});
test('limite global de 64 tentativas impede alteração depois de saturar',()=>{
 const m=fresh(),token=acquire(m);
 for(let i=0;i<64;i++)inspectSyntheticStorageRecord(m,token,copy());
 const before=snapshotSyntheticStorageFailureMatrix(m);
 expect(before.totalAttempts).toBe(SYNTHETIC_STORAGE_FAILURE_LIMITS.maxAttempts);
 expect(()=>inspectSyntheticStorageRecord(m,token,{...copy(),operationsEnabled:true})).toThrow('Limite global');
 expect(snapshotSyntheticStorageFailureMatrix(m)).toEqual(before);
 expect(()=>interruptSyntheticStorageRecovery(m,token)).toThrow('Limite global');
 expect(snapshotSyntheticStorageFailureMatrix(m)).toEqual(before);
});
test('histórico de conflitos também é limitado e não autoriza sessão B',()=>{
 const m=fresh();acquire(m);
 for(let i=0;i<10;i++)expect(acquireSyntheticStorageLease(m,'session-b',0)).toBeNull();
 const x=snapshotSyntheticStorageFailureMatrix(m);
 expect(x.totalAttempts).toBe(10);
 expect(x.droppedAttempts).toBe(2);expect(x.leaseOwner).toBe('session-a');
});
test('identidades inválidas, objetos falsos e números inseguros são rejeitados',()=>{
 const m=fresh();
 for(const gen of [-1,NaN,Infinity,1.5]){
  expect(()=>acquireSyntheticStorageLease(m,'session-a',gen)).toThrow('inválida');
 }
 expect(()=>acquireSyntheticStorageLease(m,'session-c' as 'session-a',0)).toThrow('inválida');
 for(const fake of [{...m},JSON.parse(JSON.stringify(m))] as SyntheticStorageFailureMatrix[]){
  expect(()=>snapshotSyntheticStorageFailureMatrix(fake)).toThrow('não emitida');
 }
});
test('resultados e limites são imutáveis e não expõem caminhos',()=>{
 const m=fresh(),token=acquire(m);
 const x=inspectSyntheticStorageRecord(m,token,copy());
 expect(Object.isFrozen(m)).toBe(true);expect(Object.isFrozen(token)).toBe(true);
 expect(Object.isFrozen(x)).toBe(true);expect(Object.isFrozen(x.retainedAttempts)).toBe(true);
 expect(Object.isFrozen(x.retainedAttempts[0])).toBe(true);
 expect(Object.isFrozen(SYNTHETIC_STORAGE_FAILURE_LIMITS)).toBe(true);
 const json=JSON.stringify(x)+JSON.stringify(token);
 for(const secret of ['def/fake.sii','C:\\','revisionTicket','synthetic-entry','PRIVATE_FILE'])
  expect(json).not.toContain(secret);
});
test('todos os cenários preservam ausência de provas reais e de operações',()=>{
 const m=fresh(),token=acquire(m);
 const snapshots=[snapshotSyntheticStorageFailureMatrix(m),
  inspectSyntheticStorageRecord(m,token,copy()),
  interruptSyntheticStorageRecovery(m,token)];
 for(const x of snapshots){
  expect(x.realLockHeld).toBe(false);
  expect(x.cryptographicIntegrityVerified).toBe(false);
  expect(x.persistenceVerified).toBe(false);expect(x.realProcessRestarted).toBe(false);
  expect(x.realBytesRead).toBe(0);expect(x.operationsEnabled).toBe(false);
  expect(x.oldEvidenceReusable).toBe(false);expect(x.requiresNewAnalysis).toBe(true);
 }
});
