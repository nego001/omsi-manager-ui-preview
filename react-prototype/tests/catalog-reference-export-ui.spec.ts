import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
type Page=import('@playwright/test').Page;
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const bus={id:'omsi-bus',title:'Ônibus Urbano Clássico',
 game:'omsi',category:'Ônibus',version:'1.0',
 description:'Veículo fictício usado apenas para validar o catálogo e os estados da interface.',size:'240 MB'};
async function propose(page:Page,mods:object[],name:string){
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name,mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
}
test('download de alvos declarados completos a 390 px preserva favoritos ao cancelar',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await propose(page,[{...bus,requires:['old'],conflictsWith:['old-x']}],'base.json');
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,requires:['next'],conflictsWith:['next-x']}],'proposta.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const details=consent.locator('details.catalog-reference-changes');
 await details.locator('summary').click();
 const group=consent.getByRole('group',{name:'Mudanças de alvos declarados'});
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  group.getByRole('button',{name:'Baixar alvos alterados de dependências e conflitos em JSON'}).click()
 ]);
 expect(download.suggestedFilename()).toBe('OMSI-Manager-Alvos-de-Referencias.json');
 const report=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(report).toMatchObject({
  schema:'omsi-manager-declared-reference-changes-v1',
  counts:{comparedIds:1,unchangedReferences:0,changed:1},
  proposedCatalogApplied:false,restorableByPreview:false,
  installationVerified:false,compatibilityVerified:false,
  installedFilesChecked:false,sameIdProvesPackageIdentity:false
 });
 expect(report.changed).toMatchObject([{
  id:'omsi-bus',requiresRemoved:['old'],requiresAdded:['next'],
  conflictsRemoved:['old-x'],conflictsAdded:['next-x']
 }]);
 await expect(consent).toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('arquivo baixado usa somente a segunda proposta e confirmação descarta os favoritos',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,requires:['first']}],'primeira.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 await expect(consent.locator('details.catalog-reference-changes')).toBeVisible();
 await propose(page,[{...bus,requires:['second'],conflictsWith:['extra']}],'segunda.json');
 await expect(consent.getByRole('group',{name:'Comparação declarativa entre catálogos'}))
  .toContainText('ID mantido com metadados alterados: 1');
 const panel=consent.locator('details.catalog-reference-changes');
 await panel.locator('summary').click();
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  consent.getByRole('group',{name:'Mudanças de alvos declarados'})
   .getByRole('button',{name:'Baixar alvos alterados de dependências e conflitos em JSON'}).click()
 ]);
 const report=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(report.changed).toMatchObject([{
  id:'omsi-bus',requiresAdded:['second'],conflictsAdded:['extra'],
  requiresRemoved:[],conflictsRemoved:[]
 }]);
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
