import {test,expect,type Page} from '@playwright/test';
import {matchesCatalogSearch} from '../src/catalog-search';
const mods=[
 {id:'torino_2014_turp',title:'Veículo Exemplo Azul',game:'omsi',
  category:'Ônibus',version:'2.7.13',description:'Somente uma ficha de teste.',size:'500 MB'},
 {id:'truck_beta_50',title:'Caminhão Exemplo Laranja',game:'ets2',
  category:'Caminhões',version:'1.99',description:'Somente uma ficha de teste.',size:'150 MB'},
 {id:'map_alpha',title:'Serra Exemplo',game:'omsi',
  category:'Mapas',version:'1.3.0',description:'Somente uma ficha de teste.',size:'100 MB'}
];
async function imported(page:Page){
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'ids-versoes-declarados.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
 await expect(page.getByText('Origem: Importado: ids-versoes-declarados.json')).toBeVisible();
 return nav;
}
test('busca normalizada encontra ID e versão do catálogo sem acessar pacotes',async({page})=>{
 expect(matchesCatalogSearch(mods[0],'OMSI 2','TORINO 2014')).toBe(true);
 expect(matchesCatalogSearch(mods[0],'OMSI 2','2.7.13')).toBe(true);
 expect(matchesCatalogSearch(mods[1],'Euro Truck Simulator 2','2.7.13')).toBe(false);
 expect(matchesCatalogSearch({title:'Mínimo',category:'Sons'},'OMSI 2','minimo sons')).toBe(true);
 await imported(page);
 const query=page.getByRole('textbox',{name:'Buscar mods'});
 await query.fill('TORINO 2014');
 await expect(page.getByText('1 resultado')).toBeVisible();
 await expect(page.getByRole('button',{name:'Veículo Exemplo Azul',exact:true})).toBeVisible();
 await query.fill('omsi 2.7.13');
 await expect(page.getByText('1 resultado')).toBeVisible();
 await expect(page.getByRole('button',{name:'Veículo Exemplo Azul',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Serra Exemplo',exact:true})).toHaveCount(0);
});
test('Detalhes exibe ID do JSON sem tratá-lo como instalador ou compatibilidade comprovada',async({page})=>{
 await imported(page);
 await page.getByRole('button',{name:'Veículo Exemplo Azul',exact:true}).click();
 const properties=page.locator('.properties');
 await expect(properties).toContainText('ID declarado no catálogo');
 await expect(properties.getByText('torino_2014_turp',{exact:true})).toBeVisible();
 await expect(properties.getByText('2.7.13',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 await expect(page.getByText('Compatibilidade não verificada',{exact:false}).first()).toBeVisible();
 await page.getByRole('navigation',{name:'Navegar pelos mods da lista atual'})
  .getByRole('button',{name:'Próximo mod: Caminhão Exemplo Laranja'}).click();
 await expect(properties.getByText('truck_beta_50',{exact:true})).toBeVisible();
});
test('Biblioteca encontra o mesmo ID com favoritos e filtros preservados a 390px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 const nav=await imported(page);
 for(const mod of mods){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:mod.title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const query=page.getByRole('textbox',{name:'Buscar favoritos'});
 await query.fill('truck_beta');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await expect(page.getByRole('button',{name:'Caminhão Exemplo Laranja',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Caminhão Exemplo Laranja',exact:true}).click();
 await expect(page.locator('.properties').getByText('truck_beta_50',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(query).toHaveValue('truck_beta');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
