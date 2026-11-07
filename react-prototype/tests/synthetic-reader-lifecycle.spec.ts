import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {createSyntheticValidationReadiness} from '../src/synthetic-validation-readiness';
import {createSyntheticReadAdmissionSession} from '../src/synthetic-read-admission';
import {
 createSyntheticContainerReview,advanceSyntheticContainerReview,
 issueSyntheticStreamDeclarationSource,type SyntheticStreamDeclarationSource
} from '../src/synthetic-container-screen';
import {
 createSyntheticStreamReview,advanceSyntheticStreamReview,cancelSyntheticStreamReview
} from '../src/synthetic-stream-checkpoints';
import {
 createSyntheticReaderLifecycle,openSyntheticReaderLifecycle,stepSyntheticReaderLifecycle,
 closeSyntheticReaderLifecycle,cancelSyntheticReaderLifecycle,
 snapshotSyntheticReaderLifecycle,type SyntheticReaderLifecycle
} from '../src/synthetic-reader-lifecycle';

const plan=createSyntheticValidationReadiness(createSyntheticDiagnosticDemo()[3].timeline);
const session=createSyntheticReadAdmissionSession(plan);
function source():SyntheticStreamDeclarationSource{
 const h=createSyntheticContainerReview(session,{format:'zip-declared',entries:[
  {path:'def/a.sii',kind:'file',compression:'deflate',encodedBytes:400,expandedBytes:1000},
  {path:'sound/b.ogg',kind:'file',compression:'deflate',encodedBytes:300,expandedBytes:700}
 ]});
 advanceSyntheticContainerReview(h);advanceSyntheticContainerReview(h);
 return issueSyntheticStreamDeclarationSource(h);
}
function stream(options:{invalid?:boolean;partial?:boolean;empty?:boolean}={}){
 const s=source(),chunks=s.entries.map((entry,i)=>({
  entryOrdinal:entry.ordinal,encodedBytes:entry.encodedBytes,
  expandedBytes:entry.expandedBytes,elapsedMs:options.invalid&&i===0?251:10,
  endOfEntry:true
 }));
 if(options.partial)chunks[0]={...chunks[0],encodedBytes:200,expandedBytes:500,endOfEntry:false};
 if(options.empty)chunks.length=0;
 return createSyntheticStreamReview(s,chunks);
}
function cycle(options:{invalid?:boolean;partial?:boolean;empty?:boolean}={}){
 return createSyntheticReaderLifecycle(stream(options));
}
test('sessão nasce sem abrir arquivo nem conceder acesso nativo',()=>{
 const h=cycle(),r=snapshotSyntheticReaderLifecycle(h);
 expect(r.phase).toBe('created');expect(r.cleanupPerformed).toBe(false);
 expect(r.simulatedLeaseActive).toBe(false);expect(r.nativeHandlesOpen).toBe(0);
 expect(r.realBytesRead).toBe(0);expect(r.realResourcesAllocated).toBe(false);
 expect(r.operationsEnabled).toBe(false);
});
test('abertura só avança o estado simulado, sem handle real',()=>{
 const h=cycle(),r=openSyntheticReaderLifecycle(h);
 expect(r.phase).toBe('simulated-open');expect(r.simulatedLeaseActive).toBe(true);
 expect(r.nativeHandlesOpen).toBe(0);expect(r.realFileAccessGranted).toBe(false);
 expect(r.realCleanupVerified).toBe(false);
});
test('sem abrir, passo de leitura não processa declarações',()=>{
 const h=cycle(),r=stepSyntheticReaderLifecycle(h);
 expect(r.phase).toBe('created');expect(r.processedChunks).toBe(0);
});
test('passos completam catálogo antes de autorizar fechamento da simulação',()=>{
 const h=cycle();openSyntheticReaderLifecycle(h);
 const first=stepSyntheticReaderLifecycle(h);
 expect(first.phase).toBe('simulated-open');expect(first.processedChunks).toBe(1);
 expect(first.completedDeclarations).toBe(0);expect(first.declaredBytesProcessed).toBe(400);
 const last=stepSyntheticReaderLifecycle(h);
 expect(last.phase).toBe('ready-to-close');expect(last.processedChunks).toBe(2);
 expect(last.completedDeclarations).toBe(0);expect(last.cleanupPerformed).toBe(false);
 expect(last.simulatedLeaseActive).toBe(true);
});
test('fechamento explícito publica só totais fictícios e limpa uma vez',()=>{
 const h=cycle();openSyntheticReaderLifecycle(h);
 stepSyntheticReaderLifecycle(h);stepSyntheticReaderLifecycle(h);
 const r=closeSyntheticReaderLifecycle(h);
 expect(r.phase).toBe('closed');expect(r.closeReason).toBe('completed');
 expect(r.completedDeclarations).toBe(2);
 expect(r.declaredBytesProcessed).toBe(0);
 expect(r.cleanupPerformed).toBe(true);expect(r.completedCleanupCount).toBe(1);
 expect(r.simulatedLeaseActive).toBe(false);expect(r.operationsEnabled).toBe(false);
});
test('fechar antes de abrir fica fechado e sem publicação',()=>{
 const h=cycle(),r=closeSyntheticReaderLifecycle(h);
 expect(r.phase).toBe('closed');expect(r.closeReason).toBe('closed-before-open');
 expect(r.discardedPartialResults).toBe(true);expect(r.completedDeclarations).toBe(0);
});
test('fechar após um bloco descarta dados intermediários',()=>{
 const h=cycle();openSyntheticReaderLifecycle(h);
 expect(stepSyntheticReaderLifecycle(h).declaredBytesProcessed).toBe(400);
 const r=closeSyntheticReaderLifecycle(h);
 expect(r.closeReason).toBe('premature-close');expect(r.phase).toBe('closed');
 expect(r.discardedPartialResults).toBe(true);expect(r.declaredBytesProcessed).toBe(0);
 expect(r.completedCleanupCount).toBe(1);
});
test('cancelar antes de abrir também produz fechamento terminal',()=>{
 const h=cycle(),r=cancelSyntheticReaderLifecycle(h);
 expect(r.phase).toBe('closed');expect(r.closeReason).toBe('cancelled');
 expect(r.cleanupPerformed).toBe(true);expect(r.simulatedLeaseActive).toBe(false);
});
test('cancelar durante a entrada interrompe sem liberar declaração',()=>{
 const h=cycle({partial:true});openSyntheticReaderLifecycle(h);
 expect(stepSyntheticReaderLifecycle(h).processedChunks).toBe(1);
 const r=cancelSyntheticReaderLifecycle(h);
 expect(r.phase).toBe('closed');expect(r.closeReason).toBe('cancelled');
 expect(r.completedDeclarations).toBe(0);expect(r.discardedPartialResults).toBe(true);
 expect(r.declaredBytesProcessed).toBe(0);
});
test('falha de limite temporal chama limpeza automática em vez de continuar',()=>{
 const h=cycle({invalid:true});openSyntheticReaderLifecycle(h);
 const r=stepSyntheticReaderLifecycle(h);
 expect(r.phase).toBe('closed');expect(r.closeReason).toBe('blocked');
 expect(r.processedChunks).toBe(0);expect(r.cleanupPerformed).toBe(true);
 expect(r.completedDeclarations).toBe(0);
});
test('truncamento fecha e descarta sem permitir publicação parcial',()=>{
 const h=cycle({empty:true});openSyntheticReaderLifecycle(h);
 const r=stepSyntheticReaderLifecycle(h);
 expect(r.phase).toBe('closed');expect(r.closeReason).toBe('blocked');
 expect(r.discardedPartialResults).toBe(true);
});
test('fechamento e cancelamento repetidos são idempotentes e não duplicam limpeza',()=>{
 const h=cycle();openSyntheticReaderLifecycle(h);stepSyntheticReaderLifecycle(h);
 const once=cancelSyntheticReaderLifecycle(h);
 expect(cancelSyntheticReaderLifecycle(h)).toEqual(once);
 expect(closeSyntheticReaderLifecycle(h)).toEqual(once);
 expect(stepSyntheticReaderLifecycle(h)).toEqual(once);
 expect(openSyntheticReaderLifecycle(h)).toEqual(once);
 expect(once.completedCleanupCount).toBe(1);
});
test('tentativa de reaproveitar o mesmo fluxo na segunda sessão falha',()=>{
 const review=stream(),first=createSyntheticReaderLifecycle(review);
 expect(()=>createSyntheticReaderLifecycle(review)).toThrow('já utilizado');
 expect(first.nativeHandleIssued).toBe(false);
});
test('revisão clonada e sessão falsificada não têm direito a checkpoint',()=>{
 const h=cycle();
 for(const bad of [{...h},JSON.parse(JSON.stringify(h)),{...h,nativeHandleIssued:true}]){
  expect(()=>snapshotSyntheticReaderLifecycle(bad as SyntheticReaderLifecycle)).toThrow('não emitido');
  expect(()=>openSyntheticReaderLifecycle(bad as SyntheticReaderLifecycle)).toThrow('não emitido');
 }
});
test('fluxo sintético falso ou já adiantado não permite novo ciclo',()=>{
 const legitimate=stream();
 expect(()=>createSyntheticReaderLifecycle({...legitimate})).toThrow('não emitido');
 advanceSyntheticStreamReview(legitimate);
 expect(()=>createSyntheticReaderLifecycle(legitimate)).toThrow('não inicializado');
});
test('mudança fora do ciclo é detectada, fecha e descarta',()=>{
 const underlying=stream(),h=createSyntheticReaderLifecycle(underlying);
 openSyntheticReaderLifecycle(h);
 advanceSyntheticStreamReview(underlying);
 const r=stepSyntheticReaderLifecycle(h);
 expect(r.phase).toBe('closed');expect(r.closeReason).toBe('external-mutation');
 expect(r.discardedPartialResults).toBe(true);expect(r.completedDeclarations).toBe(0);
});
test('cancelamento do fluxo subjacente força encerramento do ciclo',()=>{
 const underlying=stream(),h=createSyntheticReaderLifecycle(underlying);
 openSyntheticReaderLifecycle(h);cancelSyntheticStreamReview(underlying);
 const r=stepSyntheticReaderLifecycle(h);
 expect(r.phase).toBe('closed');expect(r.closeReason).toBe('external-mutation');
 expect(r.cleanupPerformed).toBe(true);
});
test('não libera conclusão antes de fechamento expresso, ainda com todos blocos',()=>{
 const h=cycle();openSyntheticReaderLifecycle(h);
 stepSyntheticReaderLifecycle(h);const ready=stepSyntheticReaderLifecycle(h);
 expect(ready.phase).toBe('ready-to-close');expect(ready.completedDeclarations).toBe(0);
 expect(stepSyntheticReaderLifecycle(h)).toEqual(ready);
 expect(closeSyntheticReaderLifecycle(h).completedDeclarations).toBe(2);
});
test('snapshots imutáveis não expõem conteúdo, caminhos ou digests',()=>{
 const h=cycle(),a=openSyntheticReaderLifecycle(h),b=cancelSyntheticReaderLifecycle(h);
 for(const x of [h,a,b])expect(Object.isFrozen(x)).toBe(true);
 const serialized=JSON.stringify({h,a,b});
 for(const secret of ['def/a.sii','sound/b.ogg','Vehicles/','revisionTicket','synthetic-entry','PRIVATE_FILE','C:\\'])
  expect(serialized).not.toContain(secret);
});
test('todos os estados mantêm zero bytes reais, recursos reais e operações',()=>{
 const h=cycle(),all=[snapshotSyntheticReaderLifecycle(h),openSyntheticReaderLifecycle(h),
  stepSyntheticReaderLifecycle(h),stepSyntheticReaderLifecycle(h),closeSyntheticReaderLifecycle(h)];
 for(const x of all){
  expect(x.nativeHandlesOpen).toBe(0);expect(x.realBytesRead).toBe(0);
  expect(x.realResourcesAllocated).toBe(false);expect(x.realCleanupVerified).toBe(false);
  expect(x.realFileAccessGranted).toBe(false);expect(x.operationsEnabled).toBe(false);
 }
});
