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
 await expect(results.locator('ol li')).toHaveCount(3);
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
