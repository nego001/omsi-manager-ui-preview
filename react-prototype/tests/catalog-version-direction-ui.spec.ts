import {test,expect} from '@playwright/test';
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
test('classifica exigência mais restritiva sem comprovar instalação e preserva favorito a 390 px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await propose(page,[{...bus,requires:['engine'],
  requiresMinVersions:[{id:'engine',minVersion:'1.0'}]},engine],'base.json');
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,requires:['engine'],
  requiresMinVersions:[{id:'engine',minVersion:'1.5'}]},engine],'proposta.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const panel=consent.locator('details.catalog-version-constraints');
 await expect(panel).toBeVisible();
 await expect(panel).not.toHaveAttribute('open','');
 await panel.locator('summary').click();
 const group=consent.getByRole('group',{name:'Mudanças nas exigências de versão'});
 await expect(group.getByRole('list',{name:'Direções das exigências declaradas'}))
  .toContainText('Mais restritivas: 1');
 await expect(group).toContainText('Direção: Exigências declaradas mais restritivas');
 await expect(group).toContainText('Não é um teste de compatibilidade');
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('direção mista desaparece quando segunda proposta retorna aos limites anteriores',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await propose(page,[{...bus,gameVersionRange:{min:'1.0',max:'3.0'}}],'base.json');
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,gameVersionRange:{min:'1.5',max:'4.0'}}],'mixed.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const panel=consent.locator('details.catalog-version-constraints');
 await panel.locator('summary').click();
 await expect(consent.getByRole('group',{name:'Mudanças nas exigências de versão'}))
  .toContainText('Direção: Exigências declaradas em sentidos mistos');
 await propose(page,[{...bus,gameVersionRange:{min:'1.0',max:'3.0'}}],'same.json');
 await expect(consent.getByRole('group',{name:'Comparação declarativa entre catálogos'}))
  .toContainText('ID mantido com metadados alterados: 0');
 await expect(panel).toHaveCount(0);
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
test('mudança de simulador impede comparar as exigências numéricas do mesmo ID',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await propose(page,[{...bus,gameVersionRange:{min:'1.0'}}],'base.json');
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,game:'ets2',gameVersionRange:{min:'2.0'}}],'proposta.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const panel=consent.locator('details.catalog-version-constraints');
 await panel.locator('summary').click();
 const group=consent.getByRole('group',{name:'Mudanças nas exigências de versão'});
 await expect(group.getByRole('list',{name:'Direções das exigências declaradas'}))
  .toContainText('Jogos diferentes: 1');
 await expect(group).toContainText('Direção: Jogos diferentes: requisitos não comparáveis');
 await expect(group).toContainText('Não é um teste de compatibilidade');
 await expect(consent.getByRole('note',{name:'Alerta de IDs reutilizados entre jogos'})).toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
});

test('dependência reutilizada em outro simulador bloqueia comparação numérica do piso a 390 px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await propose(page,[{...bus,requires:['engine'],
  requiresMinVersions:[{id:'engine',minVersion:'1.0'}]},engine],'base.json');
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,requires:['engine'],
  requiresMinVersions:[{id:'engine',minVersion:'1.5'}]},
  {...engine,game:'ets2'}],'cross-game.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const panel=consent.locator('details.catalog-version-constraints');
 await panel.locator('summary').click();
 const group=consent.getByRole('group',{name:'Mudanças nas exigências de versão'});
 await expect(group.getByRole('list',{name:'Direções das exigências declaradas'}))
  .toContainText('Jogos diferentes: 1');
 await expect(group.getByRole('list',{name:'Direções das exigências declaradas'}))
  .toContainText('Mais restritivas: 0');
 await expect(group).toContainText('Direção: Jogos diferentes: requisitos não comparáveis');
 await expect(group).toContainText('dependência declarada também pode mudar de simulador');
 await expect(consent.getByRole('note',{name:'Alerta de IDs reutilizados entre jogos'}))
  .toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
