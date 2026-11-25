import {test,expect} from '@playwright/test';
test('R06 medium width dashboard preserves room for content and readable headings',async({page})=>{
 await page.route('https://shared.fastly.steamstatic.com/**',route=>route.abort());
 await page.goto('/');
 for(const width of [1440,1024,850,390]){
  await page.setViewportSize({width,height:820});
  const layout=await page.evaluate(()=>{
   const shell=document.querySelector('.gamer-premium')!;
   const side=shell.querySelector('.sidebar')!;
   const hero=shell.querySelector('.premium-hero h1')!;
   const content=shell.querySelector('.content')!;
   return {sidebar:side.getBoundingClientRect().width,content:content.getBoundingClientRect().width,heading:parseFloat(getComputedStyle(hero).fontSize),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  });
  expect(layout.heading).toBeGreaterThanOrEqual(24);
  expect(layout.overflow).toBeLessThanOrEqual(3);
  if(width===850||width===1024){expect(layout.sidebar).toBeLessThanOrEqual(191);expect(layout.content).toBeGreaterThanOrEqual(width-195);}
  await expect(page.getByRole('button',{name:'Abrir biblioteca',exact:true})).toBeVisible();
 }
});
