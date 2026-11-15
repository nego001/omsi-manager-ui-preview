import {test,expect,type Page} from '@playwright/test';

// Synthetic catalog only. These tests never scan or mutate installed mods.
const entries=[
 {id:'alfa',title:'Alfa OMSI',game:'omsi',category:'Ônibus',version:'1',
  size:'1 MB',description:'Exemplo fictício'},
 {id:'bravo',title:'Bravo OMSI',game:'omsi',category:'Sons',version:'1',
  size:'2 MB',description:'Exemplo fictício'},
 {id:'charlie',title:'Charlie ETS2',game:'ets2',category:'Caminhões',version:'1',
  size:'3 MB',description:'Exemplo fictício'}
];
const card=(page:Page,title:string)=>page.locator('.mod-card').filter({
 has:page.getByRole('button',{name:title,exact:true})
});
const titles=(page:Page)=>page.locator('.mod-grid .mod-card .text-button').allTextContents();
async function setup(page:Page,names:string[]){
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'favorite-focus.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods:entries}))
 });
 for(const name of names)await card(page,name).getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
}

test('unfavoriting the middle or last visible card restores keyboard focus to an adjacent card',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await setup(page,['Alfa OMSI','Bravo OMSI','Charlie ETS2']);
 expect(await titles(page)).toEqual(['Alfa OMSI','Bravo OMSI','Charlie ETS2']);
 const removeBravo=card(page,'Bravo OMSI').getByRole('button',{name:'Retirar dos favoritos'});
 await removeBravo.focus();
 await page.keyboard.press('Enter');
 await expect(page.getByRole('button',{name:'Charlie ETS2',exact:true})).toBeFocused();
 expect(await titles(page)).toEqual(['Alfa OMSI','Charlie ETS2']);
 await card(page,'Charlie ETS2').getByRole('button',{name:'Retirar dos favoritos'}).click();
 await expect(page.getByRole('button',{name:'Alfa OMSI',exact:true})).toBeFocused();
 expect(await titles(page)).toEqual(['Alfa OMSI']);
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('unfavoriting the sole favorite focuses the empty-Library action',async({page})=>{
 await setup(page,['Alfa OMSI']);
 await card(page,'Alfa OMSI').getByRole('button',{name:'Retirar dos favoritos'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 const action=page.getByRole('button',{name:'Explorar catálogo'});
 await expect(action).toBeFocused();
 await action.click();
 await expect(page.getByRole('heading',{name:'Catálogo de mods'})).toBeVisible();
});

test('filtered Library with hidden favorites focuses the clear-filters action after removal',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await setup(page,['Alfa OMSI','Charlie ETS2']);
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('omsi');
 expect(await titles(page)).toEqual(['Alfa OMSI']);
 await card(page,'Alfa OMSI').getByRole('button',{name:'Retirar dos favoritos'}).click();
 await expect(page.getByRole('heading',{name:'Nenhum favorito nesses filtros'})).toBeVisible();
 const reset=page.getByRole('button',{name:'Mostrar todos os favoritos'});
 await expect(reset).toBeFocused();
 await reset.click();
 await expect(page.getByRole('button',{name:'Charlie ETS2',exact:true})).toBeFocused();
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toHaveValue('all');
 expect(await titles(page)).toEqual(['Charlie ETS2']);
});

test('unfavoriting from Details returns to the first remaining visible Library card',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await setup(page,['Alfa OMSI','Bravo OMSI','Charlie ETS2']);
 await page.getByRole('button',{name:'Bravo OMSI',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Bravo OMSI',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Remover dos favoritos'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(page.getByRole('button',{name:'Alfa OMSI',exact:true})).toBeFocused();
 expect(await titles(page)).toEqual(['Alfa OMSI','Charlie ETS2']);
});

test('unfavoriting from Details with hidden favorites focuses the filtered empty action',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await setup(page,['Alfa OMSI','Charlie ETS2']);
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('omsi');
 await page.getByRole('button',{name:'Alfa OMSI',exact:true}).click();
 await page.getByRole('button',{name:'Remover dos favoritos'}).click();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Nenhum favorito nesses filtros'})).toBeVisible();
 const reset=page.getByRole('button',{name:'Mostrar todos os favoritos'});
 await expect(reset).toBeFocused();
 await reset.click();
 await expect(page.getByRole('button',{name:'Charlie ETS2',exact:true})).toBeFocused();
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toHaveValue('all');
});

test('unfavoriting the sole favorite from Details focuses the empty-Library action',async({page})=>{
 await setup(page,['Alfa OMSI']);
 await page.getByRole('button',{name:'Alfa OMSI',exact:true}).click();
 await page.getByRole('button',{name:'Remover dos favoritos'}).click();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Explorar catálogo'})).toBeFocused();
});
