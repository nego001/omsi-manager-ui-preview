import {test,expect} from '@playwright/test';
test('N07.4 reference dashboard precedes secondary live controls without losing actions',async({page})=>{
 await page.setViewportSize({width:1586,height:992});
 await page.route('https://shared.fastly.steamstatic.com/**',route=>route.abort());
 await page.goto('/');
 await expect(page.locator('.negresco-banner')).toBeVisible();
 const geometry=await page.evaluate(()=>{
  const rect=(s:string)=>document.querySelector(s)!.getBoundingClientRect();
  return {bannerBottom:rect('.negresco-banner').bottom,statsTop:rect('.premium-stats').top,quickBottom:rect('.negresco-quick-panel').bottom,controlsTop:rect('.negresco-live-controls').top,footerTop:rect('.footer').top,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
 });
 expect(geometry.statsTop-geometry.bannerBottom).toBeGreaterThanOrEqual(0);
 expect(geometry.statsTop-geometry.bannerBottom).toBeLessThanOrEqual(18);
 expect(geometry.statsTop).toBeLessThanOrEqual(360);
 expect(geometry.controlsTop).toBeGreaterThanOrEqual(geometry.quickBottom);
 expect(geometry.footerTop).toBe(931);
 expect(geometry.overflow).toBeLessThanOrEqual(3);
 await page.getByRole('group',{name:'Escolher simulador em destaque'}).getByRole('button',{name:'Mostrar Euro Truck Simulator 2 no destaque'}).click();
 await expect(page.getByRole('region',{name:'Destaque de simuladores'}).getByRole('heading',{name:'Euro Truck Simulator 2'})).toBeVisible();
 await page.getByRole('button',{name:'Ver mods de Euro Truck Simulator 2'}).click();
 await expect(page.getByRole('heading',{name:'Catálogo de mods'})).toBeVisible();
 await expect(page.getByText('2 resultados',{exact:true})).toBeVisible();
});
