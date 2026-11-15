import {test,expect,type Page} from '@playwright/test';
import {declaredSearchMatchFields} from '../src/catalog-search';
const mods=[
 {id:'torino_2014_turp',title:'Veículo Exemplo Azul',game:'omsi',
  category:'Ônibus',version:'2.7.13',description:'Somente uma ficha de teste.',size:'500 MB'},
 {id:'truck_beta_50',title:'Caminhão Exemplo Laranja',game:'ets2',
  category:'Caminhões',version:'1.99',description:'Somente uma ficha de teste.',size:'150 MB'},
 {id:'map_alpha',title:'Serra Exemplo',game:'omsi',
  category:'Mapas',version:'1.3.0',description:'Somente uma ficha de teste.',size:'100 MB'}
] as const;
const note=(page:Page)=>page.getByRole('note',{name:'Campos declarados que coincidem com a busca'});
async function setup(page:Page){
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'pesquisa-id-versao.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
 await expect(page.getByText('Origem: Importado: pesquisa-id-versao.json')).toBeVisible();
 return nav;
}
test('campos declarados da busca identificam ID e versão sem alegar compatibilidade',async({page})=>{
 expect(declaredSearchMatchFields(mods[0],'  TORINO 2.7.13 ')).toEqual({id:true,version:true});
 expect(declaredSearchMatchFields(mods[0],'   ')).toEqual({id:false,version:false});
 expect(declaredSearchMatchFields(mods[0],'onibus')).toEqual({id:false,version:false});
 const nav=await setup(page);
 const search=page.getByRole('textbox',{name:'Buscar mods'});
 await expect(note(page)).toHaveCount(0);
 await search.fill('TORINO 2014');
 await expect(page.getByText('1 resultado')).toBeVisible();
 await expect(note(page)).toContainText('ID declarado: torino_2014_turp');
 await expect(note(page)).not.toContainText('Versão declarada:');
 await search.fill('2.7.13');
 await expect(note(page)).toContainText('Versão declarada: 2.7.13');
 await expect(note(page)).not.toContainText('ID declarado:');
 await search.fill('torino_2014 2.7.13');
 await expect(note(page)).toContainText('ID declarado: torino_2014_turp');
 await expect(note(page)).toContainText('Versão declarada: 2.7.13');
 await search.fill('veiculo azul');
 await expect(page.getByText('1 resultado')).toBeVisible();
 await expect(note(page)).toHaveCount(0);
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(note(page)).toHaveCount(0);
});
test('Biblioteca mantém identificação e filtros sem perder favoritos ou seleções',async({page})=>{
 const nav=await setup(page);
 for(const mod of mods){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:mod.title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const search=page.getByRole('textbox',{name:'Buscar favoritos'});
 await search.fill('truck_beta');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await expect(note(page)).toContainText('ID declarado: truck_beta_50');
 await page.getByRole('checkbox',{name:'Selecionar Caminhão Exemplo Laranja para análise conjunta'}).check();
 await page.getByRole('button',{name:'Caminhão Exemplo Laranja',exact:true}).click();
 await expect(page.locator('.properties').getByText('truck_beta_50',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(search).toHaveValue('truck_beta');
 await expect(note(page)).toContainText('ID declarado: truck_beta_50');
 await expect(page.getByRole('checkbox',{name:'Selecionar Caminhão Exemplo Laranja para análise conjunta'})).toBeChecked();
 await search.fill('');
 await expect(note(page)).toHaveCount(0);
 await expect(page.getByText('3 favoritos exibidos')).toBeVisible();
});
test('busca longa com identificador no cartão não gera overflow no celular',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await setup(page);
 await page.getByRole('textbox',{name:'Buscar mods'}).fill('torino_2014_turp');
 await expect(note(page)).toContainText('torino_2014_turp');
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
 await page.getByRole('button',{name:'Veículo Exemplo Azul',exact:true}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});
