import {useState} from 'react';
import {LockKeyhole,ShieldAlert} from 'lucide-react';
import SyntheticReadAdmissionPreview from './SyntheticReadAdmissionPreview';
import type {SyntheticDiagnosticTimeline} from './synthetic-diagnostic-timeline';
import {createSyntheticValidationReadiness,filterSyntheticValidationReadiness,type ValidationReadinessFilter,type ValidationPhase} from './synthetic-validation-readiness';

const phaseLabels:Readonly<Record<ValidationPhase,string>>={
 origin:'1. Origem e isolamento',
 integrity:'2. Integridade e leitura',
 compatibility:'3. Dependências e compatibilidade',
 execution:'4. Segurança antes de operações'
};
const phases:readonly ValidationPhase[]=['origin','integrity','compatibility','execution'];
export default function SyntheticValidationReadinessPreview({timeline}:{timeline:SyntheticDiagnosticTimeline}){
 const [phase,setPhase]=useState<ValidationReadinessFilter>('all');
 // Issued source only; neither timeline filters nor declared consensus authorizes real files.
 const plan=createSyntheticValidationReadiness(timeline);
 const visible=filterSyntheticValidationReadiness(plan,phase);
 return <section className="synthetic-readiness" role="region" aria-label="Requisitos para validação real futura" data-approved="false" data-demo-only="true">
  <header>
   <div>
    <span className="eyebrow">PLANEJAMENTO · NENHUMA PROVA REAL</span>
    <h3>O que falta para validar um mod real?</h3>
    <p>Esta lista descreve requisitos de engenharia que ainda não foram avaliados. Os relatórios fictícios da revisão {plan.revision} não concluem nenhum deles.</p>
   </div>
   <span className="synthetic-readiness-lock"><LockKeyhole size={15} aria-hidden="true"/> Sem autorização</span>
  </header>
  <div className="synthetic-readiness-summary" role="status" aria-live="polite" aria-atomic="true">
   <div><small>Requisitos previstos</small><strong data-testid="synthetic-readiness-total">{plan.totalRequirements}</strong></div>
   <div><small>Avaliados com provas reais</small><strong data-testid="synthetic-readiness-completed">{plan.completed}</strong></div>
   <div><small>Ainda não avaliados</small><strong data-testid="synthetic-readiness-unverified">{plan.notEvaluated}</strong></div>
  </div>
  <label className="synthetic-readiness-filter" htmlFor="synthetic-readiness-phase">
   Mostrar requisitos por etapa
   <select id="synthetic-readiness-phase" value={phase} onChange={e=>setPhase(e.target.value as ValidationReadinessFilter)}>
    <option value="all">Todas as etapas</option>
    {phases.map(id=><option key={id} value={id}>{phaseLabels[id]}</option>)}
   </select>
  </label>
  <p className="synthetic-readiness-count" data-testid="synthetic-readiness-visible">{visible.shown} de 12 requisitos exibidos. O filtro não altera a situação de aprovação.</p>
  <div className="synthetic-readiness-phases">
   {phases.filter(id=>phase==='all'||phase===id).map(id=><section key={id} className="synthetic-readiness-phase" data-phase={id} aria-label={phaseLabels[id]}>
    <h4>{phaseLabels[id]}</h4>
    <ol>
     {visible.requirements.filter(item=>item.phase===id).map(item=><li key={item.id} data-requirement={item.id} data-status={item.status}>
      <div className="synthetic-readiness-item-heading">
       <strong>{item.title}</strong>
       <span><ShieldAlert size={13} aria-hidden="true"/> Não avaliado</span>
      </div>
      <p><b>Prova necessária:</b> {item.proofNeeded}</p>
      <details><summary>Por que isso importa?</summary><p>{item.reason}</p></details>
     </li>)}
    </ol>
   </section>)}
  </div>
  <SyntheticReadAdmissionPreview readiness={plan}/>
  <p className="synthetic-readiness-guard" data-testid="synthetic-readiness-guard">Uma lista de requisitos não é uma aprovação. Mesmo que todos sejam implementados no futuro, será necessário um mecanismo de autorização independente e uma confirmação explícita para cada operação. Instalar, remover, atualizar e editar continuam bloqueados.</p>
 </section>;
}
