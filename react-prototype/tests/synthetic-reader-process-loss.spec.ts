import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {createSyntheticValidationReadiness} from '../src/synthetic-validation-readiness';
import {createSyntheticReadAdmissionSession} from '../src/synthetic-read-admission';
import {createSyntheticContainerReview,advanceSyntheticContainerReview,
 issueSyntheticStreamDeclarationSource} from '../src/synthetic-container-screen';
import {createSyntheticStreamReview,advanceSyntheticStreamReview,
 snapshotSyntheticStreamReview} from '../src/synthetic-stream-checkpoints';
import {createSyntheticReaderLifecycle,openSyntheticReaderLifecycle,
 stepSyntheticReaderLifecycle,closeSyntheticReaderLifecycle,
 beginSyntheticReaderLifecycleClose,finishSyntheticReaderLifecycleClose,
 simulateSyntheticReaderLifecycleProcessLoss,acknowledgeSyntheticReaderLifecycleLoss,
 cancelSyntheticReaderLifecycle,snapshotSyntheticReaderLifecycle,
 type SyntheticReaderLifecycle} from '../src/synthetic-reader-lifecycle';
const plan=createSyntheticValidationReadiness(createSyntheticDiagnosticDemo()[3].timeline);
const session=createSyntheticReadAdmissionSession(plan);
function make(){
 const container=createSyntheticContainerReview(session,{format:'zip-declared',entries:[
  {path:'def/fake.sii',kind:'file',compression:'deflate',encodedBytes:400,expandedBytes:1000},
  {path:'sound/fake.ogg',kind:'file',compression:'deflate',encodedBytes:300,expandedBytes:700}
 ]});
 advanceSyntheticContainerReview(container);advanceSyntheticContainerReview(container);
 const source=issueSyntheticStreamDeclarationSource(container);
 const review=createSyntheticStreamReview(source,source.entries.map(e=>({
  entryOrdinal:e.ordinal,encodedBytes:e.encodedBytes,expandedBytes:e.expandedBytes,
  elapsedMs:10,endOfEntry:true
 })));
 return {review,handle:createSyntheticReaderLifecycle(review)};
}
function ready(handle:SyntheticReaderLifecycle){
 openSyntheticReaderLifecycle(handle);
 stepSyntheticReaderLifecycle(handle);stepSyntheticReaderLifecycle(handle);
 return snapshotSyntheticReaderLifecycle(handle);
}
test('perda de processo antes da abertura não confirma nenhuma limpeza real',()=>{
 const {handle}=make();
 const x=simulateSyntheticReaderLifecycleProcessLoss(handle);
 expect(x.phase).toBe('interrupted');expect(x.closeReason).toBe('process-lost');
 expect(x.recoveryRequired).toBe(true);expect(x.cleanupPerformed).toBe(false);
 expect(x.completedCleanupCount).toBe(0);expect(x.abandonedWithoutConfirmedClose).toBe(true);
 expect(x.realCleanupVerified).toBe(false);expect(x.operationsEnabled).toBe(false);
});
test('perda após a primeira entrada descarta contagens não publicadas',()=>{
 const {handle}=make();openSyntheticReaderLifecycle(handle);
 const mid=stepSyntheticReaderLifecycle(handle);
 expect(mid.declaredBytesProcessed).toBe(400);
 const lost=simulateSyntheticReaderLifecycleProcessLoss(handle);
 expect(lost.processedChunks).toBe(1);
 expect(lost.declaredBytesProcessed).toBe(0);
 expect(lost.completedDeclarations).toBe(0);
 expect(lost.discardedPartialResults).toBe(true);
 expect(lost.simulatedLeaseActive).toBe(false);
});
test('perda quando tudo está conferido mas não fechado não publica conclusões',()=>{
 const {handle}=make();
 expect(ready(handle).phase).toBe('ready-to-close');
 const lost=simulateSyntheticReaderLifecycleProcessLoss(handle);
 expect(lost.closeReason).toBe('process-lost');
 expect(lost.completedDeclarations).toBe(0);
 expect(lost.cleanupPerformed).toBe(false);
});
test('abertura de fechamento em duas etapas nunca publica resultados sozinha',()=>{
 const {handle}=make();ready(handle);
 const closing=beginSyntheticReaderLifecycleClose(handle);
 expect(closing.phase).toBe('closing');
 expect(closing.completedDeclarations).toBe(0);
 expect(closing.cleanupPerformed).toBe(false);
 expect(closing.simulatedLeaseActive).toBe(true);
});
test('confirmação explícita do fechamento publica somente totais fictícios',()=>{
 const {handle}=make();ready(handle);beginSyntheticReaderLifecycleClose(handle);
 const done=finishSyntheticReaderLifecycleClose(handle);
 expect(done.phase).toBe('closed');expect(done.closeReason).toBe('completed');
 expect(done.completedDeclarations).toBe(2);
 expect(done.completedCleanupCount).toBe(1);expect(done.cleanupPerformed).toBe(true);
 expect(done.realCleanupVerified).toBe(false);expect(done.nativeHandlesOpen).toBe(0);
});
test('interrupção exatamente entre começo e conclusão de fechamento invalida tudo',()=>{
 const {handle}=make();ready(handle);beginSyntheticReaderLifecycleClose(handle);
 const lost=simulateSyntheticReaderLifecycleProcessLoss(handle);
 expect(lost.phase).toBe('interrupted');
 expect(lost.closeReason).toBe('close-interrupted');
 expect(lost.completedDeclarations).toBe(0);
 expect(lost.completedCleanupCount).toBe(0);
 expect(lost.recoveryRequired).toBe(true);expect(lost.discardedPartialResults).toBe(true);
});
test('concluir fechamento depois de perda não permite publicação',()=>{
 const {handle}=make();ready(handle);beginSyntheticReaderLifecycleClose(handle);
 simulateSyntheticReaderLifecycleProcessLoss(handle);
 const x=finishSyntheticReaderLifecycleClose(handle);
 expect(x.phase).toBe('interrupted');
 expect(x.completedDeclarations).toBe(0);
 expect(x.cleanupPerformed).toBe(false);
});
test('reconhecer abandono muda apenas estado local, sem atestar limpeza',()=>{
 const {handle}=make();ready(handle);beginSyntheticReaderLifecycleClose(handle);
 simulateSyntheticReaderLifecycleProcessLoss(handle);
 const rec=acknowledgeSyntheticReaderLifecycleLoss(handle);
 expect(rec.phase).toBe('closed');expect(rec.recoveryRequired).toBe(false);
 expect(rec.abandonedWithoutConfirmedClose).toBe(true);
 expect(rec.completedDeclarations).toBe(0);expect(rec.cleanupPerformed).toBe(false);
 expect(rec.completedCleanupCount).toBe(0);expect(rec.realCleanupVerified).toBe(false);
});
test('reconhecimento do abandono não reabre sessão nem cria resultado',()=>{
 const {handle}=make();openSyntheticReaderLifecycle(handle);
 simulateSyntheticReaderLifecycleProcessLoss(handle);
 const a=acknowledgeSyntheticReaderLifecycleLoss(handle);
 expect(openSyntheticReaderLifecycle(handle)).toEqual(a);
 expect(stepSyntheticReaderLifecycle(handle)).toEqual(a);
 expect(closeSyntheticReaderLifecycle(handle)).toEqual(a);
 expect(finishSyntheticReaderLifecycleClose(handle)).toEqual(a);
});
test('cancelar durante interrupção não a disfarça como limpeza concluída',()=>{
 const {handle}=make();openSyntheticReaderLifecycle(handle);
 const a=simulateSyntheticReaderLifecycleProcessLoss(handle);
 expect(cancelSyntheticReaderLifecycle(handle)).toEqual(a);
 expect(closeSyntheticReaderLifecycle(handle)).toEqual(a);
 expect(a.cleanupPerformed).toBe(false);
});
test('perdas repetidas e reconciliação repetida não mudam a auditoria',()=>{
 const {handle}=make();
 const first=simulateSyntheticReaderLifecycleProcessLoss(handle);
 expect(simulateSyntheticReaderLifecycleProcessLoss(handle)).toEqual(first);
 const ack=acknowledgeSyntheticReaderLifecycleLoss(handle);
 expect(acknowledgeSyntheticReaderLifecycleLoss(handle)).toEqual(ack);
 expect(simulateSyntheticReaderLifecycleProcessLoss(handle)).toEqual(ack);
});
test('um fluxo perdido continua reivindicado e não pode originar segunda sessão',()=>{
 const {handle,review}=make();
 simulateSyntheticReaderLifecycleProcessLoss(handle);
 acknowledgeSyntheticReaderLifecycleLoss(handle);
 expect(()=>createSyntheticReaderLifecycle(review)).toThrow('já utilizado');
});
test('fechamento iniciado duas vezes não conclui nem duplica limpeza',()=>{
 const {handle}=make();ready(handle);
 const a=beginSyntheticReaderLifecycleClose(handle);
 expect(beginSyntheticReaderLifecycleClose(handle)).toEqual(a);
 expect(a.completedDeclarations).toBe(0);
 const done=finishSyntheticReaderLifecycleClose(handle);
 expect(finishSyntheticReaderLifecycleClose(handle)).toEqual(done);
 expect(done.completedCleanupCount).toBe(1);
});
test('fechamento convencional permanece compatível após começo em duas etapas',()=>{
 const {handle}=make();ready(handle);beginSyntheticReaderLifecycleClose(handle);
 const done=closeSyntheticReaderLifecycle(handle);
 expect(done.phase).toBe('closed');expect(done.closeReason).toBe('completed');
 expect(done.completedDeclarations).toBe(2);
});
test('tentativa de começar confirmação de fechamento antes de pronto não faz nada',()=>{
 const {handle}=make();
 const before=snapshotSyntheticReaderLifecycle(handle);
 expect(beginSyntheticReaderLifecycleClose(handle)).toEqual(before);
 expect(finishSyntheticReaderLifecycleClose(handle)).toEqual(before);
 openSyntheticReaderLifecycle(handle);
 const opened=snapshotSyntheticReaderLifecycle(handle);
 expect(beginSyntheticReaderLifecycleClose(handle)).toEqual(opened);
});
test('comandos externos em um handle falso são rejeitados inclusive interrupção e recuperação',()=>{
 const {handle}=make();
 for(const fake of [{...handle},JSON.parse(JSON.stringify(handle))]){
  const h=fake as SyntheticReaderLifecycle;
  expect(()=>simulateSyntheticReaderLifecycleProcessLoss(h)).toThrow('não emitido');
  expect(()=>acknowledgeSyntheticReaderLifecycleLoss(h)).toThrow('não emitido');
  expect(()=>beginSyntheticReaderLifecycleClose(h)).toThrow('não emitido');
  expect(()=>finishSyntheticReaderLifecycleClose(h)).toThrow('não emitido');
 }
});
test('sessão normalmente fechada não é transformada em processo perdido',()=>{
 const {handle}=make();ready(handle);
 const done=closeSyntheticReaderLifecycle(handle);
 expect(simulateSyntheticReaderLifecycleProcessLoss(handle)).toEqual(done);
 expect(done.abandonedWithoutConfirmedClose).toBe(false);
});
test('checkpoint de interrupção é imutável e não revela caminhos ou tokens',()=>{
 const {handle}=make();ready(handle);beginSyntheticReaderLifecycleClose(handle);
 const x=simulateSyntheticReaderLifecycleProcessLoss(handle);
 expect(Object.isFrozen(x)).toBe(true);expect(Object.isFrozen(handle)).toBe(true);
 const text=JSON.stringify(handle)+JSON.stringify(x);
 for(const secret of ['def/fake.sii','sound/fake.ogg','C:\\','revisionTicket','synthetic-entry']){
  expect(text).not.toContain(secret);
 }
});
test('um estado interrompido nunca comprova recursos reais fechados, bytes ou operações',()=>{
 for(const setup of [
  (h:SyntheticReaderLifecycle)=>openSyntheticReaderLifecycle(h),
  (h:SyntheticReaderLifecycle)=>ready(h),
  (h:SyntheticReaderLifecycle)=>{ready(h);beginSyntheticReaderLifecycleClose(h);}
 ]){
  const {handle}=make();setup(handle);
  const x=simulateSyntheticReaderLifecycleProcessLoss(handle);
  expect(x.nativeHandlesOpen).toBe(0);expect(x.realBytesRead).toBe(0);
  expect(x.realResourcesAllocated).toBe(false);
  expect(x.realFileAccessGranted).toBe(false);
  expect(x.realCleanupVerified).toBe(false);
  expect(x.operationsEnabled).toBe(false);
 }
});
