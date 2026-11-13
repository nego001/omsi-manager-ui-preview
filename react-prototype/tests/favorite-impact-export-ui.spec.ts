import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
type Page=import('@playwright/test').Page;
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const manifest=(id:string,title:string)=>({schemaVersion:1,mods:[{
 id,title,game:'omsi',category:'Ônibus',version:'2.0',size:'1 MB',
 description:'Registro sintético'
}]});
async function propose(page:Page,id:string,title:string){
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:id+'.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(manifest(id,title)))
 });
}
test('download do impacto de favoritos não aplica proposta nem descarta estado a 390px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await card(page,'Serra do Vale').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,'um_novo','Mod declarado');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const impact=consent.getByRole('group',{name:'Impacto da proposta nos favoritos'});
 await expect(impact).toContainText('Favoritos ausentes na proposta: 2');
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  impact.getByRole('button',{name:'Baixar impacto completo nos favoritos em JSON'}).click()
 ]);
 expect(download.suggestedFilename()).toBe('OMSI-Manager-Impacto-nos-Favoritos.json');
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(exported).toMatchObject({
  schema:'omsi-manager-declared-favorite-impact-v1',
  counts:{total:2,unchanged:0,changed:0,removed:2},
  allFavoritesDiscardedOnConfirmation:true,proposedCatalogApplied:false,
  sourceAuthenticated:false,restorableByPreview:false
 });
 expect(exported.removed.map((x:{id:string})=>x.id)).toEqual(['omsi-bus','omsi-map']);
 await expect(consent).toBeVisible();
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(consent).toHaveCount(0);
 await expect(card(page,'Serra do Vale')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('segunda proposta altera o JSON baixado sem importar até confirmação',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,'primeiro','Primeiro mod');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const impact=consent.getByRole('group',{name:'Impacto da proposta nos favoritos'});
 await expect(impact).toContainText('Favoritos ausentes na proposta: 1');
 // Reusing the same ID with a different title must be classified as changed,
 // but must not carry the old favorite into the newly imported catalog.
 await propose(page,'omsi-bus','Título novo para mesmo ID');
 await expect(impact).toContainText('Mesmo ID com dados alterados: 1');
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  impact.getByRole('button',{name:'Baixar impacto completo nos favoritos em JSON'}).click()
 ]);
 const report=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(report.counts).toEqual({total:1,unchanged:0,changed:1,removed:0});
 expect(report.changed).toEqual([{
  id:'omsi-bus',oldTitle:'Ônibus Urbano Clássico',
  newTitle:'Título novo para mesmo ID',
  fields:['title','version','description','size']
 }]);
 await expect(page.getByRole('button',{name:'Título novo para mesmo ID',exact:true})).toHaveCount(0);
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
