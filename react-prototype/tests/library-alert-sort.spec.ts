import {test,expect,type Page} from '@playwright/test';

// All records are fictitious catalog metadata: no file content or installations.
const sample={
 schemaVersion:1,
 mods:[
  {id:'clean',title:'Alfa Limpo',game:'omsi',category:'Ônibus',version:'1.0',description:'Sem relações declaradas.',size:'10 MB'},
  {id:'notice',title:'Beta Aviso',game:'omsi',category:'Ônibus',version:'1.0',description:'Alerta apenas declarativo.',size:'20 MB',conflictsWith:['absent-other']},
  {id:'block-z',title:'Zeta Bloqueio',game:'omsi',category:'Ônibus',version:'1.0',description:'Dependência não fornecida.',size:'30 MB',requires:['missing-z']},
  {id:'block-o',title:'Omega Bloqueio',game:'omsi',category:'Ônibus',version:'1.0',description:'Dependência não fornecida.',size:'40 MB',requires:['missing-o']}
 ]
};
const originals=['Alfa Limpo','Beta Aviso','Zeta Bloqueio','Omega Bloqueio'];
const priorities=['Omega Bloqueio','Zeta Bloqueio','Beta Aviso','Alfa Limpo'];
async function ready(page:Page){
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'metadata-only.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sample))
 });
 await expect(page.getByText('Origem: Importado: metadata-only.json')).toBeVisible();
 for(const title of originals){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByText('4 favoritos exibidos')).toBeVisible();
 return {nav,sort:page.getByRole('combobox',{name:'Ordenar biblioteca'})};
}
const shown=(page:Page)=>page.locator('.mod-grid .mod-card .text-button').allTextContents();

test('prioridade dos alertas é declarativa, estável e reversível com chips em 390 px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 const {sort}=await ready(page);
 expect(await shown(page)).toEqual(originals);
 await sort.selectOption('alerts');
 expect(await shown(page)).toEqual(priorities);
 await expect(page.locator('.mod-card .library-mod-status')).toHaveCount(4);
 expect(await page.locator('.mod-card .library-mod-status').allTextContents()).toEqual([
  'Bloqueios declarados · não verificado',
  'Bloqueios declarados · não verificado',
  'Avisos declarados · não verificado',
  'Sem alertas declarados · não verificado'
 ]);
 const chips=page.getByRole('group',{name:'Filtros ativos da biblioteca'});
 await expect(chips).toContainText('Ordem: Alertas declarados');
 await expect(page.getByRole('button',{name:'Limpar filtros da biblioteca'})).toContainText('(1)');
 await chips.getByRole('button',{name:'Remover filtro de ordenação'}).click();
 await expect(sort).toHaveValue('catalog');
 expect(await shown(page)).toEqual(originals);
 await sort.selectOption('alerts');
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(sort).toHaveValue('catalog');
 expect(await shown(page)).toEqual(originals);
 await expect(page.getByText('4 favoritos exibidos')).toBeVisible();
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('Detalhes percorre favoritos pela ordem de prioridade declarada, sem liberar instalação',async({page})=>{
 const {sort}=await ready(page);
 await sort.selectOption('alerts');
 await page.getByRole('button',{name:'Omega Bloqueio',exact:true}).click();
 const scope=page.getByRole('navigation',{name:'Navegar pelos mods da lista atual'});
 await expect(scope).toContainText('1 de 4 · Biblioteca');
 await scope.getByRole('button',{name:'Próximo mod: Zeta Bloqueio'}).click();
 await expect(page.getByRole('heading',{name:'Zeta Bloqueio',exact:true})).toBeFocused();
 await scope.getByRole('button',{name:'Próximo mod: Beta Aviso'}).click();
 await expect(page.getByRole('heading',{name:'Beta Aviso',exact:true})).toBeFocused();
 await scope.getByRole('button',{name:'Próximo mod: Alfa Limpo'}).click();
 await expect(scope).toContainText('4 de 4 · Biblioteca');
 await expect(scope.getByRole('button',{name:'Sem próximo mod'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(page.getByRole('button',{name:'Alfa Limpo',exact:true})).toBeFocused();
 expect(await shown(page)).toEqual(priorities);
 await expect(sort).toHaveValue('alerts');
 await expect(page.getByText('Arquivos dos mods não inspecionados. Status real desconhecido.')).toBeVisible();
});


test('resumo separa alertas de todos os favoritos dos resultados filtrados',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 const {sort}=await ready(page);
 const banner=page.locator('.library-declared-alerts');
 await expect(banner).toContainText('2 com bloqueios');
 await expect(banner).toContainText('1 com avisos no catálogo entre todos os 4 favoritos');
 await expect(banner.locator('.library-visible-alerts')).toHaveCount(0);
 const alerts=page.getByRole('combobox',{name:'Filtrar alertas declarados'});
 await alerts.selectOption('blocking');
 await expect(banner.locator('.library-visible-alerts')).toHaveText('Na visualização filtrada: bloqueios 2 · avisos 0.');
 await sort.selectOption('alerts');
 await expect(banner.locator('.library-visible-alerts')).toHaveText('Na visualização filtrada: bloqueios 2 · avisos 0.');
 await page.getByRole('textbox',{name:'Buscar favoritos'}).fill('omega');
 await expect(banner.locator('.library-visible-alerts')).toHaveText('Na visualização filtrada: bloqueios 1 · avisos 0.');
 await alerts.selectOption('attention');
 await expect(banner.locator('.library-visible-alerts')).toHaveText('Na visualização filtrada: bloqueios 0 · avisos 0.');
 await expect(page.getByRole('heading',{name:'Nenhum favorito nesses filtros'})).toBeVisible();
 await expect(banner).toContainText('2 com bloqueios');
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(banner.locator('.library-visible-alerts')).toHaveCount(0);
 await expect(page.getByText('4 favoritos exibidos')).toBeVisible();
 await expect(sort).toHaveValue('catalog');
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});


test('atalhos de alertas filtram e desfazem sem apagar favoritos nem alterar outros controles',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 const {sort}=await ready(page);
 const group=page.getByRole('group',{name:'Atalhos de alertas declarados'});
 const blockers=group.getByRole('button',{name:'Ver bloqueios declarados'});
 const notices=group.getByRole('button',{name:'Ver avisos declarados'});
 const alerts=page.getByRole('combobox',{name:'Filtrar alertas declarados'});
 await expect(blockers).toHaveAttribute('aria-pressed','false');
 await expect(notices).toHaveAttribute('aria-pressed','false');
 await blockers.focus();
 await page.keyboard.press('Enter');
 await expect(alerts).toHaveValue('blocking');
 await expect(blockers).toHaveAttribute('aria-pressed','true');
 expect(await shown(page)).toEqual(['Zeta Bloqueio','Omega Bloqueio']);
 await sort.selectOption('alerts');
 expect(await shown(page)).toEqual(['Omega Bloqueio','Zeta Bloqueio']);
 await notices.click();
 await expect(alerts).toHaveValue('attention');
 await expect(blockers).toHaveAttribute('aria-pressed','false');
 await expect(notices).toHaveAttribute('aria-pressed','true');
 expect(await shown(page)).toEqual(['Beta Aviso']);
 await notices.click();
 await expect(alerts).toHaveValue('all');
 await expect(notices).toHaveAttribute('aria-pressed','false');
 expect(await shown(page)).toEqual(priorities);
 await page.getByRole('textbox',{name:'Buscar favoritos'}).fill('alfa');
 await blockers.click();
 await expect(page.getByRole('heading',{name:'Nenhum favorito nesses filtros'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Buscar favoritos'})).toHaveValue('alfa');
 await expect(page.locator('.library-declared-alerts')).toContainText('entre todos os 4 favoritos');
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(alerts).toHaveValue('all');
 await expect(sort).toHaveValue('catalog');
 expect(await shown(page)).toEqual(originals);
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('atalhos de alertas sem ocorrências ficam inativos e não alegam compatibilidade',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})});
 await card.getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const group=page.getByRole('group',{name:'Atalhos de alertas declarados'});
 await expect(group.getByRole('button',{name:'Ver bloqueios declarados'})).toBeDisabled();
 await expect(group.getByRole('button',{name:'Ver avisos declarados'})).toBeDisabled();
 await expect(page.getByText('Ausência de alertas declarados não comprova compatibilidade nem instalação.',{exact:false})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Filtrar alertas declarados'})).toHaveValue('all');
});
