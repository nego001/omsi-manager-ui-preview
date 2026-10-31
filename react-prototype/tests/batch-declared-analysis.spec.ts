import {test,expect} from '@playwright/test';
import {analyzeDeclaredBatch} from '../src/batch-declared-analysis';
import {parseCatalogManifest} from '../src/catalog';
import type {CatalogMod} from '../src/catalog';
const mod=(id:string,game:'omsi'|'ets2'|'ats'='omsi',requires:string[]=[],conflictsWith:string[]=[]):CatalogMod=>({
 id,title:'Mod '+id,game,category:'Ônibus',version:'1.0',size:'1 MB',
 description:'Apenas catálogo demonstrativo',safe:true,requires,conflictsWith
});
const base=mod('base');
const a=mod('a','omsi',['base'],['b']);
const b=mod('b');
const truck=mod('truck','ets2');
const combined=[base,a,b,truck];
test('seleções OMSI agregam dependências e elevam conflito entre favoritos distintos',()=>{
 const result=analyzeDeclaredBatch(combined,['a','b']);
 expect(result.selectedCount).toBe(2);
 expect(result.groups).toHaveLength(1);
 expect(result.groups[0].game).toBe('omsi');
 expect(result.groups[0].sequence.map(m=>m.id)).toEqual(['base','a','b']);
 expect(result.issues.filter(i=>i.code==='conflict-in-plan')).toHaveLength(1);
 expect(result.blockers).toBe(1);
 expect(result.mode).toBe('catalog-metadata-only');
 expect(result.installationVerified).toBe(false);
 expect(result.compatibilityVerified).toBe(false);
 expect(result.canInstall).toBe(false);
});
test('conflito de catálogo com mod não selecionado não vira bloqueio automático',()=>{
 const result=analyzeDeclaredBatch(combined,['a']);
 expect(result.blockers).toBe(0);
 expect(result.notices).toBe(1);
 expect(result.issues[0].code).toBe('declared-conflict');
 expect(result.groups[0].sequence.map(m=>m.id)).toEqual(['base','a']);
});
test('separa simuladores e recusa dependência cruzada, ciclo e ausente',()=>{
 const separated=analyzeDeclaredBatch(combined,['a','truck']);
 expect(separated.groups.map(g=>g.game)).toEqual(['omsi','ets2']);
 expect(separated.groups[1].sequence.map(m=>m.id)).toEqual(['truck']);
 const cross=analyzeDeclaredBatch([mod('omsi','omsi',['ets']),mod('ets','ets2')],['omsi']);
 expect(cross.issues.map(i=>i.code)).toContain('different-game');
 const cycle=analyzeDeclaredBatch([mod('one','omsi',['two']),mod('two','omsi',['one'])],['one']);
 expect(cycle.issues.map(i=>i.code)).toContain('dependency-cycle');
 const missing=analyzeDeclaredBatch([mod('one','omsi',['absent'])],['one']);
 expect(missing.issues.map(i=>i.code)).toContain('dependency-missing');
});
test('seleção inválida nunca produz relatório de instalação',()=>{
 for(const ids of [[],['a','a'],['unknown'],Array(201).fill('a')])
  expect(()=>analyzeDeclaredBatch(combined,ids)).toThrow();
});

test('ordenação do relatório não depende da ordem de marcação dos favoritos',()=>{
 const first=analyzeDeclaredBatch(combined,['a','b']);
 const reversed=analyzeDeclaredBatch(combined,['b','a']);
 expect(first.groups[0].sequence.map(m=>m.id))
  .toEqual(reversed.groups[0].sequence.map(m=>m.id));
 const chain=[mod('top','omsi',['middle']),mod('middle','omsi',['foundation']),mod('foundation')];
 const result=analyzeDeclaredBatch(chain,['top']);
 expect(result.groups[0].sequence.map(m=>m.id))
  .toEqual(['foundation','middle','top']);
 expect(result.canInstall).toBe(false);
});
test('marcar todos os favoritos exibidos respeita os filtros, sem incluir jogo oculto',async({page})=>{
 const payload=JSON.stringify({schemaVersion:1,mods:combined.map(({safe,...m})=>m)});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'batch-selection.json',mimeType:'application/json',buffer:Buffer.from(payload)
 });
 for(const name of ['Mod a','Mod b','Mod truck']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('omsi');
 await page.getByRole('button',{name:'Marcar favoritos exibidos'}).click();
 await expect(page.getByText('2 selecionado(s)')).toBeVisible();
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('all');
 await expect(page.getByRole('checkbox',{name:'Selecionar Mod truck para análise conjunta'})).not.toBeChecked();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 const results=page.getByRole('region',{name:'Resultado da análise conjunta'});
 await expect(results).toBeVisible();
 await expect(results.locator('.library-batch-game')).toHaveCount(1);
 await expect(results).toContainText('dependência adicionada somente ao relatório');
 await expect(results).toContainText('Instalação e remoção continuam bloqueadas');
});

test('Resumo declarado pode ser consultado no Histórico apenas nesta sessão',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const demo=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})});
 await demo.getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await nav.getByRole('button',{name:'Histórico'}).click();
 const region=page.getByRole('region',{name:'Análises declarativas desta sessão'});
 await expect(region).toContainText('Ônibus Urbano Clássico');
 await expect(region).toContainText('Instalação e compatibilidade não verificadas');
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await page.reload();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 await expect(page.getByRole('region',{name:'Análises declarativas desta sessão'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
});
test('restaurar demonstração limpa seleção e histórico da fonte importada',async({page})=>{
 const payload=JSON.stringify({schemaVersion:1,mods:combined.map(({safe,...m})=>m)});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'reset-catalog.json',mimeType:'application/json',buffer:Buffer.from(payload)
 });
 const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Mod a',exact:true})});
 await card.getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Mod a para análise conjunta'}).check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByRole('button',{name:'Restaurar demonstração'}).click();
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(page.getByRole('region',{name:'Análises declarativas desta sessão'})).toHaveCount(0);
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});

test('Biblioteca permite análise conjunta apenas sobre os favoritos marcados',async({page})=>{
 const payload=JSON.stringify({schemaVersion:1,mods:combined.map(({safe,...m})=>m)});
 const parsed=parseCatalogManifest(payload);
 expect(parsed).toHaveLength(4);
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'batch-catalog.json',mimeType:'application/json',buffer:Buffer.from(payload)
 });
 for(const name of ['Mod a','Mod b','Mod truck']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const panel=page.getByRole('region',{name:'Análise conjunta declarativa'});
 // The chooser itself is the section; result is hidden until requested.
 await expect(page.getByRole('button',{name:'Analisar seleção'})).toBeDisabled();
 await page.getByRole('checkbox',{name:'Selecionar Mod a para análise conjunta'}).check();
 await page.getByRole('checkbox',{name:'Selecionar Mod b para análise conjunta'}).check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 const results=page.getByRole('region',{name:'Resultado da análise conjunta'});
 await expect(results).toBeVisible();
 await expect(results.getByText(/2 mod\(s\) selecionado\(s\) · 1 bloqueio/)).toBeVisible();
 await expect(results.getByText(/Mod a declara conflito com Mod b/)).toBeVisible();
 // The eight unexecuted reader specialists have their own list.
 await expect(results.locator('.library-batch-game ol li')).toHaveCount(3);
 await expect(results).toContainText('Instalação e remoção continuam bloqueadas');
 await page.getByRole('checkbox',{name:'Selecionar Mod truck para análise conjunta'}).check();
 await expect(results).toHaveCount(0);
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'}).getByRole('heading',{name:/Euro Truck Simulator 2/})).toBeVisible();
 await page.getByRole('button',{name:'Limpar seleção'}).click();
 await expect(page.getByRole('button',{name:'Analisar seleção'})).toBeDisabled();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toHaveCount(0);
 await nav.getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});

test('análise conjunta avisa quando a seleção inclui favoritos ocultos pelos filtros',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of ['Ônibus Urbano Clássico','Caminhão Rodoviário']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const bus=page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'});
 const truck=page.getByRole('checkbox',{name:'Selecionar Caminhão Rodoviário para análise conjunta'});
 await bus.check();
 await truck.check();
 const game=page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'});
 await game.selectOption('omsi');
 await expect(page.locator('.library-batch-actions [role="status"]')).toHaveText('2 selecionado(s) · 1 fora dos filtros atuais');
 await expect(page.getByRole('note').filter({hasText:'A análise conjunta também incluirá 1 favorito'})).toBeVisible();
 const hidden=page.getByRole('button',{name:'Desmarcar ocultos (1)'});
 await expect(hidden).toBeVisible();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'}).locator('.library-batch-game')).toHaveCount(2);
 await hidden.click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toHaveCount(0);
 await expect(page.locator('.library-batch-actions [role="status"]')).toHaveText('1 selecionado(s)');
 await expect(hidden).toHaveCount(0);
 await game.selectOption('all');
 await expect(bus).toBeChecked();
 await expect(truck).not.toBeChecked();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(2);
 await expect(page.getByRole('note').filter({hasText:'A análise conjunta também incluirá'})).toHaveCount(0);
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'}).locator('.library-batch-game')).toHaveCount(1);
});

test('seleção toda oculta pode ser limpa sem apagar favoritos em 390 px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Serra do Vale',exact:true})});
 await card.getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Serra do Vale para análise conjunta'}).check();
 await page.getByRole('textbox',{name:'Buscar favoritos'}).fill('não existe');
 await expect(page.getByRole('heading',{name:'Nenhum favorito nesses filtros'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Desmarcar ocultos (1)'})).toBeVisible();
 await page.getByRole('button',{name:'Desmarcar ocultos (1)'}).click();
 await expect(page.getByRole('button',{name:'Analisar seleção'})).toBeDisabled();
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(page.getByRole('checkbox',{name:'Selecionar Serra do Vale para análise conjunta'})).not.toBeChecked();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(1);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(3);
});

test('desmarcar exibidos preserva favoritos ocultos sem reaproveitar relatório anterior',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale','Caminhão Rodoviário']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('button',{name:'Marcar favoritos exibidos'}).click();
 const game=page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'});
 await game.selectOption('omsi');
 await expect(page.locator('.library-batch-actions [role="status"]')).toHaveText('3 selecionado(s) · 1 fora dos filtros atuais');
 await expect(page.getByRole('button',{name:'Desmarcar exibidos (2)'})).toBeVisible();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'}).locator('.library-batch-game')).toHaveCount(2);
 await page.getByRole('button',{name:'Desmarcar exibidos (2)'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toHaveCount(0);
 await expect(page.locator('.library-batch-actions [role="status"]')).toHaveText('1 selecionado(s) · 1 fora dos filtros atuais');
 await expect(page.getByRole('button',{name:'Desmarcar exibidos (1)'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Desmarcar ocultos (1)'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Marcar favoritos exibidos'})).toBeEnabled();
 await game.selectOption('all');
 await expect(page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'})).not.toBeChecked();
 await expect(page.getByRole('checkbox',{name:'Selecionar Serra do Vale para análise conjunta'})).not.toBeChecked();
 await expect(page.getByRole('checkbox',{name:'Selecionar Caminhão Rodoviário para análise conjunta'})).toBeChecked();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(3);
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'}).locator('.library-batch-game')).toHaveCount(1);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(3);
});

test('desmarcar exibidos respeita categoria e busca sem perder seleção fora da lista',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 const category=page.getByRole('combobox',{name:'Filtrar categoria na biblioteca'});
 await category.selectOption('Mapas');
 await expect(page.getByRole('button',{name:'Desmarcar exibidos (1)'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Desmarcar ocultos (1)'})).toBeVisible();
 await page.getByRole('button',{name:'Marcar favoritos exibidos'}).click();
 await expect(page.getByRole('button',{name:'Desmarcar exibidos (1)'})).toBeVisible();
 await page.getByRole('textbox',{name:'Buscar favoritos'}).fill('serra');
 await page.getByRole('button',{name:'Desmarcar exibidos (1)'}).click();
 await expect(page.locator('.library-batch-actions [role="status"]')).toHaveText('1 selecionado(s) · 1 fora dos filtros atuais');
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'})).toBeChecked();
 await expect(page.getByRole('checkbox',{name:'Selecionar Serra do Vale para análise conjunta'})).not.toBeChecked();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toHaveCount(0);
});

test('inspetor de selecionados ocultos permite desmarcar um item sem apagar favoritos',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale','Caminhão Rodoviário']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('button',{name:'Marcar favoritos exibidos'}).click();
 await page.getByRole('combobox',{name:'Filtrar categoria na biblioteca'}).selectOption('Mapas');
 const inspector=page.locator('details.library-batch-hidden-list');
 await expect(inspector).toBeVisible();
 await expect(inspector.locator('summary')).toHaveText('Ver selecionados ocultos (2)');
 await inspector.locator('summary').focus();
 await page.keyboard.press('Enter');
 await expect(inspector).toHaveAttribute('open','');
 await expect(inspector.locator('li')).toHaveCount(2);
 await expect(inspector).toContainText('Ônibus Urbano Clássico');
 await expect(inspector).toContainText('Caminhão Rodoviário');
 await expect(inspector).toContainText('Nenhum arquivo de mod foi inspecionado');
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'}).locator('.library-batch-game')).toHaveCount(2);
 await inspector.getByRole('button',{name:'Desmarcar Ônibus Urbano Clássico (OMSI 2, ID omsi-bus) da análise conjunta'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toHaveCount(0);
 await expect(inspector.locator('li')).toHaveCount(1);
 await expect(inspector).toContainText('Caminhão Rodoviário');
 await expect(inspector).not.toContainText('Ônibus Urbano Clássico');
 await expect(page.locator('.library-batch-actions [role="status"]')).toHaveText('2 selecionado(s) · 1 fora dos filtros atuais');
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'})).not.toBeChecked();
 await expect(page.getByRole('checkbox',{name:'Selecionar Serra do Vale para análise conjunta'})).toBeChecked();
 await expect(page.getByRole('checkbox',{name:'Selecionar Caminhão Rodoviário para análise conjunta'})).toBeChecked();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(3);
 await expect(inspector).toHaveCount(0);
});

test('inspetor de selecionados ocultos funciona com busca vazia e título longo em 390 px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 const longTitle='Ônibus demonstrativo de nome muito comprido usado para testar cartões responsivos e acessibilidade';
 const payload=JSON.stringify({schemaVersion:1,mods:[
  {id:'longo-bus',title:longTitle,game:'omsi',category:'Ônibus',version:'1.0',size:'10 MB',description:'Somente dados sintéticos'},
  {id:'mapa-curto',title:'Mapa de teste',game:'omsi',category:'Mapas',version:'1.0',size:'2 MB',description:'Somente dados sintéticos'}
 ]});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'hidden-long-titles.json',mimeType:'application/json',buffer:Buffer.from(payload)
 });
 for(const title of [longTitle,'Mapa de teste']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('button',{name:'Marcar favoritos exibidos'}).click();
 await page.getByRole('textbox',{name:'Buscar favoritos'}).fill('nenhum resultado');
 await expect(page.getByRole('heading',{name:'Nenhum favorito nesses filtros'})).toBeVisible();
 const inspector=page.locator('details.library-batch-hidden-list');
 await inspector.locator('summary').click();
 await expect(inspector.locator('li')).toHaveCount(2);
 await expect(inspector).toContainText(longTitle);
 await inspector.getByRole('button',{name:`Desmarcar ${longTitle} (OMSI 2, ID longo-bus) da análise conjunta`}).click();
 await expect(inspector.locator('li')).toHaveCount(1);
 await expect(inspector).toContainText('Mapa de teste');
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(2);
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toHaveCount(0);
});

test('desfavoritar item selecionado fecha relatório e não o seleciona ao favoritar de novo',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const bus=page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'});
 const map=page.getByRole('checkbox',{name:'Selecionar Serra do Vale para análise conjunta'});
 await bus.check();
 await map.check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toBeVisible();
 const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Serra do Vale',exact:true})});
 await card.getByRole('button',{name:'Retirar dos favoritos'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toHaveCount(0);
 await expect(page.locator('.library-batch-actions [role="status"]')).toHaveText('1 selecionado(s)');
 await expect(bus).toBeChecked();
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const catalogCard=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Serra do Vale',exact:true})});
 await catalogCard.getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(map).not.toBeChecked();
 await expect(bus).toBeChecked();
 await expect(page.getByText('2 favoritos exibidos')).toBeVisible();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toContainText('1 mod(s) selecionado(s)');
});

test('remover e readicionar favorito em Detalhes não recupera seleção antiga',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})});
 await card.getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toBeVisible();
 await page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 await page.getByRole('button',{name:'Remover dos favoritos'}).click();
 await page.getByRole('button',{name:'Adicionar aos favoritos'}).click();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'})).not.toBeChecked();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Analisar seleção'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(1);
});

test('desfavoritar item fora da seleção não fecha relatório de outros mods',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 const report=page.getByRole('region',{name:'Resultado da análise conjunta'});
 await expect(report).toBeVisible();
 const mapCard=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Serra do Vale',exact:true})});
 await mapCard.getByRole('button',{name:'Retirar dos favoritos'}).click();
 await expect(report).toBeVisible();
 await expect(report).toContainText('1 mod(s) selecionado(s)');
 await expect(page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'})).toBeChecked();
});


test('resumo por simulador mostra toda a seleção sem incluir dependências nem perder filtro',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of ['Ônibus Urbano Clássico','Caminhão Rodoviário','Long Haul Classic']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const summary=page.getByRole('status',{name:'Seleção por simulador'});
 await expect(summary).toHaveCount(0);
 await page.getByRole('button',{name:'Marcar favoritos exibidos'}).click();
 await expect(summary).toContainText('OMSI 2: 1');
 await expect(summary).toContainText('Euro Truck Simulator 2: 1');
 await expect(summary).toContainText('American Truck Simulator: 1');
 await expect(summary).toContainText('Dependências teóricas não entram nesta contagem');
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toHaveCount(0);
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('omsi');
 await expect(summary).toContainText('Euro Truck Simulator 2: 1');
 await page.getByRole('button',{name:'Desmarcar exibidos (1)'}).click();
 await expect(summary).not.toContainText('OMSI 2: 1');
 await expect(summary).toContainText('American Truck Simulator: 1');
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'}).locator('.library-batch-game')).toHaveCount(2);
 await page.getByRole('button',{name:'Limpar seleção'}).click();
 await expect(summary).toHaveCount(0);
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('relatório declarativo aparece só depois de Analisar seleção e some após alterar seleção',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})});
 await card.getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await expect(page.getByRole('status',{name:'Seleção por simulador'})).toContainText('OMSI 2: 1');
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toHaveCount(0);
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toBeVisible();
 await page.getByRole('button',{name:'Desmarcar exibidos (1)'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toHaveCount(0);
 await expect(page.getByRole('status',{name:'Seleção por simulador'})).toHaveCount(0);
});


test('filtro só selecionados mostra apenas marcados sem apagar favoritos ocultos',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale','Caminhão Rodoviário']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await page.getByRole('checkbox',{name:'Selecionar Caminhão Rodoviário para análise conjunta'}).check();
 const only=page.getByRole('checkbox',{name:'Mostrar apenas selecionados para análise'});
 await only.check();
 await expect(page.locator('.mod-card')).toHaveCount(2);
 await expect(page.getByText('2 favoritos exibidos')).toBeVisible();
 await expect(page.getByRole('checkbox',{name:'Selecionar Serra do Vale para análise conjunta'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Remover filtro de selecionados'})).toBeVisible();
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('omsi');
 await expect(page.locator('.mod-card')).toHaveCount(1);
 await expect(page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'})).toBeChecked();
 await expect(page.locator('.library-batch-actions [role="status"]')).toContainText('2 selecionado(s) · 1 fora dos filtros atuais');
 await page.getByRole('button',{name:'Remover filtro de selecionados'}).click();
 await expect(only).not.toBeChecked();
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(3);
 await expect(page.getByRole('checkbox',{name:'Selecionar Serra do Vale para análise conjunta'})).not.toBeChecked();
 await expect(page.getByRole('checkbox',{name:'Selecionar Caminhão Rodoviário para análise conjunta'})).toBeChecked();
});

test('filtro só selecionados sem seleção permite recuperar cartões em 390px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})});
 await card.getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const only=page.getByRole('checkbox',{name:'Mostrar apenas selecionados para análise'});
 await only.check();
 await expect(page.getByRole('heading',{name:'Nenhum favorito nesses filtros'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Limpar filtros da biblioteca'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Analisar seleção'})).toBeDisabled();
 await only.uncheck();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(1);
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await only.check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toBeVisible();
 await page.getByRole('button',{name:'Desmarcar exibidos (1)'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Nenhum favorito nesses filtros'})).toBeVisible();
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(only).not.toBeChecked();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(1);
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});


test('Histórico remove um único resumo declarado sem alterar favoritos ou os demais',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const bus=page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'});
 const map=page.getByRole('checkbox',{name:'Selecionar Serra do Vale para análise conjunta'});
 await expect(page.getByLabel('Resumo da biblioteca')).toContainText('Simuladores nos favoritos');
 await bus.check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await map.check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await nav.getByRole('button',{name:'Histórico'}).click();
 const region=page.getByRole('region',{name:'Análises declarativas desta sessão'});
 await expect(region.locator('li')).toHaveCount(2);
 await expect(region.locator('li').first()).toContainText('2 mod(s) declarados');
 await expect(region.locator('li').last()).toContainText('1 mod(s) declarados');
 await region.getByRole('button',{name:'Excluir resumo 1 desta sessão'}).click();
 await expect(region.locator('li')).toHaveCount(1);
 await expect(region).toContainText('2 mod(s) declarados');
 await expect(region).toContainText('Serra do Vale');
 await expect(region).toContainText('Instalação e compatibilidade não verificadas');
 await expect(region).not.toContainText('1 mod(s) declarados');
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(bus).toBeChecked();
 await expect(map).toBeChecked();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(2);
 await nav.getByRole('button',{name:'Histórico'}).click();
 await region.getByRole('button',{name:'Excluir resumo 2 desta sessão'}).click();
 await expect(region).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('Histórico permite desfazer exclusão e preserva IDs de relatórios mesmo após remoção',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const bus=page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'});
 const map=page.getByRole('checkbox',{name:'Selecionar Serra do Vale para análise conjunta'});
 await bus.check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await map.check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await nav.getByRole('button',{name:'Histórico'}).click();
 const history=page.getByRole('region',{name:'Análises declarativas desta sessão'});
 await expect(history.locator('li')).toHaveCount(2);
 await history.getByRole('button',{name:'Excluir resumo 1 desta sessão'}).click();
 await expect(history.locator('li')).toHaveCount(1);
 await page.getByRole('button',{name:'Desfazer exclusão do último resumo'}).click();
 await expect(history.locator('li')).toHaveCount(2);
 await expect(page.getByRole('button',{name:'Desfazer exclusão do último resumo'})).toHaveCount(0);
 await history.getByRole('button',{name:'Excluir resumo 2 desta sessão'}).click();
 await expect(history.locator('li')).toHaveCount(1);
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await map.uncheck();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(history.locator('li')).toHaveCount(2);
 await expect(history.getByRole('button',{name:'Excluir resumo 3 desta sessão'})).toBeVisible();
 await expect(history.getByRole('button',{name:'Excluir resumo 1 desta sessão'})).toBeVisible();
 await expect(history.getByRole('button',{name:'Excluir resumo 2 desta sessão'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Desfazer exclusão do último resumo'})).toHaveCount(0);
 await history.getByRole('button',{name:'Excluir resumo 3 desta sessão'}).click();
 await page.getByRole('button',{name:'Desfazer exclusão do último resumo'}).click();
 await expect(history.locator('li')).toHaveCount(2);
 await history.getByRole('button',{name:'Limpar resumos da sessão'}).click();
 await expect(history).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Desfazer exclusão do último resumo'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('Histórico recupera seleção declarada sem recriar favoritos removidos nem instalar mods',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const bus=page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'});
 const map=page.getByRole('checkbox',{name:'Selecionar Serra do Vale para análise conjunta'});
 await bus.check();
 await map.check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await page.getByRole('button',{name:'Limpar seleção'}).click();
 await nav.getByRole('button',{name:'Histórico'}).click();
 const history=page.getByRole('region',{name:'Análises declarativas desta sessão'});
 await history.getByRole('button',{name:'Rever seleção do resumo 1'}).click();
 await expect(bus).toBeChecked();
 await expect(map).toBeChecked();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(2);
 await page.getByRole('button',{name:'Limpar seleção'}).click();
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const mapCard=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Serra do Vale',exact:true})});
 await mapCard.getByRole('button',{name:'Retirar dos favoritos'}).click();
 await nav.getByRole('button',{name:'Histórico'}).click();
 await history.getByRole('button',{name:'Rever seleção do resumo 1'}).click();
 await expect(bus).toBeChecked();
 await expect(map).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(1);
 await expect(page.getByRole('status').filter({hasText:'1 indisponível(is)'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toBeVisible();
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const busCard=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})});
 await busCard.getByRole('button',{name:'Retirar dos favoritos'}).click();
 await nav.getByRole('button',{name:'Histórico'}).click();
 await history.getByRole('button',{name:'Rever seleção do resumo 1'}).click();
 await expect(page.getByRole('button',{name:'Analisar seleção'})).toHaveCount(0);
 await expect(page.getByText('Nenhum favorito deste resumo está disponível na biblioteca. Nenhum mod foi instalado.')).toBeVisible();
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(history).toContainText('2 mod(s) declarados');
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
