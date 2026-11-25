import {test,expect} from '@playwright/test';
test('N06 desktop retains exact art and compact live hero controls',async({page})=>{
 await page.route('https://shared.fastly.steamstatic.com/**',route=>route.abort());
 await page.goto('/');
 await expect(page.locator('.premium-hero-main')).toHaveAttribute('data-approved-art','true');
 for(const width of [1586,1440,1024,850,390]){
  await page.setViewportSize({width,height:992});
  const banner=page.locator('.negresco-banner');
  await expect.poll(()=>banner.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBe(1332);
  const metrics=await page.evaluate(()=>{
   const banner=document.querySelector('.negresco-banner')!.getBoundingClientRect();
   const copy=document.querySelector('.premium-hero-main .hero-copy')!.getBoundingClientRect();
   const stats=[...document.querySelectorAll('.premium-stat')].map(el=>el.getBoundingClientRect().top);
   return {banner:banner.height,copy:copy.height,statRows:new Set(stats.map(x=>Math.round(x))).size,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  });
  expect(metrics.overflow).toBeLessThanOrEqual(3);
  if(width>=1024){expect(metrics.copy).toBeLessThanOrEqual(180);expect(metrics.statRows).toBe(1);}
  await expect(page.getByRole('button',{name:'Abrir biblioteca',exact:true})).toBeVisible();
 }
 await page.getByRole('group',{name:'Escolher simulador em destaque'}).getByRole('button',{name:'Mostrar Euro Truck Simulator 2 no destaque'}).click();
 await expect(page.getByRole('region',{name:'Destaque de simuladores'}).getByRole('heading',{name:'Euro Truck Simulator 2'})).toBeVisible();
});
