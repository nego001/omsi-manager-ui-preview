import {useState} from 'react';
import {RotateCcw,ShieldAlert} from 'lucide-react';
import SyntheticTransactionPreview from './SyntheticTransactionPreview';
import {createSyntheticRestartDraft,inspectSyntheticRestartDraft} from './synthetic-restart-handoff';
import type {SyntheticOrphanRecovery} from './synthetic-orphan-recovery';

type Case='as-issued'|'missing-event'|'fake-approval'|'future-version';
const labels:Readonly<Record<Case,string>>={
 'as-issued':'Cópia estruturalmente consistente',
 'missing-event':'Evento do histórico removido',
 'fake-approval':'Permissão artificial inserida no registro',
 'future-version':'Versão do registro não reconhecida'
};
export default function SyntheticRestartPreview({record}:{record:SyntheticOrphanRecovery}){
 const [scenario,setScenario]=useState<Case>('as-issued');
 const [simulated,setSimulated]=useState(false);
 const draft=createSyntheticRestartDraft(record);
 // JSON roundtrip intentionally models only in-memory serialization, not OS restart.
 const copy=JSON.parse(JSON.stringify(draft)) as Record<string,unknown>;
 if(scenario==='missing-event'){
  copy.retainedEvents=(copy.retainedEvents as unknown[]).slice(0,-1);
 }else if(scenario==='fake-approval'){
  copy.operationsEnabled=true;
 }else if(scenario==='future-version'){
  copy.schemaVersion=99;
 }
 const result=inspectSyntheticRestartDraft(copy);
 return <section className="synthetic-restart" role="region" aria-label="Simulação de retomada após reinicialização" data-restarted="false" data-persistent="false">
  <header>
   <div>
    <span className="eyebrow">TRANSFERÊNCIA ENTRE SESSÕES · APENAS SIMULADA</span>
    <h6><RotateCcw size={14} aria-hidden="true"/> E se o programa fosse reiniciado?</h6>
    <p>Uma cópia fictícia do registro é examinada como dado não confiável. Nada é salvo em disco e nenhum processo é reiniciado.</p>
   </div>
  </header>
  <div className="synthetic-restart-metrics">
   <div><small>Eventos na sequência original</small><strong data-testid="synthetic-restart-total">{draft.totalEvents}</strong></div>
   <div><small>Eventos retidos no exemplo</small><strong data-testid="synthetic-restart-retained">{draft.retainedEvents.length}</strong></div>
   <div><small>Eventos antigos resumidos por descarte</small><strong data-testid="synthetic-restart-dropped">{draft.omittedEvents}</strong></div>
   <div><small>Evidências antigas reutilizáveis</small><strong data-testid="synthetic-restart-reusable">0</strong></div>
  </div>
  <label htmlFor="synthetic-restart-case">Registro que será simulado
   <select id="synthetic-restart-case" value={scenario} onChange={e=>{setScenario(e.target.value as Case);setSimulated(false);}}>
    {(Object.keys(labels) as Case[]).map(x=><option key={x} value={x}>{labels[x]}</option>)}
   </select>
  </label>
  <div className="synthetic-restart-actions">
   <button type="button" onClick={()=>setSimulated(true)} disabled={simulated}>Simular reinicialização do registro</button>
   <button type="button" onClick={()=>setSimulated(false)} disabled={!simulated}>Limpar resultado da simulação</button>
  </div>
  {simulated&&<div className="synthetic-restart-result" role="status" aria-live="polite">
   <strong data-testid="synthetic-restart-status">{result.status==='rejected'?'Registro rejeitado':'Nova análise obrigatória'}</strong>
   <p data-testid="synthetic-restart-reason">{result.reason==='incomplete-old-analysis'?
    'A sessão anterior terminou incompleta. As conclusões antigas não podem ser retomadas.':
    result.reason==='claimed-complete-untrusted'?
    'A cópia declara conclusão fictícia, mas serialização não comprova origem ou integridade.':
    result.reason==='inconsistent-sequence'?
    'Sequência de eventos incompleta ou inconsistente.':
    result.reason==='unsupported-version'?
    'Versão do registro não reconhecida.':
    'Estrutura recusada: não é possível conceder permissões por um registro copiado.'}</p>
   <p data-testid="synthetic-restart-guard"><ShieldAlert size={13} aria-hidden="true"/> Mesmo após esta simulação, nenhuma evidência foi restaurada, nenhuma análise real foi concluída e nenhuma operação foi autorizada.</p>
  </div>}
  <SyntheticTransactionPreview record={record}/>
  <p className="synthetic-restart-note">Retenção máxima de 12 eventos por cópia, preservando os dois eventos iniciais quando válidos. Esta é uma inspeção de formato, não uma validação criptográfica ou recuperação persistente.</p>
 </section>;
}
