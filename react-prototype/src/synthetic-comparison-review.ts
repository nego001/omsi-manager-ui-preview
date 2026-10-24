// Explain SYNTHETIC reported differences without inferring real-world risk or integrity.
// Only compare locally issued, immutable comparison objects. No filesystem or IO.
import {
 isIssuedSyntheticRevisionComparison,
 type SyntheticRevisionComparison,type SyntheticModuleComparison
} from './synthetic-revision-comparison';
import type {SyntheticModuleId} from './distributed-reader-contract';
type Specialist=Exclude<SyntheticModuleId,'container'>;
export type SyntheticReviewPriority='investigate-first'|'recheck-required'|'informational';
export type SyntheticReviewCause='blocked-report'|'missing-report'|'incomplete-report'|
 'declared-impact'|'pending-report'|'status-only'|'observations-only'|'unchanged-indicators';
export type SyntheticReviewItem=Readonly<{
 moduleId:Specialist;priority:SyntheticReviewPriority;cause:SyntheticReviewCause;
 headline:string;detail:string;
 statusChanged:boolean;observationCountChanged:boolean;declaredImpactChanged:boolean;
 verified:false;realRiskAssessed:false;operationsEnabled:false;
}>;
export type SyntheticComparisonReview=Readonly<{
 source:'synthetic-fixture';schemaVersion:1;beforeRevision:number;afterRevision:number;
 items:readonly SyntheticReviewItem[];
 investigateFirst:number;recheckRequired:number;informational:number;
 totalModules:7;
 priorityDoesNotMeanRisk:true;
 actualContentCompared:false;compatibilityVerified:false;operationsEnabled:false;
}>;
function classify(m:SyntheticModuleComparison):Pick<SyntheticReviewItem,'priority'|'cause'|'headline'|'detail'>{
 if(m.afterStatus==='blocked')return {
  priority:'investigate-first',cause:'blocked-report',headline:'Bloqueio declarado',
  detail:'Conferir o motivo do relatório bloqueado. É apenas um estado fictício, não uma ameaça real confirmada.'
 };
 if(m.afterStatus==='missing')return {
  priority:'investigate-first',cause:'missing-report',headline:'Relatório ausente',
  detail:'Solicitar nova observação sintética deste especialista. Ausência não é aprovação nem falha real confirmada.'
 };
 if(m.afterStatus==='incomplete')return {
  priority:'investigate-first',cause:'incomplete-report',headline:'Relatório incompleto',
  detail:'Completar a observação declarada antes de formar uma conclusão fictícia. Não houve inspeção real.'
 };
 if(m.afterAffected)return {
  priority:'investigate-first',cause:'declared-impact',headline:'Impacto declarado na revisão',
  detail:'A mudança fictícia pode envolver este especialista. Prioridade de conferência, sem inferir defeito nem gravidade real.'
 };
 if(m.afterStatus==='pending')return {
  priority:'recheck-required',cause:'pending-report',headline:'Reanálise obrigatória',
  detail:'A revisão nova precisa de relatório próprio. Uma mudança de estado por si só não comprova modificação dos bytes.'
 };
 if(m.beforeStatus!==m.afterStatus)return {
  priority:'informational',cause:'status-only',headline:'Somente estado do relatório',
  detail:'O estado declarado mudou, sem indicação de impacto no pacote. Isso não prova correção ou compatibilidade real.'
 };
 if(m.beforeObservations!==m.afterObservations)return {
  priority:'informational',cause:'observations-only',headline:'Quantidade declarada diferente',
  detail:'Mudou a contagem fictícia de observações; nenhuma comparação de arquivos reais foi realizada.'
 };
 return {
  priority:'informational',cause:'unchanged-indicators',headline:'Indicadores declarados iguais',
  detail:'Nada mudou nos indicadores resumidos. Isso não prova que os arquivos reais continuaram iguais.'
 };
}
export function reviewSyntheticComparison(comparison:SyntheticRevisionComparison):SyntheticComparisonReview{
 if(!isIssuedSyntheticRevisionComparison(comparison))
  throw Error('Comparação sintética não emitida.');
 if(comparison.modules.length!==7)throw Error('Comparação sintética incompleta.');
 const items=Object.freeze(comparison.modules.map(m=>{
  const info=classify(m);
  return Object.freeze({
   moduleId:m.moduleId,...info,
   statusChanged:m.beforeStatus!==m.afterStatus,
   observationCountChanged:m.beforeObservations!==m.afterObservations,
   declaredImpactChanged:m.beforeAffected!==m.afterAffected,
   verified:false as const,realRiskAssessed:false as const,operationsEnabled:false as const
  });
 }));
 return Object.freeze({
  source:'synthetic-fixture' as const,schemaVersion:1 as const,
  beforeRevision:comparison.before.revision,afterRevision:comparison.after.revision,
  items,investigateFirst:items.filter(m=>m.priority==='investigate-first').length,
  recheckRequired:items.filter(m=>m.priority==='recheck-required').length,
  informational:items.filter(m=>m.priority==='informational').length,
  totalModules:7 as const,priorityDoesNotMeanRisk:true as const,
  actualContentCompared:false as const,compatibilityVerified:false as const,operationsEnabled:false as const
 });
}
