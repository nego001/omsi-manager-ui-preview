import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {createSyntheticValidationReadiness} from '../src/synthetic-validation-readiness';
import {createSyntheticReadAdmissionSession} from '../src/synthetic-read-admission';
import {createSyntheticContainerReview,advanceSyntheticContainerReview,issueSyntheticStreamDeclarationSource,
 type SyntheticStreamDeclarationSource} from '../src/synthetic-container-screen';
import {createSyntheticStreamReview} from '../src/synthetic-stream-checkpoints';
import {
 createSyntheticReaderLifecycle,openSyntheticReaderLifecycle,stepSyntheticReaderLifecycle,
 closeSyntheticReaderLifecycle,simulateSyntheticReaderLifecycleProcessLoss,
 acknowledgeSyntheticReaderLifecycleLoss,beginSyntheticReaderLifecycleClose,
 type SyntheticReaderLifecycle
} from '../src/synthetic-reader-lifecycle';
import {
 createSyntheticOrphanRecovery,acknowledgeSyntheticOrphanRecovery,
 assessFreshSyntheticOrphanAnalysis,snapshotSyntheticOrphanRecovery,
 type SyntheticOrphanRecovery
} from '../src/synthetic-orphan-recovery';

const plan=createSyntheticValidationReadiness(createSyntheticDiagnosticDemo()[3].timeline);
const session=createSyntheticReadAdmissionSession(plan);
function screened(){
 const h=createSyntheticContainerReview(session,{format:'zip-declared',entries:[
  {path:'def/fake.sii',kind:'file',compression:'deflate',encodedBytes:400,expandedBytes:1000},
  {path:'sound/fake.ogg',kind:'file',compression:'deflate',encodedBytes:300,expandedBytes:700}
 ]});
 advanceSyntheticContainerReview(h);advanceSyntheticContainerReview(h);
 return issueSyntheticStreamDeclarationSource(h);
}
function life(src:SyntheticStreamDeclarationSource=screened(),bad=false){
 const chunks=src.entries.map((e,i)=>({
  entryOrdinal:e.ordinal,encodedBytes:e.encodedBytes,expandedBytes:e.expandedBytes,
  elapsedMs:bad&&i===0?251:10,endOfEntry:true
 }));
 const handle=createSyntheticReaderLifecycle(createSyntheticStreamReview(src,chunks));
 return handle;
}
function complete(handle:SyntheticReaderLifecycle){
 openSyntheticReaderLifecycle(handle);
 stepSyntheticReaderLifecycle(handle);stepSyntheticReaderLifecycle(handle);
 closeSyntheticReaderLifecycle(handle);return handle;
}
function orphan(){
 const h=life();openSyntheticReaderLifecycle(h);stepSyntheticReaderLifecycle(h);
 simulateSyntheticReaderLifecycleProcessLoss(h);return h;
}
test('registro não admite ciclo normal que concluiu de modo controlado',()=>{
 expect(()=>createSyntheticOrphanRecovery(complete(life()))).toThrow('Somente sessão abandonada');
 expect(()=>createSyntheticOrphanRecovery(life())).toThrow('Somente sessão abandonada');
});
test('cópia JSON e objeto falso de ciclo não iniciam recuperação',()=>{
 const h=orphan();
 for(const fake of [JSON.parse(JSON.stringify(h)),{...h}]){
  expect(()=>createSyntheticOrphanRecovery(fake)).toThrow('Ciclo sintético não emitido');
 }
});
test('abertura de recuperação invalida evidência antiga e permanece sem autorização',()=>{
 const h=orphan(),record=createSyntheticOrphanRecovery(h);
 const s=snapshotSyntheticOrphanRecovery(record);
 expect(s.phase).toBe('acknowledgement-required');
 expect(s.oldEvidenceInvalidated).toBe(true);expect(s.oldResultReusable).toBe(false);
 expect(s.freshIndependentScreeningObserved).toBe(false);
 expect(s.freshSyntheticDeclarations).toBe(0);expect(s.operationsEnabled).toBe(false);
 expect(s.realCleanupVerified).toBe(false);expect(s.realReanalysisVerified).toBe(false);
});
test('análise apresentada antes do reconhecimento nunca conta como nova',()=>{
 const record=createSyntheticOrphanRecovery(orphan());
 const x=assessFreshSyntheticOrphanAnalysis(record,complete(life()));
 expect(x.phase).toBe('acknowledgement-required');
 expect(x.lastAttempt).toBe('unacknowledged');
 expect(x.freshSyntheticDeclarations).toBe(0);
});
test('reconhecer abandono é registro local, não atesta limpeza do Windows',()=>{
 const record=createSyntheticOrphanRecovery(orphan());
 const x=acknowledgeSyntheticOrphanRecovery(record);
 expect(x.phase).toBe('fresh-screening-required');
 expect(x.realCleanupVerified).toBe(false);expect(x.oldResultReusable).toBe(false);
 expect(x.approvedForOperations).toBe(false);
});
test('reconhecimento é idempotente e não promove análise antiga',()=>{
 const record=createSyntheticOrphanRecovery(orphan());
 const a=acknowledgeSyntheticOrphanRecovery(record);
 expect(acknowledgeSyntheticOrphanRecovery(record)).toEqual(a);
 expect(a.freshIndependentScreeningObserved).toBe(false);
});
test('mesmo ciclo interrompido é rejeitado como substituto',()=>{
 const old=orphan(),record=createSyntheticOrphanRecovery(old);
 acknowledgeSyntheticOrphanRecovery(record);
 const result=assessFreshSyntheticOrphanAnalysis(record,old);
 expect(result.phase).toBe('fresh-screening-required');
 expect(result.lastAttempt).toBe('not-independent');
});
test('uma nova sessão baseada no MESMO catálogo é recusada apesar de objeto diferente',()=>{
 const src=screened();
 const previous=life(src);
 simulateSyntheticReaderLifecycleProcessLoss(previous);
 const record=createSyntheticOrphanRecovery(previous);
 acknowledgeSyntheticOrphanRecovery(record);
 const freshLooking=complete(life(src));
 const result=assessFreshSyntheticOrphanAnalysis(record,freshLooking);
 expect(result.lastAttempt).toBe('not-independent');
 expect(result.freshSyntheticDeclarations).toBe(0);
});
test('duas fontes emitidas pelo MESMO screening não são independentes',()=>{
 const h=createSyntheticContainerReview(session,{format:'zip-declared',entries:[
  {path:'def/repeat.sii',kind:'file',compression:'deflate',encodedBytes:100,expandedBytes:150}
 ]});
 advanceSyntheticContainerReview(h);
 const a=issueSyntheticStreamDeclarationSource(h),b=issueSyntheticStreamDeclarationSource(h);
 const previous=life(a);simulateSyntheticReaderLifecycleProcessLoss(previous);
 const record=createSyntheticOrphanRecovery(previous);acknowledgeSyntheticOrphanRecovery(record);
 const candidate=life(b);openSyntheticReaderLifecycle(candidate);stepSyntheticReaderLifecycle(candidate);closeSyntheticReaderLifecycle(candidate);
 expect(assessFreshSyntheticOrphanAnalysis(record,candidate).lastAttempt).toBe('not-independent');
});
test('nova triagem independente porém incompleta não é reconhecida como concluída',()=>{
 const record=createSyntheticOrphanRecovery(orphan());
 acknowledgeSyntheticOrphanRecovery(record);
 const incomplete=life();
 const result=assessFreshSyntheticOrphanAnalysis(record,incomplete);
 expect(result.lastAttempt).toBe('not-complete');
 expect(result.freshSyntheticDeclarations).toBe(0);
});
test('nova análise com falha e fechamento antecipado continua inválida',()=>{
 const record=createSyntheticOrphanRecovery(orphan());
 acknowledgeSyntheticOrphanRecovery(record);
 const failed=life(undefined,true);
 openSyntheticReaderLifecycle(failed);stepSyntheticReaderLifecycle(failed);
 expect(assessFreshSyntheticOrphanAnalysis(record,failed).lastAttempt).toBe('not-complete');
 const early=life();openSyntheticReaderLifecycle(early);closeSyntheticReaderLifecycle(early);
 expect(assessFreshSyntheticOrphanAnalysis(record,early).lastAttempt).toBe('not-complete');
});
test('triagem independente concluída é registrada somente como evidência fictícia nova',()=>{
 const record=createSyntheticOrphanRecovery(orphan());
 acknowledgeSyntheticOrphanRecovery(record);
 const fresh=complete(life());
 const result=assessFreshSyntheticOrphanAnalysis(record,fresh);
 expect(result.phase).toBe('new-fixture-reported');
 expect(result.freshIndependentScreeningObserved).toBe(true);
 expect(result.freshSyntheticDeclarations).toBe(2);
 expect(result.lastAttempt).toBe('accepted-fixture');
 expect(result.oldResultReusable).toBe(false);
 expect(result.realReanalysisVerified).toBe(false);
 expect(result.approvedForOperations).toBe(false);
});
test('após nova evidência fictícia relatório fica terminal e não reaproveita candidatos',()=>{
 const record=createSyntheticOrphanRecovery(orphan());
 acknowledgeSyntheticOrphanRecovery(record);
 const accepted=assessFreshSyntheticOrphanAnalysis(record,complete(life()));
 expect(assessFreshSyntheticOrphanAnalysis(record,complete(life()))).toEqual(accepted);
 expect(acknowledgeSyntheticOrphanRecovery(record)).toEqual(accepted);
});
test('revisão numérica falsamente avançada não satisfaz verificação original',()=>{
 const older=orphan(),record=createSyntheticOrphanRecovery(older);
 acknowledgeSyntheticOrphanRecovery(record);
 const foreign=complete(life());
 const fake={...foreign,revision:foreign.revision+1};
 expect(assessFreshSyntheticOrphanAnalysis(record,fake).lastAttempt).toBe('not-independent');
});
test('reconhecimento feito diretamente no ciclo antes de registrar recuperação é permitido',()=>{
 const old=orphan();
 acknowledgeSyntheticReaderLifecycleLoss(old);
 const record=createSyntheticOrphanRecovery(old);
 expect(snapshotSyntheticOrphanRecovery(record).phase).toBe('fresh-screening-required');
 expect(assessFreshSyntheticOrphanAnalysis(record,complete(life())).phase).toBe('new-fixture-reported');
});
test('perda durante começo do fechamento também exige nova análise',()=>{
 const h=life();
 openSyntheticReaderLifecycle(h);stepSyntheticReaderLifecycle(h);stepSyntheticReaderLifecycle(h);
 beginSyntheticReaderLifecycleClose(h);simulateSyntheticReaderLifecycleProcessLoss(h);
 const rec=createSyntheticOrphanRecovery(h);
 acknowledgeSyntheticOrphanRecovery(rec);
 expect(assessFreshSyntheticOrphanAnalysis(rec,complete(life())).phase).toBe('new-fixture-reported');
});
test('registro de recuperação forjado não pode reconhecer ou receber evidências',()=>{
 const rec=createSyntheticOrphanRecovery(orphan());
 for(const fake of [{...rec},JSON.parse(JSON.stringify(rec))] as SyntheticOrphanRecovery[]){
  expect(()=>snapshotSyntheticOrphanRecovery(fake)).toThrow('não emitida');
  expect(()=>acknowledgeSyntheticOrphanRecovery(fake)).toThrow('não emitida');
  expect(()=>assessFreshSyntheticOrphanAnalysis(fake,complete(life()))).toThrow('não emitida');
 }
});
test('recusa não destrói a possibilidade de apresentar uma nova análise legítima',()=>{
 const old=orphan(),record=createSyntheticOrphanRecovery(old);
 acknowledgeSyntheticOrphanRecovery(record);
 expect(assessFreshSyntheticOrphanAnalysis(record,old).lastAttempt).toBe('not-independent');
 const result=assessFreshSyntheticOrphanAnalysis(record,complete(life()));
 expect(result.phase).toBe('new-fixture-reported');
 expect(result.oldEvidenceInvalidated).toBe(true);
});
test('nenhum resultado expõe caminho, token, digest, handles ou recursos reais',()=>{
 const record=createSyntheticOrphanRecovery(orphan());
 acknowledgeSyntheticOrphanRecovery(record);
 const x=assessFreshSyntheticOrphanAnalysis(record,complete(life()));
 const serialized=JSON.stringify(record)+JSON.stringify(x);
 for(const word of ['def/fake.sii','sound/fake.ogg','C:\\','revisionTicket','synthetic-entry','PRIVATE_KEY']){
  expect(serialized).not.toContain(word);
 }
 expect(Object.isFrozen(record)).toBe(true);
 expect(Object.isFrozen(x)).toBe(true);
});
test('recuperação jamais transforma aprovação fictícia em autorização de mod',()=>{
 const record=createSyntheticOrphanRecovery(orphan());
 const initial=snapshotSyntheticOrphanRecovery(record);
 acknowledgeSyntheticOrphanRecovery(record);
 const final=assessFreshSyntheticOrphanAnalysis(record,complete(life()));
 for(const x of [initial,final]){
  expect(x.realBytesRead).toBe(0);expect(x.realCleanupVerified).toBe(false);
  expect(x.realFileIdentityVerified).toBe(false);expect(x.operationsEnabled).toBe(false);
  expect(x.approvedForOperations).toBe(false);expect(x.oldResultReusable).toBe(false);
 }
});
