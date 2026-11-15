import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
type Page=import('@playwright/test').Page;
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const bus={id:'omsi-bus',title:'Ônibus Urbano Clássico',game:'omsi',category:'Ônibus',
 version:'1.0',size:'240 MB',
 description:'Veículo fictício usado apenas para validar o catálogo e os estados da interface.'};
const engine={id:'engine',title:'Motor fictício',game:'omsi',category:'Sons',
 version:'3.0',size:'1 MB',description:'Registro sem arquivos reais'};
async function propose(page:Page,mods:object[],name:string){
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name,mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
}
test('baixa comparação completa de versões a 390 px e cancelar mantém favorito',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await propose(page,[{...bus,requires:['engine'],
  requiresMinVersions:[{id:'engine',minVersion:'1.0'}]},engine],'base.json');
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,requires:['engine'],
  requiresMinVersions:[{id:'engine',minVersion:'1.5'}],
  gameVersionRange:{min:'1.0',max:'2.0'}},engine],'versao.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const panel=consent.locator('details.catalog-version-constraints');
 await panel.locator('summary').click();
 const group=consent.getByRole('group',{name:'Mudanças nas exigências de versão'});
 await expect(group).toContainText('Versão mínima alterada: engine: 1.0 → 1.5');
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  group.getByRole('button',{name:'Baixar comparação completa de versões declaradas em JSON'}).click()
 ]);
 expect(download.suggestedFilename()).toBe('OMSI-Manager-Exigencias-de-Versao.json');
 const report=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(report).toMatchObject({
  schema:'omsi-manager-declared-version-constraints-v1',
  counts:{changed:1,unchangedConstraints:1,comparedIds:2},
  completeDeclaredVersionChanges:true,
  proposedCatalogApplied:false,restorableByPreview:false,
  installedFilesChecked:false,realCompatibilityVerified:false,
  installationVerified:false,sourceAuthenticated:false
 });
 expect(report.changed).toMatchObject([{
  id:'omsi-bus',oldGameMin:null,newGameMin:'1.0',
  newGameMax:'2.0',changedFloors:[{
   id:'engine',oldMinVersion:'1.0',newMinVersion:'1.5'
  }]
 }]);
 await expect(consent).toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('relatório reflete segunda proposta e não confirma substituição',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,gameVersionRange:{min:'1.0'}}],'primeira.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 await expect(consent.locator('details.catalog-version-constraints')).toBeVisible();
 await propose(page,[{...bus,gameVersionRange:{min:'2.0'}}],'segunda.json');
 await expect(consent.getByRole('group',{name:'Comparação declarativa entre catálogos'}))
  .toContainText('ID mantido com metadados alterados: 1');
 const panel=consent.locator('details.catalog-version-constraints');
 await panel.locator('summary').click();
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  consent.getByRole('group',{name:'Mudanças nas exigências de versão'})
   .getByRole('button',{name:'Baixar comparação completa de versões declaradas em JSON'}).click()
 ]);
 const report=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(report.changed).toMatchObject([{id:'omsi-bus',oldGameMin:null,newGameMin:'2.0'}]);
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
