import {useEffect,useMemo,useState} from 'react';
import {parseCatalogManifest,MAX_CATALOG_BYTES,type CatalogMod} from './catalog';
import {analyzeModRelations} from './relation-analysis';
import {consolidateDiagnostic} from './diagnostic-report';
import type {FolderInspection} from './inspection-types';
import {House,Gamepad2,Grid2X2,Library,FileText,Clock3,History,Settings2,ShieldCheck,Search,ChevronRight,ArrowLeft,LockKeyhole,Download,Trash2,CheckCircle2,AlertTriangle,Menu} from 'lucide-react';

type GameId='omsi'|'ets2'|'ats';
type Screen='home'|'games'|'catalog'|'library'|'details'|'queue'|'history'|'settings'|'security';
type Category='Todos'|'Ônibus'|'Mapas'|'Caminhões'|'Sons'|'Gráficos';
type Mod=CatalogMod;
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
export default function App(){
 const [screen,setScreen]=useState<Screen>('home');
 const [selectedGame,setSelectedGame]=useState<GameId|'all'>('all');
 const [featuredGame,setFeaturedGame]=useState<GameId>('omsi');
 const [libraryGame,setLibraryGame]=useState<GameId|'all'>('all');
 const [libraryCategory,setLibraryCategory]=useState<Category>('Todos');
 const [librarySearch,setLibrarySearch]=useState('');
 const [librarySort,setLibrarySort]=useState<'catalog'|'title'|'game'>('catalog');
 const [detailOrigin,setDetailOrigin]=useState<'home'|'catalog'|'library'>('catalog');
 const [category,setCategory]=useState<Category>('Todos');
 const [search,setSearch]=useState('');
 const [selectedMod,setSelectedMod]=useState(mods[0].id);
 const [hypotheticalGameVersion,setHypotheticalGameVersion]=useState('');
 const [catalogMods,setCatalogMods]=useState<Mod[]>(mods);
 const [catalogSource,setCatalogSource]=useState('Demonstração');
 const [catalogError,setCatalogError]=useState('');
 const [inspections,setInspections]=useState<Partial<Record<GameId,FolderInspection>>>({});
 const [inspecting,setInspecting]=useState<GameId|null>(null);
 const inspectorAvailable=typeof window.omsiPreview?.inspectGame==='function';
 const initialPrefs=useMemo(readPreferences,[]);
 const [favorites,setFavorites]=useState<string[]>(initialPrefs.favorites);
 const [sidebar,setSidebar]=useState(initialPrefs.sidebar);
 const [dense,setDense]=useState(initialPrefs.dense);
 const [toast,setToast]=useState('');
 useEffect(()=>{
  try{window.localStorage.setItem(PREFS_KEY,JSON.stringify({favorites,sidebar,dense}));}
  catch{/* private-mode storage can be unavailable; keep session state */}
 },[favorites,sidebar,dense]);
 const selected=catalogMods.find(m=>m.id===selectedMod)??catalogMods[0];
 const relationAnalysis=useMemo(()=>analyzeModRelations(catalogMods,selected.id,hypotheticalGameVersion),[catalogMods,selected.id,hypotheticalGameVersion]);
 const diagnostic=useMemo(()=>consolidateDiagnostic(selected.game,selected.id,catalogSource,relationAnalysis,inspections[selected.game],hypotheticalGameVersion),[selected.game,selected.id,catalogSource,relationAnalysis,inspections,hypotheticalGameVersion]);
 const filtered=useMemo(()=>catalogMods.filter(m=>(selectedGame==='all'||m.game===selectedGame)&&(category==='Todos'||m.category===category)&&(`${m.title} ${m.category} ${games[m.game].title}`.toLowerCase().includes(search.toLowerCase()))),[catalogMods,selectedGame,category,search]);
 const favoriteMods=useMemo(()=>catalogMods.filter(m=>favorites.includes(m.id)),[catalogMods,favorites]);
 const libraryMods=useMemo(()=>{
  const query=librarySearch.trim().toLocaleLowerCase('pt-BR');
  const list=favoriteMods.filter(m=>
   (libraryGame==='all'||m.game===libraryGame)&&
   (libraryCategory==='Todos'||m.category===libraryCategory)&&
   (!query||(`${m.title} ${m.category} ${games[m.game].title}`).toLocaleLowerCase('pt-BR').includes(query))
  );
  if(librarySort==='title')return [...list].sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
  if(librarySort==='game'){
   const order:Record<GameId,number>={omsi:0,ets2:1,ats:2};
   return [...list].sort((a,b)=>order[a.game]-order[b.game]||a.title.localeCompare(b.title,'pt-BR'));
  }
  return list;
 },[favoriteMods,libraryGame,libraryCategory,librarySearch,librarySort]);
 function goto(id:Screen){setScreen(id);setToast('')}
 function detail(id:string){setDetailOrigin(screen==='library'?'library':screen==='home'?'home':'catalog');setSelectedMod(id);goto('details')}
 function notice(){setToast('Operação bloqueada: protótipo sem acesso a arquivos ou ao instalador.')}
 async function importCatalogFile(event:React.ChangeEvent<HTMLInputElement>){
  const file=event.currentTarget.files?.[0];
  event.currentTarget.value='';
  if(!file)return;
  try{
   if(file.size>MAX_CATALOG_BYTES)throw new Error('Arquivo excede 1 MB.');
   const next=parseCatalogManifest(await file.text());
   setCatalogMods(next);setHypotheticalGameVersion('');
   setCatalogSource('Importado: '+file.name.slice(0,85));
   setCatalogError('');
   setSelectedMod(next[0].id);
   setSelectedGame('all');setCategory('Todos');setSearch('');
   setFavorites([]);setLibraryGame('all');setLibraryCategory('Todos');setLibrarySearch('');setLibrarySort('catalog');setLibrarySearch('');setLibrarySort('catalog');
   setToast(next.length+' mods carregados somente como metadados. Nenhum arquivo de jogo foi alterado.');
  }catch(error){
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
  setCatalogMods(mods);setHypotheticalGameVersion('');setCatalogSource('Demonstração');setCatalogError('');
  setSelectedMod(mods[0].id);setSelectedGame('all');setCategory('Todos');setSearch('');
  setFavorites([]);setLibraryGame('all');setLibraryCategory('Todos');setLibrarySearch('');setLibrarySort('catalog');
 }
 const modCards=(list:Mod[])=><div className={'mod-grid '+(dense?'compact':'')}>{list.map(m=><article className="mod-card" key={m.id}><button className="mod-art" onClick={()=>detail(m.id)} aria-label={`Ver ${m.title}`}><span>{m.category}</span><ModArtwork mod={m}/></button><div className="mod-info"><span className="meta">{games[m.game].title} · {m.category}</span>{screen==='library'&&<span className="library-mod-status">Não verificado · favorito</span>}<button className="text-button" onClick={()=>detail(m.id)}>{m.title}</button><div className="mod-bottom"><small>v{m.version} · {m.size}</small><button className="icon-btn" aria-label={favorites.includes(m.id)?'Retirar dos favoritos':'Favoritar'} onClick={()=>setFavorites(a=>a.includes(m.id)?a.filter(x=>x!==m.id):[...a,m.id])}>{favorites.includes(m.id)?'♥':'♡'}</button></div></div></article>)}</div>;
 const title=nav.find(n=>n.id===screen)?.label??'Início';
 return <><a className="skip-link" href="#conteudo-principal">Pular para o conteúdo principal</a><div className="shell">
  <aside className={'sidebar '+(!sidebar?'collapsed':'')}>
   <div className="brand"><span className="brand-mark">M</span><div><strong>OMSI Manager</strong><small>DESIGN PROTOTYPE</small></div></div>
   <p className="nav-caption">EXPLORAR</p><nav aria-label="Navegação principal">{nav.map(({id,label,icon:Icon})=><button key={id} className={'nav-link '+(screen===id?'active':'')} aria-label={label} aria-current={screen===id?'page':undefined} onClick={()=>goto(id)} title={label}><Icon size={19}/><span>{label}</span></button>)}</nav>
   <div className="sidebar-bottom"><div className="safety-status"><ShieldCheck size={17}/><span>Modo seguro ativo</span></div><small>Sem leitura de conteúdo ou alterações nos jogos</small></div>
  </aside>
  <div className="workspace"><header className="topbar"><div className="top-left"><button className="icon-btn menu-btn" aria-label="Alternar menu" onClick={()=>setSidebar(v=>!v)}><Menu size={20}/></button><div className="breadcrumb">OMSI Manager <ChevronRight size={13}/> <strong>{title}</strong></div></div><div className="top-actions"><label className="search"><Search size={17}/><input placeholder={screen==='library'?'Buscar favoritos...':'Buscar mods...'} aria-label={screen==='library'?'Buscar favoritos':'Buscar mods'} value={screen==='library'?librarySearch:search} onChange={e=>screen==='library'?setLibrarySearch(e.target.value.slice(0,100)):setSearch(e.target.value)} onFocus={()=>screen!=='catalog'&&screen!=='library'&&goto('catalog')}/></label><span className="mode-indicator"><LockKeyhole size={13}/> Protótipo</span></div></header>
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
       <div className="inspection-assessment" role="status"><strong>Compatibilidade não verificada</strong><span>{report.assessment.summary}</span>{report.selectionMode==='direct-mod-folder'&&<small>Selecionada diretamente: pasta mod</small>}</div>
       {report.groups.map(g=><div className="inspection-group" key={g.key}>
        <div className="inspection-stat"><span>{g.name}</span><strong>{g.found?g.count+(g.limited?'+':''):'Não encontrada'}</strong></div>
        {g.found&&<div className="inspection-breakdown"><span>{g.directories} pastas</span><span>{g.files} arquivos</span>{id!=='omsi'&&<span>{g.packageCandidates} candidatos .scs/.zip</span>}{g.linksSkipped>0&&<span>{g.linksSkipped} links ignorados</span>}</div>}
       </div>)}
       {report.notices.length>0&&<ul className="inspection-notices">{report.notices.map(n=><li key={n.code} className={n.level}>{n.message}</li>)}</ul>}</div>})()}
       {inspections[id]?.status==='error'&&<p className="inspection-error" role="alert">{inspections[id]?.status==='error'?inspections[id].message:''}</p>}</div>)}</div>
      <p className="inspection-note">No ETS2/ATS, escolha a própria pasta mod ou a pasta acima dela, geralmente nos Documentos do jogo, não necessariamente na Steam. Contagens são apenas pistas de estrutura, nunca prova de instalação, ativação ou compatibilidade. Não enviamos caminhos completos nem nomes de arquivos à interface. Instalar e remover seguem bloqueados.</p>
     </section></>}
    {screen==='catalog'&&<><div className="page-heading"><span className="eyebrow">EXPLORAR CONTEÚDO</span><h1>Catálogo de mods</h1><p>Explore os exemplos ou importe um JSON de metadados. Instalação desativada.</p></div><div className="toolbar"><div className="tabs">{(['all','omsi','ets2','ats'] as const).map(id=><button key={id} className={selectedGame===id?'selected':''} onClick={()=>setSelectedGame(id)}>{id==='all'?'Todos os jogos':games[id].title}</button>)}</div><select value={category} onChange={e=>setCategory(e.target.value as Category)} aria-label="Filtrar categoria">{categories.map(c=><option key={c}>{c}</option>)}</select></div><div className="catalog-import-bar"><div className="catalog-source"><strong>Origem: {catalogSource}</strong><span>Somente metadados JSON. Sem varredura ou instalação.</span></div><div className="catalog-import-actions"><label className="btn secondary import-control">Importar catálogo JSON<input type="file" accept=".json,application/json" aria-label="Arquivo JSON do catálogo" onChange={importCatalogFile}/></label>{catalogSource!=='Demonstração'&&<button className="btn secondary" onClick={restoreDemo}>Restaurar demonstração</button>}</div></div>{catalogError&&<div className="catalog-error" role="alert">{catalogError}</div>}<div className="result-count">{filtered.length} {filtered.length===1?'resultado':'resultados'}</div>{filtered.length?modCards(filtered):<div className="empty">Nenhum mod corresponde aos filtros.</div>}</>}
    {screen==='library'&&<><div className="page-heading"><span className="eyebrow">COLEÇÃO PESSOAL</span><h1>Minha biblioteca</h1><p>Os favoritos ficam salvos localmente. Filtre por simulador e categoria. São apenas metadados: não detectamos instalação nem compatibilidade real.</p></div>
 <section className="library-summary" aria-label="Resumo da biblioteca"><div><small>Favoritos</small><strong>{favoriteMods.length}</strong></div><div><small>Simuladores na seleção</small><strong>{new Set(favoriteMods.map(m=>m.game)).size}</strong></div><div className="library-trust"><LockKeyhole size={16}/><span>Arquivos dos mods não inspecionados. Status real desconhecido.</span></div></section>
 {favoriteMods.length>0&&<div className="library-toolbar" aria-label="Filtros da biblioteca"><label>Jogo<select aria-label="Filtrar jogo na biblioteca" value={libraryGame} onChange={e=>setLibraryGame(e.target.value as GameId|'all')}><option value="all">Todos os jogos</option>{(Object.keys(games) as GameId[]).map(id=><option key={id} value={id}>{games[id].title}</option>)}</select></label><label>Categoria<select aria-label="Filtrar categoria na biblioteca" value={libraryCategory} onChange={e=>setLibraryCategory(e.target.value as Category)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Ordenação<select aria-label="Ordenar biblioteca" value={librarySort} onChange={e=>setLibrarySort(e.target.value as 'catalog'|'title'|'game')}><option value="catalog">Ordem do catálogo</option><option value="title">Nome (A–Z)</option><option value="game">Jogo e nome</option></select></label><div className="library-filter-results" role="status">{libraryMods.length} {libraryMods.length===1?'favorito exibido':'favoritos exibidos'}</div></div>}
 {favoriteMods.length===0?<div className="empty"><Library size={32}/><h3>Biblioteca vazia</h3><p>Adicione mods aos favoritos no catálogo. Eles aparecerão aqui, separados por jogo e categoria.</p><button className="btn secondary" onClick={()=>goto('catalog')}>Explorar catálogo</button></div>:libraryMods.length?modCards(libraryMods):<div className="empty library-empty-filter"><Library size={28}/><h3>Nenhum favorito nesses filtros</h3><p>Seus favoritos continuam salvos. Altere a busca, o jogo ou a categoria para encontrá-los.</p><button className="btn secondary" onClick={()=>{setLibraryGame('all');setLibraryCategory('Todos');setLibrarySearch('');setLibrarySort('catalog')}}>Limpar filtros da biblioteca</button></div>}
 </>}
    {screen==='details'&&<><button className="back" onClick={()=>goto(detailOrigin)}><ArrowLeft size={17}/> {detailOrigin==='library'?'Voltar à biblioteca':detailOrigin==='home'?'Voltar ao início':'Voltar ao catálogo'}</button><div className="detail-layout"><div className="detail-art"><ModArtwork mod={selected}/><p className="detail-image-note">Arte ilustrativa do catálogo, não é uma imagem extraída deste mod.</p></div><div className="detail-copy"><span className="eyebrow">{games[selected.game].title} / {selected.category}</span><h1>{selected.title}</h1><p>{selected.description}</p><div className="detail-verification-status"><AlertTriangle size={17}/><span><strong>Compatibilidade não verificada</strong> · Instalação e atualização reais indisponíveis nesta prévia.</span></div><div className="properties"><div><span>Versão</span><strong>{selected.version}</strong></div><div><span>Tamanho</span><strong>{selected.size}</strong></div><div><span>Verificação</span><strong>Dados ilustrativos</strong></div></div><div className="detail-actions"><button className="btn disabled-action" disabled title="Instalação desativada"><Download size={17}/> Instalar (bloqueado)</button><button className="btn disabled-action" disabled title="Desinstalação desativada"><Trash2 size={17}/> Remover (bloqueado)</button><button className="btn secondary" onClick={()=>setFavorites(a=>a.includes(selected.id)?a.filter(x=>x!==selected.id):[...a,selected.id])}>{favorites.includes(selected.id)?'Remover dos favoritos':'Adicionar aos favoritos'}</button></div><p className="lock-note"><LockKeyhole size={16}/> Nenhum mod será aplicado enquanto o pipeline de testes não estiver liberado.</p>
 <section className="relation-panel" aria-label="Simulação de dependências">
  <h2>Dependências e conflitos · simulação</h2>
  <label className="version-simulator"><strong>Versão hipotética do jogo</strong><input aria-label="Versão hipotética do jogo" placeholder="Ex.: 1.52.0 (opcional)" value={hypotheticalGameVersion} onChange={e=>setHypotheticalGameVersion(e.target.value.slice(0,30))}/><small>Valor digitado por você. Não detectamos a versão instalada no computador.</small></label>
  <p>Somente metadados declarados no catálogo. Não é uma análise dos arquivos do jogo.</p>
  <div className="relation-verdict" role="status">{relationAnalysis.logicalBlockers?'Inconsistências lógicas encontradas':'Nenhum bloqueio lógico encontrado no JSON'}</div>
  <h3>Sequência teórica de dependências</h3>
  <ol className="relation-order">{relationAnalysis.sequence.map(m=><li key={m.id}>{m.title} <small>({m.id})</small></li>)}</ol>
  {relationAnalysis.issues.length>0?<ul className="relation-issues">{relationAnalysis.issues.map((issue,index)=><li key={issue.code+index} className={issue.severity}><strong>{issue.severity==='blocking'?'Bloqueio no catálogo':'Atenção'}:</strong> {issue.message}</li>)}</ul>:<p className="relation-clean">Nenhuma relação inconsistente declarada para este mod.</p>}
  <p className="relation-disclaimer"><LockKeyhole size={15}/> A versão informada é hipotética. Compatibilidade real, versão instalada, integridade dos mods e instalação NÃO verificadas. Nenhuma ação é executada.</p>
 </section></div></div>
 <section className="diagnostic-report" aria-label="Relatório consolidado">
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
    {screen==='history'&&<><div className="page-heading"><span className="eyebrow">ATIVIDADES</span><h1>Histórico</h1><p>A interface não gera registros de instalação nem simula operações como concluídas.</p></div><div className="empty"><History size={32}/><h3>Sem atividades registradas</h3><p>Quando houver integração validada, somente eventos reais aparecerão aqui.</p></div></>}
    {screen==='settings'&&<><div className="page-heading"><span className="eyebrow">PERSONALIZAÇÃO</span><h1>Configurações</h1><p>Preferências visuais salvas localmente neste dispositivo.</p></div><div className="settings-panel"><h3>Aparência</h3><label className="switch-row"><span><strong>Cards compactos</strong><small>Exibir mais itens por linha</small></span><input type="checkbox" checked={dense} onChange={e=>setDense(e.target.checked)}/></label><label className="switch-row"><span><strong>Barra lateral expandida</strong><small>Mostrar nomes das seções</small></span><input type="checkbox" checked={sidebar} onChange={e=>setSidebar(e.target.checked)}/></label><div className="divider"/><h3>Integrações</h3><div className="disabled-integration"><LockKeyhole size={18}/><div><strong>Integração somente leitura</strong><small>Inspeção manual de pastas na tela Jogos, sem instalação ou exclusão</small></div></div></div></>}
    {screen==='security'&&<><div className="page-heading"><span className="eyebrow">PROTEÇÃO DO AMBIENTE</span><h1>Central de segurança</h1><p>As ações destrutivas estão inacessíveis por projeto.</p></div><div className="security-grid"><div className="security-card"><CheckCircle2 size={25}/><h3>Modo somente leitura</h3><p>A inspeção local é manual e só conta entradas diretas de pastas conhecidas, sem ler conteúdo de arquivos.</p></div><div className="security-card"><LockKeyhole size={25}/><h3>Instalação bloqueada</h3><p>Não existe comando de instalação nem execução em segundo plano.</p></div><div className="security-card"><ShieldCheck size={25}/><h3>Desinstalação bloqueada</h3><p>Não há mecanismo capaz de apagar arquivos de jogos.</p></div><div className="security-card warning"><AlertTriangle size={25}/><h3>Testes pendentes</h3><p>Restam validações de integridade, backup, rollback, limites de caminho e permissões.</p></div></div><button className="btn secondary" onClick={notice}>Verificar disponibilidade das operações</button></>}
   </main><footer className="footer"><span>OMSI Manager · Interface React independente</span><span><ShieldCheck size={13}/> Modo demonstração seguro</span></footer>
  </div>{toast&&<div className="toast" role="status"><LockKeyhole size={16}/>{toast}<button aria-label="Fechar aviso" onClick={()=>setToast('')}>×</button></div>}
 </div></>;
}
