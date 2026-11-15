import {test,expect} from '@playwright/test';
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
test('mostra alvos trocados mesmo com um bloqueio do mesmo tipo a 390 px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 // No session state: the first valid import becomes the active baseline.
 await propose(page,[{...bus,requires:['missing-a'],conflictsWith:['old-c']}],'base.json');
 await expect(card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'})).toBeVisible();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,requires:['missing-b'],conflictsWith:['new-c']}],'proposta.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const details=consent.locator('details.catalog-reference-changes');
 await expect(details.locator('summary')).toContainText('Ver alvos de dependências e conflitos alterados (1)');
 await expect(details).not.toHaveAttribute('open','');
 await details.locator('summary').click();
 const group=consent.getByRole('group',{name:'Mudanças de alvos declarados'});
 await expect(group).toContainText('Dependências retiradas: missing-a');
 await expect(group).toContainText('Dependências adicionadas: missing-b');
 await expect(group).toContainText('Conflitos retirados: old-c');
 await expect(group).toContainText('Conflitos adicionados: new-c');
 await expect(group).toContainText('não comprova arquivos instalados');
 // The blocker code remains dependency-missing on both sides; this new
 // reference check is independent of numerical blocker regressions.
 await expect(consent.locator('details.catalog-relation-regressions')).toHaveCount(0);
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(details).toHaveCount(0);
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('nova proposta sem troca de alvo remove prévia; confirmar ainda descarta favoritos',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,requires:['a']}],'first.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const details=consent.locator('details.catalog-reference-changes');
 await expect(details).toBeVisible();
 await propose(page,[bus],'second.json');
 await expect(consent.getByRole('group',{name:'Comparação declarativa entre catálogos'}))
  .toContainText('ID mantido com metadados alterados: 0');
 await expect(details).toHaveCount(0);
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
