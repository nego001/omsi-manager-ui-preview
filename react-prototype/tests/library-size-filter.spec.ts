import {test,expect,type Page} from '@playwright/test';
import {declaredSizeBytes} from '../src/declared-size-sort';
const mods=[
 {id:'zero',title:'Tamanho Zero Conhecido',game:'omsi',category:'Ônibus',version:'1',description:'Fictício.',size:'0 B'},
 {id:'bus',title:'Ônibus do Catálogo',game:'omsi',category:'Ônibus',version:'1',description:'Fictício.',size:'2 GiB'},
 {id:'unk',title:'Mapa Sem Tamanho',game:'omsi',category:'Mapas',version:'1',description:'Fictício.',size:'desconhecido'},
 {id:'truck',title:'Caminhão Tamanho Inválido',game:'ets2',category:'Caminhões',version:'1',description:'Fictício.',size:'1e3 MB'}
];
async function setup(page:Page){
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'filtros-de-tamanho.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
 await expect(page.getByText('Origem: Importado: filtros-de-tamanho.json')).toBeVisible();
 for(const mod of mods){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:mod.title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 return page.getByRole('group',{name:'Filtrar por tamanho declarado'});
}
test('desconhecido não equivale a 0 B; filtrar preserva favoritos e análise',async({page})=>{
 expect(declaredSizeBytes('0 B')).toBe(0);
 expect(declaredSizeBytes('desconhecido')).toBeNull();
 const quick=await setup(page);
 await expect(quick).toContainText('2 reconhecido(s) e 2 desconhecido(s)');
 await page.getByRole('checkbox',{name:'Selecionar Ônibus do Catálogo para análise conjunta'}).check();
 const unknown=quick.getByRole('button',{name:'Só tamanhos desconhecidos'});
 await unknown.click();
 await expect(unknown).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('2 favoritos exibidos')).toBeVisible();
 await expect(page.getByRole('button',{name:'Mapa Sem Tamanho',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Caminhão Tamanho Inválido',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Tamanho Zero Conhecido',exact:true})).toHaveCount(0);
 await expect(page.getByText(/1 fora dos filtros atuais/)).toBeVisible();
 const known=quick.getByRole('button',{name:'Só tamanhos reconhecidos'});
 await known.click();
 await expect(known).toHaveAttribute('aria-pressed','true');
 await expect(unknown).toHaveAttribute('aria-pressed','false');
 await expect(page.getByRole('button',{name:'Tamanho Zero Conhecido',exact:true})).toBeVisible();
 await expect(page.getByRole('checkbox',{name:'Selecionar Ônibus do Catálogo para análise conjunta'})).toBeChecked();
 await expect(page.getByRole('button',{name:'Limpar filtros da biblioteca'})).toHaveText('Limpar filtros (1)');
});
test('tamanho combina com jogo e ordenação e o chip remove apenas este filtro',async({page})=>{
 const quick=await setup(page);
 await quick.getByRole('button',{name:'Só tamanhos desconhecidos'}).click();
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('ets2');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await page.getByRole('combobox',{name:'Ordenar biblioteca'}).selectOption('size-desc');
 const chips=page.getByRole('group',{name:'Filtros ativos da biblioteca'});
 await expect(chips.getByRole('button')).toHaveCount(3);
 const sizeChip=chips.getByRole('button',{name:'Remover filtro de tamanho declarado'});
 await sizeChip.focus();
 await page.keyboard.press('Enter');
 await expect(quick.getByRole('button',{name:'Só tamanhos desconhecidos'})).toHaveAttribute('aria-pressed','false');
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toHaveValue('ets2');
 await expect(page.getByRole('combobox',{name:'Ordenar biblioteca'})).toHaveValue('size-desc');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await page.getByRole('button',{name:'Caminhão Tamanho Inválido',exact:true}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
test('filtro por teclado e limpar em 390px sem rolagem horizontal',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 const quick=await setup(page);
 const unknown=quick.getByRole('button',{name:'Só tamanhos desconhecidos'});
 await unknown.focus();
 await page.keyboard.press('Enter');
 await expect(unknown).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('2 favoritos exibidos')).toBeVisible();
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(unknown).toHaveAttribute('aria-pressed','false');
 await expect(page.getByText('4 favoritos exibidos')).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
