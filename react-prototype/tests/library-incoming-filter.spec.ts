import {test,expect,type Page} from '@playwright/test';
const mods=[
 {id:'base',title:'Pacote Base',game:'omsi',category:'Ônibus',version:'1',size:'10 MB',description:'Exemplo'},
 {id:'audio',title:'Pacote Som',game:'omsi',category:'Sons',version:'1',size:'20 MB',description:'Exemplo',requires:['base']},
 {id:'empty',title:'Sem Declaração',game:'omsi',category:'Sons',version:'1',size:'30 MB',description:'Exemplo'},
 {id:'cross',title:'Referência Externa',game:'ets2',category:'Sons',version:'1',size:'40 MB',description:'Exemplo',conflictsWith:['empty']}
];
const favorites=['Pacote Base','Pacote Som','Sem Declaração'];
const titles=(p:Page)=>p.locator('.mod-grid .mod-card .text-button').allTextContents();
const group=(p:Page)=>p.getByRole('group',{name:'Filtrar por referências recebidas'});
async function setup(p:Page){
 await p.goto('/');
 const nav=p.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await p.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'synthetic-incoming.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
 for(const name of favorites){
  await p.locator('.mod-card').filter({has:p.getByRole('button',{name,exact:true})})
   .getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 return nav;
}
test('with/without incoming declarations are reversible, count nonfavorites and work at 390px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await setup(page);
 await expect(group(page)).toContainText('3 favoritos: 2 mencionado(s) e 1 sem referências');
 const withRefs=group(page).getByRole('button',{name:'Só favoritos com referências recebidas'});
 const without=group(page).getByRole('button',{name:'Só favoritos sem referências recebidas'});
 await withRefs.focus();await page.keyboard.press('Enter');
 await expect(withRefs).toHaveAttribute('aria-pressed','true');
 expect(await titles(page)).toEqual(['Pacote Base','Sem Declaração']);
 await expect(page.getByRole('button',{name:'Limpar filtros da biblioteca'})).toHaveText('Limpar filtros (1)');
 await without.click();
 await expect(withRefs).toHaveAttribute('aria-pressed','false');
 expect(await titles(page)).toEqual(['Pacote Som']);
 const chip=page.getByRole('group',{name:'Filtros ativos da biblioteca'});
 await expect(chip).toContainText('Referências recebidas: sem referências');
 await chip.getByRole('button',{name:'Remover filtro de referências recebidas'}).click();
 expect(await titles(page)).toEqual(favorites);
 const over=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(over).toBeLessThanOrEqual(3);
});
test('filter joins other filters and Details stay read-only',async({page})=>{
 await setup(page);
 await group(page).getByRole('button',{name:'Só favoritos com referências recebidas'}).click();
 await page.getByRole('combobox',{name:'Ordenar biblioteca'}).selectOption('incoming');
 expect(await titles(page)).toEqual(['Pacote Base','Sem Declaração']);
 await page.getByRole('combobox',{name:'Filtrar categoria na biblioteca'}).selectOption('Sons');
 expect(await titles(page)).toEqual(['Sem Declaração']);
 await page.getByRole('button',{name:'Sem Declaração',exact:true}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 expect(await titles(page)).toEqual(favorites);
});
test('new isolated catalog resets incoming filter and disables unavailable filter choice',async({page})=>{
 await setup(page);
 await group(page).getByRole('button',{name:'Só favoritos sem referências recebidas'}).click();
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'single-record.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods:[{
   id:'one',title:'Registro Único',game:'omsi',category:'Ônibus',
   version:'1',size:'1 MB',description:'Exemplo sem referências'
  }]}))
 });
 await page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Registro Único',exact:true})})
  .getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(group(page)).toContainText('1 favorito: 0 mencionado(s) e 1 sem referências');
 await expect(group(page).getByRole('button',{name:'Só favoritos com referências recebidas'})).toBeDisabled();
 await expect(group(page).getByRole('button',{name:'Só favoritos mencionados por outro simulador'})).toBeDisabled();
 await expect(group(page).getByRole('button',{name:'Só favoritos sem referências recebidas'})).toHaveAttribute('aria-pressed','false');
 await expect(page.getByRole('button',{name:'Limpar filtros da biblioteca'})).toHaveCount(0);
 expect(await titles(page)).toEqual(['Registro Único']);
});

test('cross-simulator incoming mentions remain metadata-only, reversible and responsive',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await setup(page);
 await expect(group(page)).toContainText('1 com menção de outro simulador');
 const crossCard=page.locator('.mod-card').filter({
  has:page.getByRole('button',{name:'Sem Declaração',exact:true})
 });
 await expect(crossCard.locator('.library-cross-game-warning'))
  .toContainText('1 referência(s) de outro simulador no JSON.');
 await expect(crossCard.locator('.library-cross-game-warning'))
  .toContainText('Origem declarada: Euro Truck Simulator 2 (0 dependência(s), 1 conflito(s))');
 await expect(crossCard.locator('.library-cross-game-warning'))
  .toContainText('Não comprova conversão nem compatibilidade.');
 const sameGameCard=page.locator('.mod-card').filter({
  has:page.getByRole('button',{name:'Pacote Base',exact:true})
 });
 await expect(sameGameCard.locator('.library-cross-game-warning')).toHaveCount(0);
 const cross=group(page).getByRole('button',{name:'Só favoritos mencionados por outro simulador'});
 await cross.focus();
 await page.keyboard.press('Enter');
 await expect(cross).toHaveAttribute('aria-pressed','true');
 // The declaration comes from an ETS2 record not in favorites, targeting OMSI.
 expect(await titles(page)).toEqual(['Sem Declaração']);
 const chip=page.getByRole('group',{name:'Filtros ativos da biblioteca'});
 await expect(chip).toContainText('Referências recebidas: de outro simulador');
 await page.getByRole('button',{name:'Consultar referências recebidas de Sem Declaração'}).click();
 await expect(page.getByRole('region',{name:'Referências recebidas no catálogo'}))
  .toContainText('Referência entre jogos diferentes · somente JSON');
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(cross).toHaveAttribute('aria-pressed','true');
 await chip.getByRole('button',{name:'Remover filtro de referências recebidas'}).click();
 expect(await titles(page)).toEqual(favorites);
 const over=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(over).toBeLessThanOrEqual(3);
});
