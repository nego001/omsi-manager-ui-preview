import {test,expect} from '@playwright/test';

type Page=import('@playwright/test').Page;
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});

test('atalho da Biblioteca leva ao cartão e ao estado vazio sem mexer nos favoritos',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('button',{name:'Ir aos filtros da biblioteca'})).toHaveCount(0);
 await page.getByRole('button',{name:'Ir à biblioteca vazia'}).click();
 await expect(page.getByRole('button',{name:'Explorar catálogo'})).toBeFocused();
 await page.getByRole('button',{name:'Explorar catálogo'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await card(page,'Serra do Vale').getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('button',{name:'Ir aos filtros da biblioteca'}).click();
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toBeFocused();
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toHaveValue('all');
 await page.getByRole('button',{name:'Ir aos favoritos exibidos (2)'}).click();
 await expect(card(page,'Ônibus Urbano Clássico').getByRole('button',{
  name:'Ônibus Urbano Clássico',exact:true
 })).toBeFocused();
 // The bookmark action is purely navigation; no change to favorites.
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await expect(card(page,'Serra do Vale')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 // No favorite is for ATS; preserve this filter rather than resetting it.
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('ats');
 await page.getByRole('button',{name:'Ir aos filtros da biblioteca'}).click();
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toBeFocused();
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toHaveValue('ats');
 await expect(page.getByRole('button',{name:'Ir ao resultado vazio dos filtros'})).toBeVisible();
 await page.getByRole('button',{name:'Ir ao resultado vazio dos filtros'}).click();
 await expect(page.getByRole('button',{name:'Mostrar todos os favoritos'})).toBeFocused();
 await page.getByRole('button',{name:'Mostrar todos os favoritos'}).click();
 await expect(card(page,'Ônibus Urbano Clássico').getByRole('button',{
  name:'Ônibus Urbano Clássico',exact:true
 })).toBeFocused();
 await expect(page.getByRole('button',{name:'Ir aos favoritos exibidos (2)'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
