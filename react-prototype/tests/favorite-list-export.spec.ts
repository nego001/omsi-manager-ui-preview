import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const nav=(page:import('@playwright/test').Page)=>
 page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:import('@playwright/test').Page,title:string)=>
 page.locator('.mod-card').filter({
  has:page.getByRole('button',{name:title,exact:true})
 });

test('favorite inventory export includes all saved favorites independently of Library filters',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await card(page,'Caminhão Rodoviário').getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 const inventory=page.getByRole('region',{name:'Exportação de favoritos declarados'});
 await expect(inventory).toContainText('não pode ser restaurado automaticamente');
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('omsi');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  inventory.getByRole('button',{name:'Exportar lista de favoritos em JSON'}).click()
 ]);
 expect(download.suggestedFilename()).toBe('OMSI-Manager-Lista-de-Favoritos.json');
 const raw=await readFile(await download.path(),'utf8');
 const json=JSON.parse(raw);
 expect(json).toEqual({
  schema:'omsi-manager-declared-favorites-list-v1',
  source:'catalog-declarations',
  compatibilityVerified:false,
  installationVerified:false,
  restorableByPreview:false,
  items:[
   {id:'omsi-bus',title:'Ônibus Urbano Clássico',game:'omsi',category:'Ônibus',version:'1.0'},
   {id:'ets-truck',title:'Caminhão Rodoviário',game:'ets2',category:'Caminhões',version:'2.0'}
  ]
 });
 expect(raw).not.toContain('description');
 expect(raw).not.toContain('modPath');
 expect(raw).not.toContain('installPath');
 // This inventory is NOT a second route to installing/importing catalog data.
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:download.suggestedFilename(),mimeType:'application/json',
  buffer:Buffer.from(raw)
 });
 await expect(page.getByRole('alert')).toContainText('Versão do catálogo incompatível');
 await expect(page.getByRole('region',{name:'Confirmar substituição do catálogo'})).toHaveCount(0);
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(inventory).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toHaveValue('omsi');
 await expect(page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('favorite export only appears when collection has entries and does not create new favorites',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 const inventory=page.getByRole('region',{name:'Exportação de favoritos declarados'});
 await expect(inventory).toHaveCount(0);
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(inventory).toBeVisible();
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  inventory.getByRole('button',{name:'Exportar lista de favoritos em JSON'}).click()
 ]);
 const json=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(json.items).toHaveLength(1);
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Retirar dos favoritos'}).click();
 await expect(inventory).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
