import {test,expect} from '@playwright/test';
type Page=import('@playwright/test').Page;
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const bus={id:'omsi-bus',title:'Ônibus Urbano Clássico',game:'omsi',category:'Ônibus',
 version:'1.0',description:'Veículo fictício usado apenas para validar o catálogo e os estados da interface.',size:'240 MB'};
const map={id:'omsi-map',title:'Serra do Vale',game:'omsi',category:'Mapas',
 version:'0.9',description:'Mapa de demonstração. Nenhum arquivo real do jogo é acessado.',size:'1,2 GB'};
const sound={id:'omsi-sound',title:'Pacote de Sons',game:'omsi',category:'Sons',
 version:'1.1',description:'Prévia de um pacote de áudio fictício para os cartões.',size:'96 MB'};
const propose=(page:Page,mods:object[],name='proposta.json')=>
 page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
test('favoritos alterados, iguais e excluídos têm impacto explícito a 390px sem apagar no cancelamento',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale','Pacote de Sons'])
  await card(page,title).getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,version:'8.0'},map]);
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const favorite=consent.getByRole('group',{name:'Impacto da proposta nos favoritos'});
 await expect(favorite).toContainText('Mesmo ID e dados iguais: 1');
 await expect(favorite).toContainText('Mesmo ID com dados alterados: 1');
 await expect(favorite).toContainText('Favoritos ausentes na proposta: 1');
 await expect(favorite).toContainText('Ônibus Urbano Clássico');
 await expect(favorite).toContainText('Serra do Vale');
 await expect(favorite).toContainText('Pacote de Sons');
 await expect(favorite).toContainText('versão');
 await expect(favorite).toContainText('Todos os 3 favoritos serão descartados');
 await expect(consent).toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(favorite).toHaveCount(0);
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale','Pacote de Sons'])
  await expect(card(page,title).getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('nova proposta e favoritos ao vivo recontam impacto sem reusar prévia antiga',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await card(page,'Serra do Vale').getByRole('button',{name:'Favoritar'}).click();
 await propose(page,[{...bus,version:'2.0'}],'first.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const impact=consent.getByRole('group',{name:'Impacto da proposta nos favoritos'});
 await expect(impact).toContainText('Mesmo ID com dados alterados: 1');
 await expect(impact).toContainText('Favoritos ausentes na proposta: 1');
 await propose(page,[bus,map],'second.json');
 await expect(impact).toContainText('Mesmo ID e dados iguais: 2');
 await expect(impact).toContainText('Mesmo ID com dados alterados: 0');
 await expect(impact).toContainText('Favoritos ausentes na proposta: 0');
 await card(page,'Serra do Vale').getByRole('button',{name:'Retirar dos favoritos'}).click();
 await expect(impact).toContainText('Mesmo ID e dados iguais: 1');
 await expect(impact).toContainText('Todos os 1 favoritos serão descartados');
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
