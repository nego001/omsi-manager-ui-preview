import {useMemo,useState} from 'react';
import type {FolderInspection,InspectionGameId,OmsiStructureHints} from './inspection-types';

const gameIds=['omsi','ets2','ats'] as const;
const labels:Record<InspectionGameId,string>={omsi:'OMSI 2',ets2:'Euro Truck Simulator 2',ats:'American Truck Simulator'};
type Props={
 inspections:Partial<Record<InspectionGameId,FolderInspection>>;
 busy:boolean;
 onOpenGames:()=>void;
 onClear:()=>void;
};
const searchKey=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
export function LocalInventoryLibrary({inspections,busy,onOpenGames,onClear}:Props){
 const [game,setGame]=useState<InspectionGameId|'all'>('all');
 const [kind,setKind]=useState<'all'|'directory'|'package'>('all');
 const [query,setQuery]=useState('');
 const [structure,setStructure]=useState<OmsiStructureHints|null>(null);
 const [structureBusy,setStructureBusy]=useState(false);
 async function inspectStructure(){
  if(busy||structureBusy||!window.omsiPreview?.inspectOmsiCandidate)return;
  setStructureBusy(true);
  try{
   const result=await window.omsiPreview.inspectOmsiCandidate();
   if(result.status!=='cancelled')setStructure(result);
  }catch{setStructure({status:'error',message:'Não foi possível verificar os nomes da pasta.'});}
  finally{setStructureBusy(false);}
 }
 const snapshots=useMemo(()=>gameIds.flatMap(id=>{
  const report=inspections[id];
  if(report?.status!=='ok'||report.game!==id)return [];
  const groups=report.groups.filter(g=>g.inventory!==undefined);
  if(!groups.length)return [];
  return [{id,groups,limited:report.limited}];
 }),[inspections]);
 const rows=useMemo(()=>snapshots.flatMap(s=>s.groups.flatMap(g=>(g.inventory??[]).map(item=>({
  ...item,game:s.id,group:g.key,groupLabel:g.name
 })))),[snapshots]);
 const shown=useMemo(()=>rows.filter(row=>(game==='all'||game===row.game)&&
  (kind==='all'||kind===row.kind)&&searchKey(row.label).includes(searchKey(query.trim()))),[rows,game,kind,query]);
 return <section className="library-by-game" aria-label="Biblioteca local da sessão">
  <div className="library-by-game-heading"><h2>Conteúdo local</h2><span>Separado dos favoritos e do catálogo. Apenas nomes observados na última inspeção de cada jogo, nesta sessão.</span></div>
  <p>Não confirma instalação, ativação, integridade ou compatibilidade. A lista não é monitorada em tempo real e pode incluir conteúdo original do jogo.</p>
  <div className="library-quick-navigation">
   <button type="button" className="btn secondary" onClick={onOpenGames}>Inspecionar pastas em Jogos</button>
   <button type="button" className="btn secondary" disabled={busy||structureBusy||(Object.keys(inspections).length===0&&!structure)} onClick={()=>{setStructure(null);onClear();}}>Limpar inspeções da sessão</button>
  </div>
  {snapshots.length===0?<p>Nenhum inventário local nesta sessão. Confirme uma pasta em Jogos para começar.</p>:<>
   <div className="library-by-game-grid">{snapshots.map(s=>{
    const visible=s.groups.reduce((n,g)=>n+(g.inventory?.length??0),0);
    const observed=s.groups.reduce((n,g)=>n+g.directories+g.packageCandidates,0);
    return <div key={s.id}><strong>{labels[s.id]}</strong><p>{visible} nomes exibíveis de {observed} candidatos observados.</p>{(s.limited||visible<observed)&&<small>Lista incompleta: limite de inspeção ou nomes omitidos.</small>}</div>;
   })}</div>
   <div className="library-toolbar" aria-label="Filtros de conteúdo local">
    <label>Simulador<select aria-label="Simulador local" value={game} onChange={e=>setGame(e.target.value as typeof game)}><option value="all">Todos</option>{gameIds.map(id=><option key={id} value={id}>{labels[id]}</option>)}</select></label>
    <label>Tipo<select aria-label="Tipo de conteúdo local" value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="all">Todos</option><option value="directory">Pastas</option><option value="package">Pacotes .SCS/.ZIP</option></select></label>
    <label>Pesquisar<input aria-label="Pesquisar conteúdo local" value={query} maxLength={160} onChange={e=>setQuery(e.target.value)}/></label>
    <button type="button" className="btn secondary" onClick={()=>{setGame('all');setKind('all');setQuery('');}}>Limpar filtros locais</button>
   </div>
   <p role="status">{shown.length} de {rows.length} nomes locais exibidos</p>
   {shown.length===0?<p>Nenhum candidato corresponde aos filtros locais.</p>:<ul className="inspection-notices">{shown.map(row=><li key={JSON.stringify([row.game,row.group,row.label])}><strong style={{overflowWrap:'anywhere'}}><bdi>{row.label}</bdi></strong> — {labels[row.game]} · {row.groupLabel} · {row.kind==='directory'?'Pasta candidata':'Pacote candidato'}</li>)}</ul>}
  </>}
  {window.omsiPreview?.inspectOmsiCandidate&&<section aria-label="Estrutura de um conteúdo OMSI">
   <h3>Identificar estrutura OMSI</h3>
   <p>Escolha diretamente a pasta de um veículo ou mapa. A análise observa somente extensões e nomes fixos no primeiro nível, sem abrir arquivos nem percorrer subpastas.</p>
   <button type="button" className="btn secondary" disabled={busy||structureBusy} onClick={()=>void inspectStructure()}>{structureBusy?'Verificando estrutura...':'Selecionar pasta de veículo ou mapa'}</button>
   {structure?.status==='error'&&<p role="alert">{structure.message}</p>}
   {structure?.status==='structure-hints'&&<div className="inspection-assessment" role="status">
    <strong>{{'vehicle-candidate':'Estrutura candidata de veículo','map-candidate':'Estrutura candidata de mapa',mixed:'Indícios mistos',inconclusive:'Estrutura inconclusiva'}[structure.kind]}</strong>
    <span>{structure.busFiles} nomes .bus · {structure.aiVehicleFiles} nomes .ovh · {structure.mapTiles} nomes .map · global.cfg: {structure.globalConfig?'observado':'não observado'}</span>
    {structure.limited&&<small>Inspeção parcial; outras entradas podem existir.</small>}
    {structure.linksSkipped>0&&<small>{structure.linksSkipped} links ignorados.</small>}
    <small>Fabricante, carroceria, chassi, versão, origem, dependências e compatibilidade não verificados. A classificação é apenas um indício.</small>
   </div>}
  </section>}
  <small>Os nomes não são salvos nos favoritos, exportados nem persistidos por esta biblioteca. Instalar e remover permanecem bloqueados.</small>
 </section>;
}
