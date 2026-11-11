import {useEffect,useMemo,useRef,useState} from 'react';
import {parseCatalogManifest,MAX_CATALOG_BYTES,type CatalogMod} from './catalog';
import {matchesCatalogSearch,declaredSearchMatchFields} from './catalog-search';
import {compareModsByDeclaredSize,declaredSizeBytes} from './declared-size-sort';
import {summarizeDeclaredSizes} from './declared-size-summary';
import {analyzeModRelations} from './relation-analysis';
import {analyzeDeclaredBatch} from './batch-declared-analysis';
import {prepareBatchReviewReadiness} from './batch-review-readiness';
import {serializeDeclaredSessionReport,serializeDeclaredSessionArchive} from './session-report-export';
import {compareDeclaredSessionReports,serializeDeclaredSessionComparison} from './session-report-compare';
import {parseDeclaredSessionReview,compareReviewedDeclaredReports,serializeReviewedDeclaredComparison,MAX_SESSION_REVIEW_BYTES,type ReviewedDeclaredFile} from './session-report-review';
import {parseDeclaredComparisonReview,type ReviewedComparisonFile} from './session-comparison-review';
import {explainRelationIssue,summarizeRelationIssues} from './relation-guidance';
import {buildRelationTimeline} from './relation-timeline';
import {collectIncomingDeclaredRelations,indexIncomingDeclaredRelations,summarizeCrossGameIncoming} from './incoming-relations';
import {consolidateDiagnostic} from './diagnostic-report';
import SyntheticDiagnosticPreview from './SyntheticDiagnosticPreview';
import SyntheticGateLab from './SyntheticGateLab';
import FixtureCrossPackageLab from './FixtureCrossPackageLab';
import {summarizeDeclaredStatus,type DeclaredStatusKind} from './library-declared-status';
import type {FolderInspection} from './inspection-types';
import {House,Gamepad2,Grid2X2,Library,FileText,Clock3,History,Settings2,ShieldCheck,Search,ChevronRight,ArrowLeft,LockKeyhole,Download,Trash2,CheckCircle2,AlertTriangle,Menu} from 'lucide-react';

type GameId='omsi'|'ets2'|'ats';
type Screen='home'|'games'|'catalog'|'library'|'details'|'queue'|'history'|'settings'|'security';
type Category='Todos'|'Ônibus'|'Mapas'|'Caminhões'|'Sons'|'Gráficos';
type Mod=CatalogMod;
type DependencyLookupContext={
 sourceId:string;sourceTitle:string;targetId:string;
 origin:'home'|'catalog'|'library';
 hypotheticalVersion:string;
 previousGame:GameId|'all';previousCategory:Category;
 previousSearch:string;previousSort:'catalog'|'title'|'game';
};
type SessionBatchRecord={
 id:number;selectedIds:string[];selectedTitles:string[];selectedCount:number;
 games:GameId[];blockers:number;notices:number;
 source:'catalog-declarations';compatibilityVerified:false;installationVerified:false;
};
const games:Record<GameId,{title:string;publisher:string;app:number;color:string}> = {
 omsi:{title:'OMSI 2',publisher:'Aerosoft',app:252530,color:'#607fc8'},
 ets2:{title:'Euro Truck Simulator 2',publisher:'SCS Software',app:227300,color:'#b88c65'},
 ats:{title:'American Truck Simulator',publisher:'SCS Software',app:270880,color:'#c37c5d'}
};
const mods:Mod[]=[
 {id:'omsi-bus',title:'Ônibus Urbano Clássico',game:'omsi',category:'Ônibus',version:'1.0',description:'Veículo fictício usado apenas para validar o catálogo e os estados da interface.',size:'240 MB',safe:true},
 {id:'omsi-map',title:'Serra do Vale',game:'omsi',category:'Mapas',version:'0.9',description:'Mapa de demonstração. Nenhum arquivo real do jogo é acessado.',size:'1,2 GB',safe:true},
 {id:'omsi-sound',title:'Pacote de Sons',game:'omsi',category:'Sons',version:'1.1',description:'Prévia de um pacote de áudio fictício para os cartões.',size:'96 MB',safe:true},
 {id:'ets-truck',title:'Caminhão Rodoviário',game:'ets2',category:'Caminhões',version:'2.0',description:'Conteúdo ilustrativo para a biblioteca ETS2.',size:'320 MB',safe:true},
 {id:'ets-graphic',title:'Iluminação Noturna',game:'ets2',category:'Gráficos',version:'1.2',description:'Efeitos visuais para demonstração de filtros.',size:'76 MB',safe:true},
 {id:'ats-truck',title:'Long Haul Classic',game:'ats',category:'Caminhões',version:'1.4',description:'Caminhão fictício para teste de seleção dinâmica.',size:'410 MB',safe:true},
 {id:'ats-sound',title:'Motor & Estrada',game:'ats',category:'Sons',version:'1.0',description:'Pacote fictício para apresentar metadados.',size:'185 MB',safe:true}
];
const previewArt:Record<string,{glyph:string;first:string;second:string}> = {
 'omsi-bus':{glyph:'BUS',first:'#507ab9',second:'#18283e'},
 'omsi-map':{glyph:'MAP',first:'#729572',second:'#203c34'},
 'omsi-sound':{glyph:'SND',first:'#8c70b8',second:'#2c2446'},
 'ets-truck':{glyph:'TRK',first:'#b98858',second:'#393044'},
 'ets-graphic':{glyph:'FX',first:'#3b8caa',second:'#212f51'},
 'ats-truck':{glyph:'USA',first:'#b86669',second:'#33243b'},
 'ats-sound':{glyph:'V8',first:'#ad9562',second:'#49323c'}
};
function ModArtwork({mod}:{mod:Mod}){
 const palette:[string,string][]= [
  ['#557ab8','#222b45'],['#698778','#253c38'],['#9075bc','#372b53'],
  ['#aa785d','#49352d'],['#508d9e','#243c50'],['#b16f86','#472739']
 ];
 const hash=Array.from(mod.id).reduce((n,ch)=>((n*31+ch.charCodeAt(0))>>>0),0);
 const pair=palette[hash%palette.length];
 const art=previewArt[mod.id]??{glyph:mod.category==='Ônibus'?'BUS':mod.category==='Mapas'?'MAP':mod.category==='Caminhões'?'TRK':mod.category==='Sons'?'SND':'FX',first:pair[0],second:pair[1]};
 return <div className="mod-cover" style={{'--mod-first':art.first,'--mod-second':art.second} as React.CSSProperties}>
  <span className="mod-cover-glyph" aria-hidden="true">{art.glyph}</span>
  <div className="mod-cover-caption"><strong>{mod.title}</strong><small>VISUAL ILUSTRATIVO</small></div>
 </div>;
}
const nav:{id:Screen;label:string;icon:typeof House}[]=[
 {id:'home',label:'Início',icon:House},{id:'games',label:'Jogos',icon:Gamepad2},
 {id:'catalog',label:'Catálogo de mods',icon:Grid2X2},{id:'library',label:'Minha biblioteca',icon:Library},
 {id:'details',label:'Detalhes',icon:FileText},{id:'queue',label:'Fila de tarefas',icon:Clock3},
 {id:'history',label:'Histórico',icon:History},{id:'settings',label:'Configurações',icon:Settings2},
 {id:'security',label:'Segurança',icon:ShieldCheck}
];
const categories:Category[]=['Todos','Ônibus','Mapas','Caminhões','Sons','Gráficos'];
function GameCover({id,large=false}:{id:GameId;large?:boolean}){
 const game=games[id];
 const [loaded,setLoaded]=useState(false);
 return <div className={'game-cover '+(large?'large':'')} data-cover-loaded={loaded?'true':'false'} style={{'--game-color':game.color} as React.CSSProperties}>
  <img className={loaded?'cover-loaded':''} src={`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.app}/library_600x900.jpg`} alt="" aria-hidden="true" loading="lazy" decoding="async" onLoad={e=>setLoaded(e.currentTarget.naturalWidth>0)} onError={()=>setLoaded(false)}/>
  <div className="cover-fallback"><strong>{game.title}</strong><span>{game.publisher}</span></div>
 </div>;
}
type SavedPreferences={favorites:string[];sidebar:boolean;dense:boolean};
const PREFS_KEY='omsi-manager-preview:prefs:v1';
function readPreferences():SavedPreferences{
 const defaults:SavedPreferences={favorites:[],sidebar:true,dense:false};
 try{
  const parsed:unknown=JSON.parse(window.localStorage.getItem(PREFS_KEY)??'null');
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return defaults;
  const obj=parsed as Partial<SavedPreferences>;
  const allowed=new Set(mods.map(m=>m.id));
  return {
   favorites:Array.isArray(obj.favorites)?Array.from(new Set(obj.favorites.filter((id):id is string=>typeof id==='string'&&allowed.has(id)))):[],
   sidebar:typeof obj.sidebar==='boolean'?obj.sidebar:true,
   dense:obj.dense===true
  };
 }catch{return defaults}
}
function DeclaredSearchEvidence({mod,query}:{mod:Mod;query:string}){
 const matches=declaredSearchMatchFields(mod,query);
 if(!matches.id&&!matches.version)return null;
 return <span className="mod-search-evidence" role="note" aria-label="Campos declarados que coincidem com a busca">
  {matches.id&&<span>ID declarado: <strong>{mod.id}</strong></span>}
  {matches.version&&<span>Versão declarada: <strong>{mod.version}</strong></span>}
 </span>;
}
export default function App(){
 const [screen,setScreen]=useState<Screen>('home');
 const [selectedGame,setSelectedGame]=useState<GameId|'all'>('all');
 const [catalogSort,setCatalogSort]=useState<'catalog'|'title'|'game'>('catalog');
 const [featuredGame,setFeaturedGame]=useState<GameId>('omsi');
 const [libraryGame,setLibraryGame]=useState<GameId|'all'>('all');
 const [libraryCategory,setLibraryCategory]=useState<Category>('Todos');
 const [libraryDeclaredStatus,setLibraryDeclaredStatus]=useState<DeclaredStatusKind|'all'>('all');
 const [librarySizeFilter,setLibrarySizeFilter]=useState<'all'|'known'|'unknown'>('all');
 const [libraryIncomingFilter,setLibraryIncomingFilter]=useState<'all'|'with'|'without'|'cross-game'>('all');
 const [libraryOnlySelected,setLibraryOnlySelected]=useState(false);
 const [librarySearch,setLibrarySearch]=useState('');
 const [librarySort,setLibrarySort]=useState<'catalog'|'title'|'game'|'alerts'|'size-desc'|'size-asc'|'incoming'>('catalog');
 const [detailOrigin,setDetailOrigin]=useState<'home'|'catalog'|'library'>('catalog');
 const [detailFocus,setDetailFocus]=useState<'overview'|'relations'|'incoming'>('overview');
 const [dependencyLookup,setDependencyLookup]=useState<DependencyLookupContext|null>(null);
 const [category,setCategory]=useState<Category>('Todos');
 const [search,setSearch]=useState('');
 const [selectedMod,setSelectedMod]=useState(mods[0].id);
 const focusDetailsTitleAfterStep=useRef(false);
 const [hypotheticalGameVersion,setHypotheticalGameVersion]=useState('');
 const [catalogMods,setCatalogMods]=useState<Mod[]>(mods);
 const [catalogSource,setCatalogSource]=useState('Demonstração');
 const [catalogError,setCatalogError]=useState('');
 const [inspections,setInspections]=useState<Partial<Record<GameId,FolderInspection>>>({});
 const [inspecting,setInspecting]=useState<GameId|null>(null);
 const inspectorAvailable=typeof window.omsiPreview?.inspectGame==='function';
 const runtime=window.omsiPreview?.runtime;
 const osLabel=runtime?.operatingSystem==='windows'?'Windows':
  runtime?.operatingSystem==='linux'?'Linux':
  runtime?.operatingSystem==='unsupported'?'Sistema não homologado':
  'Prévia no navegador';
 const initialPrefs=useMemo(readPreferences,[]);
 const [favorites,setFavorites]=useState<string[]>(initialPrefs.favorites);
 const [batchSelected,setBatchSelected]=useState<string[]>([]);
 const [batchOpen,setBatchOpen]=useState(false);
 const [batchHistory,setBatchHistory]=useState<SessionBatchRecord[]>([]);
 const [reviewedFile,setReviewedFile]=useState<ReviewedDeclaredFile|null>(null);
 const [reviewedComparisonFile,setReviewedComparisonFile]=useState<ReviewedComparisonFile|null>(null);
 const [reviewError,setReviewError]=useState('');
 const [reviewBeforeId,setReviewBeforeId]=useState<number|null>(null);
 const [reviewAfterId,setReviewAfterId]=useState<number|null>(null);
 // Reviewed exports are never promoted to the session history.
 const reviewedAfterReport=reviewedFile?.reports.find(r=>r.reportId===reviewAfterId)??reviewedFile?.reports[1];
 const reviewedBeforeReport=reviewedFile?.reports.find(r=>r.reportId===reviewBeforeId&&r.reportId!==reviewedAfterReport?.reportId)??
  reviewedFile?.reports.find(r=>r.reportId!==reviewedAfterReport?.reportId);
 const reviewedComparison=useMemo(()=>reviewedBeforeReport&&reviewedAfterReport?
  compareReviewedDeclaredReports(reviewedBeforeReport,reviewedAfterReport):null,
  [reviewedBeforeReport,reviewedAfterReport]);
 const [compareBeforeId,setCompareBeforeId]=useState<number|null>(null);
 const [compareAfterId,setCompareAfterId]=useState<number|null>(null);
 const [lastRemovedReport,setLastRemovedReport]=useState<SessionBatchRecord|null>(null);
 const nextSessionReportId=useRef(1);
 // Invalidate stale asynchronous File.text() completions after a new choice/reset.
 const reviewReadGeneration=useRef(0);
 const catalogReadGeneration=useRef(0);
 // Automatically choose the two most recent *distinct* stored reports.
 // Explicit selections remain stable while their reports exist.
 const compareAfterReport=batchHistory.find(r=>r.id===compareAfterId)??batchHistory[0];
 const compareBeforeReport=batchHistory.find(r=>
  r.id===compareBeforeId&&r.id!==compareAfterReport?.id)??
  batchHistory.find(r=>r.id!==compareAfterReport?.id);
 const reportComparison=useMemo(()=>compareAfterReport&&compareBeforeReport?
  compareDeclaredSessionReports(compareBeforeReport,compareAfterReport):null,
  [compareBeforeReport,compareAfterReport]);
 const [sidebar,setSidebar]=useState(initialPrefs.sidebar);
 const [dense,setDense]=useState(initialPrefs.dense);
 const [toast,setToast]=useState('');
 useEffect(()=>{
  try{window.localStorage.setItem(PREFS_KEY,JSON.stringify({favorites,sidebar,dense}));}
  catch{/* private-mode storage can be unavailable; keep session state */}
 },[favorites,sidebar,dense]);
 const selected=catalogMods.find(m=>m.id===selectedMod)??catalogMods[0];
 const selectedDeclaredBytes=declaredSizeBytes(selected.size);
 const selectedDeclaredLabel=selectedDeclaredBytes===null?'Formato não reconhecido':
  selectedDeclaredBytes===0?'Zero declarado':'Tamanho reconhecido';
 const selectedDeclaredDisplay=selectedDeclaredBytes!==null?
  summarizeDeclaredSizes([selected]).subtotal:null;
 const relationAnalysis=useMemo(()=>analyzeModRelations(catalogMods,selected.id,hypotheticalGameVersion),[catalogMods,selected.id,hypotheticalGameVersion]);
 const relationSummary=summarizeRelationIssues(relationAnalysis.issues);
 const relationTimeline=useMemo(()=>buildRelationTimeline(relationAnalysis,selected.id),[relationAnalysis,selected.id]);
 // Build a single index of direct incoming edges for the whole JSON catalog.
 // The selected record, Library cards, filters and sort share that same index.
 const incomingById=useMemo(()=>indexIncomingDeclaredRelations(catalogMods),[catalogMods]);
 const incomingRelations=incomingById.get(selected.id)??
  collectIncomingDeclaredRelations(catalogMods,selected.id);
 const diagnostic=useMemo(()=>consolidateDiagnostic(selected.game,selected.id,catalogSource,relationAnalysis,inspections[selected.game],hypotheticalGameVersion),[selected.game,selected.id,catalogSource,relationAnalysis,inspections,hypotheticalGameVersion]);
 const filtered=useMemo(()=>{
  // Exact target ID for a dependency jump; editing the query restores fuzzy search.
  const targetId=dependencyLookup?.targetId===search?dependencyLookup.targetId:null;
  const matching=catalogMods.filter(m=>
   (selectedGame==='all'||m.game===selectedGame)&&
   (category==='Todos'||m.category===category)&&
   (targetId!==null?m.id===targetId:matchesCatalogSearch(m,games[m.game].title,search)));
  if(catalogSort==='catalog')return matching;
  if(catalogSort==='title')return [...matching].sort((a,b)=>
   a.title.localeCompare(b.title,'pt-BR')||a.id.localeCompare(b.id));
  const order:Record<GameId,number>={omsi:0,ets2:1,ats:2};
  return [...matching].sort((a,b)=>
   order[a.game]-order[b.game]||
   a.title.localeCompare(b.title,'pt-BR')||a.id.localeCompare(b.id));
 },[catalogMods,selectedGame,category,search,catalogSort,dependencyLookup]);
 const favoriteMods=useMemo(()=>catalogMods.filter(m=>favorites.includes(m.id)),[catalogMods,favorites]);
 const favoriteIncomingCounts=useMemo(()=>favoriteMods.reduce((counts,mod)=>{
  const links=incomingById.get(mod.id);
  if((links?.requiredBy.length??0)+(links?.conflictDeclaredBy.length??0)>0)
   counts.withReferences++;
  else counts.withoutReferences++;
  // Cross-game mentions are JSON metadata, never a compatibility verdict.
  if(summarizeCrossGameIncoming(links).total>0)counts.crossGame++;
  return counts;
 },{withReferences:0,withoutReferences:0,crossGame:0}),[favoriteMods,incomingById]);
 const activeBatch=useMemo(()=>batchSelected.filter(id=>
  favorites.includes(id)&&catalogMods.some(m=>m.id===id)),[batchSelected,favorites,catalogMods]);
 // Group counts are computed cheaply; dependency analysis is on demand.
 const selectionByGame=useMemo(()=>{
  const ids=new Set(activeBatch);
  return (['omsi','ets2','ats'] as const)
   .map(game=>({game,count:catalogMods.filter(m=>m.game===game&&ids.has(m.id)).length}))
   .filter(group=>group.count>0);
 },[catalogMods,activeBatch]);
 const batchReport=useMemo(()=>batchOpen&&activeBatch.length?
  analyzeDeclaredBatch(catalogMods,activeBatch):null,[catalogMods,activeBatch,batchOpen]);
 const batchReadiness=useMemo(()=>batchReport?
  prepareBatchReviewReadiness(batchReport):null,[batchReport]);
 const declaredStatuses=useMemo(()=>new Map(catalogMods.map(mod=>[mod.id,summarizeDeclaredStatus(catalogMods,mod.id)])),[catalogMods]);
 const libraryAlerts=useMemo(()=>favoriteMods.reduce((counts,mod)=>{
  const status=declaredStatuses.get(mod.id);
  if(status?.kind==='blocking')counts.blocking++;
  if(status?.kind==='attention')counts.attention++;
  return counts;
 },{blocking:0,attention:0}),[favoriteMods,declaredStatuses]);
 const libraryMods=useMemo(()=>{
  // Search never changes the underlying favorites or declared status.
  const matchesIncomingFilter=(id:string)=>{
   if(libraryIncomingFilter==='all')return true;
   const links=incomingById.get(id);
   if(libraryIncomingFilter==='cross-game')
    return summarizeCrossGameIncoming(links).total>0;
   const hasIncoming=(links?.requiredBy.length??0)+(links?.conflictDeclaredBy.length??0)>0;
   return hasIncoming===(libraryIncomingFilter==='with');
  };
  const list=favoriteMods.filter(m=>
   (libraryGame==='all'||m.game===libraryGame)&&
   (libraryCategory==='Todos'||m.category===libraryCategory)&&
   (libraryDeclaredStatus==='all'||declaredStatuses.get(m.id)?.kind===libraryDeclaredStatus)&&
    (librarySizeFilter==='all'||(declaredSizeBytes(m.size)!==null)===(librarySizeFilter==='known'))&&
   matchesIncomingFilter(m.id)&&
   (!libraryOnlySelected||activeBatch.includes(m.id))&&
   matchesCatalogSearch(m,games[m.game].title,librarySearch)
  );
  if(librarySort==='incoming'){
   // Count direct incoming edges across the whole validated catalog;
   // not popularity, severity, compatibility or installed state.
   const count=(id:string)=>{
    const entry=incomingById.get(id);
    return {total:(entry?.requiredBy.length??0)+(entry?.conflictDeclaredBy.length??0),
     required:entry?.requiredBy.length??0};
   };
   return [...list].sort((a,b)=>{
    const x=count(a.id),y=count(b.id);
    return y.total-x.total||y.required-x.required||
     a.title.localeCompare(b.title,'pt-BR')||a.id.localeCompare(b.id);
   });
  }
  if(librarySort==='alerts'){
   // Priority is based on declared metadata only: it never authenticates mod state.
   const rank:Record<DeclaredStatusKind,number>={blocking:0,attention:1,'no-issues':2};
   return [...list].sort((a,b)=>{
    const level=(rank[declaredStatuses.get(a.id)?.kind??'no-issues']-
     rank[declaredStatuses.get(b.id)?.kind??'no-issues']);
    return level||a.title.localeCompare(b.title,'pt-BR')||a.id.localeCompare(b.id);
   });
  }
  if(librarySort==='size-desc'||librarySort==='size-asc')
   return [...list].sort((a,b)=>compareModsByDeclaredSize(a,b,
    librarySort==='size-asc'?'asc':'desc'));
  if(librarySort==='title')return [...list].sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
  if(librarySort==='game'){
   const order:Record<GameId,number>={omsi:0,ets2:1,ats:2};
   return [...list].sort((a,b)=>order[a.game]-order[b.game]||a.title.localeCompare(b.title,'pt-BR'));
  }
  return list;
 },[favoriteMods,libraryGame,libraryCategory,libraryDeclaredStatus,libraryOnlySelected,activeBatch,librarySearch,librarySort,librarySizeFilter,libraryIncomingFilter,declaredStatuses,incomingById]);
 const librarySizeSummary=useMemo(()=>summarizeDeclaredSizes(libraryMods),[libraryMods]);
 const allFavoritesSizeSummary=useMemo(()=>summarizeDeclaredSizes(favoriteMods),[favoriteMods]);
 const libraryGameSummary=useMemo(()=>(['omsi','ets2','ats'] as GameId[])
  .map(game=>{
   const items=favoriteMods.filter(mod=>mod.game===game);
   return {game,count:items.length,size:summarizeDeclaredSizes(items)};
  }).filter(group=>group.count>0),[favoriteMods]);
 const visibleLibraryAlerts=useMemo(()=>libraryMods.reduce((counts,mod)=>{
  const kind=declaredStatuses.get(mod.id)?.kind;
  if(kind==='blocking')counts.blocking++;
  if(kind==='attention')counts.attention++;
  return counts;
 },{blocking:0,attention:0}),[libraryMods,declaredStatuses]);
 // A batch selection survives filtering; reveal selections outside the current view.
 const detailCandidates=detailOrigin==='library'?libraryMods:
  detailOrigin==='home'?catalogMods.slice(0,4):filtered;
 const detailPosition=detailCandidates.findIndex(mod=>mod.id===selectedMod);
 const detailPrev=detailPosition>0?detailCandidates[detailPosition-1]:null;
 const detailNext=detailPosition>=0&&detailPosition<detailCandidates.length-1?
  detailCandidates[detailPosition+1]:null;
 const visibleLibraryIds=new Set(libraryMods.map(mod=>mod.id));
 const hiddenSelectedMods=favoriteMods.filter(mod=>activeBatch.includes(mod.id)&&!visibleLibraryIds.has(mod.id));
 const hiddenBatchCount=hiddenSelectedMods.length;
 const visibleBatchCount=activeBatch.length-hiddenBatchCount;
 const activeLibraryControlCount=[
  libraryGame!=='all',libraryCategory!=='Todos',
  libraryDeclaredStatus!=='all',librarySizeFilter!=='all',libraryIncomingFilter!=='all',libraryOnlySelected,librarySearch.trim().length>0,
  librarySort!=='catalog'
 ].filter(Boolean).length;
 function resetLibraryControls(){
  setLibraryGame('all');setLibraryCategory('Todos');
  setLibraryDeclaredStatus('all');setLibrarySizeFilter('all');setLibraryIncomingFilter('all');
  setLibraryOnlySelected(false);setLibrarySearch('');setLibrarySort('catalog');
 }
 function saveBatchToSession(){
  if(!batchReport||!batchOpen)return;
  const selectedTitles=activeBatch.map(id=>catalogMods.find(m=>m.id===id)?.title)
   .filter((title):title is string=>typeof title==='string');
  if(selectedTitles.length!==batchReport.selectedCount)return;
  const reportId=nextSessionReportId.current++;
  setLastRemovedReport(null);
  setBatchHistory(existing=>[{
   id:reportId,selectedIds:[...activeBatch],selectedTitles,
   selectedCount:batchReport.selectedCount,
   games:batchReport.groups.map(g=>g.game),
   blockers:batchReport.blockers,notices:batchReport.notices,
   source:'catalog-declarations' as const,compatibilityVerified:false as const,
   installationVerified:false as const
  },...existing].slice(0,10));
  setToast('Resumo declarado guardado somente nesta sessão. Não representa instalação.');
 }
 function removeSessionReport(record:SessionBatchRecord){
  setBatchHistory(existing=>existing.filter(item=>item.id!==record.id));
  setLastRemovedReport(record);
 }
 function undoRemovedSessionReport(){
  if(!lastRemovedReport)return;
  const report=lastRemovedReport;
  setBatchHistory(existing=>existing.some(item=>item.id===report.id)?
   existing:[...existing,report].sort((a,b)=>b.id-a.id).slice(0,10));
  setLastRemovedReport(null);
 }
 function downloadDeclaredJson(json:string,filename:string){
  // Only this user click may start a local browser download.
  let url:string|null=null;
  try{
   const blob=new Blob([json],{type:'application/json;charset=utf-8'});
   url=URL.createObjectURL(blob);
   const link=document.createElement('a');
   link.href=url;link.download=filename;
   document.body.appendChild(link);
   try{link.click();}finally{link.remove();}
   const urlToRevoke=url;
   // Keep the Blob available while the browser acquires the download.
   window.setTimeout(()=>URL.revokeObjectURL(urlToRevoke),10000);
   url=null;
  }catch{
   if(url)URL.revokeObjectURL(url);
   throw Error('DECLARED_SESSION_DOWNLOAD_FAILED');
  }
 }
 function exportSessionReport(record:SessionBatchRecord){
  try{
   downloadDeclaredJson(serializeDeclaredSessionReport(record),
    `OMSI-Manager-Resumo-${record.id}.json`);
  }catch{setToast('Não foi possível exportar este resumo declarativo.');}
 }
 function exportSessionArchive(){
  try{
   downloadDeclaredJson(serializeDeclaredSessionArchive(batchHistory),
    'OMSI-Manager-Resumos-da-sessao.json');
  }catch{setToast('Não foi possível exportar os resumos desta sessão.');}
 }
 function exportSessionComparison(){
  if(!compareBeforeReport||!compareAfterReport)return;
  try{
   const json=serializeDeclaredSessionComparison(compareBeforeReport,compareAfterReport);
   downloadDeclaredJson(json,
    `OMSI-Manager-Comparacao-${compareBeforeReport.id}-${compareAfterReport.id}.json`);
  }catch{setToast('Não foi possível exportar esta comparação declarativa.');}
 }
 function exportReviewedComparison(){
  if(!reviewedBeforeReport||!reviewedAfterReport)return;
  try{
   const json=serializeReviewedDeclaredComparison(reviewedBeforeReport,reviewedAfterReport);
   downloadDeclaredJson(json,
    `OMSI-Manager-Comparacao-Externa-${reviewedBeforeReport.reportId}-${reviewedAfterReport.reportId}.json`);
  }catch{setToast('Não foi possível exportar esta comparação externa de metadados.');}
 }
 async function openDeclaredExport(event:React.ChangeEvent<HTMLInputElement>){
  const file=event.currentTarget.files?.[0];
  event.currentTarget.value='';
  if(!file)return;
  const generation=++reviewReadGeneration.current;
  try{
   if(file.size>MAX_SESSION_REVIEW_BYTES)throw Error('SESSION_REVIEW_TOO_LARGE');
   const raw=await file.text();
   if(generation!==reviewReadGeneration.current)return;
   let parsed:unknown;
   try{parsed=JSON.parse(raw);}catch{throw Error('SESSION_REVIEW_INVALID_JSON');}
   const schema=parsed!==null&&typeof parsed==='object'&&!Array.isArray(parsed)?
    (parsed as Record<string,unknown>).schema:null;
   if(schema==='omsi-manager-declared-comparison-v1'||
      schema==='omsi-manager-external-declared-comparison-v1'){
    setReviewedComparisonFile(parseDeclaredComparisonReview(raw));
    setReviewedFile(null);
   }else{
    setReviewedFile(parseDeclaredSessionReview(raw));
    setReviewedComparisonFile(null);
   }
   setReviewBeforeId(null);setReviewAfterId(null);
   setReviewError('');
  }catch(error){
   if(generation!==reviewReadGeneration.current)return;
   const code=error instanceof Error?error.message:'SESSION_REVIEW_INVALID';
   setReviewError(code==='SESSION_REVIEW_TOO_LARGE'?
    'Arquivo excede o limite de 128 KiB.':
    'Arquivo incompatível ou adulterado. Apenas resumos, coleções e comparações JSON declarativas são aceitos.');
  }
 }
 function revisitSessionReport(record:SessionBatchRecord){
  // Metadata only. Reuse existing favorites, never re-add removed mods.
  const eligible=record.selectedIds.filter(id=>
   favorites.includes(id)&&catalogMods.some(mod=>mod.id===id));
  const skipped=record.selectedIds.length-eligible.length;
  setBatchSelected(eligible);
  setBatchOpen(eligible.length>0);
  setScreen('library');
  setToast(eligible.length?
   `Seleção declarada restaurada: ${eligible.length} favorito(s)${skipped?` · ${skipped} indisponível(is)`:''}. Nada foi instalado.`:
   'Nenhum favorito deste resumo está disponível na biblioteca. Nenhum mod foi instalado.');
 }
 const focusMainAfterNavigation=useRef(false);
 const focusCardAfterDetails=useRef<string|null>(null);
 const focusFirstLibraryCardAfterReset=useRef(false);
 const focusLibraryBatchAfterDetails=useRef(false);
 const focusCatalogSearchAfterDependencyJump=useRef(false);
 const focusFirstCatalogCardAfterReset=useRef(false);
 const focusCatalogChipIndexAfterRemoval=useRef<number|null>(null);
 const focusLibraryChipIndexAfterRemoval=useRef<number|null>(null);
 function removeCatalogFilterChip(event:React.MouseEvent<HTMLButtonElement>,reset:()=>void){
  // Retain keyboard position when an active chip disappears from the DOM.
  const siblings=event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button');
  focusCatalogChipIndexAfterRemoval.current=siblings?
   Math.max(0,Array.from(siblings).indexOf(event.currentTarget)):0;
  reset();
 }
 function removeLibraryFilterChip(event:React.MouseEvent<HTMLButtonElement>,reset:()=>void){
  // A removed chip unmounts immediately; preserve the keyboard position.
  const siblings=event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button');
  focusLibraryChipIndexAfterRemoval.current=siblings?
   Math.max(0,Array.from(siblings).indexOf(event.currentTarget)):0;
  reset();
 }
 function resetLibraryFiltersWithFocus(){
  focusFirstLibraryCardAfterReset.current=true;
  resetLibraryControls();
 }
 function resetCatalogFiltersWithFocus(){
  // A search/category/game combination can hide all examples without removing data.
  focusFirstCatalogCardAfterReset.current=true;
  setSelectedGame('all');setCategory('Todos');setSearch('');
 }
 function goto(id:Screen,preserveInputFocus=false){
  if(id!==screen&&!preserveInputFocus)focusMainAfterNavigation.current=true;
  setScreen(id);setToast('');
 }
 function detail(id:string){setHypotheticalGameVersion('');setDetailFocus('overview');setDetailOrigin(screen==='library'?'library':screen==='home'?'home':'catalog');setSelectedMod(id);goto('details')}
 function returnFromDetails(){
  // Restore the exact card when possible; filtered-out cards fall back to main.
  focusCardAfterDetails.current=selected.id;
  goto(detailOrigin);
 }
 function reviewLibrarySelectionFromDetails(){
  if(detailOrigin!=='library'||activeBatch.length===0)return;
  focusLibraryBatchAfterDetails.current=true;
  goto('library');
 }
 function restoreCatalogBeforeDependencyLookup(context:DependencyLookupContext){
  setSelectedGame(context.previousGame);setCategory(context.previousCategory);
  setSearch(context.previousSearch);setCatalogSort(context.previousSort);
 }
 function returnToOriginalDependencyDiagnostic(){
  if(!dependencyLookup)return;
  const context=dependencyLookup;
  setDependencyLookup(null);
  restoreCatalogBeforeDependencyLookup(context);
  if(!catalogMods.some(mod=>mod.id===context.sourceId))return;
  setSelectedMod(context.sourceId);setDetailOrigin(context.origin);
  setHypotheticalGameVersion(context.hypotheticalVersion);
  setDetailFocus('relations');goto('details');
 }
 function dismissDependencyLookup(){
  if(!dependencyLookup)return;
  restoreCatalogBeforeDependencyLookup(dependencyLookup);
  setDependencyLookup(null);
  document.querySelector<HTMLInputElement>('input[aria-label="Buscar mods"]')?.focus({preventScroll:true});
 }
 function locateDeclaredDependencyInCatalog(modId:string){
  // Only local validated catalog records, never actual installed files.
  if(!catalogMods.some(mod=>mod.id===modId))return;
  setDependencyLookup({
   sourceId:selected.id,sourceTitle:selected.title,targetId:modId,origin:detailOrigin,
   hypotheticalVersion:hypotheticalGameVersion,
   previousGame:selectedGame,previousCategory:category,
   previousSearch:search,previousSort:catalogSort
  });
  setSelectedGame('all');setCategory('Todos');
  setSearch(modId);setCatalogSort('catalog');
  focusCatalogSearchAfterDependencyJump.current=true;
  goto('catalog');
 }
 function stepDetails(nextId:string){
  if(!detailCandidates.some(mod=>mod.id===nextId))return;
  focusDetailsTitleAfterStep.current=true;
  setSelectedMod(nextId);
  setHypotheticalGameVersion('');
  setDetailFocus('overview');
 }
 function openDeclaredDiagnostic(id:string){setHypotheticalGameVersion('');setDetailOrigin('library');setSelectedMod(id);setDetailFocus('relations');goto('details')}
 function openIncomingFromLibrary(id:string){
  if(!catalogMods.some(mod=>mod.id===id))return;
  setHypotheticalGameVersion('');
  setDetailOrigin('library');setSelectedMod(id);setDetailFocus('incoming');
  goto('details');
 }
 function notice(){setToast('Operação bloqueada: protótipo sem acesso a arquivos ou ao instalador.')}
 async function importCatalogFile(event:React.ChangeEvent<HTMLInputElement>){
  const file=event.currentTarget.files?.[0];
  event.currentTarget.value='';
  if(!file)return;
  const generation=++catalogReadGeneration.current;
  try{
   if(file.size>MAX_CATALOG_BYTES)throw new Error('Arquivo excede 1 MB.');
   const raw=await file.text();
   if(generation!==catalogReadGeneration.current)return;
   const next=parseCatalogManifest(raw);
   ++reviewReadGeneration.current;
   setCatalogMods(next);setHypotheticalGameVersion('');setDependencyLookup(null);
   setCatalogSource('Importado: '+file.name.slice(0,85));
   setCatalogError('');
   setSelectedMod(next[0].id);
   setSelectedGame('all');setCategory('Todos');setSearch('');setCatalogSort('catalog');
   setFavorites([]);setBatchSelected([]);setBatchOpen(false);setBatchHistory([]);setLastRemovedReport(null);setReviewedFile(null);setReviewedComparisonFile(null);setReviewBeforeId(null);setReviewAfterId(null);setReviewError('');setLibraryGame('all');setLibraryCategory('Todos');setLibraryDeclaredStatus('all');setLibrarySizeFilter('all');setLibraryIncomingFilter('all');setLibraryOnlySelected(false);setLibrarySearch('');setLibrarySort('catalog');
   setToast(next.length+' mods carregados somente como metadados. Nenhum arquivo de jogo foi alterado.');
  }catch(error){
   if(generation!==catalogReadGeneration.current)return;
   const message=error instanceof Error?error.message:'Falha ao importar catálogo.';
   setCatalogError(message.slice(0,240));
  }
 }
 async function inspectGame(gameId:GameId){
  if(inspecting||!window.omsiPreview?.inspectGame)return;
  setInspecting(gameId);
  try {
   const report=await window.omsiPreview.inspectGame(gameId);
   if(report.status!=='cancelled')setInspections(all=>({...all,[gameId]:report}));
  }catch{
   setInspections(all=>({...all,[gameId]:{status:'error',message:'Inspeção não autorizada ou indisponível.'}}));
  }finally{setInspecting(null)}
 }
 function restoreDemo(){
  ++catalogReadGeneration.current;
  ++reviewReadGeneration.current;
  setCatalogMods(mods);setHypotheticalGameVersion('');setDependencyLookup(null);setCatalogSource('Demonstração');setCatalogError('');
  setSelectedMod(mods[0].id);setSelectedGame('all');setCategory('Todos');setSearch('');setCatalogSort('catalog');
  setFavorites([]);setBatchSelected([]);setBatchOpen(false);setBatchHistory([]);setLastRemovedReport(null);setReviewedFile(null);setReviewedComparisonFile(null);setReviewBeforeId(null);setReviewAfterId(null);setReviewError('');setLibraryGame('all');setLibraryCategory('Todos');setLibraryDeclaredStatus('all');setLibrarySizeFilter('all');setLibraryIncomingFilter('all');setLibraryOnlySelected(false);setLibrarySearch('');setLibrarySort('catalog');
 }
 function toggleFavorite(modId:string){
  // A removed favorite must not silently rejoin an earlier batch if favorited again.
  if(favorites.includes(modId)){
   setBatchSelected(ids=>ids.filter(id=>id!==modId));
   if(activeBatch.includes(modId))setBatchOpen(false);
  }
  setFavorites(ids=>ids.includes(modId)?ids.filter(id=>id!==modId):[...ids,modId]);
 }
 const modCards=(list:Mod[])=><div className={'mod-grid '+(dense?'compact':'')}>{list.map(m=><article className="mod-card" key={m.id}><button className="mod-art" onClick={()=>detail(m.id)} aria-label={`Ver ${m.title}`}><span>{m.category}</span><ModArtwork mod={m}/></button><div className="mod-info"><span className="meta">{games[m.game].title} · {m.category}</span>{screen==='library'&&(()=>{const status=declaredStatuses.get(m.id);return <><span className={'library-mod-status '+(status?.kind??'no-issues')} title="Metadados do catálogo, não arquivos do mod ou jogo instalado">{status?.label??'Não analisado'} · não verificado</span>{status&&status.issueCount>0&&<button type="button" className="library-diagnostic-link" aria-label={'Ver diagnóstico de '+m.title} onClick={()=>openDeclaredDiagnostic(m.id)}><AlertTriangle size={13}/><span>Consultar {status.issueCount} {status.issueCount===1?'alerta declarado':'alertas declarados'}</span><ChevronRight size={13}/></button>}
 {(()=>{const incoming=incomingById.get(m.id);const dependents=incoming?.requiredBy.length??0;const conflicts=incoming?.conflictDeclaredBy.length??0;
 const crossGame=summarizeCrossGameIncoming(incoming);
 return dependents+conflicts>0?<div className="library-incoming-references" role="note">
 <small>Outros registros do JSON mencionam este ID:</small>
 <span>{dependents} dependência(s) recebida(s) · {conflicts} conflito(s) declarado(s) por outros</span>
 {crossGame.total>0&&<small className="library-cross-game-warning">
  <strong>{crossGame.total} referência(s) de outro simulador no JSON.</strong>
  <span>Origem declarada: {crossGame.byGame.map(source=>games[source.game].title+
   ' ('+source.dependencies+' dependência(s), '+source.conflicts+' conflito(s))').join(' · ')}</span>
  <span>Não comprova conversão nem compatibilidade.</span>
 </small>}
 <button type="button" className="library-incoming-button" aria-label={'Consultar referências recebidas de '+m.title} onClick={()=>openIncomingFromLibrary(m.id)}>
 Ver referências recebidas <ChevronRight size={13} aria-hidden="true"/>
 </button>
 </div>:null;})()}</>})()}<button className="text-button" id={`mod-title-${m.id}`} onClick={()=>detail(m.id)}>{m.title}</button>{(screen==='catalog'||screen==='library')&&<DeclaredSearchEvidence mod={m} query={screen==='library'?librarySearch:search}/>}{screen==='library'&&<label className="library-batch-select"><input type="checkbox" aria-label={'Selecionar '+m.title+' para análise conjunta'} checked={activeBatch.includes(m.id)} onChange={e=>{setBatchSelected(ids=>e.target.checked?[...ids,m.id]:ids.filter(id=>id!==m.id));setBatchOpen(false)}}/>Incluir na análise conjunta</label>}<div className="mod-bottom"><small>v{m.version} · {m.size}</small><button className="icon-btn" aria-label={favorites.includes(m.id)?'Retirar dos favoritos':'Favoritar'} aria-describedby={`mod-title-${m.id}`} onClick={()=>toggleFavorite(m.id)}>{favorites.includes(m.id)?'♥':'♡'}</button></div></div></article>)}</div>;
 useEffect(()=>{
  if(!focusMainAfterNavigation.current)return;
  focusMainAfterNavigation.current=false;
  // Keep keyboard/screen reader context in the new screen after prior buttons unmount.
  // Native search focus is exempt so it remains typeable when activating Catalog.
  const cardId=focusCardAfterDetails.current;
  focusCardAfterDetails.current=null;
  if(cardId!==null){
   const card=document.getElementById('mod-title-'+cardId);
   if(card instanceof HTMLButtonElement){card.focus();return;}
  }
  document.getElementById('conteudo-principal')?.focus({preventScroll:true});
 },[screen]);
 useEffect(()=>{
  if(screen!=='library'||!focusLibraryBatchAfterDetails.current)return;
  focusLibraryBatchAfterDetails.current=false;
  document.getElementById('library-batch')?.focus({preventScroll:true});
 },[screen]);
 useEffect(()=>{
  if(screen!=='catalog'||!focusCatalogSearchAfterDependencyJump.current)return;
  focusCatalogSearchAfterDependencyJump.current=false;
  document.querySelector<HTMLInputElement>('input[aria-label="Buscar mods"]')?.focus({preventScroll:true});
 },[screen]);
 useEffect(()=>{
  if(!focusFirstCatalogCardAfterReset.current||screen!=='catalog'||filtered.length===0)return;
  focusFirstCatalogCardAfterReset.current=false;
  document.getElementById('mod-title-'+filtered[0].id)?.focus({preventScroll:true});
 },[screen,filtered]);
 useEffect(()=>{
  if(focusCatalogChipIndexAfterRemoval.current===null||screen!=='catalog')return;
  const removedIndex=focusCatalogChipIndexAfterRemoval.current;
  focusCatalogChipIndexAfterRemoval.current=null;
  const chips=document.querySelectorAll<HTMLButtonElement>('.catalog-active-filters button');
  const next=chips[Math.min(removedIndex,chips.length-1)];
  if(next){next.focus({preventScroll:true});return;}
  const first=filtered[0]&&document.getElementById('mod-title-'+filtered[0].id);
  if(first instanceof HTMLButtonElement){first.focus({preventScroll:true});return;}
  document.querySelector<HTMLInputElement>('.topbar .search input')?.focus({preventScroll:true});
 },[screen,selectedGame,category,search,catalogSort,filtered]);
 useEffect(()=>{
  if(!focusFirstLibraryCardAfterReset.current||screen!=='library'||libraryMods.length===0)return;
  focusFirstLibraryCardAfterReset.current=false;
  document.getElementById('mod-title-'+libraryMods[0].id)?.focus({preventScroll:true});
 },[screen,libraryMods]);
 useEffect(()=>{
  if(focusLibraryChipIndexAfterRemoval.current===null||screen!=='library')return;
  const priorIndex=focusLibraryChipIndexAfterRemoval.current;
  focusLibraryChipIndexAfterRemoval.current=null;
  const remaining=document.querySelectorAll<HTMLButtonElement>('.library-active-filters button');
  const successor=remaining[Math.min(priorIndex,remaining.length-1)];
  if(successor){successor.focus({preventScroll:true});return;}
  const card=libraryMods[0]&&document.getElementById('mod-title-'+libraryMods[0].id);
  if(card instanceof HTMLButtonElement){card.focus({preventScroll:true});return;}
  document.querySelector<HTMLSelectElement>('.library-toolbar select')?.focus({preventScroll:true});
 },[screen,libraryGame,libraryCategory,libraryDeclaredStatus,libraryOnlySelected,librarySearch,librarySort,libraryMods]);
 useEffect(()=>{
  if(screen!=='details'||!focusDetailsTitleAfterStep.current)return;
  focusDetailsTitleAfterStep.current=false;
  document.getElementById('detail-mod-title')?.focus({preventScroll:true});
 },[screen,selectedMod]);
 useEffect(()=>{
  if(screen!=='details'||detailFocus==='overview')return;
  const target=document.getElementById(detailFocus==='incoming'?
   'relacoes-recebidas':'relacoes-declaradas');
  if(target){target.scrollIntoView({block:'start'});target.focus({preventScroll:true})}
  setDetailFocus('overview');
 },[screen,detailFocus,selectedMod]);
 const title=nav.find(n=>n.id===screen)?.label??'Início';
 return <><a className="skip-link" href="#conteudo-principal">Pular para o conteúdo principal</a><div className="shell">
  <aside className={'sidebar '+(!sidebar?'collapsed':'')}>
   <div className="brand"><span className="brand-mark">M</span><div><strong>OMSI Manager</strong><small>DESIGN PROTOTYPE</small></div></div>
   <p className="nav-caption">EXPLORAR</p><nav aria-label="Navegação principal">{nav.map(({id,label,icon:Icon})=><button key={id} className={'nav-link '+(screen===id?'active':'')} aria-label={label} aria-current={screen===id?'page':undefined} onClick={()=>goto(id)} title={label}><Icon size={19}/><span>{label}</span></button>)}</nav>
   <div className="sidebar-bottom"><div className="safety-status"><ShieldCheck size={17}/><span>Modo seguro ativo</span></div><small>Sem leitura de conteúdo ou alterações nos jogos</small></div>
  </aside>
  <div className="workspace"><header className="topbar"><div className="top-left"><button className="icon-btn menu-btn" aria-label="Alternar menu" onClick={()=>setSidebar(v=>!v)}><Menu size={20}/></button><div className="breadcrumb">OMSI Manager <ChevronRight size={13}/> <strong>{title}</strong></div></div><div className="top-actions"><label className="search"><Search size={17}/><input placeholder={screen==='library'?'Buscar favoritos...':'Buscar mods...'} aria-label={screen==='library'?'Buscar favoritos':'Buscar mods'} value={screen==='library'?librarySearch:search} onChange={e=>screen==='library'?setLibrarySearch(e.target.value.slice(0,100)):setSearch(e.target.value.slice(0,100))} onFocus={()=>screen!=='catalog'&&screen!=='library'&&goto('catalog',true)}/></label><span className="mode-indicator"><LockKeyhole size={13}/> Protótipo</span></div></header>
   <main id="conteudo-principal" tabIndex={-1} className="content">
    {screen==='home'&&<><section className="hero hero-spotlight" aria-label="Destaque de simuladores" style={{'--spotlight':games[featuredGame].color} as React.CSSProperties}>
     <div className="hero-copy">
      <div className="eyebrow">SEUS JOGOS, SEUS MODS</div>
      <h1>Seu universo de simulação, organizado.</h1>
      <p>Explore OMSI 2, Euro Truck Simulator 2 e American Truck Simulator sem modificar nenhuma instalação.</p>
      <div className="featured-game-label">EM DESTAQUE</div>
      <h2 className="featured-game-name">{games[featuredGame].title}</h2>
      <p className="featured-game-subtitle">{featuredGame==='omsi'?'Ônibus e mapas demonstrativos':featuredGame==='ets2'?'Caminhões e gráficos demonstrativos':'Caminhões e sons demonstrativos'} · {games[featuredGame].publisher}</p>
      <div className="hero-actions">
       <button className="btn primary" onClick={()=>{setSelectedGame(featuredGame);setCategory('Todos');setSearch('');goto('catalog')}}>Ver mods de {games[featuredGame].title} <ChevronRight size={17}/></button>
       <button className="btn secondary" onClick={()=>goto('games')}>Explorar jogos</button>
      </div>
      <div className="featured-selector" role="group" aria-label="Escolher simulador em destaque">
       {(Object.keys(games) as GameId[]).map(id=><button type="button" key={id} aria-label={'Mostrar '+games[id].title+' no destaque'} aria-pressed={featuredGame===id} className={'featured-choice '+(featuredGame===id?'selected':'')} onClick={()=>setFeaturedGame(id)}>{id==='omsi'?'OMSI 2':id==='ets2'?'ETS2':'ATS'}</button>)}
      </div>
     </div>
     <div className="hero-art hero-spotlight-art" aria-hidden="true">
      <div className="hero-art-halo"/>
      <GameCover key={featuredGame} id={featuredGame} large/>
      <span className="hero-art-tag">{featuredGame==='omsi'?'OMSI':featuredGame==='ets2'?'EURO':'AMERICAN'} SIMULATION</span>
     </div>
    </section><div className="section-title"><h2>Jogos em destaque</h2><button className="link" onClick={()=>goto('games')}>Ver todos <ChevronRight size={14}/></button></div><div className="game-grid">{(Object.keys(games) as GameId[]).map(id=><button className="game-tile" key={id} onClick={()=>{setSelectedGame(id);goto('catalog')}}><GameCover id={id}/><strong>{games[id].title}</strong><small>Abrir catálogo</small></button>)}</div><div className="section-title"><h2>Descobrir mods</h2></div>{modCards(catalogMods.slice(0,4))}</>}
    {screen==='games'&&<><div className="page-heading"><span className="eyebrow">BIBLIOTECA DE JOGOS</span><h1>Escolha seu simulador</h1><p>Capas online quando disponíveis; cartões identificados mesmo sem internet. A inspeção é manual e opcional, sem detecção automática de instalações.</p></div><div className="game-grid game-grid-large">{(Object.keys(games) as GameId[]).map(id=><button className="game-tile" key={id} onClick={()=>{setSelectedGame(id);goto('catalog')}}><GameCover id={id} large/><strong>{games[id].title}</strong><small>Ver mods <ChevronRight size={13}/></small></button>)}</div>
     <section className="inspection-panel" aria-label="Inspeção de pastas de jogos">
      <div className="inspection-header"><div><h2>Inspeção local · somente leitura</h2><p>Escolha manualmente a pasta desejada. O app distingue pastas, arquivos e possíveis pacotes de mods apenas pelos nomes, sem abrir conteúdo nem alterar nada.</p></div><span className="pill">{inspectorAvailable?'Seletor nativo disponível':'Disponível apenas no Electron'}</span></div>
      <div className="inspection-grid">{(Object.keys(games) as GameId[]).map(id=><div className="inspection-game" key={id}><strong>{games[id].title}</strong><button className="btn secondary" disabled={!inspectorAvailable||inspecting!==null} onClick={()=>void inspectGame(id)}>{inspecting===id?'Inspecionando...':'Selecionar pasta e inspecionar'}</button>
       {inspections[id]?.status==='ok'&&(()=>{const report=inspections[id];if(!report||report.status!=='ok')return null;return <div className="inspection-result"><p><strong>Pasta:</strong> {report.folderName} · {report.recognized?'Pastas esperadas encontradas':'Nenhuma pasta conhecida encontrada'}</p>
       <div className="inspection-assessment" role="status"><strong>Compatibilidade não verificada</strong><span>{report.assessment.summary}</span>{report.selectionMode==='direct-mod-folder'&&<small>Selecionada diretamente: pasta mod</small>}{report.provenance&&<small>Leitura por metadados de diretório. Enumeração por handle nativo: {report.provenance.nativeDirectoryEnumeration==='not-connected'?'não integrada':'somente observação auxiliar de teste'}. Proteção total contra trocas de pasta não comprovada.</small>}</div>
       {report.groups.map(g=><div className="inspection-group" key={g.key}>
        <div className="inspection-stat"><span>{g.name}</span><strong>{g.found?g.count+(g.limited?'+':''):'Não encontrada'}</strong></div>
        {g.found&&<div className="inspection-breakdown"><span>{g.directories} pastas</span><span>{g.files} arquivos</span>{id!=='omsi'&&<span>{g.packageCandidates} candidatos .scs/.zip</span>}{g.linksSkipped>0&&<span>{g.linksSkipped} links ignorados</span>}</div>}
       </div>)}
       {report.notices.length>0&&<ul className="inspection-notices">{report.notices.map(n=><li key={n.code} className={n.level}>{n.message}</li>)}</ul>}</div>})()}
       {inspections[id]?.status==='error'&&<p className="inspection-error" role="alert">{inspections[id]?.status==='error'?inspections[id].message:''}</p>}</div>)}</div>
      <p className="inspection-note">No ETS2/ATS, escolha a própria pasta mod ou a pasta acima dela, geralmente nos Documentos do jogo, não necessariamente na Steam. Contagens são apenas pistas de estrutura, nunca prova de instalação, ativação ou compatibilidade. Não enviamos caminhos completos nem nomes de arquivos à interface. Instalar e remover seguem bloqueados.</p>
     </section></>}
    {screen==='catalog'&&<>{dependencyLookup&&<section className="catalog-dependency-return"
 aria-label="Consulta de dependência declarada">
  <div>
   <strong>Consulta temporária de ID declarado</strong>
   <p>Você veio do diagnóstico de <b>{dependencyLookup.sourceTitle}</b>.
    A pesquisa foi ajustada para localizar um registro do catálogo, sem
    verificar arquivos nem instalações.</p>
   {search===dependencyLookup.targetId&&<small className="catalog-lookup-exact" role="status">
    Correspondência exata do ID declarado: <strong>{dependencyLookup.targetId}</strong>.
    Edite a pesquisa para voltar à busca comum.
   </small>}
  </div>
  <div className="catalog-dependency-return-actions">
   <button type="button" className="btn secondary"
    onClick={returnToOriginalDependencyDiagnostic}>
    Voltar ao diagnóstico original
   </button>
   <button type="button" className="btn secondary"
    onClick={dismissDependencyLookup}>Restaurar filtros do Catálogo</button>
  </div>
 </section>}<div className="page-heading"><span className="eyebrow">EXPLORAR CONTEÚDO</span><h1>Catálogo de mods</h1><p>Explore os exemplos ou importe um JSON de metadados. Instalação desativada.</p></div><div className="toolbar"><div className="tabs">{(['all','omsi','ets2','ats'] as const).map(id=><button key={id} className={selectedGame===id?'selected':''} onClick={()=>setSelectedGame(id)}>{id==='all'?'Todos os jogos':games[id].title}</button>)}</div><select value={category} onChange={e=>setCategory(e.target.value as Category)} aria-label="Filtrar categoria">{categories.map(c=><option key={c}>{c}</option>)}</select><label className="catalog-sort-control">Ordenar<select aria-label="Ordenar catálogo" value={catalogSort} onChange={e=>setCatalogSort(e.target.value as 'catalog'|'title'|'game')}><option value="catalog">Ordem do catálogo</option><option value="title">Nome (A–Z)</option><option value="game">Jogo e nome</option></select></label></div><div className="catalog-import-bar"><div className="catalog-source"><strong>Origem: {catalogSource}</strong><span>Somente metadados JSON. Sem varredura ou instalação.</span></div><div className="catalog-import-actions"><label className="btn secondary import-control">Importar catálogo JSON<input type="file" accept=".json,application/json" aria-label="Arquivo JSON do catálogo" onChange={importCatalogFile}/></label>{catalogSource!=='Demonstração'&&<button className="btn secondary" onClick={restoreDemo}>Restaurar demonstração</button>}</div></div>{catalogError&&<div className="catalog-error" role="alert">{catalogError}</div>}<div className="result-count">{filtered.length} {filtered.length===1?'resultado':'resultados'}</div>
 { (selectedGame!=='all'||category!=='Todos'||search.trim().length>0||catalogSort!=='catalog')&&<div className="catalog-active-filters" role="group" aria-label="Filtros ativos do catálogo">
  <span>Filtros ativos:</span>
  {selectedGame!=='all'&&<button type="button" aria-label="Remover filtro de jogo do catálogo" onClick={event=>removeCatalogFilterChip(event,()=>setSelectedGame('all'))}>Jogo: {games[selectedGame].title} <span aria-hidden="true">×</span></button>}
  {category!=='Todos'&&<button type="button" aria-label="Remover filtro de categoria do catálogo" onClick={event=>removeCatalogFilterChip(event,()=>setCategory('Todos'))}>Categoria: {category} <span aria-hidden="true">×</span></button>}
  {search.trim().length>0&&<button type="button" aria-label="Remover filtro de pesquisa do catálogo" onClick={event=>removeCatalogFilterChip(event,()=>setSearch(''))}>Busca: {search.trim()} <span aria-hidden="true">×</span></button>}
  {catalogSort!=='catalog'&&<button type="button" aria-label="Remover ordenação do catálogo" onClick={event=>removeCatalogFilterChip(event,()=>setCatalogSort('catalog'))}>Ordem: {catalogSort==='title'?'Nome (A–Z)':'Jogo e nome'} <span aria-hidden="true">×</span></button>}
 </div>}
 {filtered.length?modCards(filtered):<div className="empty catalog-empty-filter"><Search size={28}/><h3>Nenhum mod corresponde aos filtros.</h3><p>Os metadados do catálogo continuam disponíveis. Limpe a pesquisa, o jogo e a categoria para vê-los novamente.</p><button type="button" className="btn secondary" onClick={resetCatalogFiltersWithFocus}>Mostrar todos os mods</button></div>}</>}
    {screen==='library'&&<><div className="page-heading"><span className="eyebrow">COLEÇÃO PESSOAL</span><h1>Minha biblioteca</h1><p>Os favoritos ficam salvos localmente. Filtre por simulador e categoria. São apenas metadados: não detectamos instalação nem compatibilidade real.</p></div>
 <section className="library-summary" aria-label="Resumo da biblioteca"><div><small>Favoritos</small><strong>{favoriteMods.length}</strong></div><div><small>Simuladores nos favoritos</small><strong>{new Set(favoriteMods.map(m=>m.game)).size}</strong></div><div className="library-trust"><LockKeyhole size={16}/><span>Arquivos dos mods não inspecionados. Status real desconhecido.</span></div></section>
 {favoriteMods.length>0&&<section className="library-by-game" aria-label="Resumo de favoritos por simulador">
   <div className="library-by-game-heading">
    <strong>Favoritos por simulador</strong>
    <span>Contagem de toda a coleção, independente dos filtros. Tamanhos apenas declarados.</span>
   </div>
   <div className="library-by-game-grid">
    {libraryGameSummary.map(group=><button key={group.game} type="button"
     aria-label={'Filtrar favoritos de '+games[group.game].title}
     aria-pressed={libraryGame===group.game}
     onClick={()=>setLibraryGame(current=>current===group.game?'all':group.game)}>
     <span className="library-by-game-title">{games[group.game].title}</span>
     <strong>{group.count} {group.count===1?'favorito':'favoritos'}</strong>
     <small>{group.size.known>0?'Subtotal declarado: '+group.size.subtotal:'Sem tamanho interpretável'}
      {group.size.unknown>0?' · '+group.size.unknown+' tamanho(s) desconhecido(s)':''}</small>
     <span className="library-by-game-hint">{libraryGame===group.game?'Mostrar todos os simuladores':'Ver apenas este simulador'}</span>
    </button>)}
   </div>
  </section>}
  {favoriteMods.length>0&&<div className="library-toolbar" aria-label="Filtros da biblioteca"><label>Jogo<select aria-label="Filtrar jogo na biblioteca" value={libraryGame} onChange={e=>setLibraryGame(e.target.value as GameId|'all')}><option value="all">Todos os jogos</option>{(Object.keys(games) as GameId[]).map(id=><option key={id} value={id}>{games[id].title}</option>)}</select></label><label>Categoria<select aria-label="Filtrar categoria na biblioteca" value={libraryCategory} onChange={e=>setLibraryCategory(e.target.value as Category)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Alertas<select aria-label="Filtrar alertas declarados" value={libraryDeclaredStatus} onChange={e=>setLibraryDeclaredStatus(e.target.value as DeclaredStatusKind|'all')}><option value="all">Todos os estados do catálogo</option><option value="blocking">Bloqueios declarados</option><option value="attention">Avisos declarados</option><option value="no-issues">Sem alertas declarados</option></select></label><label>Ordenação<select aria-label="Ordenar biblioteca" value={librarySort} onChange={e=>setLibrarySort(e.target.value as 'catalog'|'title'|'game'|'alerts'|'size-desc'|'size-asc'|'incoming')}><option value="catalog">Ordem do catálogo</option><option value="title">Nome (A–Z)</option><option value="game">Jogo e nome</option><option value="alerts">Alertas declarados (bloqueios primeiro)</option><option value="incoming">Referências recebidas no JSON (mais primeiro)</option><option value="size-desc">Tamanho declarado (maior primeiro)</option><option value="size-asc">Tamanho declarado (menor primeiro)</option></select></label><label className="library-selected-only"><input type="checkbox" aria-label="Mostrar apenas selecionados para análise" checked={libraryOnlySelected} onChange={e=>setLibraryOnlySelected(e.target.checked)}/>Só selecionados</label><div className="library-filter-results" role="status">{libraryMods.length} {libraryMods.length===1?'favorito exibido':'favoritos exibidos'}</div>{activeLibraryControlCount>0&&<button className="btn secondary library-clear-filters" type="button" aria-label="Limpar filtros da biblioteca" onClick={resetLibraryFiltersWithFocus}>Limpar filtros ({activeLibraryControlCount})</button>}</div>}
 {favoriteMods.length>0&&activeLibraryControlCount>0&&<div className="library-active-filters" role="group" aria-label="Filtros ativos da biblioteca">
  <span>Filtros ativos:</span>
  {libraryGame!=='all'&&<button type="button" aria-label="Remover filtro de jogo" onClick={event=>removeLibraryFilterChip(event,()=>setLibraryGame('all'))}>Jogo: {games[libraryGame].title} <span aria-hidden="true">×</span></button>}
  {libraryCategory!=='Todos'&&<button type="button" aria-label="Remover filtro de categoria" onClick={event=>removeLibraryFilterChip(event,()=>setLibraryCategory('Todos'))}>Categoria: {libraryCategory} <span aria-hidden="true">×</span></button>}
  {libraryDeclaredStatus!=='all'&&<button type="button" aria-label="Remover filtro de alertas" onClick={event=>removeLibraryFilterChip(event,()=>setLibraryDeclaredStatus('all'))}>Alertas: {{blocking:'Bloqueios declarados',attention:'Avisos declarados','no-issues':'Sem alertas declarados'}[libraryDeclaredStatus]} <span aria-hidden="true">×</span></button>}
  {librarySizeFilter!=='all'&&<button type="button" aria-label="Remover filtro de tamanho declarado" onClick={event=>removeLibraryFilterChip(event,()=>setLibrarySizeFilter('all'))}>Tamanho: {librarySizeFilter==='known'?'reconhecido':'desconhecido'} <span aria-hidden="true">×</span></button>}
  {libraryIncomingFilter!=='all'&&<button type="button" aria-label="Remover filtro de referências recebidas" onClick={event=>removeLibraryFilterChip(event,()=>setLibraryIncomingFilter('all'))}>Referências recebidas: {libraryIncomingFilter==='cross-game'?'de outro simulador':libraryIncomingFilter==='with'?'com referências':'sem referências'} <span aria-hidden="true">×</span></button>}
   {libraryOnlySelected&&<button type="button" aria-label="Remover filtro de selecionados" onClick={event=>removeLibraryFilterChip(event,()=>setLibraryOnlySelected(false))}>Seleção: só marcados <span aria-hidden="true">×</span></button>}
  {librarySearch.trim().length>0&&<button type="button" aria-label="Remover filtro de pesquisa" onClick={event=>removeLibraryFilterChip(event,()=>setLibrarySearch(''))}>Busca: {librarySearch.trim()} <span aria-hidden="true">×</span></button>}
  {librarySort!=='catalog'&&<button type="button" aria-label="Remover filtro de ordenação" onClick={event=>removeLibraryFilterChip(event,()=>setLibrarySort('catalog'))}>Ordem: {librarySort==='title'?'Nome (A–Z)':librarySort==='game'?'Jogo e nome':librarySort==='alerts'?'Alertas declarados':librarySort==='incoming'?'Referências recebidas no JSON':librarySort==='size-desc'?'Tamanho declarado (maior primeiro)':'Tamanho declarado (menor primeiro)'} <span aria-hidden="true">×</span></button>}
 </div>}
 {(librarySort==='size-asc'||librarySort==='size-desc')&&favoriteMods.length>0&&<p className="library-size-sort-note" role="note">Ordem baseada apenas no tamanho declarado do catálogo, não em espaço ocupado no disco. Unidades desconhecidas ficam por último. Nenhum mod foi inspecionado.</p>}
  {librarySort==='incoming'&&favoriteMods.length>0&&<p className="library-size-sort-note library-incoming-sort-note" role="note">Ordenação pelas referências diretas recebidas no JSON inteiro, mesmo quando o registro que cita não é favorito. Empates: dependências recebidas primeiro e depois nome. Não mede popularidade, instalação, qualidade nem compatibilidade real.</p>}
 {favoriteMods.length>0&&<div className="library-declared-size-summary" role="note" aria-label="Resumo dos tamanhos declarados dos favoritos exibidos">
   <strong>{librarySizeSummary.known>0?(librarySizeSummary.unknown>0?'Subtotal declarado':'Soma declarada')+' dos exibidos: '+librarySizeSummary.subtotal:'Nenhum tamanho reconhecido nos favoritos exibidos'}</strong>
   <span>{librarySizeSummary.known} de {libraryMods.length} com tamanho interpretável.{librarySizeSummary.unknown>0?' '+librarySizeSummary.unknown+' tamanho(s) desconhecido(s) não somado(s).':''} São apenas metadados do catálogo: não é espaço ocupado no disco, nem prova de instalação.</span>
  </div>}
  {favoriteMods.length>0&&<div className="library-size-quick-filters" role="group" aria-label="Filtrar por tamanho declarado">
    <div><strong>Confiabilidade do tamanho declarado</strong><small>Em todos os favoritos: {allFavoritesSizeSummary.known} reconhecido(s) e {allFavoritesSizeSummary.unknown} desconhecido(s). Não é espaço real no disco.</small></div>
    <div className="library-size-filter-actions">
     <button type="button" aria-pressed={librarySizeFilter==='known'} disabled={allFavoritesSizeSummary.known===0}
      onClick={()=>setLibrarySizeFilter(value=>value==='known'?'all':'known')}>Só tamanhos reconhecidos</button>
     <button type="button" aria-pressed={librarySizeFilter==='unknown'} disabled={allFavoritesSizeSummary.unknown===0}
      onClick={()=>setLibrarySizeFilter(value=>value==='unknown'?'all':'unknown')}>Só tamanhos desconhecidos</button>
    </div>
   </div>}
   {favoriteMods.length>0&&<div className="library-size-quick-filters library-incoming-quick-filters" role="group" aria-label="Filtrar por referências recebidas">
    <div><strong>Referências recebidas no catálogo</strong>
     <small>Entre todos os {favoriteMods.length} {favoriteMods.length===1?'favorito':'favoritos'}: {favoriteIncomingCounts.withReferences} mencionado(s) e {favoriteIncomingCounts.withoutReferences} sem referências diretas de outros registros do JSON; {favoriteIncomingCounts.crossGame} com menção de outro simulador. Não demonstra conversão, instalação ou compatibilidade.</small>
    </div>
    <div className="library-size-filter-actions">
     <button type="button" aria-pressed={libraryIncomingFilter==='with'}
      disabled={favoriteIncomingCounts.withReferences===0}
      onClick={()=>setLibraryIncomingFilter(v=>v==='with'?'all':'with')}>Só favoritos com referências recebidas</button>
     <button type="button" aria-pressed={libraryIncomingFilter==='without'}
      disabled={favoriteIncomingCounts.withoutReferences===0}
      onClick={()=>setLibraryIncomingFilter(v=>v==='without'?'all':'without')}>Só favoritos sem referências recebidas</button>
     <button type="button" aria-pressed={libraryIncomingFilter==='cross-game'}
      disabled={favoriteIncomingCounts.crossGame===0}
      onClick={()=>setLibraryIncomingFilter(v=>v==='cross-game'?'all':'cross-game')}>Só favoritos mencionados por outro simulador</button>
    </div>
   </div>}
   {favoriteMods.length>0&&<div className="library-declared-alerts" role="note"><AlertTriangle size={16}/><div className="library-alert-content"><span><strong>{libraryAlerts.blocking} com bloqueios</strong> · {libraryAlerts.attention} com avisos no catálogo entre todos os {favoriteMods.length} favoritos.{libraryMods.length!==favoriteMods.length&&<span className="library-visible-alerts">Na visualização filtrada: bloqueios {visibleLibraryAlerts.blocking} · avisos {visibleLibraryAlerts.attention}.</span>} Ausência de alertas declarados não comprova compatibilidade nem instalação.</span><div className="library-alert-actions" role="group" aria-label="Atalhos de alertas declarados"><button type="button" aria-pressed={libraryDeclaredStatus==='blocking'} disabled={libraryAlerts.blocking===0} onClick={()=>setLibraryDeclaredStatus(current=>current==='blocking'?'all':'blocking')}>Ver bloqueios declarados</button><button type="button" aria-pressed={libraryDeclaredStatus==='attention'} disabled={libraryAlerts.attention===0} onClick={()=>setLibraryDeclaredStatus(current=>current==='attention'?'all':'attention')}>Ver avisos declarados</button></div></div></div>}
 {favoriteMods.length>0&&<section id="library-batch" tabIndex={-1} className="library-batch" aria-label="Análise conjunta declarativa">
 <div><h2>Analisar vários mods</h2><p>Escolha os favoritos nos cartões. A análise cruza dependências e conflitos do catálogo, separando OMSI 2, ETS2 e ATS. Nenhum pacote é aberto ou instalado.</p></div>
 <div className="library-batch-actions"><span role="status">{activeBatch.length} selecionado(s){hiddenBatchCount>0?` · ${hiddenBatchCount} fora dos filtros atuais`:''}</span><button className="btn secondary" disabled={libraryMods.length===0||libraryMods.every(m=>activeBatch.includes(m.id))} onClick={()=>{setBatchSelected(ids=>[...new Set([...ids,...libraryMods.map(m=>m.id)])]);setBatchOpen(false)}}>Marcar favoritos exibidos</button>{visibleBatchCount>0&&<button className="btn secondary" type="button" onClick={()=>{setBatchSelected(ids=>ids.filter(id=>!visibleLibraryIds.has(id)));setBatchOpen(false)}}>Desmarcar exibidos ({visibleBatchCount})</button>}{hiddenBatchCount>0&&<button className="btn secondary" type="button" onClick={()=>{setBatchSelected(ids=>ids.filter(id=>visibleLibraryIds.has(id)));setBatchOpen(false)}}>Desmarcar ocultos ({hiddenBatchCount})</button>}<button className="btn primary" disabled={activeBatch.length===0} onClick={()=>setBatchOpen(true)}>Analisar seleção</button><button className="btn secondary" disabled={activeBatch.length===0} onClick={()=>{setBatchSelected([]);setBatchOpen(false)}}>Limpar seleção</button></div>
  {selectionByGame.length>0&&<div className="library-batch-selection-summary" role="status" aria-label="Seleção por simulador">
   <strong>Seleção por simulador</strong>
   {selectionByGame.map(({game,count})=><span key={game}>{games[game].title}: {count}</span>)}
   <small>Somente favoritos marcados. Dependências teóricas não entram nesta contagem.</small>
  </div>}
  {hiddenBatchCount>0&&<p className="library-batch-hidden-note" role="note">A análise conjunta também incluirá {hiddenBatchCount} {hiddenBatchCount===1?'favorito selecionado que não aparece':'favoritos selecionados que não aparecem'} nos filtros atuais. Desmarque os ocultos para analisar apenas o que está visível.</p>}
  {hiddenBatchCount>0&&<details className="library-batch-hidden-list">
   <summary>Ver selecionados ocultos ({hiddenBatchCount})</summary>
   <p>Somente títulos e informações declaradas no catálogo. Nenhum arquivo de mod foi inspecionado.</p>
   <ul>{hiddenSelectedMods.map(mod=><li key={mod.id}>
    <div><strong>{mod.title}</strong><small>{games[mod.game].title} · {mod.category} · ID {mod.id}</small></div>
    <button type="button" className="btn secondary" aria-label={`Desmarcar ${mod.title} (${games[mod.game].title}, ID ${mod.id}) da análise conjunta`} onClick={()=>{setBatchSelected(ids=>ids.filter(id=>id!==mod.id));setBatchOpen(false)}}>Desmarcar</button>
   </li>)}</ul>
  </details>}
 {batchOpen&&batchReport&&<div className="library-batch-results" role="region" aria-label="Resultado da análise conjunta"><h3>Análise conjunta · apenas metadados declarados</h3>
 <p role="status">{batchReport.selectedCount} mod(s) selecionado(s) · {batchReport.blockers} bloqueio(s) lógico(s) · {batchReport.notices} aviso(s)</p>
 {batchReport.groups.map(group=><div key={group.game} className="library-batch-game"><h4>{games[group.game].title} · {group.requested} selecionado(s)</h4><p>Sequência teórica de dependências declaradas (não executável):</p><ol>{group.sequence.map(m=><li key={m.id}>{m.title} <small>v{m.version} (declarada) · {activeBatch.includes(m.id)?'selecionado':'dependência adicionada somente ao relatório'}</small></li>)}</ol></div>)}
 {batchReport.issues.length>0?<ul className="library-batch-issues">{batchReport.issues.map((issue,i)=><li key={i} className={issue.severity}><strong>{issue.severity==='blocking'?'Bloqueio declarado':'Aviso declarado'} · {games[issue.game].title}:</strong> {issue.message}</li>)}</ul>:<p>Nenhuma inconsistência encontrada no catálogo selecionado. Isso não comprova compatibilidade.</p>}
 {batchReadiness&&<details className="library-cooperative-review"><summary>O que o analisador cooperativo precisará verificar?</summary><p>Nenhum especialista executado. Esta é uma lista das verificações necessárias, não um diagnóstico dos arquivos.</p><ol aria-label="Verificações cooperativas pendentes">{batchReadiness.specialists.map(step=><li key={step.id}><strong>{step.label}</strong><span>{step.purpose}</span><small>Não executado · {step.phase==='gate'?'antes de qualquer leitura':'após aprovação do gate de segurança'}</small></li>)}</ol><p>Sem hash real, conteúdo lido, compatibilidade confirmada ou autorização para instalar.</p></details>}
 <p className="library-batch-disclaimer"><LockKeyhole size={15}/> Não verificado: arquivos reais, versões instaladas, integridade e funcionamento dos mods. Instalação e remoção continuam bloqueadas.</p><button className="btn secondary" type="button" onClick={saveBatchToSession}>Guardar resumo nesta sessão</button></div>}
 </section>}
 {favoriteMods.length===0?<div className="empty"><Library size={32}/><h3>Biblioteca vazia</h3><p>Adicione mods aos favoritos no catálogo. Eles aparecerão aqui, separados por jogo e categoria.</p><button className="btn secondary" onClick={()=>goto('catalog')}>Explorar catálogo</button></div>:libraryMods.length?modCards(libraryMods):<div className="empty library-empty-filter"><Library size={28}/><h3>Nenhum favorito nesses filtros</h3><p>Seus favoritos continuam salvos. Ajuste os filtros ou mostre a coleção completa.</p><button type="button" className="btn secondary" onClick={resetLibraryFiltersWithFocus}>Mostrar todos os favoritos</button></div>}
 <SyntheticGateLab/>
 <FixtureCrossPackageLab/>
 </>}
    {screen==='details'&&<><button className="back" onClick={returnFromDetails}><ArrowLeft size={17}/> {detailOrigin==='library'?'Voltar à biblioteca':detailOrigin==='home'?'Voltar ao início':'Voltar ao catálogo'}</button><div className="detail-layout"><div className="detail-art"><ModArtwork mod={selected}/><p className="detail-image-note">Arte ilustrativa do catálogo, não é uma imagem extraída deste mod.</p></div><div className="detail-copy"><span className="eyebrow">{games[selected.game].title} / {selected.category}</span><h1 id="detail-mod-title" tabIndex={-1}>{selected.title}</h1><p>{selected.description}</p><nav className="detail-neighbors" aria-label="Navegar pelos mods da lista atual">
  <button type="button" className="btn secondary" disabled={!detailPrev} aria-label={detailPrev?`Mod anterior: ${detailPrev.title}`:'Sem mod anterior'} onClick={()=>detailPrev&&stepDetails(detailPrev.id)}>Anterior</button>
  <span aria-live="polite">{detailPosition>=0?`${detailPosition+1} de ${detailCandidates.length}`:'Fora dos filtros atuais'} · {detailOrigin==='library'?'Biblioteca':detailOrigin==='home'?'Destaques':'Catálogo'}</span>
  <button type="button" className="btn secondary" disabled={!detailNext} aria-label={detailNext?`Próximo mod: ${detailNext.title}`:'Sem próximo mod'} onClick={()=>detailNext&&stepDetails(detailNext.id)}>Próximo</button>
 </nav><div className="detail-verification-status"><AlertTriangle size={17}/><span><strong>Compatibilidade não verificada</strong> · Instalação e atualização reais indisponíveis nesta prévia.</span></div><div className="properties"><div><span>ID declarado no catálogo</span><strong className="mod-declared-id">{selected.id}</strong></div><div><span>Versão declarada</span><strong>{selected.version}</strong></div><div><span>Tamanho declarado</span><strong>{selected.size}</strong></div><div><span>Origem</span><strong>{catalogSource==='Demonstração'?'Catálogo demonstrativo':'JSON importado'}</strong></div></div>
  <div className="detail-size-evidence" role="note" aria-label="Qualidade do tamanho declarado">
   <div className="detail-size-evidence-head">
    <strong>{selectedDeclaredLabel}</strong>
    <span>{catalogSource==='Demonstração'?'Exemplo fictício':'Informado no JSON importado'}</span>
   </div>
   <p>{selectedDeclaredBytes===null?
    'Não foi possível converter este formato para comparação. Desconhecido não significa 0 B.':
    selectedDeclaredBytes===0?
    'O catálogo declarou 0 B. Isso não comprova que o pacote esteja vazio ou instalado.':
    'Equivalência decimal aproximada informada pelo catálogo: '+selectedDeclaredDisplay+'.'}</p>
   <small>Sem medição de disco, abertura de pacote, verificação de integridade ou instalação.</small>
  </div>
 <section className="detail-checklist" aria-label="Etapas de verificação do mod">
  <div className="detail-checklist-heading"><div><span className="eyebrow">ESTADO DA ANÁLISE</span><h2>O que já sabemos sobre este mod</h2></div><span className="detail-checklist-mode"><LockKeyhole size={14}/> Somente leitura</span></div>
  <div className="detail-checklist-grid">
   <div className="detail-check-item"><span className="detail-check-icon neutral"><CheckCircle2 size={17}/></span><div><strong>Metadados do catálogo</strong><p>{catalogSource==='Demonstração'?'Exemplo demonstrativo, não extraído do mod.':'JSON fornecido pelo usuário, sem validação contra o mod.'}</p></div></div>
   <div className="detail-check-item"><span className="detail-check-icon neutral"><Library size={17}/></span><div><strong>Pasta do jogo</strong><p>{diagnostic.directoryStatus==='inspected'?'Nomes de entradas examinados manualmente.':diagnostic.directoryStatus==='error'?'Inspeção de pasta falhou ou não foi autorizada.':'Nenhuma inspeção de pasta realizada.'}</p></div></div>
   <div className="detail-check-item"><span className="detail-check-icon pending"><AlertTriangle size={17}/></span><div><strong>Conteúdo do mod</strong><p>Arquivos internos, modelos, texturas e sons não analisados.</p></div></div>
   <div className="detail-check-item"><span className="detail-check-icon pending"><LockKeyhole size={17}/></span><div><strong>Compatibilidade com o jogo</strong><p>Não verificada. {diagnostic.blockers>0?diagnostic.blockers+' inconsistência(s) declarada(s) no catálogo.':'Sem comprovação de funcionamento no simulador.'}</p></div></div>
  </div>
  <div className="detail-checklist-actions"><a className="detail-report-link" href="#relatorio-consolidado">Consultar evidências e limitações <ChevronRight size={15}/></a><button className="btn secondary" type="button" onClick={()=>goto('games')}>Inspecionar pasta manualmente <ChevronRight size={15}/></button></div>
 </section><div className="detail-actions"><button className="btn disabled-action" disabled title="Instalação desativada"><Download size={17}/> Instalar (bloqueado)</button><button className="btn disabled-action" disabled title="Desinstalação desativada"><Trash2 size={17}/> Remover (bloqueado)</button><button className="btn secondary" onClick={()=>toggleFavorite(selected.id)}>{favorites.includes(selected.id)?'Remover dos favoritos':'Adicionar aos favoritos'}</button></div>
  {detailOrigin==='library'&&favorites.includes(selected.id)&&<section
   className="detail-batch-selection" aria-label="Seleção declarativa nos Detalhes">
    <div className="detail-batch-heading">
     <strong>Seleção para análise conjunta</strong>
     <span>{activeBatch.length} {activeBatch.length===1?'favorito selecionado':'favoritos selecionados'} nesta sessão</span>
    </div>
    <label className="detail-batch-checkbox">
     <input type="checkbox" aria-label={'Selecionar '+selected.title+' para análise conjunta nos Detalhes'}
      checked={activeBatch.includes(selected.id)}
      onChange={event=>{
       const checked=event.target.checked;
       setBatchSelected(ids=>checked?
        (ids.includes(selected.id)?ids:[...ids,selected.id]):
        ids.filter(id=>id!==selected.id));
       setBatchOpen(false);
      }}/>
     Incluir este favorito na análise conjunta
    </label>
    {activeBatch.length>0&&<button type="button" className="btn secondary detail-review-selection"
     onClick={reviewLibrarySelectionFromDetails}>Revisar seleção na Biblioteca ({activeBatch.length})</button>}
    <p>Somente metadados declarados do catálogo. Marcar não lê nem instala mods.
     Se o filtro "Só selecionados" estiver ativo, desmarcar pode ocultar este mod da lista.</p>
   </section>}
  <p className="lock-note"><LockKeyhole size={16}/> Nenhum mod será aplicado enquanto o pipeline de testes não estiver liberado.</p>
 <section id="relacoes-declaradas" tabIndex={-1} className="relation-panel" aria-label="Simulação de dependências">
  <h2>Dependências e conflitos · simulação</h2>
  <label className="version-simulator"><strong>Versão hipotética do jogo</strong><input aria-label="Versão hipotética do jogo" placeholder="Ex.: 1.52.0 (opcional)" value={hypotheticalGameVersion} onChange={e=>setHypotheticalGameVersion(e.target.value.slice(0,30))}/><small>Valor digitado por você. Não detectamos a versão instalada no computador.</small></label>
  <p>Somente metadados declarados no catálogo. Não é uma análise dos arquivos do jogo.</p>
  <div className="relation-verdict" role="status">{relationAnalysis.logicalBlockers?'Inconsistências lógicas encontradas':'Nenhum bloqueio lógico encontrado no JSON'}</div>
  <div className="relation-overview" aria-label="Resumo das relações declaradas">
   <div><small>Bloqueios no catálogo</small><strong>{relationSummary.blocking}</strong></div>
   <div><small>Avisos no catálogo</small><strong>{relationSummary.attention}</strong></div>
   <div><small>Etapas teóricas</small><strong>{relationAnalysis.sequence.length}</strong></div>
  </div>
  {relationAnalysis.issues.length>0&&<nav className="relation-alert-index" aria-label="Índice dos alertas declarados">
   <div className="relation-alert-index-heading"><strong>Ir direto a um alerta</strong><small>Orientações baseadas apenas no JSON, sem modificar jogos ou mods.</small></div>
   <ol>{relationAnalysis.issues.map((issue,index)=>{
    const guide=explainRelationIssue(issue);
    return <li key={issue.code+index}><button type="button" aria-label={'Abrir orientação do alerta '+(index+1)+': '+guide.heading} onClick={()=>{
      const explanation=document.getElementById('relation-guide-'+index) as HTMLDetailsElement|null;
      if(!explanation)return;
      explanation.open=true;
      explanation.scrollIntoView({block:'center'});
      explanation.querySelector('summary')?.focus({preventScroll:true});
     }}>
      <span className={'relation-alert-index-severity '+issue.severity}>{issue.severity==='blocking'?'Bloqueio':'Aviso'} {index+1}</span>
      <span className="relation-alert-index-name">{guide.heading}</span>
      <ChevronRight size={14} aria-hidden="true"/>
     </button></li>;
   })}</ol>
  </nav>}
  <h3>Sequência teórica de dependências</h3>
  {relationTimeline.hasCycle&&<p className="relation-sequence-warning" role="alert">O catálogo declara uma dependência circular. A ordem abaixo é apenas ilustrativa e não representa uma sequência válida de instalação.</p>}
  {relationTimeline.hasMissingOrCrossGameDependency&&<p className="relation-sequence-warning" role="note">Existe dependência ausente ou declarada para outro jogo. A lista abaixo não inclui esses componentes e está incompleta.</p>}
  {relationTimeline.noDeclaredDependencies&&<p className="relation-no-deps">Este mod não declara dependências. Isso não comprova que funcione sozinho.</p>}
  <ol className="relation-order relation-timeline" aria-label="Etapas declaradas do mod">{relationTimeline.stages.map(stage=><li key={stage.id} data-stage-role={stage.role}>
    <div className="relation-stage-number" aria-hidden="true">{stage.step}</div>
    <div className="relation-stage-body">
      <span className="relation-stage-role">{stage.role==='selected'?'MOD SELECIONADO':stage.role==='direct'?'DEPENDÊNCIA DIRETA':'DEPENDÊNCIA INDIRETA'}</span>
      <strong>{stage.title}</strong>
      <small>{stage.id}</small>
      <details className="relation-stage-detail">
       <summary>Ver dados declarados</summary>
       <p>Categoria: {stage.category} · Versão declarada: {stage.version} · Jogo: {games[stage.game as GameId].title}.</p>
       <p>Presença, versão instalada, ativação e integridade deste componente não verificadas.</p>
       {stage.role!=='selected'&&catalogMods.some(mod=>mod.id===stage.id)&&
        <button type="button" className="relation-stage-catalog-jump"
         aria-label={'Localizar dependência '+stage.title+' (ID '+stage.id+') no Catálogo'}
         onClick={()=>locateDeclaredDependencyInCatalog(stage.id)}>
         Localizar ID no Catálogo <ChevronRight size={14} aria-hidden="true"/>
        </button>}
      </details>
    </div>
   </li>)}</ol>
  <section id="relacoes-recebidas" tabIndex={-1} className="relation-incoming" aria-label="Referências recebidas no catálogo">
   <h3>Quem menciona este mod no catálogo?</h3>
   <p>São declarações diretas do JSON. Não inclui dependências indiretas,
    não comprova compatibilidade, instalação nem conflito real.</p>
   {incomingRelations.requiredBy.length+incomingRelations.conflictDeclaredBy.length===0?
    <p className="relation-incoming-empty">Nenhuma referência recebida nesses campos do catálogo.</p>:
    <div className="relation-incoming-groups">
     {incomingRelations.requiredBy.length>0&&<div>
      <h4>Declara dependência direta deste ID ({incomingRelations.requiredBy.length})</h4>
      <ul>{incomingRelations.requiredBy.map(mod=><li key={mod.id}>
       <span><strong>{mod.title}</strong><small>{games[mod.game].title} · {mod.category} · ID {mod.id}</small>
        {mod.differentGame&&<small className="relation-incoming-context">Referência entre jogos diferentes · somente JSON</small>}</span>
       <button className="relation-stage-catalog-jump" type="button"
        aria-label={'Localizar mod que declara depender '+mod.title+' (ID '+mod.id+') no Catálogo'}
        onClick={()=>locateDeclaredDependencyInCatalog(mod.id)}>
        Localizar ID no Catálogo <ChevronRight size={14} aria-hidden="true"/>
       </button>
      </li>)}</ul>
     </div>}
     {incomingRelations.conflictDeclaredBy.length>0&&<div>
      <h4>Outros registros que declaram conflito com este ID ({incomingRelations.conflictDeclaredBy.length})</h4>
      <ul>{incomingRelations.conflictDeclaredBy.map(mod=><li key={mod.id}>
       <span><strong>{mod.title}</strong><small>{games[mod.game].title} · {mod.category} · ID {mod.id}</small>
        <small className="relation-incoming-context">{mod.reciprocalDeclaration?
         'Ambos os registros declaram conflito no JSON':
         'Declaração unilateral: apenas este outro registro indica conflito'}</small>
        {mod.differentGame&&<small className="relation-incoming-context">Referência entre jogos diferentes · somente JSON</small>}</span>
       <button className="relation-stage-catalog-jump" type="button"
        aria-label={'Localizar mod que declara conflito '+mod.title+' (ID '+mod.id+') no Catálogo'}
        onClick={()=>locateDeclaredDependencyInCatalog(mod.id)}>
        Localizar ID no Catálogo <ChevronRight size={14} aria-hidden="true"/>
       </button>
      </li>)}</ul>
     </div>}
    </div>}
   <small>Declarações de outros registros do catálogo atual. Não foram inspecionados arquivos ou versões instaladas.</small>
  </section>
  {relationAnalysis.issues.length>0?<><h3>O que significam os alertas</h3><ul className="relation-issues">{relationAnalysis.issues.map((issue,index)=>{
   const guide=explainRelationIssue(issue);
   return <li key={issue.code+index} className={issue.severity}>
    <div className="relation-issue-title"><span className="relation-issue-category">{guide.group}</span><strong>{guide.heading}</strong></div>
    <p><strong>{issue.severity==='blocking'?'Bloqueio no catálogo':'Atenção'}:</strong> {issue.message}</p>
    <details id={'relation-guide-'+index} className="relation-guide"><summary>Entender e conferir este alerta</summary><p>{guide.meaning}</p><p><strong>Próxima verificação:</strong> {guide.nextStep}</p></details>
   </li>;
  })}</ul></>:<p className="relation-clean">Nenhuma relação inconsistente declarada para este mod.</p>}
  <p className="relation-scope-note"><LockKeyhole size={14}/> Estes alertas usam apenas registros declarados. Nenhum aviso resolvido ou ausente comprova que o mod funciona.</p>
  <p className="relation-disclaimer"><LockKeyhole size={15}/> A versão informada é hipotética. Compatibilidade real, versão instalada, integridade dos mods e instalação NÃO verificadas. Nenhuma ação é executada.</p>
 </section></div></div>
 <section id="relatorio-consolidado" tabIndex={-1} className="diagnostic-report" aria-label="Relatório consolidado">
  <div className="report-heading"><div><span className="eyebrow">DIAGNÓSTICO SOMENTE LEITURA</span><h2>Relatório consolidado</h2><p>Reúne metadados declarados e, se realizada, a inspeção manual de pastas deste jogo. Nenhuma operação é executada.</p></div><strong className="report-verdict">{diagnostic.title}</strong></div>
  <div className="report-summary">
   <div><small>Bloqueios declarados</small><strong>{diagnostic.blockers}</strong></div>
   <div><small>Avisos</small><strong>{diagnostic.warnings}</strong></div>
   <div><small>Etapas teóricas</small><strong>{diagnostic.declaredSequenceCount}</strong></div>
   <div><small>Inspeção de pasta</small><strong>{diagnostic.directoryStatus==='inspected'?'Manual':diagnostic.directoryStatus==='error'?'Falhou':'Não realizada'}</strong></div>
  </div>
  <p className="report-origin">Origem do catálogo: {diagnostic.catalogOrigin} · Jogo: {games[diagnostic.game].title} · Versão hipotética: {diagnostic.hypotheticalVersion??'não informada'}</p>
  {diagnostic.directoryStatus==='inspected'&&<p className="report-origin">Entradas diretas contabilizadas: {diagnostic.inspectedEntries}{diagnostic.hasPartialCounts?' (contagem parcial)':''}. Não equivale a quantidade de mods instalados.</p>}
  <h3>Constatações e avisos</h3>
  <ul className="report-findings">{diagnostic.findings.map((finding,index)=><li key={finding.origin+'-'+finding.code+'-'+index} className={finding.severity}><span>{finding.origin==='catalog'?'Catálogo':'Pastas'}</span><p>{finding.description}</p></li>)}</ul>
  <h3>O que não foi verificado</h3>
  <ul className="report-limits">{diagnostic.limitations.map((reason,index)=><li key={index}>{reason}</li>)}</ul>
  <p className="report-footnote"><LockKeyhole size={16}/> Este relatório é informativo. Compatibilidade não verificada. Instalar e remover continuam bloqueados.</p>
 </section></>}
    {screen==='queue'&&<><div className="page-heading"><span className="eyebrow">CONTROLE DE OPERAÇÕES</span><h1>Fila de tarefas</h1><p>Execução de tarefas permanentemente desabilitada neste protótipo.</p></div><div className="empty"><Clock3 size={33}/><h3>Nenhuma tarefa em execução</h3><p>Não há processos em andamento ou tarefas pendentes.</p><span className="pill">Fila bloqueada por segurança</span></div></>}
    {screen==='history'&&<><div className="page-heading"><span className="eyebrow">ATIVIDADES</span><h1>Histórico</h1><p>A interface não gera registros de instalação nem simula operações como concluídas.</p></div>
 <section className="session-import-review" aria-label="Consulta de arquivos exportados">
  <h2>Consultar JSON exportado</h2>
  <p>Abra um resumo, coleção ou comparação JSON exportada anteriormente. Consulta local e temporária: não importa para o Histórico, não altera favoritos nem verifica instalações.</p>
  <label className="session-import-picker">Arquivo JSON de resumos exportados<input type="file" aria-label="Arquivo JSON de resumos exportados" accept=".json,application/json" onChange={openDeclaredExport}/></label>
  {reviewError&&<p role="alert" className="session-import-error">{reviewError}</p>}
  {reviewedComparisonFile&&<section className="session-comparison-review" aria-label="Consulta de comparação JSON exportada">
   <div className="session-import-summary">
    <strong>Comparação JSON consultada: resumo {reviewedComparisonFile.beforeReportId} → resumo {reviewedComparisonFile.afterReportId}</strong>
    <button type="button" className="btn secondary" onClick={()=>{++reviewReadGeneration.current;setReviewedComparisonFile(null);setReviewError('')}}>Descartar comparação consultada</button>
   </div>
   <p>Origem {reviewedComparisonFile.source==='external-json-unverified'?'comparação externa':'exportação de sessão'} não autenticada. Ordem cronológica não verificada. Não comprova instalação nem compatibilidade.</p>
   <div className="session-import-compare-stats" role="group" aria-label="Diferenças da comparação JSON">
    <span>Entraram na seleção: <strong>{reviewedComparisonFile.addedSelectedMods.length}</strong></span>
    <span>Saíram da seleção: <strong>{reviewedComparisonFile.removedSelectedMods.length}</strong></span>
    <span>Permaneceram: <strong>{reviewedComparisonFile.unchangedSelectedCount}</strong></span>
    <span>Bloqueios declarados: <strong>{reviewedComparisonFile.declaredBlockers.before} → {reviewedComparisonFile.declaredBlockers.after}</strong></span>
    <span>Avisos declarados: <strong>{reviewedComparisonFile.declaredWarnings.before} → {reviewedComparisonFile.declaredWarnings.after}</strong></span>
   </div>
   <div className="session-import-compare-diff">
    <div><h3>Adicionados</h3>{reviewedComparisonFile.addedSelectedMods.length?<ul>{reviewedComparisonFile.addedSelectedMods.map(mod=><li key={mod.id}>{mod.title}</li>)}</ul>:<p>Nenhum mod adicionado.</p>}</div>
    <div><h3>Removidos</h3>{reviewedComparisonFile.removedSelectedMods.length?<ul>{reviewedComparisonFile.removedSelectedMods.map(mod=><li key={mod.id}>{mod.title}</li>)}</ul>:<p>Nenhum mod removido.</p>}</div>
   </div>
   <small>Arquivo tratado apenas como dados declarados. Nenhum histórico real, favorito, instalação ou mod foi alterado.</small>
  </section>}
  {reviewedFile&&<div className="session-import-results">
   <div className="session-import-summary"><strong>Arquivo consultado: {reviewedFile.reports.length} resumo(s) declarado(s)</strong><button type="button" className="btn secondary" onClick={()=>{++reviewReadGeneration.current;setReviewedFile(null);setReviewBeforeId(null);setReviewAfterId(null);setReviewError('')}}>Descartar consulta</button></div>
   <p>Origem externa não autenticada. Instalação e compatibilidade não verificadas. Estes dados não são atividades do sistema.</p>
   <ol>{reviewedFile.reports.map((record,index)=><li key={index}><strong>Resumo {record.reportId} · {record.selectedCount} mod(s) declarados</strong><span>{record.declaredGames.map(game=>games[game].title).join(' · ')} · {record.declaredBlockers} bloqueio(s) · {record.declaredWarnings} aviso(s)</span><ul>{record.selectedMods.map(mod=><li key={mod.id}>{mod.title}</li>)}</ul></li>)}</ol>
   {reviewedComparison&&<section className="session-import-comparison" aria-label="Comparação de resumos do arquivo consultado">
    <h3>Comparar resumos do arquivo consultado</h3>
    <p>Diferenças entre duas seleções declaradas neste arquivo externo. A ordem é escolhida manualmente e não comprova uma linha do tempo.</p>
    <div className="session-import-compare-filters">
     <label>Resumo base<select aria-label="Resumo base do arquivo consultado" value={reviewedComparison.beforeId} onChange={e=>setReviewBeforeId(Number(e.target.value))}>
      {reviewedFile.reports.filter(r=>r.reportId!==reviewedComparison.afterId).map(r=><option key={r.reportId} value={r.reportId}>Resumo {r.reportId}</option>)}
     </select></label>
     <label>Resumo comparado<select aria-label="Resumo comparado do arquivo consultado" value={reviewedComparison.afterId} onChange={e=>setReviewAfterId(Number(e.target.value))}>
      {reviewedFile.reports.filter(r=>r.reportId!==reviewedComparison.beforeId).map(r=><option key={r.reportId} value={r.reportId}>Resumo {r.reportId}</option>)}
     </select></label>
    </div>
    <div className="session-import-compare-actions">
     <button type="button" className="btn secondary session-import-compare-swap" onClick={()=>{
      setReviewBeforeId(reviewedComparison.afterId);setReviewAfterId(reviewedComparison.beforeId);
     }}>Inverter comparação do arquivo</button>
     <button type="button" className="btn secondary" onClick={exportReviewedComparison}>Exportar comparação externa JSON</button>
    </div>
    <div className="session-import-compare-stats" role="group" aria-label="Diferenças do arquivo consultado">
     <span>Entraram na seleção: <strong>{reviewedComparison.added.length}</strong></span>
     <span>Saíram da seleção: <strong>{reviewedComparison.removed.length}</strong></span>
     <span>Permaneceram: <strong>{reviewedComparison.unchangedCount}</strong></span>
     <span>Bloqueios declarados: <strong>{reviewedComparison.blockersBefore} → {reviewedComparison.blockersAfter}</strong></span>
     <span>Avisos declarados: <strong>{reviewedComparison.noticesBefore} → {reviewedComparison.noticesAfter}</strong></span>
    </div>
    <div className="session-import-compare-diff">
     <div><h4>Adicionados</h4>{reviewedComparison.added.length?<ul>{reviewedComparison.added.map(mod=><li key={mod.id}>{mod.title}</li>)}</ul>:<p>Nenhum mod adicionado.</p>}</div>
     <div><h4>Removidos</h4>{reviewedComparison.removed.length?<ul>{reviewedComparison.removed.map(mod=><li key={mod.id}>{mod.title}</li>)}</ul>:<p>Nenhum mod removido.</p>}</div>
    </div>
    <small>Origem externa não autenticada. Não altera favoritos, atividades, arquivos dos jogos nem prova instalação ou compatibilidade.</small>
   </section>}
  </div>}
 </section>
 {lastRemovedReport&&<div className="session-history-undo" role="status"><span>Resumo temporário excluído desta sessão.</span><button type="button" className="btn secondary" aria-label="Desfazer exclusão do último resumo" onClick={undoRemovedSessionReport}>Desfazer exclusão</button></div>}
 {batchHistory.length>0&&<section className="session-batch-history" aria-label="Análises declarativas desta sessão"><div className="session-history-header"><div><h2>Resumos de metadados desta sessão</h2><p>Até 10 relatórios temporários. Não persistem ao fechar ou recarregar a aplicação; não comprovam instalação ou compatibilidade.</p></div><div className="session-history-header-actions"><button className="btn secondary" type="button" aria-label="Exportar todos os resumos em JSON" onClick={exportSessionArchive}>Exportar todos JSON</button><button className="btn secondary" type="button" onClick={()=>{setBatchHistory([]);setLastRemovedReport(null)}}>Limpar resumos da sessão</button></div></div>
 <ol>{batchHistory.map(record=><li key={record.id}><strong>{record.selectedCount} mod(s) declarados · {record.blockers} bloqueio(s) · {record.notices} aviso(s)</strong><span>{record.games.map(id=>games[id].title).join(' · ')}</span><p>{record.selectedTitles.join(' · ')}</p><small>Somente metadados de catálogo. Instalação e compatibilidade não verificadas.</small><button type="button" className="btn secondary session-history-export" aria-label={`Exportar resumo ${record.id} em JSON`} onClick={()=>exportSessionReport(record)}>Exportar JSON</button><button type="button" className="btn secondary session-history-reopen" aria-label={`Rever seleção do resumo ${record.id}`} onClick={()=>revisitSessionReport(record)}>Rever seleção</button><button type="button" className="btn secondary session-history-remove" aria-label={`Excluir resumo ${record.id} desta sessão`} onClick={()=>removeSessionReport(record)}>Excluir este resumo</button></li>)}</ol></section>}
 {reportComparison&&<section className="session-comparison" aria-label="Comparar resumos declarados da sessão">
  <h2>Comparar resumos declarados</h2>
  <p>Compare apenas os mods selecionados e os alertas registrados no catálogo. Não mostra instalação, versão atual nem compatibilidade real.</p>
  <div className="session-comparison-filters">
   <label>Resumo anterior<select aria-label="Resumo anterior para comparação" value={reportComparison.beforeId} onChange={e=>setCompareBeforeId(Number(e.target.value))}>{batchHistory.filter(r=>r.id!==reportComparison.afterId).map(r=><option key={r.id} value={r.id}>Resumo {r.id} · {r.selectedCount} mod(s)</option>)}</select></label>
   <label>Resumo posterior<select aria-label="Resumo posterior para comparação" value={reportComparison.afterId} onChange={e=>setCompareAfterId(Number(e.target.value))}>{batchHistory.filter(r=>r.id!==reportComparison.beforeId).map(r=><option key={r.id} value={r.id}>Resumo {r.id} · {r.selectedCount} mod(s)</option>)}</select></label>
  </div>
  <div className="session-comparison-actions"><button className="btn secondary session-comparison-swap" type="button" onClick={()=>{setCompareBeforeId(reportComparison.afterId);setCompareAfterId(reportComparison.beforeId)}}>Inverter ordem da comparação</button><button className="btn secondary" type="button" aria-label="Exportar comparação em JSON" onClick={exportSessionComparison}>Exportar comparação JSON</button></div>
  <div className="session-comparison-stats" role="group" aria-label="Mudanças nos metadados">
   <div><small>Entraram na seleção</small><strong>{reportComparison.added.length}</strong></div>
   <div><small>Saíram da seleção</small><strong>{reportComparison.removed.length}</strong></div>
   <div><small>Permaneceram</small><strong>{reportComparison.unchangedCount}</strong></div>
   <div><small>Bloqueios declarados</small><strong>{reportComparison.blockersBefore} → {reportComparison.blockersAfter}</strong></div>
   <div><small>Avisos declarados</small><strong>{reportComparison.noticesBefore} → {reportComparison.noticesAfter}</strong></div>
  </div>
  <div className="session-comparison-diff">
   <div><h3>Adicionados na seleção</h3>{reportComparison.added.length?<ul>{reportComparison.added.map(mod=><li key={mod.id}>{mod.title}</li>)}</ul>:<p>Nenhum mod adicionado.</p>}</div>
   <div><h3>Removidos da seleção</h3>{reportComparison.removed.length?<ul>{reportComparison.removed.map(mod=><li key={mod.id}>{mod.title}</li>)}</ul>:<p>Nenhum mod removido.</p>}</div>
  </div>
  <small className="session-comparison-note">Somente metadados salvos nesta sessão. Alterações nos alertas declarados não demonstram melhora ou piora real da instalação.</small>
 </section>}
 <div className="empty"><History size={32}/><h3>Sem atividades registradas</h3><p>Quando houver integração validada, somente eventos reais aparecerão aqui.</p></div><SyntheticDiagnosticPreview/></>}
    {screen==='settings'&&<><div className="page-heading"><span className="eyebrow">PERSONALIZAÇÃO</span><h1>Configurações</h1><p>Preferências visuais salvas localmente neste dispositivo.</p></div><div className="settings-panel"><h3>Aparência</h3><label className="switch-row"><span><strong>Cards compactos</strong><small>Exibir mais itens por linha</small></span><input type="checkbox" checked={dense} onChange={e=>setDense(e.target.checked)}/></label><label className="switch-row"><span><strong>Barra lateral expandida</strong><small>Mostrar nomes das seções</small></span><input type="checkbox" checked={sidebar} onChange={e=>setSidebar(e.target.checked)}/></label><div className="divider"/><h3>Plataforma</h3><div className="disabled-integration"><ShieldCheck size={18}/><div><strong>Sistema detectado automaticamente: {osLabel}</strong><small>{runtime?.platformSelection==='automatic'?'Aplicativo portátil com recursos específicos da plataforma, sem configuração manual.':'Somente prévia visual: a identificação nativa exige o aplicativo desktop.'} Instalação e remoção de mods permanecem bloqueadas.</small></div></div><div className="divider"/><h3>Integrações</h3><div className="disabled-integration"><LockKeyhole size={18}/><div><strong>Integração somente leitura</strong><small>Inspeção manual de pastas na tela Jogos, sem instalação ou exclusão</small></div></div></div></>}
    {screen==='security'&&<><div className="page-heading"><span className="eyebrow">PROTEÇÃO DO AMBIENTE</span><h1>Central de segurança</h1><p>As ações destrutivas estão inacessíveis por projeto.</p></div><div className="security-grid"><div className="security-card"><CheckCircle2 size={25}/><h3>Modo somente leitura</h3><p>A inspeção local é manual e só conta entradas diretas de pastas conhecidas, sem ler conteúdo de arquivos.</p></div><div className="security-card"><LockKeyhole size={25}/><h3>Instalação bloqueada</h3><p>Não existe comando de instalação nem execução em segundo plano.</p></div><div className="security-card"><ShieldCheck size={25}/><h3>Desinstalação bloqueada</h3><p>Não há mecanismo capaz de apagar arquivos de jogos.</p></div><div className="security-card warning"><AlertTriangle size={25}/><h3>Testes pendentes</h3><p>Restam validações de integridade, backup, rollback, limites de caminho e permissões.</p></div></div><button className="btn secondary" onClick={notice}>Verificar disponibilidade das operações</button></>}
   </main><footer className="footer"><span>OMSI Manager · Interface React independente</span><span><ShieldCheck size={13}/> Modo demonstração seguro</span></footer>
  </div>{toast&&<div className="toast" role="status"><LockKeyhole size={16}/>{toast}<button aria-label="Fechar aviso" onClick={()=>setToast('')}>×</button></div>}
 </div></>;
}
