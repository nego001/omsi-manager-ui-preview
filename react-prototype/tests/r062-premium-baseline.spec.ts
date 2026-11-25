import {test,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const regions={
 sidebar:'.sidebar',header:'.topbar',content:'.content',
 hero:'.premium-hero',heroMain:'.premium-hero-main',heroTitle:'.premium-hero h1',
 simulatorName:'.featured-game-name',simulatorSelector:'.premium-selector',
 indicators:'.premium-stats',library:'.premium-dashboard > .premium-panel',
 lowerPanels:'.premium-bottom-grid'
} as const;
test('N07 records comparison evidence at the approved reference size',async({page})=>{
 execFileSync(process.execPath,['scripts/verify-negresco-art.mjs'],{stdio:'inherit'});
 const reference=JSON.parse(await readFile('docs/NEGRESCO-TOOLS-REFERENCE.json','utf8'));
 const targets=JSON.parse(await readFile('docs/NEGRESCO-TOOLS-REGION-TARGETS.json','utf8'));
 expect(reference.assetsIntegrated).toBe(true);
 await page.setViewportSize({width:reference.width,height:reference.height});
 await page.route('https://shared.fastly.steamstatic.com/**',route=>route.abort());
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');
 await mkdir('test-results/screenshots/premium-baseline',{recursive:true});
 for(const [width,height] of [[reference.width,reference.height],[1440,900],[1024,768],[850,650],[390,844]]){
  await page.setViewportSize({width,height});
  await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
  await page.evaluate(()=>window.scrollTo(0,0));
  for(const selector of Object.values(regions)) await expect(page.locator(selector).first()).toBeVisible();
  const measurements=await page.evaluate(regions=>Object.fromEntries(Object.entries(regions).map(([name,selector])=>{
   const node=document.querySelector(selector);
   if(!node)throw new Error('Missing region: '+name);
   const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
   return [name,{x:rect.x,y:rect.y,width:rect.width,height:rect.height,fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,color:style.color,backgroundColor:style.backgroundColor,borderRadius:style.borderRadius,padding:style.padding,gap:style.gap}];
  })),regions);
  const exact=width===reference.width&&height===reference.height;
  const measured=exact?await page.evaluate(targets=>targets.map(({name,selector,rect}:{name:string;selector:string;rect:number[]})=>{
   const node=document.querySelector(selector);if(!node)throw new Error('Missing target '+name);
   const r=node.getBoundingClientRect();const actual=[r.x,r.y,r.width,r.height];
   return {name,reference:rect,actual,delta:actual.map((v,i)=>Math.round((v-rect[i])*100)/100)};
  }),targets.regions):null;
  const prefix='test-results/screenshots/premium-baseline/home-'+width+'x'+height;
  const png=await page.screenshot({path:prefix+'.png',animations:'disabled',scale:'css',fullPage:false});
  await writeFile(prefix+'.json',JSON.stringify({schema:'PREMIUM_LAYOUT_OBSERVATION_V1',viewport:{width,height},artMode:'approved-exact-crops',referenceStatus:'APPROVED_REFERENCE_PINNED_ASSETS_INTEGRATED',referenceSha256:reference.sha256,visualParityVerified:false,matchedSizeRegionDeltas:measured,sha256:createHash('sha256').update(png).digest('hex'),regions:measurements},null,2));
 }
});
