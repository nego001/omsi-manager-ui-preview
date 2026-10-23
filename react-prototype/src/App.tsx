import {useEffect,useMemo,useState} from 'react';
import {parseCatalogManifest,MAX_CATALOG_BYTES,type CatalogMod} from './catalog';
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
function GameCover({id,large=false}:{id:GameId;large?:boolean}){const game=games[id];return <div className={'game-cover '+(large?'large':'')} style={{'--game-color':game.color} as React.CSSProperties}><img src={`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.app}/library_600x900.jpg`} alt={`Capa de ${game.title}`} loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/><div className="cover-fallback"><strong>{game.title}</strong><span>{game.publisher}</span></div></div>}
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
 const [category,setCategory]=useState<Category>('Todos');
 const [search,setSearch]=useState('');
 const [selectedMod,setSelectedMod]=useState(mods[0].id);
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
 const filtered=useMemo(()=>catalogMods.filter(m=>(selectedGame==='all'||m.game===selectedGame)&&(category==='Todos'||m.category===category)&&(`${m.title} ${m.category} ${games[m.game].title}`.toLowerCase().includes(search.toLowerCase()))),[catalogMods,selectedGame,category,search]);
 function goto(id:Screen){setScreen(id);setToast('')}
 function detail(id:string){setSelectedMod(id);goto('details')}
 function notice(){setToast('Operação bloqueada: protótipo sem acesso a arquivos ou ao instalador.')}
 async function importCatalogFile(event:React.ChangeEvent<HTMLInputElement>){
  const file=event.currentTarget.files?.[0];
  event.currentTarget.value='';
  if(!file)return;
  try{
   if(file.size>MAX_CATALOG_BYTES)throw new Error('Arquivo excede 1 MB.');
   const next=parseCatalogManifest(await file.text());
   setCatalogMods(next);
   setCatalogSource('Importado: '+file.name.slice(0,85));
   setCatalogError('');
   setSelectedMod(next[0].id);
   setSelectedGame('all');setCategory('Todos');setSearch('');
   setFavorites([]);
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
  setCatalogMods(mods);setCatalogSource('Demonstração');setCatalogError('');
  setSelectedMod(mods[0].id);setSelectedGame('all');setCategory('Todos');setSearch('');
  setFavorites([]);
 }
 const modCards=(list:Mod[])=><div className={'mod-grid '+(dense?'compact':'')}>{list.map(m=><article className="mod-card" key={m.id}><button className="mod-art" onClick={()=>detail(m.id)} aria-label={`Ver ${m.title}`}><span>{m.category}</span><ModArtwork mod={m}/></button><div className="mod-info"><span className="meta">{games[m.game].title} · {m.category}</span><button className="text-button" onClick={()=>detail(m.id)}>{m.title}</button><div className="mod-bottom"><small>v{m.version} · {m.size}</small><button className="icon-btn" aria-label={favorites.includes(m.id)?'Retirar dos favoritos':'Favoritar'} onClick={()=>setFavorites(a=>a.includes(m.id)?a.filter(x=>x!==m.id):[...a,m.id])}>{favorites.includes(m.id)?'♥':'♡'}</button></div></div></article>)}</div>;
 const title=nav.find(n=>n.id===screen)?.label??'Início';
 return <div className="shell">
  <aside className={'sidebar '+(!sidebar?'collapsed':'')}>
   <div className="brand"><span className="brand-mark">M</span><div><strong>OMSI Manager</strong><small>DESIGN PROTOTYPE</small></div></div>
   <p className="nav-caption">EXPLORAR</p><nav aria-label="Navegação principal">{nav.map(({id,label,icon:Icon})=><button key={id} className={'nav-link '+(screen===id?'active':'')} onClick={()=>goto(id)} title={label}><Icon size={19}/><span>{label}</span></button>)}</nav>
   <div className="sidebar-bottom"><div className="safety-status"><ShieldCheck size={17}/><span>Modo seguro ativo</span></div><small>Sem leitura de conteúdo ou alterações nos jogos</small></div>
  </aside>
  <div className="workspace"><header className="topbar"><div className="top-left"><button className="icon-btn menu-btn" aria-label="Alternar menu" onClick={()=>setSidebar(v=>!v)}><Menu size={20}/></button><div className="breadcrumb">OMSI Manager <ChevronRight size={13}/> <strong>{title}</strong></div></div><div className="top-actions"><label className="search"><Search size={17}/><input placeholder="Buscar mods..." aria-label="Buscar mods" value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>screen!=='catalog'&&goto('catalog')}/></label><span className="mode-indicator"><LockKeyhole size={13}/> Protótipo</span></div></header>
   <main className="content">
    {screen==='home'&&<><div className="hero"><div><div className="eyebrow">SEUS JOGOS, SEUS MODS</div><h1>Seu universo de simulação, organizado.</h1><p>Uma central visual para OMSI 2, Euro Truck Simulator 2 e American Truck Simulator. Explore sem modificar nenhuma instalação.</p><button className="btn primary" onClick={()=>goto('games')}>Explorar jogos <ChevronRight size={17}/></button></div><div className="hero-art"><GameCover id="omsi" large/><GameCover id="ets2" large/><GameCover id="ats" large/></div></div><div className="section-title"><h2>Jogos em destaque</h2><button className="link" onClick={()=>goto('games')}>Ver todos <ChevronRight size={14}/></button></div><div className="game-grid">{(Object.keys(games) as GameId[]).map(id=><button className="game-tile" key={id} onClick={()=>{setSelectedGame(id);goto('catalog')}}><GameCover id={id}/><strong>{games[id].title}</strong><small>Abrir catálogo</small></button>)}</div><div className="section-title"><h2>Descobrir mods</h2></div>{modCards(catalogMods.slice(0,4))}</>}
    {screen==='games'&&<><div className="page-heading"><span className="eyebrow">BIBLIOTECA DE JOGOS</span><h1>Escolha seu simulador</h1><p>Capas originais carregadas online. A inspeção é manual e opcional, sem detecção automática de instalações.</p></div><div className="game-grid game-grid-large">{(Object.keys(games) as GameId[]).map(id=><button className="game-tile" key={id} onClick={()=>{setSelectedGame(id);goto('catalog')}}><GameCover id={id} large/><strong>{games[id].title}</strong><small>Ver mods <ChevronRight size={13}/></small></button>)}</div>
     <section className="inspection-panel" aria-label="Inspeção de pastas de jogos">
      <div className="inspection-header"><div><h2>Inspeção local · somente leitura</h2><p>Escolha manualmente uma pasta do simulador. O app conta apenas os itens nas pastas conhecidas, sem abrir mods, buscar em subpastas ou fazer alterações.</p></div><span className="pill">{inspectorAvailable?'Seletor nativo disponível':'Disponível apenas no Electron'}</span></div>
      <div className="inspection-grid">{(Object.keys(games) as GameId[]).map(id=><div className="inspection-game" key={id}><strong>{games[id].title}</strong><button className="btn secondary" disabled={!inspectorAvailable||inspecting!==null} onClick={()=>void inspectGame(id)}>{inspecting===id?'Inspecionando...':'Selecionar pasta e inspecionar'}</button>
       {inspections[id]?.status==='ok'&&(()=>{const report=inspections[id];if(report.status!=='ok')return null;return <div className="inspection-result"><p><strong>Pasta:</strong> {report.folderName} · {report.recognized?'Estrutura compatível encontrada':'Nenhuma pasta conhecida encontrada'}</p>{report.groups.map(g=><div className="inspection-stat" key={g.key}><span>{g.name}</span><strong>{g.found?g.count+(g.limited?'+':''):'Não encontrada'}</strong></div>)}{report.limited&&<small>Limite de 2.000 entradas por categoria. Contagem parcial.</small>}</div>})()}
       {inspections[id]?.status==='error'&&<p className="inspection-error" role="alert">{inspections[id].message}</p>}</div>)}</div>
      <p className="inspection-note">Nenhum caminho completo ou nome de arquivo é enviado à interface. No navegador, esta função fica desabilitada. Instalação e remoção permanecem bloqueadas.</p>
     </section></>}
    {screen==='catalog'&&<><div className="page-heading"><span className="eyebrow">EXPLORAR CONTEÚDO</span><h1>Catálogo de mods</h1><p>Explore os exemplos ou importe um JSON de metadados. Instalação desativada.</p></div><div className="toolbar"><div className="tabs">{(['all','omsi','ets2','ats'] as const).map(id=><button key={id} className={selectedGame===id?'selected':''} onClick={()=>setSelectedGame(id)}>{id==='all'?'Todos os jogos':games[id].title}</button>)}</div><select value={category} onChange={e=>setCategory(e.target.value as Category)} aria-label="Filtrar categoria">{categories.map(c=><option key={c}>{c}</option>)}</select></div><div className="catalog-import-bar"><div className="catalog-source"><strong>Origem: {catalogSource}</strong><span>Somente metadados JSON. Sem varredura ou instalação.</span></div><div className="catalog-import-actions"><label className="btn secondary import-control">Importar catálogo JSON<input type="file" accept=".json,application/json" aria-label="Arquivo JSON do catálogo" onChange={importCatalogFile}/></label>{catalogSource!=='Demonstração'&&<button className="btn secondary" onClick={restoreDemo}>Restaurar demonstração</button>}</div></div>{catalogError&&<div className="catalog-error" role="alert">{catalogError}</div>}<div className="result-count">{filtered.length} {filtered.length===1?'resultado':'resultados'}</div>{filtered.length?modCards(filtered):<div className="empty">Nenhum mod corresponde aos filtros.</div>}</>}
    {screen==='library'&&<><div className="page-heading"><span className="eyebrow">COLEÇÃO PESSOAL</span><h1>Minha biblioteca</h1><p>Os favoritos ficam salvos localmente. Catálogos importados só permanecem até fechar ou recarregar a interface; nenhum mod foi instalado.</p></div>{favorites.length?modCards(catalogMods.filter(m=>favorites.includes(m.id))):<div className="empty"><Library size={32}/><h3>Biblioteca vazia</h3><p>Adicione mods aos favoritos no catálogo. Eles aparecerão aqui.</p><button className="btn secondary" onClick={()=>goto('catalog')}>Explorar catálogo</button></div>}</>}
    {screen==='details'&&<><button className="back" onClick={()=>goto('catalog')}><ArrowLeft size={17}/> Voltar ao catálogo</button><div className="detail-layout"><div className="detail-art"><GameCover id={selected.game} large/></div><div><span className="eyebrow">{games[selected.game].title} / {selected.category}</span><h1>{selected.title}</h1><p>{selected.description}</p><div className="properties"><div><span>Versão</span><strong>{selected.version}</strong></div><div><span>Tamanho</span><strong>{selected.size}</strong></div><div><span>Verificação</span><strong>Dados ilustrativos</strong></div></div><div className="detail-actions"><button className="btn disabled-action" disabled title="Instalação desativada"><Download size={17}/> Instalar (bloqueado)</button><button className="btn disabled-action" disabled title="Desinstalação desativada"><Trash2 size={17}/> Remover (bloqueado)</button><button className="btn secondary" onClick={()=>setFavorites(a=>a.includes(selected.id)?a.filter(x=>x!==selected.id):[...a,selected.id])}>{favorites.includes(selected.id)?'Remover dos favoritos':'Adicionar aos favoritos'}</button></div><p className="lock-note"><LockKeyhole size={16}/> Nenhum mod será aplicado enquanto o pipeline de testes não estiver liberado.</p></div></div></>}
    {screen==='queue'&&<><div className="page-heading"><span className="eyebrow">CONTROLE DE OPERAÇÕES</span><h1>Fila de tarefas</h1><p>Execução de tarefas permanentemente desabilitada neste protótipo.</p></div><div className="empty"><Clock3 size={33}/><h3>Nenhuma tarefa em execução</h3><p>Não há processos em andamento ou tarefas pendentes.</p><span className="pill">Fila bloqueada por segurança</span></div></>}
    {screen==='history'&&<><div className="page-heading"><span className="eyebrow">ATIVIDADES</span><h1>Histórico</h1><p>A interface não gera registros de instalação nem simula operações como concluídas.</p></div><div className="empty"><History size={32}/><h3>Sem atividades registradas</h3><p>Quando houver integração validada, somente eventos reais aparecerão aqui.</p></div></>}
    {screen==='settings'&&<><div className="page-heading"><span className="eyebrow">PERSONALIZAÇÃO</span><h1>Configurações</h1><p>Preferências visuais salvas localmente neste dispositivo.</p></div><div className="settings-panel"><h3>Aparência</h3><label className="switch-row"><span><strong>Cards compactos</strong><small>Exibir mais itens por linha</small></span><input type="checkbox" checked={dense} onChange={e=>setDense(e.target.checked)}/></label><label className="switch-row"><span><strong>Barra lateral expandida</strong><small>Mostrar nomes das seções</small></span><input type="checkbox" checked={sidebar} onChange={e=>setSidebar(e.target.checked)}/></label><div className="divider"/><h3>Integrações</h3><div className="disabled-integration"><LockKeyhole size={18}/><div><strong>Integração somente leitura</strong><small>Inspeção manual de pastas na tela Jogos, sem instalação ou exclusão</small></div></div></div></>}
    {screen==='security'&&<><div className="page-heading"><span className="eyebrow">PROTEÇÃO DO AMBIENTE</span><h1>Central de segurança</h1><p>As ações destrutivas estão inacessíveis por projeto.</p></div><div className="security-grid"><div className="security-card"><CheckCircle2 size={25}/><h3>Modo somente leitura</h3><p>A inspeção local é manual e só conta entradas diretas de pastas conhecidas, sem ler conteúdo de arquivos.</p></div><div className="security-card"><LockKeyhole size={25}/><h3>Instalação bloqueada</h3><p>Não existe comando de instalação nem execução em segundo plano.</p></div><div className="security-card"><ShieldCheck size={25}/><h3>Desinstalação bloqueada</h3><p>Não há mecanismo capaz de apagar arquivos de jogos.</p></div><div className="security-card warning"><AlertTriangle size={25}/><h3>Testes pendentes</h3><p>Restam validações de integridade, backup, rollback, limites de caminho e permissões.</p></div></div><button className="btn secondary" onClick={notice}>Verificar disponibilidade das operações</button></>}
   </main><footer className="footer"><span>OMSI Manager · Interface React independente</span><span><ShieldCheck size={13}/> Modo demonstração seguro</span></footer>
  </div>{toast&&<div className="toast" role="status"><LockKeyhole size={16}/>{toast}<button onClick={()=>setToast('')}>×</button></div>}
 </div>;
}
