import {test,expect} from '@playwright/test';
test('R02 local panoramic art survives the blocked Steam host',async({page})=>{
 await page.route('https://shared.fastly.steamstatic.com/**',route=>route.abort());
 await page.goto('/');
 const hero=page.locator('.premium-hero-main');
 for(const [title,id] of [['OMSI 2','omsi'],['Euro Truck Simulator 2','ets2'],['American Truck Simulator','ats']]){
  await page.locator('.premium-choice[data-game="'+id+'"]').click();
  await expect(hero).toHaveAttribute('data-game',id);
  await expect(hero.locator('.featured-game-name')).toHaveText(title);
  const url=await hero.locator('.game-cover').evaluate(el=>getComputedStyle(el).backgroundImage.match(/url\("([^"]+)"\)/)?.[1]);
  expect(url).toBeTruthy();
  expect(await page.evaluate(async src=>new Promise<boolean>(resolve=>{const img=new Image();img.onload=()=>resolve(img.naturalWidth>0);img.onerror=()=>resolve(false);img.src=src!}),url)).toBe(true);
 }
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 for(const label of ['Jogos','Catálogo de mods','Minha biblioteca','Fila de tarefas','Histórico','Configurações','Segurança']){
  await nav.getByRole('button',{name:label,exact:true}).click();
  await expect(nav.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-current','page');
  await expect(page.locator('.page-heading')).toBeVisible();
 }
});
