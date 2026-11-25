import {test,expect} from '@playwright/test';
test('N07.2 desktop frame spans the reference viewport without hiding the lower content',async({page})=>{
 await page.setViewportSize({width:1586,height:992});
 await page.goto('/');
 const geometry=await page.evaluate(()=>{
  const r=(s:string)=>document.querySelector(s)!.getBoundingClientRect();
  return {header:r('.topbar').width,headerBottom:r('.topbar').bottom,footer:r('.footer').width,footerBottom:r('.footer').bottom,sidebarTop:r('.sidebar').top,bannerTop:r('.negresco-banner').top,indicatorsTop:r('.premium-stats').top,viewport:document.documentElement.clientWidth};
 });
 expect(geometry.header).toBeGreaterThanOrEqual(geometry.viewport-1);
 expect(geometry.footer).toBeGreaterThanOrEqual(geometry.viewport-1);
 expect(geometry.footerBottom).toBeLessThanOrEqual(992);
 expect(Math.abs(geometry.sidebarTop-geometry.headerBottom)).toBeLessThanOrEqual(1);
 expect(geometry.bannerTop).toBeLessThanOrEqual(65);
 expect(geometry.indicatorsTop).toBeLessThan(500);
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Catálogo de mods'})).toBeVisible();
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 const bottom=await page.evaluate(()=>({content:document.querySelector('.content')!.getBoundingClientRect().bottom,footer:document.querySelector('.footer')!.getBoundingClientRect().top}));
 expect(bottom.content).toBeLessThanOrEqual(bottom.footer+3);
});
