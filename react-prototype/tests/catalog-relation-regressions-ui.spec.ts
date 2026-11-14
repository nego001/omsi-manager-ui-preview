import {test,expect} from '@playwright/test';
type Page=import('@playwright/test').Page;
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const bus={id:'omsi-bus',title:'Ônibus Urbano Clássico',game:'omsi',category:'Ônibus',
 version:'1.0',description:'Veículo fictício usado apenas para validar o catálogo e os estados da interface.',size:'240 MB'};
const map={id:'omsi-map',title:'Serra do Vale',game:'omsi',category:'Mapas',
 version:'0.9',description:'Mapa de demonstração. Nenhum arquivo real do jogo é acessado.',size:'1,2 GB'};
async function propose(page:Page,mods:object[],name:string){
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name,mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
}
test('mostra novos bloqueios de dependências declaradas sem alterar favoritos a 390px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,requires:['id-inexistente']},map,
  {id:'pacote-novo',title:'Outro pacote',game:'omsi',category:'Sons',
   version:'1.0',description:'Somente metadados',size:'1 MB',
   requires:['dependencia-ausente']}],'com-bloqueios.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const details=consent.locator('details.catalog-relation-regressions');
 await expect(details).toBeVisible();
 await expect(details.locator('summary')).toContainText('Ver mudanças nos bloqueios declarados (2)');
 await expect(details).not.toHaveAttribute('open','');
 await details.locator('summary').click();
 const impact=consent.getByRole('group',{name:'Mudanças de bloqueios declarados'});
 await expect(impact).toContainText('Novos bloqueios em IDs mantidos: 1');
 await expect(impact).toContainText('Registros novos com bloqueios: 1');
 await expect(impact).toContainText('Ônibus Urbano Clássico');
 await expect(impact).toContainText('Outro pacote');
 await expect(impact).toContainText('Favorito atual');
 await expect(impact).toContainText('nenhum arquivo instalado');
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(details).toHaveCount(0);
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('trocar proposta para dependências resolvidas remove alerta anterior',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,requires:['ausente']}],'primeira.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const details=consent.locator('details.catalog-relation-regressions');
 await expect(details).toBeVisible();
 await propose(page,[bus,map],'segunda.json');
 await expect(consent.getByRole('group',{name:'Comparação declarativa entre catálogos'}))
  .toContainText('ID mantido com metadados alterados: 0');
 await expect(details).toHaveCount(0);
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});

test('mostra troca do tipo de bloqueio sem aumento da quantidade, apenas metadados',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 const engine={id:'engine',title:'Motor declarado',game:'omsi',category:'Sons',
  version:'1.0',description:'Registro demonstrativo',size:'1 MB'};
 // First import is allowed without prior session-bound data. It declares
 // one existing missing-dependency blocker for the bus.
 await propose(page,[{...bus,requires:['missing']},engine],'base.json');
 await expect(card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'})).toBeVisible();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 // New proposal keeps one blocker, but changes the type to different-game.
 await propose(page,[{...bus,requires:['engine']},{...engine,game:'ets2'}],'mudanca.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const details=consent.locator('details.catalog-relation-regressions');
 await expect(details.locator('summary')).toContainText('Ver mudanças nos bloqueios declarados (1)');
 await details.locator('summary').click();
 const group=consent.getByRole('group',{name:'Mudanças de bloqueios declarados'});
 await expect(group).toContainText('Tipos de bloqueio alterados, sem aumento: 1');
 await expect(group).toContainText('IDs mantidos com tipos de bloqueio diferentes');
 await expect(group).toContainText('Bloqueios antes: 1 · Na proposta: 1');
 await expect(group).toContainText('Motivos anteriores: Dependência declarada ausente');
 await expect(group).toContainText('Motivos na proposta: Dependência declarada de outro simulador');
 await expect(group).toContainText('Favorito atual');
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('queda de dois para um bloqueio não esconde um novo tipo de dependência',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 const engine={id:'engine',title:'Motor declarado',game:'omsi',category:'Sons',
  version:'1.0',description:'Registro demonstrativo',size:'1 MB'};
 // Import without local session data becomes the active baseline.
 await propose(page,[{...bus,requires:['missing_a','missing_b']},engine],'base.json');
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,requires:['engine']},{...engine,game:'ets2'}],'proposta.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const details=consent.locator('details.catalog-relation-regressions');
 await expect(details.locator('summary')).toContainText('Ver mudanças nos bloqueios declarados (1)');
 await details.locator('summary').click();
 const impact=consent.getByRole('group',{name:'Mudanças de bloqueios declarados'});
 await expect(impact).toContainText('Tipos de bloqueio alterados, sem aumento: 1');
 await expect(impact).toContainText('Bloqueios antes: 2 · Na proposta: 1');
 await expect(impact).toContainText('Dependência declarada de outro simulador');
 await expect(impact).toContainText('Uma redução numérica');
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
