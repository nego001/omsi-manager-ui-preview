import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
type Page=import('@playwright/test').Page;
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const bus={id:'omsi-bus',title:'Ônibus Urbano Clássico',game:'omsi',category:'Ônibus',
 version:'1.0',size:'240 MB',
 description:'Veículo fictício usado apenas para validar o catálogo e os estados da interface.'};
const engine={id:'engine',title:'Motor declarado',game:'omsi',category:'Sons',
 version:'1.0',description:'Registro demonstrativo',size:'1 MB'};
async function propose(page:Page,mods:object[],name:string){
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name,mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
}
test('baixa relatório dos bloqueios a 390 px sem aplicar proposta nem perder favoritos',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,requires:['missing']}],'proposta.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const panel=consent.locator('details.catalog-relation-regressions');
 await panel.locator('summary').click();
 const group=consent.getByRole('group',{name:'Mudanças de bloqueios declarados'});
 await expect(group).toContainText('Novos bloqueios em IDs mantidos: 1');
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  group.getByRole('button',{name:'Baixar comparação completa de bloqueios declarados em JSON'}).click()
 ]);
 expect(download.suggestedFilename()).toBe('OMSI-Manager-Bloqueios-Declarados.json');
 const report=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(report).toMatchObject({
  schema:'omsi-manager-declared-relation-regressions-v1',
  counts:{newlyBlocked:1,worsened:0,changedReasons:0,addedBlocked:0},
  completeFlaggedRecords:true,proposedCatalogApplied:false,
  restorableByPreview:false,realCompatibilityVerified:false
 });
 expect(report.newlyBlocked[0]).toMatchObject({
  id:'omsi-bus',previousBlockers:0,proposedBlockers:1,favoriteNow:true
 });
 await expect(consent).toBeVisible();
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('nova proposta e troca de motivo geram relatório atualizado, sem migração',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await propose(page,[{...bus,requires:['missing']},engine],'base.json');
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,requires:['engine']},{...engine,game:'ets2'}],'segunda.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const panel=consent.locator('details.catalog-relation-regressions');
 await expect(panel.locator('summary')).toContainText('(1)');
 await panel.locator('summary').click();
 const group=consent.getByRole('group',{name:'Mudanças de bloqueios declarados'});
 await expect(group).toContainText('Tipos de bloqueio alterados, mesmo total: 1');
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  group.getByRole('button',{name:'Baixar comparação completa de bloqueios declarados em JSON'}).click()
 ]);
 const report=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(report.counts.changedReasons).toBe(1);
 expect(report.changedReasons[0]).toMatchObject({
  previousBlockingCodes:['dependency-missing'],proposedBlockingCodes:['different-game']
 });
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
