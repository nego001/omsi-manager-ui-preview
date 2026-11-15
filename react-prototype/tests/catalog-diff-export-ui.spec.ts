import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const nav=(page:import('@playwright/test').Page)=>
 page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:import('@playwright/test').Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const manifest=(id:string,title:string)=>({schemaVersion:1,mods:[{
 id,title,game:'omsi',category:'Ônibus',version:'3.0',size:'1 MB',
 description:'Somente metadados sintéticos'
}]});
const propose=async(page:import('@playwright/test').Page,id:string,title:string)=>
 page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:id+'.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(manifest(id,title)))
 });

test('download do diff preserva favoritos, proposta e confirmação separada a 390px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,'novo_um','Mod fictício um');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const comparison=consent.getByRole('group',{name:'Comparação declarativa entre catálogos'});
 await expect(comparison).toContainText('IDs adicionados: 1');
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  comparison.getByRole('button',{name:'Baixar comparação completa em JSON'}).click()
 ]);
 expect(download.suggestedFilename()).toBe('OMSI-Manager-Comparacao-de-Catalogos.json');
 const report=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(report).toMatchObject({
  schema:'omsi-manager-declared-catalog-diff-v1',
  sourceAuthenticated:false,proposedCatalogApplied:false,
  installationVerified:false,compatibilityVerified:false,
  restorableByPreview:false,
  counts:{added:1},
  added:[{id:'novo_um',title:'Mod fictício um'}]
 });
 await expect(consent).toBeVisible();
 await expect(card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(comparison).toHaveCount(0);
 await expect(card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('nova proposta muda o arquivo exportado e não efetua importação ao baixar',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,'primeiro','Proposta inicial');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const compare=consent.getByRole('group',{name:'Comparação declarativa entre catálogos'});
 await expect(compare).toContainText('Proposta inicial');
 await propose(page,'segundo','Proposta posterior');
 await expect(compare).not.toContainText('Proposta inicial');
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  compare.getByRole('button',{name:'Baixar comparação completa em JSON'}).click()
 ]);
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(exported.added).toEqual([{id:'segundo',title:'Proposta posterior'}]);
 await expect(page.getByRole('button',{name:'Proposta posterior',exact:true})).toHaveCount(0);
 await expect(consent).toBeVisible();
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await expect(page.getByRole('button',{name:'Proposta posterior',exact:true})).toBeVisible();
});
