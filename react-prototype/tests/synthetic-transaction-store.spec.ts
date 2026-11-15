import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {createSyntheticValidationReadiness} from '../src/synthetic-validation-readiness';
import {createSyntheticReadAdmissionSession} from '../src/synthetic-read-admission';
import {createSyntheticContainerReview,advanceSyntheticContainerReview,issueSyntheticStreamDeclarationSource} from '../src/synthetic-container-screen';
import {createSyntheticStreamReview} from '../src/synthetic-stream-checkpoints';
import {createSyntheticReaderLifecycle,openSyntheticReaderLifecycle,stepSyntheticReaderLifecycle,
 simulateSyntheticReaderLifecycleProcessLoss} from '../src/synthetic-reader-lifecycle';
import {createSyntheticOrphanRecovery} from '../src/synthetic-orphan-recovery';
import {createSyntheticRestartDraft,type SyntheticRestartDraft} from '../src/synthetic-restart-handoff';
import {createSyntheticTransactionStore,prepareSyntheticTransaction,markSyntheticTransactionCommitIntent,
 confirmSyntheticTransaction,simulateSyntheticTransactionPowerLoss,
 reconcileSyntheticTransactionAfterLoss,snapshotSyntheticTransactionStore,
 SYNTHETIC_TX_HISTORY_LIMIT,type SyntheticTransactionStore,type SyntheticTransactionToken} from '../src/synthetic-transaction-store';
const plan=createSyntheticValidationReadiness(createSyntheticDiagnosticDemo()[3].timeline);
const admission=createSyntheticReadAdmissionSession(plan);
function orphan(){
 const catalog=createSyntheticContainerReview(admission,{format:'zip-declared',entries:[
  {path:'def/fake.sii',kind:'file',compression:'deflate',encodedBytes:100,expandedBytes:300}
 ]});
 advanceSyntheticContainerReview(catalog);
 const source=issueSyntheticStreamDeclarationSource(catalog);
 const e=source.entries[0];
 const chunk=createSyntheticStreamReview(source,[{entryOrdinal:e.ordinal,encodedBytes:e.encodedBytes,
  expandedBytes:e.expandedBytes,elapsedMs:5,endOfEntry:true}]);
 const life=createSyntheticReaderLifecycle(chunk);
 openSyntheticReaderLifecycle(life);stepSyntheticReaderLifecycle(life);
 simulateSyntheticReaderLifecyclePowerless(life);
 return createSyntheticOrphanRecovery(life);
}
function simulateSyntheticReaderLifecyclePowerless(life:ReturnType<typeof createSyntheticReaderLifecycle>){
 simulateSyntheticReaderLifecycleProcessLoss(life);
}
const rec=orphan();
const draft=()=>createSyntheticRestartDraft(rec);
function prepared(store:SyntheticTransactionStore,expected=0){
 return prepareSyntheticTransaction(store,draft(),expected);
}
function committed(store:SyntheticTransactionStore,expected=0){
 const token=prepared(store,expected);
 markSyntheticTransactionCommitIntent(store,token);
 return {token,result:confirmSyntheticTransaction(store,token)};
}
test('armazenamento criado não reserva recurso nativo nem altera evidências antigas',()=>{
 const x=snapshotSyntheticTransactionStore(createSyntheticTransactionStore());
 expect(x.phase).toBe('empty');expect(x.generation).toBe(0);
 expect(x.pendingGeneration).toBeNull();expect(x.committedEntries).toHaveLength(0);
 expect(x.actuallyPersisted).toBe(false);expect(x.operationsEnabled).toBe(false);
 expect(x.requiresNewAnalysis).toBe(true);
});
test('preparar reserva apenas a próxima geração declarativa',()=>{
 const store=createSyntheticTransactionStore(),token=prepared(store);
 const x=snapshotSyntheticTransactionStore(store);
 expect(token.generation).toBe(1);
 expect(x.phase).toBe('prepared');expect(x.pendingGeneration).toBe(1);
 expect(x.generation).toBe(0);expect(x.committedEntries).toHaveLength(0);
});
test('intenção separada de confirmação não publica nenhum resultado parcial',()=>{
 const store=createSyntheticTransactionStore(),token=prepared(store);
 const x=markSyntheticTransactionCommitIntent(store,token);
 expect(x.phase).toBe('commit-intent');expect(x.generation).toBe(0);
 expect(x.committedEntries).toHaveLength(0);expect(x.oldEvidenceReusable).toBe(false);
});
test('confirmar depois de preparar e sinalizar intenção registra só resumo fictício',()=>{
 const store=createSyntheticTransactionStore();
 const {result}=committed(store);
 expect(result.phase).toBe('recorded');expect(result.generation).toBe(1);
 expect(result.committedEntries).toEqual([{generation:1,declaredEvents:2,
  previousState:'incomplete',dataTrusted:false}]);
 expect(result.pendingGeneration).toBeNull();expect(result.actuallyPersisted).toBe(false);
 expect(result.cryptographicIntegrityVerified).toBe(false);
});
test('confirmação sem intenção é recusada sem alterar estado',()=>{
 const store=createSyntheticTransactionStore(),token=prepared(store);
 const before=snapshotSyntheticTransactionStore(store);
 expect(()=>confirmSyntheticTransaction(store,token)).toThrow('Token fictício');
 expect(snapshotSyntheticTransactionStore(store)).toEqual(before);
});
test('intenção sem preparação válida não é permitida',()=>{
 const a=createSyntheticTransactionStore(),b=createSyntheticTransactionStore(),token=prepared(a);
 const before=snapshotSyntheticTransactionStore(b);
 expect(()=>markSyntheticTransactionCommitIntent(b,token)).toThrow('Token fictício');
 expect(snapshotSyntheticTransactionStore(b)).toEqual(before);
});
test('clone de token não funciona mesmo com os mesmos campos públicos',()=>{
 const store=createSyntheticTransactionStore(),token=prepared(store);
 for(const fake of [{...token},JSON.parse(JSON.stringify(token))] as SyntheticTransactionToken[]){
  expect(()=>markSyntheticTransactionCommitIntent(store,fake)).toThrow('Token fictício');
 }
 expect(snapshotSyntheticTransactionStore(store).phase).toBe('prepared');
});
test('rascunho copiado não pode abrir transação',()=>{
 const store=createSyntheticTransactionStore(),raw=draft();
 for(const fake of [{...raw},JSON.parse(JSON.stringify(raw))] as SyntheticRestartDraft[]){
  expect(()=>prepareSyntheticTransaction(store,fake,0)).toThrow('não emitido');
 }
 expect(snapshotSyntheticTransactionStore(store).generation).toBe(0);
});
test('rascunho emitido não pode ser apresentado duas vezes',()=>{
 const draftSource=draft(),a=createSyntheticTransactionStore(),b=createSyntheticTransactionStore();
 prepareSyntheticTransaction(a,draftSource,0);
 expect(()=>prepareSyntheticTransaction(b,draftSource,0)).toThrow('já usado');
});
test('compare-and-swap impede geração antiga e números malformados',()=>{
 const store=createSyntheticTransactionStore();
 committed(store);
 const before=snapshotSyntheticTransactionStore(store);
 for(const v of [0,-1,NaN,1.2,Infinity,Number.MAX_SAFE_INTEGER+1]){
  expect(()=>prepareSyntheticTransaction(store,draft(),v)).toThrow('Versão de transação desatualizada');
 }
 expect(snapshotSyntheticTransactionStore(store)).toEqual(before);
});
test('gerações novas só podem ser emitidas com geração atual correta',()=>{
 const store=createSyntheticTransactionStore();
 committed(store);
 const token=prepared(store,1);
 expect(token.generation).toBe(2);
 markSyntheticTransactionCommitIntent(store,token);
 const x=confirmSyntheticTransaction(store,token);
 expect(x.committedEntries.map(e=>e.generation)).toEqual([1,2]);
});
test('queda durante preparação deixa a transação interrompida e invisível',()=>{
 const store=createSyntheticTransactionStore();
 prepared(store);
 const lost=simulateSyntheticTransactionPowerLoss(store);
 expect(lost.phase).toBe('interrupted');
 expect(lost.discardedPending).toBe(true);
 expect(lost.generation).toBe(0);
 expect(lost.committedEntries).toHaveLength(0);
});
test('reconciliação após preparação abandona o candidato não confirmado',()=>{
 const store=createSyntheticTransactionStore();
 prepared(store);
 simulateSyntheticTransactionPowerLoss(store);
 const x=reconcileSyntheticTransactionAfterLoss(store);
 expect(x.phase).toBe('empty');expect(x.lastRecovery).toBe('discarded-prepared');
 expect(x.discardedPending).toBe(true);expect(x.generation).toBe(0);
});
test('queda durante intenção também nunca vira confirmação automática',()=>{
 const store=createSyntheticTransactionStore(),token=prepared(store);
 markSyntheticTransactionCommitIntent(store,token);
 simulateSyntheticTransactionPowerLoss(store);
 const x=reconcileSyntheticTransactionAfterLoss(store);
 expect(x.lastRecovery).toBe('discarded-intent');
 expect(x.phase).toBe('empty');expect(x.committedEntries).toHaveLength(0);
 expect(()=>confirmSyntheticTransaction(store,token)).toThrow('Token fictício');
});
test('queda depois de confirmação guarda resumo mas sem restaurar confiança',()=>{
 const store=createSyntheticTransactionStore();
 committed(store);
 simulateSyntheticTransactionPowerLoss(store);
 const x=reconcileSyntheticTransactionAfterLoss(store);
 expect(x.phase).toBe('recorded');expect(x.lastRecovery).toBe('retained-untrusted');
 expect(x.committedEntries).toHaveLength(1);
 expect(x.committedEntries[0].dataTrusted).toBe(false);
 expect(x.requiresNewAnalysis).toBe(true);expect(x.oldEvidenceReusable).toBe(false);
});
test('queda sobre estado vazio não cria registro nem limpeza real',()=>{
 const store=createSyntheticTransactionStore();
 simulateSyntheticTransactionPowerLoss(store);
 const x=reconcileSyntheticTransactionAfterLoss(store);
 expect(x.phase).toBe('empty');expect(x.lastRecovery).toBe('empty-untrusted');
 expect(x.realResourcesCleaned).toBe(false);expect(x.processRestarted).toBe(false);
});
test('sem conciliar interrupção não é possível preparar outro registro',()=>{
 const store=createSyntheticTransactionStore();
 prepared(store);simulateSyntheticTransactionPowerLoss(store);
 expect(()=>prepareSyntheticTransaction(store,draft(),0)).toThrow('não conciliada');
 reconcileSyntheticTransactionAfterLoss(store);
 expect(prepareSyntheticTransaction(store,draft(),0).generation).toBe(1);
});
test('queda não permite reutilizar token da sessão interrompida',()=>{
 const store=createSyntheticTransactionStore(),token=prepared(store);
 simulateSyntheticTransactionPowerLoss(store);
 reconcileSyntheticTransactionAfterLoss(store);
 expect(()=>markSyntheticTransactionCommitIntent(store,token)).toThrow('Token fictício');
});
test('confirmação repetida falha fechada e não duplica a geração',()=>{
 const store=createSyntheticTransactionStore();
 const {token,result}=committed(store);
 expect(()=>confirmSyntheticTransaction(store,token)).toThrow('Token fictício');
 expect(snapshotSyntheticTransactionStore(store)).toEqual(result);
});
test('quedas repetidas e conciliações repetidas não duplicam resumos',()=>{
 const store=createSyntheticTransactionStore();
 committed(store);
 const lost=simulateSyntheticTransactionPowerLoss(store);
 expect(simulateSyntheticTransactionPowerLoss(store)).toEqual(lost);
 const recovered=reconcileSyntheticTransactionAfterLoss(store);
 expect(reconcileSyntheticTransactionAfterLoss(store)).toEqual(recovered);
 expect(recovered.committedEntries).toHaveLength(1);
});
test('histórico em memória só preserva as últimas oito gerações fictícias',()=>{
 const store=createSyntheticTransactionStore();
 for(let gen=0;gen<11;gen++)committed(store,gen);
 const x=snapshotSyntheticTransactionStore(store);
 expect(x.generation).toBe(11);expect(x.committedEntries).toHaveLength(SYNTHETIC_TX_HISTORY_LIMIT);
 expect(x.committedEntries.map(e=>e.generation)).toEqual([4,5,6,7,8,9,10,11]);
});
test('queda entre duas gerações preserva só última confirmação não confiável',()=>{
 const store=createSyntheticTransactionStore();
 committed(store);
 const token=prepared(store,1);
 markSyntheticTransactionCommitIntent(store,token);
 simulateSyntheticTransactionPowerLoss(store);
 const x=reconcileSyntheticTransactionAfterLoss(store);
 expect(x.generation).toBe(1);expect(x.committedEntries).toHaveLength(1);
 expect(x.lastRecovery).toBe('discarded-intent');
 expect(x.oldEvidenceReusable).toBe(false);
});
test('store forjado não pode receber token ou simular recuperação',()=>{
 const original=createSyntheticTransactionStore();
 for(const bad of [{...original},JSON.parse(JSON.stringify(original))] as SyntheticTransactionStore[]){
  expect(()=>snapshotSyntheticTransactionStore(bad)).toThrow('não emitido');
  expect(()=>simulateSyntheticTransactionPowerLoss(bad)).toThrow('não emitido');
  expect(()=>prepareSyntheticTransaction(bad,draft(),0)).toThrow('não emitido');
 }
});
test('todos os snapshots e resumos são imutáveis e não contêm paths privados',()=>{
 const store=createSyntheticTransactionStore();
 const {token,result}=committed(store);
 expect(Object.isFrozen(token)).toBe(true);expect(Object.isFrozen(result)).toBe(true);
 expect(Object.isFrozen(result.committedEntries)).toBe(true);
 expect(Object.isFrozen(result.committedEntries[0])).toBe(true);
 const txt=JSON.stringify(result)+JSON.stringify(token);
 for(const secret of ['def/fake.sii','synthetic-entry','C:\\','revisionTicket','PRIVATE_FILE'])
  expect(txt).not.toContain(secret);
});
test('mesmo registro aparentemente confirmado não verifica integridade criptográfica',()=>{
 const store=createSyntheticTransactionStore();
 const x=committed(store).result;
 expect(x.structureOnlyChecked).toBe(true);
 expect(x.cryptographicIntegrityVerified).toBe(false);
 expect(x.dataTrusted).toBe(false);expect(x.actuallyPersisted).toBe(false);
 expect(x.realBytesRead).toBe(0);expect(x.operationsEnabled).toBe(false);
});
