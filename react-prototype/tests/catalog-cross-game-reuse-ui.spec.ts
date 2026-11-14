import {test,expect} from '@playwright/test';
type Page=import('@playwright/test').Page;
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const bus={id:'omsi-bus',title:'Ônibus Urbano Clássico',game:'omsi',category:'Ônibus',
 version:'1.0',description:'Veículo fictício usado apenas para validar o catálogo e os estados da interface.',size:'240 MB'};
async function propose(page:Page,mods:object[],filename:string){
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:filename,mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
}
test('ID cruzado OMSI/ETS2 sinaliza mudança sem mover favorito e seleção a 390 px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await propose(page,[{...bus,game:'ets2',category:'Caminhões',title:'Caminhão novo'}],
  'cross-game.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const warning=consent.getByRole('note',{name:'Alerta de IDs reutilizados entre jogos'});
 await expect(warning).toBeVisible();
 await expect(warning).toContainText('IDs reaproveitados entre jogos: 1');
 await expect(warning).toContainText('OMSI 2');
 await expect(warning).toContainText('Euro Truck Simulator 2');
 await expect(warning).toContainText('omsi-bus');
 await expect(warning).toContainText('Favorito atual');
 await expect(warning).toContainText('Na seleção ativa');
 await expect(warning).toContainText('não comprova identidade');
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(warning).toHaveCount(0);
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'})).toBeChecked();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('segunda proposta elimina alerta antigo e exige nova confirmação',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,game:'ats',category:'Caminhões'}],'first.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const warning=consent.getByRole('note',{name:'Alerta de IDs reutilizados entre jogos'});
 await expect(warning).toContainText('American Truck Simulator');
 await propose(page,[{...bus,version:'2.0'}],'second.json');
 const diff=consent.getByRole('group',{name:'Comparação declarativa entre catálogos'});
 await expect(diff).toContainText('ID mantido com metadados alterados: 1');
 await expect(diff).toContainText('versão');
 await expect(warning).toHaveCount(0);
 await expect(card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
