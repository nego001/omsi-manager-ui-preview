import {test,expect,type Page} from '@playwright/test';
import {declaredSizeBytes,compareModsByDeclaredSize} from '../src/declared-size-sort';

test('unidades decimais, binárias e vírgula são comparáveis; entradas incertas não viram zero',()=>{
 expect(declaredSizeBytes('1,2 GB')).toBe(1_200_000_000);
 expect(declaredSizeBytes('1.2 GB')).toBe(1_200_000_000);
 expect(declaredSizeBytes('1024 MB')).toBe(1_024_000_000);
 expect(declaredSizeBytes('1 GiB')).toBe(1_073_741_824);
 expect(declaredSizeBytes('900 KiB')).toBe(921_600);
 expect(declaredSizeBytes('0 B')).toBe(0);
 for(const size of ['desconhecido','1 GB extra','1e3 MB','-1 MB',
  '10PB','1.2.3 GB','1,000,5 GB','999999999 TB','01 MB','', 'Infinity GB']){
  expect(declaredSizeBytes(size)).toBeNull();
 }
 const a={id:'a',title:'Alfa',size:'1 GB'};
 const b={id:'b',title:'Beta',size:'1024 MB'};
 const unknown={id:'u',title:'Desconhecido',size:'desconhecido'};
 expect(compareModsByDeclaredSize(a,b,'asc')).toBeLessThan(0);
 expect(compareModsByDeclaredSize(a,b,'desc')).toBeGreaterThan(0);
 expect(compareModsByDeclaredSize(unknown,a,'desc')).toBeGreaterThan(0);
 expect(compareModsByDeclaredSize(unknown,a,'asc')).toBeGreaterThan(0);
 expect(compareModsByDeclaredSize(a,{...a,id:'z'},'desc')).toBeLessThan(0);
});

const fixture={schemaVersion:1,mods:[
 {id:'big',title:'Zeta Grande',game:'omsi',category:'Ônibus',version:'1',
  description:'Metadados fictícios.',size:'1,5 GB'},
 {id:'mid',title:'Beta Médio',game:'omsi',category:'Ônibus',version:'1',
  description:'Metadados fictícios.',size:'1024 MB'},
 {id:'small',title:'Alfa Pequeno',game:'omsi',category:'Ônibus',version:'1',
  description:'Metadados fictícios.',size:'900 KiB'},
 {id:'unknown',title:'Omega Desconhecido',game:'omsi',category:'Ônibus',version:'1',
  description:'Metadados fictícios.',size:'n/a'}
]};
const initial=['Zeta Grande','Beta Médio','Alfa Pequeno','Omega Desconhecido'];
async function prepare(page:Page){
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'declared-size-only.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(fixture))
 });
 await expect(page.getByText('Origem: Importado: declared-size-only.json')).toBeVisible();
 for(const title of initial){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByText('4 favoritos exibidos')).toBeVisible();
 return page.getByRole('combobox',{name:'Ordenar biblioteca'});
}
const displayed=(page:Page)=>page.locator('.mod-grid .mod-card .text-button').allTextContents();

test('biblioteca classifica tamanho declarado sem alegar uso real de disco e recupera a ordem',async({page})=>{
 const sort=await prepare(page);
 expect(await displayed(page)).toEqual(initial);
 await sort.selectOption('size-desc');
 expect(await displayed(page)).toEqual(['Zeta Grande','Beta Médio','Alfa Pequeno','Omega Desconhecido']);
 const note=page.locator('.library-size-sort-note');
 await expect(note).toContainText('não em espaço ocupado no disco');
 await expect(note).toContainText('Unidades desconhecidas ficam por último');
 const chips=page.getByRole('group',{name:'Filtros ativos da biblioteca'});
 await expect(chips).toContainText('Tamanho declarado (maior primeiro)');
 await sort.selectOption('size-asc');
 expect(await displayed(page)).toEqual(['Alfa Pequeno','Beta Médio','Zeta Grande','Omega Desconhecido']);
 await expect(chips).toContainText('Tamanho declarado (menor primeiro)');
 await chips.getByRole('button',{name:'Remover filtro de ordenação'}).click();
 await expect(sort).toHaveValue('catalog');
 expect(await displayed(page)).toEqual(initial);
 await expect(note).toHaveCount(0);
 await expect(page.getByText('4 favoritos exibidos')).toBeVisible();
});

test('Detalhes seguem ordenação por tamanho declarado, sem liberar instalação',async({page})=>{
 const sort=await prepare(page);
 await sort.selectOption('size-asc');
 await page.getByRole('button',{name:'Alfa Pequeno',exact:true}).click();
 const nav=page.getByRole('navigation',{name:'Navegar pelos mods da lista atual'});
 await expect(nav).toContainText('1 de 4 · Biblioteca');
 await nav.getByRole('button',{name:'Próximo mod: Beta Médio'}).click();
 await expect(page.getByRole('heading',{name:'Beta Médio',exact:true})).toBeFocused();
 await nav.getByRole('button',{name:'Próximo mod: Zeta Grande'}).click();
 await expect(page.getByRole('heading',{name:'Zeta Grande',exact:true})).toBeFocused();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(sort).toHaveValue('size-asc');
 await expect(page.getByRole('button',{name:'Zeta Grande',exact:true})).toBeFocused();
});

test('no celular, ordenar/limpar não perde favoritos nem cria overflow',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 const sort=await prepare(page);
 await sort.selectOption('size-desc');
 await expect(page.locator('.library-size-sort-note')).toBeVisible();
 await expect(page.getByRole('button',{name:'Limpar filtros da biblioteca'})).toHaveText('Limpar filtros (1)');
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(sort).toHaveValue('catalog');
 expect(await displayed(page)).toEqual(initial);
 await expect(page.getByText('4 favoritos exibidos')).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
