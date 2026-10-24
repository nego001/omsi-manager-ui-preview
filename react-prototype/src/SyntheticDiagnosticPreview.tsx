import {useMemo,useState} from 'react';
import {AlertTriangle,CheckCircle2,Clock3,History,LockKeyhole,ShieldCheck} from 'lucide-react';
import {createSyntheticDiagnosticDemo} from './synthetic-diagnostic-demo';
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
 const step=steps[selected];
 const timeline=step.timeline;
 const latest=timeline.revisions[timeline.revisions.length-1];
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
  <ol className="synthetic-diag-timeline" aria-label="Revisões da análise de demonstração" key={step.id}>
   {timeline.revisions.map(revision=><li key={revision.revision} data-revision={revision.revision} data-current={revision.current?'true':'false'} data-superseded={revision.superseded?'true':'false'}>
    <details className="synthetic-diag-revision" open={revision.current?true:undefined}>
     <summary>
      <span className="synthetic-diag-revision-number" aria-hidden="true">{revision.revision}</span>
      <span className="synthetic-diag-revision-title">
       <strong>Revisão {revision.revision} · {revision.superseded?'Histórica, substituída':stateLabels[revision.state]}</strong>
       <small>{revision.events[0].title}</small>
      </span>
      <span className="synthetic-diag-revision-count">{revision.completedSpecialists}/7 relatórios fictícios OK</span>
     </summary>
     <div className="synthetic-diag-revision-content">
      <p>{revision.events[0].description}</p>
      {revision.candidateGame&&<p className="synthetic-diag-candidate">Jogo sugerido nesta revisão: {gameLabels[revision.candidateGame]} · dado fictício {revision.candidateIsHistorical?'· não é a conclusão atual':''}.</p>}
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
