import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const nav=(page:import('@playwright/test').Page)=>
 page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:import('@playwright/test').Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const importedManifest={schemaVersion:1,mods:[{
 id:'ficticio',title:'Exemplo de importação',game:'omsi',category:'Ônibus',
 version:'2.0',size:'3 MB',description:'Dados fictícios sem arquivos reais'
}]};

test('replacement consent offers direct favorite inventory export without confirmation or data loss',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'import.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(importedManifest))
 });
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 await expect(consent).toBeVisible();
 await expect(consent).toContainText('não é um backup restaurável');
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  consent.getByRole('button',{name:'Baixar lista de favoritos antes de substituir'}).click()
 ]);
 expect(download.suggestedFilename()).toBe('OMSI-Manager-Lista-de-Favoritos.json');
 const json=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(json).toMatchObject({
  schema:'omsi-manager-declared-favorites-list-v1',
  installationVerified:false,compatibilityVerified:false,restorableByPreview:false,
  items:[{id:'omsi-bus',title:'Ônibus Urbano Clássico',game:'omsi',version:'1.0'}]
 });
 await expect(consent).toBeVisible();
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(consent).toHaveCount(0);
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('restore demonstration exports imported favorites from the active catalog only',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'imported.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(importedManifest))
 });
 await card(page,'Exemplo de importação').getByRole('button',{name:'Favoritar'}).click();
 await page.getByRole('button',{name:'Restaurar demonstração'}).click();
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 await expect(consent).toBeVisible();
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  consent.getByRole('button',{name:'Baixar lista de favoritos antes de substituir'}).click()
 ]);
 const json=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(json.items).toEqual([{
  id:'ficticio',title:'Exemplo de importação',game:'omsi',
  category:'Ônibus',version:'2.0'
 }]);
 expect(json.items.some((item:{id:string})=>item.id==='omsi-bus')).toBe(false);
 await expect(consent).toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(card(page,'Exemplo de importação')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await page.getByRole('button',{name:'Restaurar demonstração'}).click();
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
