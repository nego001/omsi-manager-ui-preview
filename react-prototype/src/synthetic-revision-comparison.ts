// Side-by-side comparison of issued SYNTHETIC timeline revisions. No real files or bytes.
// This compares reported fixture states, not trusted package content or compatibility.
import {SYNTHETIC_MODULE_IDS,type SyntheticModuleId} from './distributed-reader-contract';
import {
 isIssuedSyntheticDiagnosticTimeline,
 type SyntheticDiagnosticTimeline,type TimelineRevision,type TimelineEvent
} from './synthetic-diagnostic-timeline';
import type {HistoryModuleStatus,HistoryState,HistoryReason} from './synthetic-evidence-history';
import type {GameId} from './catalog';

type Specialist=Exclude<SyntheticModuleId,'container'>;
const specialists=SYNTHETIC_MODULE_IDS.filter((id):id is Specialist=>id!=='container');
// Issuance attests ONLY that this in-memory result came from the synthetic comparator.
const issuedComparisons=new WeakSet<object>();
export function isIssuedSyntheticRevisionComparison(value:unknown):value is SyntheticRevisionComparison{
 return !!value&&typeof value==='object'&&issuedComparisons.has(value);
}
export type ComparisonChange='status-changed'|'observations-changed'|
 'affected-marker-changed'|'no-declared-change';
export type SyntheticModuleComparison=Readonly<{
 moduleId:Specialist;
 beforeStatus:HistoryModuleStatus;
 afterStatus:HistoryModuleStatus;
 beforeObservations:number;
 afterObservations:number;
 beforeAffected:boolean;
 afterAffected:boolean;
 changed:boolean;
 change:ComparisonChange;
 explanation:string;
 verified:false;
 operationsEnabled:false;
}>;
export type ComparisonSide=Readonly<{
 revision:number;state:HistoryState;reason:HistoryReason;
 candidateGame:GameId|null;superseded:boolean;
 completedSpecialists:number;pendingSpecialists:number;blockedSpecialists:number;
 verified:false;operationsEnabled:false;
}>;
export type SyntheticRevisionComparison=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';
 before:ComparisonSide;after:ComparisonSide;
 modules:readonly SyntheticModuleComparison[];
 changedModules:number;unchangedModules:number;
 stateChanged:boolean;candidateChanged:boolean;
 explanation:string;
 actualContentCompared:false;compatibilityVerified:false;
 previousEvidenceReusable:false;operationsEnabled:false;
}>;
function eventFor(revision:TimelineRevision,id:Specialist):TimelineEvent{
 const found=revision.events.find(event=>event.kind==='specialist'&&event.moduleId===id);
 if(!found||found.status===null)throw Error('Revisão sintética incompleta para comparação.');
 return found;
}
function snapshot(rev:TimelineRevision):ComparisonSide{
 return Object.freeze({
  revision:rev.revision,state:rev.state,reason:rev.reason,
  candidateGame:rev.candidateGame,superseded:rev.superseded,
  completedSpecialists:rev.completedSpecialists,
  pendingSpecialists:rev.pendingSpecialists,blockedSpecialists:rev.blockedSpecialists,
  verified:false as const,operationsEnabled:false as const
 });
}
function explain(before:TimelineEvent,after:TimelineEvent,change:ComparisonChange):string{
 if(change==='status-changed'){
  if(after.status==='pending')return 'O novo índice exige reanálise. Relatório antigo não foi reaproveitado.';
  if(after.status==='missing')return 'O especialista não apresentou relatório nesta revisão. Ausência não comprova aprovação.';
  if(after.status==='blocked')return 'O especialista informou bloqueio fictício nesta revisão. Operações seguem desabilitadas.';
  if(after.status==='incomplete')return 'O especialista declarou análise incompleta nesta revisão.';
  return 'O especialista apresentou um novo relatório fictício. Isso não valida arquivos reais.';
 }
 if(change==='observations-changed')return 'A quantidade de observações declaradas mudou; não há comparação de bytes reais.';
 if(change==='affected-marker-changed')return 'Mudou a indicação de impacto declarada; ela serve somente como prioridade de revisão.';
 return 'Indicadores declarados iguais. Isso não comprova que o conteúdo real permaneceu igual.';
}
export function compareSyntheticRevisions(
 timeline:SyntheticDiagnosticTimeline,beforeRevision:number,afterRevision:number
):SyntheticRevisionComparison{
 if(!isIssuedSyntheticDiagnosticTimeline(timeline))throw Error('Linha do tempo sintética não emitida.');
 if(!Number.isSafeInteger(beforeRevision)||!Number.isSafeInteger(afterRevision)||
    beforeRevision>=afterRevision)throw Error('Selecione revisões diferentes em ordem cronológica.');
 const before=timeline.revisions.find(rev=>rev.revision===beforeRevision);
 const after=timeline.revisions.find(rev=>rev.revision===afterRevision);
 if(!before||!after)throw Error('Revisão sintética não encontrada.');
 const modules=Object.freeze(specialists.map(moduleId=>{
  const a=eventFor(before,moduleId),b=eventFor(after,moduleId);
  const change:ComparisonChange=a.status!==b.status?'status-changed':
   a.observations!==b.observations?'observations-changed':
   a.affectedByDeclaredChange!==b.affectedByDeclaredChange?'affected-marker-changed':
   'no-declared-change';
  return Object.freeze({
   moduleId,beforeStatus:a.status!,afterStatus:b.status!,
   beforeObservations:a.observations,afterObservations:b.observations,
   beforeAffected:a.affectedByDeclaredChange,afterAffected:b.affectedByDeclaredChange,
   changed:change!=='no-declared-change',change,
   explanation:explain(a,b,change),verified:false as const,operationsEnabled:false as const
  });
 }));
 const changedModules=modules.filter(m=>m.changed).length;
 const stateChanged=before.state!==after.state;
 const candidateChanged=before.candidateGame!==after.candidateGame;
 const result=Object.freeze({
  schemaVersion:1,source:'synthetic-fixture',before:snapshot(before),after:snapshot(after),
  modules,changedModules,unchangedModules:modules.length-changedModules,
  stateChanged,candidateChanged,
  explanation:after.state==='recheck-required'?
   'Nova revisão pendente. Conclusões anteriores são históricas e os sete especialistas devem reavaliar as declarações fictícias.':
   'Diferenças entre relatórios declarados. Nenhuma conclusão anterior é prova de compatibilidade ou instalação.',
  actualContentCompared:false as const,compatibilityVerified:false as const,
  previousEvidenceReusable:false as const,operationsEnabled:false as const
 });
 issuedComparisons.add(result);
 return result;
}
