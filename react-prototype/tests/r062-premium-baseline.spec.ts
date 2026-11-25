import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const regions={
 sidebar:'.sidebar',header:'.topbar',content:'.content',
 hero:'.premium-hero',heroMain:'.premium-hero-main',heroTitle:'.premium-hero h1',
 simulatorName:'.featured-game-name',simulatorSelector:'.premium-selector',
 indicators:'.premium-stats',library:'.premium-dashboard > .premium-panel',
 lowerPanels:'.premium-bottom-grid'
} as const;
test('R06.2 records comparison evidence, not reference parity',async({page})=>{
 await page.route('https://shared.fastly.steamstatic.com/**',route=>route.abort());
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');
 await mkdir('test-results/screenshots/premium-baseline',{recursive:true});
 for(const [width,height] of [[1440,900],[1024,768],[850,650],[390,844]]){
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
  const prefix='test-results/screenshots/premium-baseline/home-'+width+'x'+height;
  const png=await page.screenshot({path:prefix+'.png',animations:'disabled',scale:'css',fullPage:false});
  await writeFile(prefix+'.json',JSON.stringify({schema:'PREMIUM_LAYOUT_OBSERVATION_V1',viewport:{width,height},artMode:'offline-bundled',referenceStatus:'APPROVED_REFERENCE_PINNED_ASSET_INTEGRATION_PENDING',visualParityVerified:false,sha256:createHash('sha256').update(png).digest('hex'),regions:measurements},null,2));
 }
});
