import type {ReactNode} from 'react';
import {Activity,Archive,Bus,ChevronRight,Clock3,Folder,Gamepad2,Layers,AlertTriangle,Truck} from 'lucide-react';
import {summarizeLocalDiagnostics} from './local-diagnostic-summary.mjs';
import type {FolderInspection,InspectionGameId} from './inspection-types';
import type {LocalActivity} from './local-session-activity.mjs';
const games=['omsi','ets2','ats'] as const;
const names={omsi:'OMSI 2',ets2:'ETS2',ats:'ATS'};
const states={unknown:'Sem observação local',unavailable:'Inspeção indisponível',unrecognized:'Estrutura não reconhecida',partial:'Observação parcial',observed:'Estrutura observada'};
const descriptions={'inspection-observed':'Observação de estrutura recebida','inspection-unavailable':'Inspeção indisponível','inspection-cancelled':'Inspeção cancelada','reference-saved':'Referência de comparação guardada','reference-discarded':'Referência de comparação descartada'};
type Props={heroControls:ReactNode;simulatorCards:ReactNode;inspections:Partial<Record<InspectionGameId,FolderInspection>>;events:LocalActivity[];busy:boolean;onLibrary:()=>void;onDiagnostic:()=>void;onHistory:()=>void;onGames:()=>void};
export function PremiumDashboard({heroControls,simulatorCards,inspections,events,busy,onLibrary,onDiagnostic,onHistory,onGames}:Props){
 const summary=summarizeLocalDiagnostics(inspections);
 const rows=games.flatMap(game=>{
  const report=inspections[game];
  return report?.status==='ok'&&report.game===game?report.groups.flatMap(g=>(g.inventory??[]).map(item=>({...item,game,group:g.key,groupLabel:g.name}))):[];
 });
 const stats=[{label:'Simuladores observados',value:summary.observedGames,Icon:Gamepad2,action:onGames},{label:'Nomes locais exibíveis',value:rows.length,Icon:Layers,action:onLibrary},{label:'Atividades da sessão',value:events.length,Icon:Activity,action:onHistory},{label:'Simuladores com atenção',value:summary.attentionGames,Icon:AlertTriangle,action:onDiagnostic}];
 return <div className="premium-dashboard">
  {busy&&<p className="premium-busy" role="status">Inspeção em andamento — observações anteriores podem estar visíveis.</p>}
  <section className="premium-stats" aria-label="Indicadores da sessão">{stats.map(({label,value,Icon,action},index)=><button type="button" key={label} className={'premium-stat premium-accent-'+index%2} onClick={action}><Icon size={26} aria-hidden="true"/><span><small>{label}</small><strong>{value.toLocaleString('pt-BR')}</strong></span><ChevronRight className="premium-stat-arrow" size={15} aria-hidden="true"/></button>)}</section>
  <section className="negresco-simulator-section" aria-label="Simuladores disponíveis"><div className="premium-panel-header"><Gamepad2 size={24} aria-hidden="true"/><div><h2>Meus simuladores</h2><p>Selecione um simulador para explorar o catálogo.</p></div><button className="premium-link" type="button" onClick={onGames}>Gerenciar simuladores <ChevronRight size={15}/></button></div>{simulatorCards}</section>
  <div className="negresco-quick-panel premium-panel" aria-label="Acesso rápido"><div className="premium-panel-header"><Activity size={23} aria-hidden="true"/><h2>Acesso rápido</h2></div><div className="negresco-quick-grid">{[{label:"Diagnóstico",Icon:Activity,action:onDiagnostic},{label:"Conteúdo local",Icon:Folder,action:onLibrary},{label:"Inspecionar jogos",Icon:Gamepad2,action:onGames},{label:"Histórico da sessão",Icon:Clock3,action:onHistory}].map(({label,Icon,action})=><button type="button" key={label} className="btn secondary" onClick={action}><Icon size={22} aria-hidden="true"/>{label}</button>)}</div></div>
  <div className="premium-bottom-grid">
   <section className="premium-panel" aria-label="Diagnóstico no início"><div className="premium-panel-header"><Activity size={25} aria-hidden="true"/><div><h2>Central de diagnóstico</h2><p>Estado das observações dos simuladores</p></div><button type="button" className="premium-link" onClick={onDiagnostic}>Rever <ChevronRight size={15}/></button></div><div className="premium-diagnostic-grid">{summary.rows.map(row=><button type="button" className="premium-diagnostic-card" key={row.game} onClick={onDiagnostic}><span>{row.game==='omsi'?<Bus size={22}/>:<Truck size={22}/>}<strong>{names[row.game]}</strong></span><small data-state={row.state}>{states[row.state]}</small></button>)}</div><p className="premium-panel-note">Somente metadados, sem diagnóstico de compatibilidade.</p></section>
   <section className="premium-panel negresco-storage" aria-label="Armazenamento"><div className="premium-panel-header"><Archive size={23} aria-hidden="true"/><div><h2>Armazenamento</h2><p>Uso do disco não medido nesta prévia.</p></div></div><button type="button" className="premium-link" onClick={onLibrary}>Consultar conteúdo local <ChevronRight size={15}/></button></section>
   <section className="premium-panel" aria-label="Atividades recentes no início"><div className="premium-panel-header"><Clock3 size={25} aria-hidden="true"/><div><h2>Atividades recentes</h2><p>Somente nesta sessão</p></div><button type="button" className="premium-link" onClick={onHistory}>Ver histórico <ChevronRight size={15}/></button></div>{events.length?<ol className="premium-events">{events.slice(-3).reverse().map((event,i)=><li key={i}><Activity size={19} aria-hidden="true"/><span><strong>{descriptions[event.action]}</strong><small>{names[event.game]}</small></span></li>)}</ol>:<p className="premium-empty-activity">Nenhuma atividade local registrada.</p>}</section>
  </div>
  <div className="negresco-live-controls">{heroControls}</div>
  <section className="premium-panel" aria-label="Biblioteca local no início">
   <div className="premium-panel-header"><Folder size={26} aria-hidden="true"/><div><h2>Biblioteca local</h2><p>Nomes de candidatos observados nesta sessão</p></div><button type="button" className="premium-link" onClick={onLibrary}>Ver tudo na biblioteca <ChevronRight size={15}/></button></div>
   {rows.length?<div className="premium-local-grid">{rows.slice(0,4).map(row=><article className="premium-local-card" key={JSON.stringify([row.game,row.group,row.kind,row.label])}><div className={'premium-local-art '+(row.kind==='package'?'package':'directory')} aria-hidden="true">{row.kind==='package'?<Archive size={35}/>:<Folder size={35}/>}</div><div className="premium-local-info"><strong><bdi>{row.label}</bdi></strong><small>{names[row.game]} · {row.groupLabel}</small><span>{row.kind==='directory'?'Pasta candidata':'Pacote candidato'}</span></div></article>)}</div>:<div className="premium-empty"><Folder size={30} aria-hidden="true"/><div><strong>Nenhum nome local exibível</strong><p>Selecione uma pasta de teste em Jogos para começar. Não há inventário verificado.</p></div><button type="button" className="btn secondary" onClick={onGames}>Ir para inspeções</button></div>}
   <p className="premium-panel-note">Até 4 nomes da observação atual. Ícones ilustrativos; conteúdo, instalação e compatibilidade não verificados.</p>
  </section>
 </div>;
}
