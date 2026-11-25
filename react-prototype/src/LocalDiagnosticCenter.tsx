import {summarizeLocalDiagnostics} from './local-diagnostic-summary.mjs';
import {focusInspectionPanel} from './library-inspection-navigation';
import type {FolderInspection,InspectionGameId} from './inspection-types';
const labels={omsi:'OMSI 2',ets2:'Euro Truck Simulator 2',ats:'American Truck Simulator'};
const states={unknown:'Sem observação local',unavailable:'Inspeção indisponível',unrecognized:'Estrutura não reconhecida',partial:'Observação parcial',observed:'Estrutura observada'};
type Props={inspections:Partial<Record<InspectionGameId,FolderInspection>>;available:boolean;busy:boolean;onGames:()=>void};
export function LocalDiagnosticCenter({inspections,available,busy,onGames}:Props){
 const summary=summarizeLocalDiagnostics(inspections);
 return <section className="local-diagnostic-center" aria-label="Central de diagnóstico local">
  <div className="library-by-game-heading"><h2 id="premium-diagnostic-heading" tabIndex={-1}>Central de diagnóstico</h2><span>Observações da sessão · metadados</span></div>
  <p>Reúne indícios de estrutura já observados. Não é uma análise do conteúdo dos mods, nem um diagnóstico de compatibilidade.</p>
  {busy&&<p role="status">Inspeção em andamento. Os dados abaixo podem pertencer à observação anterior.</p>}
  <dl className="local-inventory-summary">
   <div><dt>Simuladores com observação</dt><dd>{summary.observedGames} de 3</dd></div>
   <div><dt>Simuladores com pontos de atenção</dt><dd>{summary.attentionGames}</dd></div>
  </dl>
  <div className="local-diagnostic-grid">{summary.rows.map(row=><article key={row.game} aria-label={'Diagnóstico de '+labels[row.game]}>
   <h3>{labels[row.game]}</h3><p className="local-diagnostic-state">{states[row.state]}</p>
   {row.state!=='unknown'&&row.state!=='unavailable'&&<ul>
    <li>{row.inventoryCollected?row.names+' nomes exibíveis':row.names+' nomes exibíveis · coleta incompleta ou indisponível'}</li>
    {row.missingGroups>0&&<li>{row.missingGroups} grupos esperados não observados.</li>}
    {row.limited&&<li>Limite de inspeção atingido; outras entradas podem existir.</li>}
    {row.namesOmitted&&<li>Alguns nomes não foram exibidos.</li>}
    {row.links>0&&<li>{row.links} links ignorados{row.limited?' (contagem parcial)':''}.</li>}
   </ul>}
   <small>Conteúdo e compatibilidade não verificados.</small>
  </article>)}</div>
  <div className="inspection-panel-links" role="group" aria-label="Atalhos da central de diagnóstico">
   <button type="button" className="btn secondary" onClick={onGames}>Rever inspeções em Jogos</button>
   {available&&<button type="button" className="btn secondary" onClick={()=>focusInspectionPanel('local')}>Consultar conteúdo local</button>}
   <button type="button" className="btn secondary" onClick={()=>focusInspectionPanel('metadata')}>Consultar pré-checagem OMSI</button>
   <button type="button" className="btn secondary" onClick={()=>focusInspectionPanel('demonstration')}>Consultar exemplos de dependências</button>
  </div>
  <p>Instalação, remoção, atualização e reparo permanecem indisponíveis. Nenhuma inspeção é iniciada por esses atalhos.</p>
 </section>;
}
