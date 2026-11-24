import type {LocalActivity} from './local-session-activity.mjs';
const labels={omsi:'OMSI 2',ets2:'Euro Truck Simulator 2',ats:'American Truck Simulator'};
const descriptions={'inspection-observed':'Observação de estrutura recebida','inspection-unavailable':'Inspeção indisponível','inspection-cancelled':'Inspeção cancelada','reference-saved':'Referência de comparação guardada','reference-discarded':'Referência de comparação descartada'};
type Props={events:LocalActivity[];onClear:()=>void;onLibrary:()=>void};
export function LocalSessionActivity({events,onClear,onLibrary}:Props){
 return <section className="local-session-activity" aria-label="Atividades locais da sessão">
  <div className="library-by-game-heading"><h2>Atividades locais da sessão</h2><span>Até 30 eventos recentes · somente memória</span></div>
  <p>Resultados de inspeção recebidos e ações sobre referências de comparação. Não é um registro de instalação, auditoria ou histórico de operações.</p>
  {events.length===0?<p role="status">Nenhuma atividade local registrada nesta sessão.</p>:<ol className="local-activity-list" aria-label="Eventos recentes">{events.slice().reverse().map((event,i)=><li key={i}><strong>{descriptions[event.action]}</strong><span>{labels[event.game]}</span></li>)}</ol>}
  <div className="inspection-panel-links">
   <button type="button" className="btn secondary" onClick={onLibrary}>Consultar biblioteca local</button>
   <button type="button" className="btn secondary" disabled={!events.length} onClick={onClear}>Limpar atividades locais</button>
  </div>
  <small>Limpar atividades não altera inspeções ou referências guardadas. Nenhum nome, caminho ou conteúdo de arquivo é registrado.</small>
 </section>;
}
