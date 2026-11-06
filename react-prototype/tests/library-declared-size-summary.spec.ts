import {test,expect,type Page} from '@playwright/test';
import {summarizeDeclaredSizes} from '../src/declared-size-summary';

test('subtotal converte unidades, isola desconhecidos e não transborda o inteiro seguro',()=>{
 expect(summarizeDeclaredSizes([
  {size:'1,5 GB'},{size:'1024 MB'},{size:'900 KiB'},{size:'n/a'}
 ])).toEqual({known:3,unknown:1,subtotal:'≈ 2,52 GB'});
 expect(summarizeDeclaredSizes([{size:'n/a'}])).toEqual({known:0,unknown:1,subtotal:'0 B'});
 expect(summarizeDeclaredSizes([])).toEqual({known:0,unknown:0,subtotal:'0 B'});
 expect(summarizeDeclaredSizes([{size:'0 B'}])).toEqual({known:1,unknown:0,subtotal:'0 B'});
 expect(summarizeDeclaredSizes([{size:'9000000 GB'},{size:'9000000 GB'}]))
  .toEqual({known:2,unknown:0,subtotal:'≈ 18.000 TB'});
});
const mods=[
 {id:'one',title:'Grande Declarado',game:'omsi',category:'Ônibus',version:'1',description:'Fictício.',size:'1,5 GB'},
 {id:'unknown',title:'Tamanho Incerto',game:'omsi',category:'Ônibus',version:'1',description:'Fictício.',size:'n/a'},
 {id:'two',title:'Médio Declarado',game:'ets2',category:'Caminhões',version:'1',description:'Fictício.',size:'1024 MB'}
];
async function setup(page:Page){
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'subtotal-ficticio.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
 await expect(page.getByText('Origem: Importado: subtotal-ficticio.json')).toBeVisible();
 for(const mod of mods){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:mod.title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 return page.getByRole('note',{name:'Resumo dos tamanhos declarados dos favoritos exibidos'});
}
test('totais seguem filtros e não mudam com a ordem; instalação permanece bloqueada',async({page})=>{
 const s=await setup(page);
 await expect(s).toContainText('Subtotal declarado dos exibidos: ≈ 2,52 GB');
 await expect(s).toContainText('2 de 3 com tamanho interpretável.');
 await expect(s).toContainText('1 tamanho(s) desconhecido(s) não somado(s).');
 await expect(s).toContainText('não é espaço ocupado no disco');
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('omsi');
 await expect(s).toContainText('Subtotal declarado dos exibidos: ≈ 1,5 GB');
 await expect(s).toContainText('1 de 2 com tamanho interpretável.');
 await page.getByRole('combobox',{name:'Ordenar biblioteca'}).selectOption('size-desc');
 await expect(s).toContainText('Subtotal declarado dos exibidos: ≈ 1,5 GB');
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('all');
 await expect(s).toContainText('Subtotal declarado dos exibidos: ≈ 2,52 GB');
 await page.getByRole('button',{name:'Grande Declarado',exact:true}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});
test('zero reconhecidos e viewport 390px não alegam ocupação nem geram overflow',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 const s=await setup(page);
 await page.getByRole('textbox',{name:'Buscar favoritos'}).fill('Tamanho Incerto');
 await expect(s).toContainText('Nenhum tamanho reconhecido nos favoritos exibidos');
 await expect(s).toContainText('0 de 1 com tamanho interpretável.');
 await page.getByRole('textbox',{name:'Buscar favoritos'}).fill('inexistente');
 await expect(s).toContainText('0 de 0 com tamanho interpretável.');
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(s).toContainText('Subtotal declarado dos exibidos: ≈ 2,52 GB');
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
