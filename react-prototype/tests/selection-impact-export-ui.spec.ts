import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
type Page=import('@playwright/test').Page;
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const bus={id:'omsi-bus',title:'Ônibus Urbano Clássico',game:'omsi',
 category:'Ônibus',version:'1.0',
 description:'Veículo fictício usado apenas para validar o catálogo e os estados da interface.',size:'240 MB'};
const map={id:'omsi-map',title:'Serra do Vale',game:'omsi',
 category:'Mapas',version:'0.9',
 description:'Mapa de demonstração. Nenhum arquivo real do jogo é acessado.',size:'1,2 GB'};
async function choose(page:Page,titles:string[]){
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of titles)await card(page,title).getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 for(const title of titles)
  await page.getByRole('checkbox',{name:'Selecionar '+title+' para análise conjunta'}).check();
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
}
async function importNext(page:Page,items:object[],name:string){
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name,mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods:items}))
 });
}
test('relatório da seleção a 390px baixa sem aplicar proposta e preserva tudo ao cancelar',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await choose(page,['Ônibus Urbano Clássico','Serra do Vale']);
 await importNext(page,[{...bus,version:'8.0'}],'primeira.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 await consent.locator('summary').filter({hasText:'Ver impacto da seleção ativa'}).click();
 const group=consent.getByRole('group',{name:'Impacto da proposta na seleção ativa'});
 await expect(group).toContainText('Mesmo ID com dados alterados: 1');
 await expect(group).toContainText('Selecionados ausentes na proposta: 1');
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  group.getByRole('button',{name:'Baixar impacto completo da seleção ativa em JSON'}).click()
 ]);
 expect(download.suggestedFilename()).toBe('OMSI-Manager-Impacto-da-Selecao.json');
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(exported).toMatchObject({
  schema:'omsi-manager-declared-selection-impact-v1',
  counts:{total:2,unchanged:0,changed:1,removed:1},
  allSelectionsDiscardedOnConfirmation:true,proposedCatalogApplied:false,
  compatibilityVerified:false,installationVerified:false,
  restorableByPreview:false,sameIdProvesPackageIdentity:false
 });
 expect(exported.changed[0].id).toBe('omsi-bus');
 expect(exported.removed).toEqual([{id:'omsi-map',title:'Serra do Vale'}]);
 await expect(consent).toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale'])
  await expect(page.getByRole('checkbox',{name:'Selecionar '+title+' para análise conjunta'})).toBeChecked();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('exportação usa a proposta mais recente e não transfere seleção após confirmação',async({page})=>{
 await choose(page,['Ônibus Urbano Clássico','Serra do Vale']);
 await importNext(page,[{...bus,version:'8.0'}],'primeira.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 await consent.locator('summary').filter({hasText:'Ver impacto da seleção ativa'}).click();
 const group=consent.getByRole('group',{name:'Impacto da proposta na seleção ativa'});
 await importNext(page,[bus,map],'segunda.json');
 // Import replaces the pending panel, so the new details starts collapsed.
 await expect(consent.getByRole('group',{name:'Comparação declarativa entre catálogos'}))
  .toContainText('ID mantido com metadados alterados: 0');
 await consent.locator('summary').filter({hasText:'Ver impacto da seleção ativa'}).click();
 await expect(group).toContainText('Mesmo ID e dados iguais: 2');
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  group.getByRole('button',{name:'Baixar impacto completo da seleção ativa em JSON'}).click()
 ]);
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(exported.counts).toEqual({total:2,unchanged:2,changed:0,removed:0});
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
