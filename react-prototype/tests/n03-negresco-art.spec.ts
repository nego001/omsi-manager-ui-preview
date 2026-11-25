import {test,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
test('N03 approved art is either explicitly missing or loads all six local crops',async({page})=>{
 const files=['hero','omsi','ets2','ats','sidebar-bus','mark'];
 const count=files.filter(name=>existsSync(resolve('src/art/negresco/'+name+'.webp'))).length;
 expect([0,6],'Partial approved-art set is not accepted').toContain(count);
 await page.route('https://shared.fastly.steamstatic.com/**',route=>route.abort());
 await page.goto('/');
 await expect(page.locator('.premium-hero-main')).toHaveAttribute('data-approved-art',String(count===6));
 if(count===6){
  const art=page.locator('.negresco-banner,.negresco-simulator-art,.negresco-sidebar-art,.brand-mark img');
  await expect(art).toHaveCount(6);
  for(const img of await art.all()) await expect.poll(()=>img.evaluate(e=>(e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 }else{
  await expect(page.locator('.negresco-banner')).toHaveCount(0);
 }
 await expect(page.getByRole('group',{name:'Escolher simulador em destaque'}).getByRole('button')).toHaveCount(3);
});
