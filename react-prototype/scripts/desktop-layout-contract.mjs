// Read-only geometry witness: no screenshots, paths, user data or IPC additions.
// Weston/Xvfb checks are compositor proxies, NOT actual Mutter/KWin/Hyprland.
export async function captureLayout(page){
 return page.evaluate(()=>{
  const box=el=>{
   if(!el)return null;
   const r=el.getBoundingClientRect();
   return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};
  };
  return {
   width:window.innerWidth,height:window.innerHeight,dpr:window.devicePixelRatio,
   overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-
    document.documentElement.clientWidth,
   heading:box(document.querySelector('.page-heading h1, .hero h1')),
   dashboard:box(document.querySelector('.premium-stats')),
   banner:box(document.querySelector('.negresco-banner')),
   nav:box(document.querySelector('nav[aria-label="Navegação principal"]')),
   main:box(document.querySelector('main#conteudo-principal')),
   sidebar:box(document.querySelector('.sidebar')),
   mode:window.omsiPreview?.mode,
   install:window.omsiPreview?.capabilities?.installMods,
   remove:window.omsiPreview?.capabilities?.uninstallMods,
   execute:window.omsiPreview?.capabilities?.executeCommands
  };
 });
}
export function checkLayout(v){
 const rect=r=>r&&['left','right','top','bottom'].every(k=>Number.isFinite(r[k]))&&
  r.right>r.left&&r.bottom>r.top;
 if(!v||!Number.isFinite(v.width)||v.width<800||v.width>4096||
  !Number.isFinite(v.height)||v.height<500||v.height>2400||
  !Number.isFinite(v.dpr)||v.dpr<0.75||v.dpr>4||
  !Number.isFinite(v.overflow)||v.overflow>2||
  v.mode!=='read-only'||v.install!==false||
  v.remove!==false||v.execute!==false||
  !rect(v.heading)||!rect(v.nav)||!rect(v.main)||!rect(v.sidebar)||
  v.heading.left< -2||v.heading.right>v.width+2||
  v.heading.top>v.height||v.heading.bottom<=0||
  v.main.left< -2||v.main.right>v.width+2||
  v.sidebar.left< -2||v.sidebar.right>v.width+2)
  throw Error('DESKTOP_GEOMETRY_NOT_VERIFIED');
 return Object.freeze({status:'PASS',viewport:[Math.round(v.width),Math.round(v.height)],
  scale:Number(v.dpr.toFixed(2)),readOnly:true});
}

// Negresco Home puts the primary dashboard above the live spotlight heading.
// Verify first-screen content, then verify the actual heading after scrolling.
// The existing strict checkLayout is unchanged; both observations must pass.
export function checkInitialHomeLayout(v){
 const rect=r=>r&&['left','right','top','bottom'].every(k=>Number.isFinite(r[k]))&&
  r.right>r.left&&r.bottom>r.top;
 if(!v||!rect(v.dashboard)||!rect(v.banner)||!rect(v.heading)||
  v.dashboard.top<v.banner.bottom-2||
  v.dashboard.top>=v.height||v.dashboard.bottom<=0||
  v.banner.top>=v.height||v.banner.bottom<=0||
  v.banner.left< -2||v.banner.right>v.width+2||
  v.heading.left< -2||v.heading.right>v.width+2)
  throw Error('DESKTOP_HOME_PRIMARY_GEOMETRY_NOT_VERIFIED');
 return checkLayout({...v,heading:v.dashboard});
}
export async function verifyHomeLayout(page){
 const reset=()=>page.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
 let initial,scrolled;
 try{
  await reset();
  initial=await captureLayout(page);
  checkInitialHomeLayout(initial);
  const title=page.locator('.hero .hero-copy > h1');
  if(await title.count()!==1)throw Error('DESKTOP_HOME_HEADING_NOT_UNIQUE');
  await title.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  scrolled=await captureLayout(page);
  const result=checkLayout(scrolled);
  // A rectangle inside the viewport alone does not exclude a fixed overlay.
  const unobscured=await title.evaluate(el=>{
   const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
   if(x<0||x>=window.innerWidth||y<0||y>=window.innerHeight)return false;
   const hit=document.elementFromPoint(x,y);
   return hit===el||!!hit&&el.contains(hit);
  });
  if(!unobscured)throw Error('DESKTOP_HOME_HEADING_OCCLUDED');
  return result;
 }catch(error){
  // Numeric geometry and capability booleans only; no text, paths, process IDs or user data.
  console.log('DESKTOP_HOME_GEOMETRY_EVIDENCE',JSON.stringify({initial,scrolled}));
  throw error;
 }finally{
  await reset();
 }
}
