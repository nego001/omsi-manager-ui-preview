import {ClipboardList,LockKeyhole} from 'lucide-react';
import SyntheticRestartPreview from './SyntheticRestartPreview';
import {
 projectSyntheticRecoveryAudit,type SyntheticOrphanRecovery,type SyntheticRecoveryEventCode
} from './synthetic-orphan-recovery';
const eventLabels:Readonly<Record<SyntheticRecoveryEventCode,string>>={
 'orphan-detected':'Interrupção fictícia identificada',
 'old-evidence-invalidated':'Análise antiga invalidada',
 'previously-acknowledged':'Abandono reconhecido anteriormente',
 'orphan-acknowledged':'Abandono reconhecido no registro',
 'acknowledgement-required':'Nova análise recusada: reconhecimento pendente',
 'old-evidence-rejected':'Reutilização da análise antiga recusada',
 'new-evidence-incomplete':'Nova análise fictícia incompleta recusada',
 'new-evidence-recorded':'Nova triagem fictícia independente registrada'
};
export default function SyntheticRecoveryAuditPreview({record}:{record:SyntheticOrphanRecovery}){
 const audit=projectSyntheticRecoveryAudit(record);
 return <section className="synthetic-recovery-audit" role="region" aria-label="Registro sequencial fictício da recuperação" data-persistent="false" data-verified="false">
  <header>
   <div>
    <span className="eyebrow">TRILHA DE EVENTOS · SOMENTE MEMÓRIA</span>
    <h6><ClipboardList size={14} aria-hidden="true"/> O que aconteceu com as evidências?</h6>
    <p>A sequência abaixo é montada apenas pelas transições do simulador. Não possui assinatura, armazenamento durável nem validação de arquivos reais.</p>
   </div>
   <span className="synthetic-recovery-audit-locked"><LockKeyhole size={13} aria-hidden="true"/> Não autenticado</span>
  </header>
  <div className="synthetic-recovery-audit-metrics">
   <div><small>Eventos registrados</small><strong data-testid="synthetic-audit-count">{audit.eventCount}</strong></div>
   <div><small>Revisão fictícia antiga</small><strong data-testid="synthetic-audit-old">1 · Substituída</strong></div>
   <div><small>Nova revisão declarativa</small><strong data-testid="synthetic-audit-new">{audit.activeEvidenceRevision===2?'2 · Fictícia':'Pendente'}</strong></div>
   <div><small>Conclusões antigas reutilizáveis</small><strong data-testid="synthetic-audit-reusable">0</strong></div>
  </div>
  <ol className="synthetic-recovery-audit-events" aria-label="Sequência dos eventos">
   {audit.events.map(event=><li key={event.sequence} data-sequence={event.sequence} data-event={event.code}>
    <span className="synthetic-recovery-audit-number" aria-hidden="true">{event.sequence}</span>
    <div><strong>{eventLabels[event.code]}</strong>
     <p>Revisão antiga 1 · {event.newEvidenceRevision===2?'Nova evidência declarativa 2, sem validação real':'Sem nova evidência confirmada'}</p>
    </div>
   </li>)}
  </ol>
  <SyntheticRestartPreview record={record}/>
  <p className="synthetic-recovery-audit-warning" data-testid="synthetic-audit-notice">Este registro não é uma auditoria criptográfica nem persiste após reiniciar o aplicativo. Mesmo com novos eventos, nenhum mod foi recuperado, verificado ou autorizado para instalação.</p>
 </section>;
}
