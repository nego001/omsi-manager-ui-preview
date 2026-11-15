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
 version:'2.0',size:'1 MB',description:'Registro declarativo sem instalação'};
async function propose(page:Page,mods:object[],name:string){
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name,mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
}
test('resumo de revisão agrega categorias sem pontuação de segurança a 390 px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await propose(page,[{...bus,requires:['engine'],
  requiresMinVersions:[{id:'engine',minVersion:'1.0'}]},engine],'base.json');
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,requires:['missing'],
  requiresMinVersions:[{id:'missing',minVersion:'2.0'}]},
  {...engine,game:'ets2'}],'altera.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const summary=consent.getByRole('group',{name:'Resumo das diferenças declaradas'});
 await expect(summary).toBeVisible();
 await expect(summary).toContainText('IDs reutilizados entre simuladores: 1');
 await expect(summary).toContainText('IDs com dependências ou conflitos de destino alterados: 1');
 await expect(summary).toContainText('IDs com exigências declaradas de versão alteradas: 1');
 await expect(summary).toContainText('IDs distintos nos quatro grupos: 2');
 await expect(summary).toContainText('IDs presentes em mais de um grupo: 1');
 await summary.getByText('Ver IDs presentes em mais de um grupo (1)').click();
 await expect(summary.locator('.catalog-preflight-overlap-examples li')).toHaveText([
  'omsi-bus: Bloqueios declarados · Dependências/conflitos · Exigências de versão'
 ]);
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  summary.getByRole('button',{name:'Baixar todos os IDs sobrepostos em JSON'}).click()
 ]);
 expect(download.suggestedFilename()).toBe('OMSI-Manager-IDs-Sobrepostos.json');
 await expect(summary).toContainText('Os grupos podem incluir o mesmo ID mais de uma vez.');
 await expect(summary).toContainText('Nada foi aplicado.');
 await expect(consent.locator('details.catalog-version-constraints')).toBeVisible();
 await expect(consent.locator('details.catalog-reference-changes')).toBeVisible();
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(summary).toHaveCount(0);
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
});
test('resumo reflete a última proposta e desaparece após confirmação explícita',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,requires:['missing']}],'primeira.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const summary=consent.getByRole('group',{name:'Resumo das diferenças declaradas'});
 await expect(summary).toBeVisible();
 await expect(summary).toContainText('IDs com dependências ou conflitos de destino alterados: 1');
 await expect(summary).toContainText('IDs distintos nos quatro grupos: 1');
 await propose(page,[bus],'segunda.json');
 await expect(summary).toContainText('IDs com dependências ou conflitos de destino alterados: 0');
 await expect(summary).toContainText('IDs reutilizados entre simuladores: 0');
 await expect(summary).toContainText('IDs com exigências declaradas de versão alteradas: 0');
 await expect(summary).toContainText('IDs distintos nos quatro grupos: 0');
 await expect(summary).toContainText('IDs presentes em mais de um grupo: 0');
 await expect(summary.locator('.catalog-preflight-overlap-examples')).toHaveCount(0);
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await expect(summary).toHaveCount(0);
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});


test('ID declarado com 64 caracteres permanece legível a 390px e funciona por teclado',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 const longId='mod-'+('a'.repeat(60));
 expect(longId).toHaveLength(64);
 await propose(page,[{...bus,id:longId,requires:['old-dep']}],'long-before.json');
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,id:longId,game:'ets2',requires:['new-dep']}],'long-after.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const overlap=consent.locator('.catalog-preflight-overlap-examples');
 await expect(overlap).toBeVisible();
 await expect(overlap.locator('li')).toHaveCount(1);
 await overlap.locator('summary').focus();
 await expect(overlap.locator('summary')).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(overlap).toHaveAttribute('open','');
 await expect(overlap.locator('li')).toContainText(longId);
 await expect(overlap.locator('li')).toContainText('Entre simuladores');
 await expect(overlap.locator('li')).toContainText('Dependências/conflitos');
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(overlap).toHaveCount(0);
});

test('alertas zerados não ocultam IDs removidos/adicionados ou alterações fora dos quatro grupos',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await propose(page,[bus],'base-somente-um.json');
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 const other={...bus,id:'only-new',title:'Registro novo'};
 await propose(page,[other],'tudo-substituido.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const summary=consent.getByRole('group',{name:'Resumo das diferenças declaradas'});
 const coverage=summary.getByRole('note');
 await expect(summary).toContainText('IDs distintos nos quatro grupos: 0');
 await expect(coverage).toContainText('IDs adicionados: 1');
 await expect(coverage).toContainText('IDs removidos: 1');
 await expect(coverage).toContainText('IDs mantidos com metadados alterados: 0');
 await expect(coverage).toContainText('Zero alertas nos quatro grupos não significa catálogos iguais.');

 await propose(page,[{...bus,description:'Descrição revisada'}],'apenas-descricao.json');
 await expect(summary).toContainText('IDs distintos nos quatro grupos: 0');
 await expect(coverage).toContainText('IDs adicionados: 0');
 await expect(coverage).toContainText('IDs removidos: 0');
 await expect(coverage).toContainText('IDs mantidos com metadados alterados: 1');
 await expect(coverage).toContainText('Zero alertas nos quatro grupos não significa catálogos iguais.');
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(summary).toHaveCount(0);
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
});


test('exportação de sobreposições acompanha a última proposta sem vazar o JSON anterior',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await propose(page,[bus,engine],'base-overlap.json');
 await card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Favoritar'}).click();
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const overlap=consent.locator('.catalog-preflight-overlap-examples');
 async function downloadOverlap(){
  await overlap.locator('summary').click();
  const [download]=await Promise.all([
   page.waitForEvent('download'),
   overlap.getByRole('button',{name:'Baixar todos os IDs sobrepostos em JSON'}).click()
  ]);
  expect(download.suggestedFilename()).toBe('OMSI-Manager-IDs-Sobrepostos.json');
  const path=await download.path();
  expect(path).not.toBeNull();
  return JSON.parse(await readFile(path!,'utf8'));
 }

 await propose(page,[{...bus,requires:['missing']},engine],'primeira-sobreposicao.json');
 await expect(overlap).toBeVisible();
 const firstExport=await downloadOverlap();
 expect(firstExport.schema).toBe('omsi-manager-declared-preflight-overlaps-v1');
 expect(firstExport.counts).toEqual({distinctIds:1,overlappingIds:1});
 expect(firstExport.overlaps).toEqual([{
  id:'omsi-bus',groups:['blockers','references']
 }]);
 expect(firstExport).toMatchObject({
  completeOverlapList:true,proposedCatalogApplied:false,
  installedFilesChecked:false,compatibilityVerified:false,
  sourceAuthenticated:false,restorableByPreview:false
 });

 await propose(page,[{...bus,requires:['engine'],
  requiresMinVersions:[{id:'engine',minVersion:'9.0'}]},engine],
 'segunda-sobreposicao.json');
 await expect(overlap).toBeVisible();
 // A nova proposta pode conservar ou recolher o disclosure; ajuste o estado
 // de forma explícita antes de acionar o botão.
 if(await overlap.getAttribute('open')!==null){
  await overlap.locator('summary').click();
 }
 const secondExport=await downloadOverlap();
 expect(secondExport.counts).toEqual({distinctIds:1,overlappingIds:1});
 expect(secondExport.overlaps).toEqual([{
  id:'omsi-bus',groups:['blockers','references','versions']
 }]);
 expect(secondExport.overlaps).not.toEqual(firstExport.overlaps);
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(overlap).toHaveCount(0);
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
});
