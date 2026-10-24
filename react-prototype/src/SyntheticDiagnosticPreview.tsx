import {useMemo,useState} from 'react';
import {AlertTriangle,CheckCircle2,Clock3,History,LockKeyhole,ShieldCheck} from 'lucide-react';
import {createSyntheticDiagnosticDemo} from './synthetic-diagnostic-demo';
import {filterSyntheticDiagnosticTimeline,type SyntheticTimelineFilter} from './synthetic-timeline-filter';
import {compareSyntheticRevisions} from './synthetic-revision-comparison';
import {reviewSyntheticComparison,type SyntheticReviewPriority} from './synthetic-comparison-review';
import type {HistoryState,HistoryModuleStatus} from './synthetic-evidence-history';
import type {SyntheticModuleId} from './distributed-reader-contract';

const moduleLabels:Readonly<Record<SyntheticModuleId,string>>={
 container:'Contêiner',structure:'Estrutura',manifest:'Manifestos',definitions:'Definições',
 resources:'Recursos',audio:'Áudio',media:'Imagens',relations:'Relações'
};
const statusLabels:Readonly<Record<HistoryModuleStatus,string>>={
 ok:'Relatório fictício recebido',pending:'Pendente',missing:'Ausente',
 incomplete:'Incompleto',blocked:'Bloqueado'
};
const stateLabels:Readonly<Record<HistoryState,string>>={
 candidate:'Candidato fictício',unknown:'Não identificado',ambiguous:'Ambíguo',
 incomplete:'Incompleto',blocked:'Bloqueado','recheck-required':'Reanálise pendente'
};
const gameLabels={omsi:'OMSI 2',ets2:'ETS2',ats:'ATS'} as const;

export default function SyntheticDiagnosticPreview(){
 const steps=useMemo(()=>createSyntheticDiagnosticDemo(),[]);
 const [selected,setSelected]=useState(3);
 const [moduleFilter,setModuleFilter]=useState<SyntheticTimelineFilter>('all');
 const [compareBefore,setCompareBefore]=useState(2);
 const [compareAfter,setCompareAfter]=useState(3);
 const [reviewFilter,setReviewFilter]=useState<'all'|SyntheticReviewPriority>('all');
 const step=steps[selected];
 const timeline=filterSyntheticDiagnosticTimeline(step.timeline,moduleFilter);
 const latest=timeline.revisions[timeline.revisions.length-1];
 const revisionCount=step.timeline.revisions.length;
 const beforeRevision=Math.min(compareBefore,Math.max(1,revisionCount-1));
 const afterRevision=revisionCount>1?Math.max(beforeRevision+1,Math.min(compareAfter,revisionCount)):1;
 // Always compare the unfiltered, issued snapshot. Visual filters MUST NOT change conclusions.
 const comparison=revisionCount>1?compareSyntheticRevisions(step.timeline,beforeRevision,afterRevision):null;
 const review=comparison?reviewSyntheticComparison(comparison):null;
 const comparedModules=comparison&&review?comparison.modules.filter(item=>
  reviewFilter==='all'||review.items.find(entry=>entry.moduleId===item.moduleId)?.priority===reviewFilter
 ):[];
 return <section className="synthetic-diag" role="region" aria-label="Laboratório de diagnóstico fictício" data-demo-only="true">
  <header className="synthetic-diag-intro">
   <div>
    <span className="eyebrow">LABORATÓRIO · SOMENTE DEMONSTRAÇÃO</span>
    <h2>Linha do tempo dos diagnósticos</h2>
    <p>Exemplo isolado com arquivos e relatórios inventados. Não representa análises dos seus mods, atividades reais ou compatibilidade verificada.</p>
   </div>
   <span className="synthetic-diag-mark"><LockKeyhole size={15} aria-hidden="true"/> Operações bloqueadas</span>
  </header>
  <div className="synthetic-diag-steps" role="group" aria-label="Etapas do cenário fictício">
   {steps.map((item,index)=><button key={item.id} type="button" aria-pressed={selected===index} onClick={()=>setSelected(index)}>
    {item.label}
   </button>)}
  </div>
  <div className="synthetic-diag-summary" role="status" aria-live="polite" aria-atomic="true">
   <div><small>Estado da revisão atual</small><strong data-testid="synthetic-current-state">{stateLabels[timeline.state]}</strong></div>
   <div><small>Revisão ativa</small><strong>{timeline.activeRevision} de {timeline.revisionCount}</strong></div>
   <div><small>Especialistas pendentes</small><strong>{latest.pendingSpecialists} de 7</strong></div>
   <div><small>Jogo sugerido</small><strong>{timeline.currentGameCandidate?gameLabels[timeline.currentGameCandidate]+' · fictício':'Não identificado'}</strong></div>
  </div>
  <div className="synthetic-diag-filter-bar">
   <label htmlFor="synthetic-module-filter">Filtrar especialistas fictícios</label>
   <select id="synthetic-module-filter" value={moduleFilter} onChange={e=>setModuleFilter(e.target.value as SyntheticTimelineFilter)}>
    <option value="all">Todos os especialistas</option>
    <option value="pending">Pendentes, ausentes e incompletos</option>
    <option value="blocked">Somente bloqueados</option>
    <option value="changed">Afetados por mudanças declaradas</option>
   </select>
   <p data-testid="synthetic-filter-count" role="status">{timeline.visibleModules} de {timeline.totalModules} registros de especialistas visíveis. As revisões continuam no histórico.</p>
  </div>
  <section className="synthetic-compare" aria-label="Comparação fictícia de revisões" role="region">
   <header className="synthetic-compare-intro">
    <div><span className="eyebrow">COMPARAÇÃO DE DECLARAÇÕES · SOMENTE DEMONSTRAÇÃO</span>
     <h3>Antes e depois de cada revisão</h3>
     <p>Compare dois estados fictícios. Identificadores iguais não provam arquivos iguais e nenhum resultado autoriza instalação.</p>
    </div>
   </header>
   {comparison===null?
    <p className="synthetic-compare-empty">Apenas uma revisão disponível neste cenário. A comparação exige duas revisões distintas.</p>:
    <>
     <div className="synthetic-compare-controls" role="group" aria-label="Escolher revisões para comparar">
      <label htmlFor="synthetic-compare-before">Revisão anterior
       <select id="synthetic-compare-before" value={beforeRevision} onChange={e=>{
        const next=Number(e.target.value);setCompareBefore(next);if(next>=compareAfter)setCompareAfter(next+1);
       }}>
        {step.timeline.revisions.filter(r=>r.revision<revisionCount).map(r=><option key={r.revision} value={r.revision}>Revisão {r.revision}</option>)}
       </select>
      </label>
      <label htmlFor="synthetic-compare-after">Revisão posterior
       <select id="synthetic-compare-after" value={afterRevision} onChange={e=>setCompareAfter(Number(e.target.value))}>
        {step.timeline.revisions.filter(r=>r.revision>beforeRevision).map(r=><option key={r.revision} value={r.revision}>Revisão {r.revision}</option>)}
       </select>
      </label>
     </div>
     <div className="synthetic-compare-heads">
      <div><small>ANTES · REVISÃO {comparison.before.revision}</small><strong>{stateLabels[comparison.before.state]}</strong><span>{comparison.before.candidateGame?gameLabels[comparison.before.candidateGame]+' · candidato fictício':'Não identificado'}</span></div>
      <div><small>DEPOIS · REVISÃO {comparison.after.revision}</small><strong>{stateLabels[comparison.after.state]}</strong><span>{comparison.after.candidateGame?gameLabels[comparison.after.candidateGame]+' · candidato fictício':'Não identificado'}</span></div>
     </div>
     <p className="synthetic-compare-summary" data-testid="synthetic-comparison-count" role="status">
      {comparison.changedModules} de 7 especialistas tiveram indicadores declarados alterados; {comparison.unchangedModules} sem alteração nos indicadores. {comparison.stateChanged?'O estado geral mudou.':'O estado geral declarado permaneceu igual.'}
     </p>
     <p className="synthetic-compare-explanation">{comparison.explanation}</p>
     <div className="synthetic-compare-review" role="group" aria-label="Orientação de conferência fictícia">
      <h4>Orientação de conferência</h4>
      <p>As prioridades são apenas pistas declaradas para investigação no teste. Não medem risco, gravidade ou integridade de mods reais.</p>
      <div className="synthetic-compare-review-counts" data-testid="synthetic-review-counts">
       <div><small>Conferir primeiro</small><strong>{review?.investigateFirst??0}</strong></div>
       <div><small>Reanalisar</small><strong>{review?.recheckRequired??0}</strong></div>
       <div><small>Informativo</small><strong>{review?.informational??0}</strong></div>
      </div>
      <label htmlFor="synthetic-review-filter">Exibir orientação
       <select id="synthetic-review-filter" value={reviewFilter}
        onChange={e=>setReviewFilter(e.target.value as 'all'|SyntheticReviewPriority)}>
        <option value="all">Todos os sete especialistas</option>
        <option value="investigate-first">Conferir primeiro</option>
        <option value="recheck-required">Reanálise obrigatória</option>
        <option value="informational">Somente informativos</option>
       </select>
      </label>
      <p className="synthetic-compare-review-visible" data-testid="synthetic-review-visible" role="status">
       {comparedModules.length} de 7 especialistas exibidos. As contagens totais e as conclusões da comparação não são alteradas pelo filtro.
      </p>
     </div>
     {comparedModules.length===0&&<p className="synthetic-compare-empty-review">Nenhum especialista corresponde a esta orientação no cenário fictício. A comparação completa permanece registrada.</p>}
     <ol className="synthetic-compare-list" aria-label="Diferenças declaradas por especialista">
      {comparedModules.map(item=>{
       const tip=review!.items.find(entry=>entry.moduleId===item.moduleId)!;
       return <li key={item.moduleId} data-module={item.moduleId} data-change={item.change} data-priority={tip.priority} data-cause={tip.cause}>
       <div className="synthetic-compare-module-header">
        <strong>{moduleLabels[item.moduleId]}</strong>
        <span>{item.changed?'Indicadores alterados':'Sem diferença declarada'}</span>
       </div>
       <div className="synthetic-compare-pair">
        <div data-side="before"><small>ANTES</small><strong>{statusLabels[item.beforeStatus]}</strong><span>{item.beforeObservations} {item.beforeObservations===1?'observação':'observações'} fictícias</span></div>
        <div data-side="after"><small>DEPOIS</small><strong>{statusLabels[item.afterStatus]}</strong><span>{item.afterObservations} {item.afterObservations===1?'observação':'observações'} fictícias</span></div>
       </div>
       <div className="synthetic-compare-priority"><strong>{tip.headline}</strong><small>{tip.priority==='investigate-first'?'Conferir primeiro':tip.priority==='recheck-required'?'Reanálise obrigatória':'Informativo'}</small></div>
       <p>{tip.detail}</p>
       <p className="synthetic-compare-signal-types">Estado: {tip.statusChanged?'alterado':'igual'} · Observações: {tip.observationCountChanged?'alteradas':'iguais'} · Pista de impacto: {tip.declaredImpactChanged?'alterada':'igual'}</p>
       <details className="synthetic-compare-why"><summary>Explicação da diferença</summary><p>{item.explanation}</p></details>
      </li>;
      })}
     </ol>
     <p className="synthetic-compare-footnote">Esta comparação sempre considera os sete especialistas, independentemente do filtro da linha do tempo. Não verifica bytes, instalações ou compatibilidade reais.</p>
    </>}
  </section>
  <ol className="synthetic-diag-timeline" aria-label="Revisões da análise de demonstração" key={step.id}>
   {timeline.revisions.map(revision=><li key={revision.revision} data-revision={revision.revision} data-current={revision.current?'true':'false'} data-superseded={revision.superseded?'true':'false'}>
    <details className="synthetic-diag-revision" open={revision.current?true:undefined}>
     <summary>
      <span className="synthetic-diag-revision-number" aria-hidden="true">{revision.revision}</span>
      <span className="synthetic-diag-revision-title">
       <strong>Revisão {revision.revision} · {revision.superseded?'Histórica, substituída':stateLabels[revision.state]}</strong>
       <small>{revision.events[0].title}</small>
      </span>
      <span className="synthetic-diag-revision-count">{revision.completedSpecialists}/7 relatórios fictícios OK · {revision.matchingModules} exibidos</span>
     </summary>
     <div className="synthetic-diag-revision-content">
      <p>{revision.events[0].description}</p>
      {revision.candidateGame&&<p className="synthetic-diag-candidate">Jogo sugerido nesta revisão: {gameLabels[revision.candidateGame]} · dado fictício {revision.candidateIsHistorical?'· não é a conclusão atual':''}.</p>}
      {revision.matchingModules===0&&<p className="synthetic-diag-filter-empty">Nenhum especialista corresponde a este filtro nesta revisão. O contexto da revisão foi preservado.</p>}
      <ul className="synthetic-diag-modules" aria-label={'Especialistas da revisão '+revision.revision}>
       {revision.events.filter(event=>event.kind==='specialist').map(event=><li key={event.moduleId} data-status={event.status}>
        <div className="synthetic-diag-module-title">
         {event.status==='ok'?<CheckCircle2 size={15} aria-hidden="true"/>:event.status==='blocked'?<AlertTriangle size={15} aria-hidden="true"/>:<Clock3 size={15} aria-hidden="true"/>}
         <strong>{event.moduleId?moduleLabels[event.moduleId]:''}</strong>
         <span>{event.status?statusLabels[event.status]:''}</span>
        </div>
        <p>{event.title}{event.affectedByDeclaredChange?' · Mudança declarada relevante':''}</p>
        <details>
         <summary>Entender este estado</summary>
         <p>{event.description}</p>
         <small>{event.observations} {event.observations===1?'observação declarada':'observações declaradas'} · nenhuma leitura real</small>
        </details>
       </li>)}
      </ul>
     </div>
    </details>
   </li>)}
  </ol>
  <p className="synthetic-diag-footnote"><ShieldCheck size={17} aria-hidden="true"/> Todos os resultados desta seção são inventados para testar a interface. Nenhuma pasta foi inspecionada aqui. Instalar, remover, atualizar e editar continuam indisponíveis.</p>
  <p className="synthetic-diag-scope"><History size={15} aria-hidden="true"/> O histórico real de atividades acima permanece vazio e separado desta demonstração.</p>
 </section>;
}
