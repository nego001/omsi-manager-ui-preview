import {test,expect} from '@playwright/test';
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
 await propose(page,[bus],'segunda.json');
 await expect(summary).toContainText('IDs com dependências ou conflitos de destino alterados: 0');
 await expect(summary).toContainText('IDs reutilizados entre simuladores: 0');
 await expect(summary).toContainText('IDs com exigências declaradas de versão alteradas: 0');
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await expect(summary).toHaveCount(0);
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
