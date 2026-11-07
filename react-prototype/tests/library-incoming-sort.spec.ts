import {test,expect,type Page} from '@playwright/test';

// Metadata only, all examples are fictional; no installed files are scanned.
const fixture={schemaVersion:1,mods:[
 {id:'alfa',title:'Alfa Apoio',game:'omsi',category:'Ônibus',version:'1',size:'1 MB',
  description:'Exemplo',requires:['base','second']},
 {id:'base',title:'Zeta Base',game:'omsi',category:'Ônibus',version:'1',size:'2 MB',
  description:'Exemplo'},
 {id:'second',title:'Beta Secundário',game:'omsi',category:'Sons',version:'1',size:'3 MB',
  description:'Exemplo'},
 {id:'conflict',title:'Conflito Externo',game:'omsi',category:'Sons',version:'1',size:'4 MB',
  description:'Exemplo',conflictsWith:['base']},
 {id:'beta',title:'Beta Apoio',game:'omsi',category:'Gráficos',version:'1',size:'5 MB',
  description:'Exemplo',requires:['base']}
]};
const favorites=['Alfa Apoio','Zeta Base','Beta Secundário','Conflito Externo'];
const ranked=['Zeta Base','Beta Secundário','Alfa Apoio','Conflito Externo'];
const cards=(page:Page)=>page.locator('.mod-grid .mod-card .text-button').allTextContents();
async function setup(page:Page){
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'incoming-sort.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(fixture))
 });
 for(const title of favorites){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 return page.getByRole('combobox',{name:'Ordenar biblioteca'});
}
test('incoming sort counts nonfavorite references, and chip restores catalog order in 390px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 const sort=await setup(page);
 expect(await cards(page)).toEqual(favorites);
 await sort.selectOption('incoming');
 expect(await cards(page)).toEqual(ranked);
 await expect(page.locator('.library-incoming-sort-note')).toContainText('mesmo quando o registro que cita não é favorito');
 await expect(page.locator('.library-incoming-sort-note')).toContainText('Não mede popularidade, instalação, qualidade nem compatibilidade real');
 const chips=page.getByRole('group',{name:'Filtros ativos da biblioteca'});
 await expect(chips).toContainText('Ordem: Referências recebidas no JSON');
 await chips.getByRole('button',{name:'Remover filtro de ordenação'}).click();
 await expect(sort).toHaveValue('catalog');
 expect(await cards(page)).toEqual(favorites);
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('sort stays consistent with filters and Details navigation, no installation',async({page})=>{
 const sort=await setup(page);
 await sort.selectOption('incoming');
 const category=page.getByRole('combobox',{name:'Filtrar categoria na biblioteca'});
 await category.selectOption('Sons');
 expect(await cards(page)).toEqual(['Beta Secundário','Conflito Externo']);
 await category.selectOption('Todos');
 expect(await cards(page)).toEqual(ranked);
 await page.getByRole('button',{name:'Zeta Base',exact:true}).click();
 const neighbors=page.getByRole('navigation',{name:'Navegar pelos mods da lista atual'});
 await expect(neighbors).toContainText('1 de 4 · Biblioteca');
 await neighbors.getByRole('button',{name:'Próximo mod: Beta Secundário'}).click();
 await expect(page.getByRole('heading',{name:'Beta Secundário',exact:true})).toBeFocused();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(sort).toHaveValue('incoming');
 expect(await cards(page)).toEqual(ranked);
});
test('sort and search reset without losing favorites or changing real status',async({page})=>{
 const sort=await setup(page);
 await sort.selectOption('incoming');
 await page.getByRole('textbox',{name:'Buscar favoritos'}).fill('apoio');
 expect(await cards(page)).toEqual(['Alfa Apoio']);
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(sort).toHaveValue('catalog');
 expect(await cards(page)).toEqual(favorites);
 await expect(page.getByText('4 favoritos exibidos')).toBeVisible();
 await expect(page.getByText('Arquivos dos mods não inspecionados. Status real desconhecido.')).toBeVisible();
});
