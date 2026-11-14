import {test,expect,type Page} from '@playwright/test';

const mods=[
 {id:'bus',title:'Ônibus de Teste',game:'omsi',category:'Ônibus',version:'1',
  description:'Exemplo fictício.',size:'1 GiB'},
 {id:'map',title:'Mapa de Teste',game:'omsi',category:'Mapas',version:'1',
  description:'Exemplo fictício.',size:'desconhecido'},
 {id:'truck',title:'Caminhão de Teste',game:'ets2',category:'Caminhões',version:'1',
  description:'Exemplo fictício.',size:'500 MB'},
 {id:'other',title:'Motor de Teste',game:'ats',category:'Sons',version:'1',
  description:'Exemplo fictício.',size:'0 B'}
];
async function prepare(page:Page){
 await page.goto('/');
 const navigation=page.getByRole('navigation',{name:'Navegação principal'});
 await navigation.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'resumo-por-simulador.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
 await expect(page.getByText('Origem: Importado: resumo-por-simulador.json')).toBeVisible();
 for(const mod of mods){
  const card=page.locator('.mod-card').filter({
   has:page.getByRole('button',{name:mod.title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await navigation.getByRole('button',{name:'Minha biblioteca'}).click();
 return page.getByRole('region',{name:'Resumo de favoritos por simulador'});
}
test('resumo mostra jogos com favoritos e separa contagens de metadados conhecidos',async({page})=>{
 const region=await prepare(page);
 const om=region.getByRole('button',{name:'Filtrar favoritos de OMSI 2'});
 await expect(om).toContainText('2 favoritos');
 await expect(om).toContainText('≈ 1,07 GB');
 await expect(om).toContainText('1 tamanho(s) desconhecido(s)');
 await expect(region.getByRole('button',{name:'Filtrar favoritos de Euro Truck Simulator 2'}))
  .toContainText('500 MB');
 await expect(region.getByRole('button',{name:'Filtrar favoritos de American Truck Simulator'}))
  .toContainText('0 B');
 await expect(region).toContainText('Tamanhos apenas declarados');
 await expect(page.getByText('4 favoritos exibidos')).toBeVisible();
});
test('atalhos de simulador filtram e alternam sem perder seleção de análise',async({page})=>{
 const region=await prepare(page);
 const om=region.getByRole('button',{name:'Filtrar favoritos de OMSI 2'});
 const ets=region.getByRole('button',{name:'Filtrar favoritos de Euro Truck Simulator 2'});
 await page.getByRole('checkbox',{name:'Selecionar Ônibus de Teste para análise conjunta'}).check();
 await om.click();
 await expect(om).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toHaveValue('omsi');
 await expect(page.getByText('2 favoritos exibidos')).toBeVisible();
 await expect(page.getByText('1 selecionado(s)')).toBeVisible();
 await ets.click();
 await expect(om).toHaveAttribute('aria-pressed','false');
 await expect(ets).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await expect(page.getByText(/1 fora dos filtros atuais/)).toBeVisible();
 await ets.click();
 await expect(ets).toHaveAttribute('aria-pressed','false');
 await expect(page.getByText('4 favoritos exibidos')).toBeVisible();
 await expect(page.getByRole('checkbox',{name:'Selecionar Ônibus de Teste para análise conjunta'})).toBeChecked();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toHaveCount(0);
});
test('resumo permanece acessível pelo teclado e sem overflow a 390px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 const region=await prepare(page);
 const om=region.getByRole('button',{name:'Filtrar favoritos de OMSI 2'});
 await om.focus();
 await page.keyboard.press('Enter');
 await expect(om).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('2 favoritos exibidos')).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
