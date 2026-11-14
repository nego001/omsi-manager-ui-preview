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
