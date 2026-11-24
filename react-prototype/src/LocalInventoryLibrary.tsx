import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Folder,Archive} from 'lucide-react';
import {focusInspectionPanel} from './library-inspection-navigation';
import {captureLocalObservation,compareLocalObservations,type LocalObservation} from './local-inventory-comparison.mjs';
import type {FolderInspection,InspectionGameId,OmsiStructureHints} from './inspection-types';

const gameIds=['omsi','ets2','ats'] as const;
const labels:Record<InspectionGameId,string>={omsi:'OMSI 2',ets2:'Euro Truck Simulator 2',ats:'American Truck Simulator'};
type Props={
 inspections:Partial<Record<InspectionGameId,FolderInspection>>;
 busy:boolean;
 onOpenGames:()=>void;
 onClear:()=>void;
 reference:LocalObservation|null;
 onReference:(value:LocalObservation|null)=>void;
};
const searchKey=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
export function LocalInventoryLibrary({inspections,busy,onOpenGames,onClear,reference,onReference}:Props){
 const [game,setGame]=useState<InspectionGameId|'all'>('all');
 const [kind,setKind]=useState<'all'|'directory'|'package'>('all');
 const [query,setQuery]=useState('');
 const [order,setOrder]=useState<'name'|'game'|'group'>('name');
 const [page,setPage]=useState(0);
 const pageSize=20;
 const [structure,setStructure]=useState<OmsiStructureHints|null>(null);
 const [structureBusy,setStructureBusy]=useState(false);
 const structureFlight=useRef(false);
 const structureButton=useRef<HTMLButtonElement>(null);
 const structureRestoreFocus=useRef(false);
 const pageStatus=useRef<HTMLSpanElement>(null);
 const pageFocus=useRef(false);
 useLayoutEffect(()=>{
  if(!structureBusy&&structureRestoreFocus.current){
   structureRestoreFocus.current=false;
   if(document.activeElement===document.body||document.activeElement===structureButton.current)
    structureButton.current?.focus({preventScroll:true});
  }
 },[structureBusy]);
 async function inspectStructure(){
  if(busy||structureFlight.current||!window.omsiPreview?.inspectOmsiCandidate)return;
  structureFlight.current=true;
  structureRestoreFocus.current=document.activeElement===structureButton.current;
  setStructure(null);setStructureBusy(true);
  try{
   const result=await window.omsiPreview.inspectOmsiCandidate();
   setStructure(result);
  }catch{setStructure({status:'error',message:'Não foi possível verificar os nomes da pasta.'});}
  finally{structureFlight.current=false;setStructureBusy(false);}
 }
 const snapshots=useMemo(()=>gameIds.flatMap(id=>{
  const report=inspections[id];
  if(report?.status!=='ok'||report.game!==id)return [];
  const groups=report.groups.filter(g=>g.inventory!==undefined);
  if(!groups.length)return [];
  return [{id,groups,limited:report.limited}];
 }),[inspections]);
 const comparison=useMemo(()=>reference?compareLocalObservations(reference,captureLocalObservation(inspections[reference.game],reference.game)):null,[reference,inspections]);
 const rows=useMemo(()=>snapshots.flatMap(s=>s.groups.flatMap(g=>(g.inventory??[]).map(item=>({
  ...item,game:s.id,group:g.key,groupLabel:g.name,
  groupLimited:g.limited,reportLimited:s.limited,groupNames:g.inventory?.length??0,
  groupCandidates:g.directories+g.packageCandidates
 })))),[snapshots]);
 const shown=useMemo(()=>{
  const matching=rows.filter(row=>(game==='all'||game===row.game)&&
   (kind==='all'||kind===row.kind)&&searchKey(row.label).includes(searchKey(query.trim())));
  const compare=(a:string,b:string)=>a.localeCompare(b,'pt-BR',{sensitivity:'base',numeric:true})||(a<b?-1:a>b?1:0);
  return matching.sort((a,b)=>(order==='game'?gameIds.indexOf(a.game)-gameIds.indexOf(b.game):
   order==='group'?compare(a.groupLabel,b.groupLabel):0)||compare(a.label,b.label)||
   gameIds.indexOf(a.game)-gameIds.indexOf(b.game)||compare(a.group,b.group));
 },[rows,game,kind,query,order]);
 const pages=Math.max(1,Math.ceil(shown.length/pageSize));
 const currentPage=Math.min(page,pages-1);
 useLayoutEffect(()=>{
  if(pageFocus.current){
   pageFocus.current=false;
   pageStatus.current?.focus({preventScroll:true});
  }
 },[currentPage]);
 function changePage(next:number){
  pageFocus.current=true;setPage(next);
 }
 const visibleRows=shown.slice(currentPage*pageSize,(currentPage+1)*pageSize);
 const directories=rows.filter(row=>row.kind==='directory').length;
 const packages=rows.length-directories;
 function resetFilters(){setGame('all');setKind('all');setQuery('');setOrder('name');setPage(0);}

 return <section className="library-by-game local-inventory-panel" aria-label="Biblioteca local da sessão">
  <div className="library-by-game-heading"><h2 id="local-inventory-heading" tabIndex={-1}>Conteúdo local</h2><span>Separado dos favoritos e do catálogo. Apenas nomes observados na última inspeção de cada jogo, nesta sessão.</span></div>
  <p>Não confirma instalação, ativação, integridade ou compatibilidade. A lista não é monitorada em tempo real e pode incluir conteúdo original do jogo.</p>
  <div className="library-quick-navigation">
   <button type="button" className="btn secondary" onClick={onOpenGames}>Inspecionar pastas em Jogos</button>
   <button type="button" className="btn secondary" disabled={busy||structureBusy||(Object.keys(inspections).length===0&&!structure&&!reference)} onClick={()=>{setStructure(null);resetFilters();onClear();focusInspectionPanel('local');}}>Limpar inspeções da sessão</button>
  </div>
  <div className="inspection-panel-links" role="group" aria-label="Atalhos de inspeção local">
   <button type="button" className="btn secondary" onClick={()=>focusInspectionPanel('metadata')}>Ir à pré-checagem OMSI</button>
   <button type="button" className="btn secondary" onClick={()=>focusInspectionPanel('demonstration')}>Ver demonstração de dependências</button>
  </div>
  <p className="inspection-panel-scope">Os atalhos apenas levam à seção correspondente. Nenhum candidato é aberto ou selecionado automaticamente.</p>
  {snapshots.length===0?<p>Nenhum inventário local nesta sessão. Confirme uma pasta em Jogos para começar.</p>:<>
   <div className="library-by-game-grid">{snapshots.map(s=>{
    const visible=s.groups.reduce((n,g)=>n+(g.inventory?.length??0),0);
    const observed=s.groups.reduce((n,g)=>n+g.directories+g.packageCandidates,0);
    return <div key={s.id}><strong>{labels[s.id]}</strong><p>{visible} nomes exibíveis de {observed} candidatos observados.</p><button type="button" className="btn secondary" disabled={busy||structureBusy||!captureLocalObservation(inspections[s.id],s.id)} onClick={()=>{const snapshot=captureLocalObservation(inspections[s.id],s.id);if(snapshot)onReference(snapshot);}}>Guardar referência de {labels[s.id]}</button>{(s.limited||visible<observed)&&<small>Lista incompleta: limite de inspeção ou nomes omitidos.</small>}</div>;
   })}</div>
   <dl className="local-inventory-summary" aria-label="Resumo dos nomes locais">
    <div><dt>Pastas candidatas</dt><dd>{directories}</dd></div>
    <div><dt>Pacotes candidatos</dt><dd>{packages}</dd></div>
    <div><dt>Nomes exibíveis</dt><dd>{rows.length}</dd></div>
   </dl>
   <div className="local-inventory-toolbar" aria-label="Filtros de conteúdo local">
    <label>Simulador<select aria-label="Simulador local" value={game} onChange={e=>{setGame(e.target.value as typeof game);setPage(0);}}><option value="all">Todos</option>{gameIds.map(id=><option key={id} value={id}>{labels[id]}</option>)}</select></label>
    <label>Tipo<select aria-label="Tipo de conteúdo local" value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setPage(0);}}><option value="all">Todos</option><option value="directory">Pastas</option><option value="package">Pacotes .SCS/.ZIP</option></select></label>
    <label>Pesquisar<input aria-label="Pesquisar conteúdo local" value={query} maxLength={160} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>
    <label>Ordenar<select aria-label="Ordenar conteúdo local" value={order} onChange={e=>{setOrder(e.target.value as typeof order);setPage(0);}}><option value="name">Nome (A–Z)</option><option value="game">Simulador</option><option value="group">Grupo de inspeção</option></select></label>
    <button type="button" className="btn secondary" onClick={resetFilters}>Limpar filtros locais</button>
   </div>
   <p role="status">{shown.length} de {rows.length} nomes locais correspondem aos filtros</p>
   {shown.length===0?<p>Nenhum candidato corresponde aos filtros locais.</p>:<><ul className="inspection-notices local-inventory-list">{visibleRows.map(row=><li key={JSON.stringify([row.game,row.group,row.label])}>
     <div className="local-candidate-header">
      <span className="local-candidate-icon" aria-hidden="true">{row.kind==='directory'?<Folder size={20}/>:<Archive size={20}/>}</span>
      <div className="local-candidate-title"><strong><bdi>{row.label}</bdi></strong><span>{labels[row.game]} · {row.groupLabel}</span></div>
      <span className="local-candidate-type">{row.kind==='directory'?'Pasta candidata':'Pacote candidato'}</span>
     </div>
     <details className="local-candidate-details">
      <summary>Detalhes do candidato</summary>
      <dl className="local-candidate-facts">
       <div><dt>Simulador da inspeção</dt><dd>{labels[row.game]}</dd></div>
       <div><dt>Grupo observado</dt><dd>{row.groupLabel}</dd></div>
       <div><dt>Tipo observado</dt><dd>{row.kind==='directory'?'Diretório':'Arquivo candidato'}</dd></div>
       <div><dt>Formato aparente</dt><dd>{row.kind==='package'?(row.label.toLowerCase().endsWith('.scs')?'.scs':'.zip'):'Não determinado'}</dd></div>
       <div><dt>Origem da informação</dt><dd>Última inspeção da sessão, primeiro nível</dd></div>
       <div><dt>Abrangência do grupo</dt><dd>{row.groupLimited?'Observação parcial':row.groupNames<row.groupCandidates?'Nomes omitidos':'Nomes observados no limite previsto'}</dd></div>
      </dl>
      {(row.groupLimited||row.reportLimited||row.groupNames<row.groupCandidates)&&<p>O inventário pode estar incompleto; outros candidatos podem existir.</p>}
      <p>Não confirma que o candidato seja um mod, nem sua instalação, fabricante, versão, tamanho, integridade ou compatibilidade. Nenhum conteúdo aberto.</p>
     </details>
    </li>)}</ul>
    <div className="local-inventory-pagination" aria-label="Paginação dos nomes locais">
     <button type="button" className="btn secondary" disabled={currentPage===0} onClick={()=>changePage(currentPage-1)}>Página anterior de conteúdo local</button>
     <span ref={pageStatus} tabIndex={-1} role="status">Página {currentPage+1} de {pages} · {currentPage*pageSize+1}–{Math.min(shown.length,(currentPage+1)*pageSize)} de {shown.length}</span>
     <button type="button" className="btn secondary" disabled={currentPage+1>=pages} onClick={()=>changePage(currentPage+1)}>Próxima página de conteúdo local</button>
    </div></>}
  </>}
  <section className="local-comparison" aria-label="Comparação de observações locais">
   <h3>Comparar observações da sessão</h3>
   <p>Guarde uma referência de um simulador e faça outra inspeção em Jogos. A comparação usa somente nomes, tipos e grupos exibíveis; a mesma instalação não é comprovada.</p>
   {!reference?<p>Nenhuma referência guardada nesta sessão.</p>:<>
    <p role="status">Referência guardada: {labels[reference.game]} · {reference.rows.length} nomes.</p>
    <button type="button" className="btn secondary" onClick={()=>{onReference(null);focusInspectionPanel('local');}}>Descartar referência local</button>
    {!comparison?<p>Observação atual indisponível ou escopo de seleção diferente. Não há comparação.</p>:<>
     <dl className="local-inventory-summary">
      <div><dt>Presentes em ambas</dt><dd>{comparison.shared}</dd></div>
      <div><dt>Só na referência</dt><dd>{comparison.onlyReference.length}</dd></div>
      <div><dt>Só na observação atual</dt><dd>{comparison.onlyCurrent.length}</dd></div>
     </dl>
     {comparison.partial&&<p>Uma ou ambas as observações são parciais. Nomes não exibidos não comprovam ausência.</p>}
     {([['Só na referência',comparison.onlyReference],['Só na observação atual',comparison.onlyCurrent]] as const).map(([title,items])=>items.length>0&&<details key={title}><summary>{title} — exemplos ({Math.min(10,items.length)} de {items.length})</summary><ul>{items.slice(0,10).map(item=><li key={item.key}><bdi>{item.label}</bdi> · {item.group} · {item.kind==='directory'?'Pasta candidata':'Pacote candidato'}</li>)}</ul></details>)}
     <p>Não comprova instalação, remoção, atualização, identidade ou igualdade de conteúdo dos mods.</p>
    </>}
   </>}
  </section>
  {window.omsiPreview?.inspectOmsiCandidate&&<section aria-label="Estrutura de um conteúdo OMSI">
   <h3>Identificar estrutura OMSI</h3>
   <p>Escolha diretamente a pasta de um veículo ou mapa. A análise observa somente extensões e nomes fixos no primeiro nível, sem abrir arquivos nem percorrer subpastas.</p>
   <button ref={structureButton} type="button" className="btn secondary" disabled={busy||structureBusy} onClick={()=>void inspectStructure()}>{structureBusy?'Verificando estrutura...':'Selecionar pasta de veículo ou mapa'}</button>
   {structure?.status==='cancelled'&&<p role="status">Seleção de estrutura cancelada.</p>}
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
