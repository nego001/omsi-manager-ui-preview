import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {createSyntheticValidationReadiness} from '../src/synthetic-validation-readiness';
import {createSyntheticReadAdmissionSession} from '../src/synthetic-read-admission';
import {createSyntheticContainerReview,advanceSyntheticContainerReview,issueSyntheticStreamDeclarationSource} from '../src/synthetic-container-screen';
import {createSyntheticStreamReview} from '../src/synthetic-stream-checkpoints';
import {createSyntheticReaderLifecycle,openSyntheticReaderLifecycle,stepSyntheticReaderLifecycle,
 closeSyntheticReaderLifecycle,simulateSyntheticReaderLifecycleProcessLoss,type SyntheticReaderLifecycle
} from '../src/synthetic-reader-lifecycle';
import {createSyntheticOrphanRecovery,acknowledgeSyntheticOrphanRecovery,
 assessFreshSyntheticOrphanAnalysis,type SyntheticOrphanRecovery} from '../src/synthetic-orphan-recovery';
import {createSyntheticRestartDraft,inspectSyntheticRestartDraft,
 SYNTHETIC_RESTART_RETENTION,type SyntheticRestartDraft} from '../src/synthetic-restart-handoff';

const readiness=createSyntheticValidationReadiness(createSyntheticDiagnosticDemo()[3].timeline);
const session=createSyntheticReadAdmissionSession(readiness);
function newLife(){
 const h=createSyntheticContainerReview(session,{format:'zip-declared',entries:[
  {path:'def/stub.sii',kind:'file',compression:'deflate',encodedBytes:300,expandedBytes:600},
  {path:'sound/stub.ogg',kind:'file',compression:'deflate',encodedBytes:200,expandedBytes:400}
 ]});
 advanceSyntheticContainerReview(h);advanceSyntheticContainerReview(h);
 const source=issueSyntheticStreamDeclarationSource(h);
 const stream=createSyntheticStreamReview(source,source.entries.map(e=>({
  entryOrdinal:e.ordinal,encodedBytes:e.encodedBytes,expandedBytes:e.expandedBytes,
  elapsedMs:10,endOfEntry:true
 })));
 return createSyntheticReaderLifecycle(stream);
}
function orphan(){
 const life=newLife();openSyntheticReaderLifecycle(life);
 stepSyntheticReaderLifecycle(life);simulateSyntheticReaderLifecycleProcessLoss(life);
 return createSyntheticOrphanRecovery(life);
}
function complete(h:SyntheticReaderLifecycle){
 openSyntheticReaderLifecycle(h);stepSyntheticReaderLifecycle(h);stepSyntheticReaderLifecycle(h);
 closeSyntheticReaderLifecycle(h);return h;
}
const copy=(x:unknown)=>JSON.parse(JSON.stringify(x)) as Record<string,unknown>;
function finished(){
 const record=orphan();
 acknowledgeSyntheticOrphanRecovery(record);
 assessFreshSyntheticOrphanAnalysis(record,complete(newLife()));
 return record;
}
test('dois eventos iniciais são retidos uma vez e não criam lacunas',()=>{
 const x=createSyntheticRestartDraft(orphan());
 expect(x.retainedEvents.map(e=>e.sequence)).toEqual([1,2]);
 expect(x.omittedEvents).toBe(0);
 expect(x.totalEvents).toBe(2);
 expect(x.oldEvidenceReusable).toBe(false);
});
test('registro incompleto simulado em JSON continua exigindo nova triagem',()=>{
 const result=inspectSyntheticRestartDraft(copy(createSyntheticRestartDraft(orphan())));
 expect(result.status).toBe('recheck-required');
 expect(result.reason).toBe('incomplete-old-analysis');
 expect(result.previousState).toBe('incomplete');
 expect(result.freshReanalysisRequired).toBe(true);
 expect(result.dataTrusted).toBe(false);
});
test('mesmo registro depois da nova análise fictícia não comprova nada após cópia',()=>{
 const x=createSyntheticRestartDraft(finished());
 const result=inspectSyntheticRestartDraft(copy(x));
 expect(x.previousState).toBe('fixture-only');
 expect(result.status).toBe('recheck-required');
 expect(result.reason).toBe('claimed-complete-untrusted');
 expect(result.oldEvidenceReusable).toBe(false);
 expect(result.realFileVerified).toBe(false);
});
test('retém no máximo doze eventos preservando os dois primeiros',()=>{
 const r=orphan();
 for(let i=0;i<46;i++)assessFreshSyntheticOrphanAnalysis(r,newLife());
 const x=createSyntheticRestartDraft(r);
 expect(x.totalEvents).toBe(48);
 expect(x.retainedEvents).toHaveLength(12);
 expect(x.retainedEvents[0]).toEqual({sequence:1,code:'orphan-detected'});
 expect(x.retainedEvents[1]).toEqual({sequence:2,code:'old-evidence-invalidated'});
 expect(x.retainedEvents[2].sequence).toBe(39);
 expect(x.retainedEvents.at(-1)?.sequence).toBe(48);
 expect(x.omittedEvents).toBe(36);
 const checked=inspectSyntheticRestartDraft(copy(x));
 expect(checked.status).toBe('recheck-required');
 expect(checked.omittedEvents).toBe(36);
});
test('o primeiro descarte retém uma lacuna explícita sem renumerar história',()=>{
 const r=orphan();
 for(let i=0;i<11;i++)assessFreshSyntheticOrphanAnalysis(r,newLife());
 const x=createSyntheticRestartDraft(r);
 expect(x.totalEvents).toBe(13);
 expect(x.omittedEvents).toBe(1);
 expect(x.retainedEvents.map(e=>e.sequence)).toEqual([1,2,4,5,6,7,8,9,10,11,12,13]);
 expect(inspectSyntheticRestartDraft(copy(x)).status).toBe('recheck-required');
});
test('antes de 12 eventos nenhuma entrada é omitida',()=>{
 const r=orphan();
 for(let i=0;i<10;i++)assessFreshSyntheticOrphanAnalysis(r,newLife());
 const x=createSyntheticRestartDraft(r);
 expect(x.totalEvents).toBe(12);
 expect(x.omittedEvents).toBe(0);
 expect(x.retainedEvents).toHaveLength(12);
 expect(x.retainedEvents.at(-1)?.sequence).toBe(12);
});
test('uma cópia JSON válida nunca recupera acesso a disco ou permissões',()=>{
 const checked=inspectSyntheticRestartDraft(copy(createSyntheticRestartDraft(finished())));
 expect(checked.operationsEnabled).toBe(false);
 expect(checked.persistedToDisk).toBe(false);
 expect(checked.realProcessRestarted).toBe(false);
 expect(checked.realBytesRead).toBe(0);
 expect(checked.realCleanupVerified).toBe(false);
});
test('campos extras de acesso e permissões falsas invalidam o contrato',()=>{
 const raw=copy(createSyntheticRestartDraft(orphan()));
 for(const extra of [{operationsEnabled:true},{realVerified:true},{path:'C:\\private\\mods'}, {trusted:true}]){
  const x=inspectSyntheticRestartDraft({...raw,...extra});
  expect(x.status).toBe('rejected');
  expect(x.reason).toBe('invalid-draft');
 }
});
test('versão do schema desconhecida é recusada antes da leitura de eventos',()=>{
 const x=copy(createSyntheticRestartDraft(orphan()));
 x.schemaVersion=99;
 const result=inspectSyntheticRestartDraft(x);
 expect(result.status).toBe('rejected');
 expect(result.reason).toBe('unsupported-version');
});
test('entrada sem campos obrigatórios ou com tipos indevidos é recusada',()=>{
 const original=copy(createSyntheticRestartDraft(orphan()));
 for(const bad of [
  null,[], 'restart',{},
  {...original,retainedEvents:[]},
  {...original,retainedEvents:null},
  {...original,totalEvents:99},
  {...original,totalEvents:-1},
  {...original,totalEvents:1.2},
  {...original,fixtureRevision:'1'},
  {...original,oldEvidenceInvalidated:false},
  {...original,omittedEvents:1}
 ]){
  expect(inspectSyntheticRestartDraft(bad).status).toBe('rejected');
 }
});
test('apagamento ou mudança de ordem de eventos quebra encadeamento declarado',()=>{
 const raw=copy(createSyntheticRestartDraft(finished()));
 const events=raw.retainedEvents as {sequence:number;code:string}[];
 for(const altered of [
  {...raw,retainedEvents:events.slice(0,-1)},
  {...raw,retainedEvents:[events[1],events[0],...events.slice(2)]},
  {...raw,retainedEvents:events.map((e,i)=>i===2?{...e,sequence:88}:e)},
  {...raw,retainedEvents:events.map((e,i)=>i===0?{...e,code:'fake'}:e)}
 ]){
  expect(inspectSyntheticRestartDraft(altered).status).toBe('rejected');
 }
});
test('não se pode declarar revisão fictícia 2 sem evento final correspondente',()=>{
 const r=orphan(),x=copy(createSyntheticRestartDraft(r));
 x.previousState='fixture-only';
 expect(inspectSyntheticRestartDraft(x).status).toBe('rejected');
});
test('não se pode trocar análise concluída por pendente mantendo evento concluído',()=>{
 const x=copy(createSyntheticRestartDraft(finished()));
 x.previousState='incomplete';
 expect(inspectSyntheticRestartDraft(x).status).toBe('rejected');
});
test('objeto com protótipo não padrão não passa pela validação',()=>{
 const x=Object.assign(Object.create(null),copy(createSyntheticRestartDraft(orphan())));
 expect(inspectSyntheticRestartDraft(x).status).toBe('rejected');
});
test('getters na raiz ou nos eventos não são executados',()=>{
 const raw=copy(createSyntheticRestartDraft(orphan()));
 Object.defineProperty(raw,'totalEvents',{enumerable:true,get(){throw Error('unsafe getter')}});
 expect(inspectSyntheticRestartDraft(raw).status).toBe('rejected');
 const other=copy(createSyntheticRestartDraft(orphan()));
 const ev=(other.retainedEvents as Record<string,unknown>[])[0];
 Object.defineProperty(ev,'code',{enumerable:true,get(){throw Error('unsafe getter')}});
 expect(inspectSyntheticRestartDraft(other).status).toBe('rejected');
});
test('objetos de origem falsos ou clonados não exportam registro como autorizado',()=>{
 const real=orphan();
 for(const fake of [copy(real),{...real}] as SyntheticOrphanRecovery[]){
  expect(()=>createSyntheticRestartDraft(fake)).toThrow('não emitida');
 }
});
test('dados retornados são imutáveis e sem segredos de arquivos privados',()=>{
 const x=createSyntheticRestartDraft(finished()),y=inspectSyntheticRestartDraft(copy(x));
 expect(Object.isFrozen(x)).toBe(true);
 expect(Object.isFrozen(x.retainedEvents)).toBe(true);
 expect(x.retainedEvents.every(e=>Object.isFrozen(e))).toBe(true);
 expect(Object.isFrozen(y)).toBe(true);
 expect(Object.isFrozen(SYNTHETIC_RESTART_RETENTION)).toBe(true);
 const text=JSON.stringify(x)+JSON.stringify(y);
 for(const secret of ['def/stub.sii','sound/stub.ogg','revisionTicket','C:\\','synthetic-entry','privatePath']){
  expect(text).not.toContain(secret);
 }
});
test('copiar de novo a mesma estrutura não transforma declaração em prova',()=>{
 const raw=copy(createSyntheticRestartDraft(finished()));
 const a=inspectSyntheticRestartDraft(raw);
 const b=inspectSyntheticRestartDraft(copy(raw));
 expect(a).toEqual(b);
 expect(a.dataTrusted).toBe(false);
 expect(a.freshReanalysisRequired).toBe(true);
});
test('nenhum cenário com registro válido, inválido ou falsificado habilita operações',()=>{
 const raw=copy(createSyntheticRestartDraft(finished()));
 for(const attempt of [raw,{...raw,operationsEnabled:true},{...raw,retainedEvents:[]}]) {
  const r=inspectSyntheticRestartDraft(attempt);
  expect(r.operationsEnabled).toBe(false);
  expect(r.oldEvidenceReusable).toBe(false);
  expect(r.realCleanupVerified).toBe(false);
  expect(r.realFileVerified).toBe(false);
  expect(r.freshReanalysisRequired).toBe(true);
 }
});
