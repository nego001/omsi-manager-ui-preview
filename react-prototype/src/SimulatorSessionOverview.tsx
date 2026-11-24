import {Bus,Truck} from 'lucide-react';
import type {FolderInspection,InspectionGameId} from './inspection-types';
const games=[['omsi','OMSI 2'],['ets2','Euro Truck Simulator 2'],['ats','American Truck Simulator']] as const;
type Props={inspections:Partial<Record<InspectionGameId,FolderInspection>>;inspecting:InspectionGameId|null;available:boolean;onReview:(id:InspectionGameId)=>void};
export function SimulatorSessionOverview({inspections,inspecting,available,onReview}:Props){
 return <section className="simulator-session-overview" aria-label="Central dos simuladores">
  <div className="library-by-game-heading"><h2>Visão geral da sessão</h2><span>Somente observações locais · sem verificação de instalação</span></div>
  <div className="simulator-session-grid">{games.map(([id,label])=>{
   const report=inspections[id];
   const ok=report?.status==='ok'&&report.game===id?report:null;
   const names=ok?.groups.some(g=>g.inventory!==undefined)?ok.groups.reduce((n,g)=>n+(g.inventory?.length??0),0):null;
   const partial=ok&&(ok.limited||ok.groups.some(g=>g.limited||!g.found||g.inventory===undefined||(g.inventory?.length??0)<g.directories+g.packageCandidates));
   const status=inspecting===id?'Inspeção em andamento':report?.status==='error'?'Última inspeção indisponível':!ok?'Sem observação nesta sessão':!ok.recognized?'Estrutura não reconhecida':partial?'Observação parcial':'Estrutura observada';
   return <article key={id} className="simulator-session-card" aria-label={'Resumo de '+label}>
    <div className="simulator-session-card-heading"><span className="simulator-session-icon" aria-hidden="true">{id==='omsi'?<Bus size={22}/>:<Truck size={22}/>}</span><h3>{label}</h3></div>
    <p className="simulator-session-status" data-observation={inspecting===id?'pending':report?.status==='error'?'unavailable':!ok?'unknown':!ok.recognized?'unrecognized':partial?'partial':'observed'} role="status">{status}</p>
    {inspecting===id&&ok&&<small>Os números abaixo pertencem à observação anterior.</small>}
    {ok&&<dl className="simulator-session-facts">
     <div><dt>Grupos encontrados</dt><dd>{ok.groups.filter(g=>g.found).length} de {ok.groups.length}</dd></div>
     <div><dt>Nomes exibíveis</dt><dd>{names===null?'Não coletados':names}</dd></div>
    </dl>}
    <small className="simulator-session-boundary">Instalação e compatibilidade não verificadas.</small>
    <button type="button" className="btn secondary" onClick={()=>onReview(id)}>{'Ir à inspeção de '+label}</button>
   </article>;
  })}</div>
  <p>{available?'Os cartões refletem apenas as últimas observações da sessão.':'Inspeção local disponível apenas no desktop compatível.'} Os atalhos não abrem seletores nem iniciam buscas.</p>
 </section>;
}
