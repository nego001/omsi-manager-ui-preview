import {test,expect} from '@playwright/test';

const key='omsi-manager-preview:prefs:v1';
const nav=(page:import('@playwright/test').Page)=>
 page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:import('@playwright/test').Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});

test('demo favorites remain locally persisted under explicit demo scope',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await expect(card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{}'),key))
  .toMatchObject({catalogScope:'demo',favorites:['omsi-bus']});
 await page.reload();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByText('Favoritos da demonstração ficam salvos neste navegador.')).toBeVisible();
 await expect(card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
});

test('imported favorite sharing a demo ID never leaks across reload into demo catalog',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 const manifest={schemaVersion:1,mods:[{
  id:'omsi-bus',title:'Registro importado com ID repetido',game:'omsi',
  category:'Ônibus',version:'8.9',description:'Metadados fictícios.',
  size:'12 MB'
 }]};
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'colliding-id.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(manifest))
 });
 await expect(page.getByRole('button',{name:'Registro importado com ID repetido',exact:true})).toBeVisible();
 await card(page,'Registro importado com ID repetido').getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByText('Favoritos do catálogo importado duram apenas esta sessão')).toBeVisible();
 await expect(card(page,'Registro importado com ID repetido')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{}'),key))
  .toMatchObject({catalogScope:'demo',favorites:[]});
 await page.reload();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Registro importado com ID repetido',exact:true})).toHaveCount(0);
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await expect(card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('ambiguous legacy favorites cannot be attributed to the demo after reload',async({page})=>{
 await page.goto('/');
 await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({
  favorites:['omsi-bus','ets-truck'],sidebar:false,dense:true
 })),key);
 await page.reload();
 const pref=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{}'),key);
 expect(pref).toMatchObject({
  catalogScope:'demo',favorites:[],sidebar:false,dense:true
 });
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({
  favorites:['omsi-bus'],sidebar:true,dense:false,catalogScope:'imported'
 })),key);
 await page.reload();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
