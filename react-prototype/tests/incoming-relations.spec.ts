import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseCatalogManifest} from '../src/catalog';
import {collectIncomingDeclaredRelations as incoming,indexIncomingDeclaredRelations as indexIncoming,summarizeCrossGameIncoming} from '../src/incoming-relations';
const example=readFileSync(resolve('examples/catalog.dependencies.example.json'),'utf8');
const parsed=parseCatalogManifest(example);
const panel=(page:Page)=>page.getByRole('region',{name:'Referências recebidas no catálogo'});
async function setup(page:Page,raw=example){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'})
  .getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'reverse-relations.json',mimeType:'application/json',buffer:Buffer.from(raw)});
}
test('reverse JSON declarations remain one-way and direct, never inferred',()=>{
 const core=incoming(parsed,'omsi-core');
 expect(core.requiredBy.map(m=>m.id)).toEqual(['omsi-bus-1721']);
 expect(core.conflictDeclaredBy).toEqual([]);
 expect(core.requiredBy[0].differentGame).toBe(false);
 expect(core.realInstallationVerified).toBe(false);
 const audio=incoming(parsed,'omsi-audio');
 expect(audio.conflictDeclaredBy.map(m=>m.id))
  .toEqual(['omsi-alternative']);
 expect(audio.conflictDeclaredBy[0].reciprocalDeclaration).toBe(false);
 expect(incoming(parsed,'unknown').requiredBy).toEqual([]);
 const circular=parseCatalogManifest(JSON.stringify({schemaVersion:1,mods:[
  {id:'a',title:'A',game:'omsi',category:'Ônibus',version:'1',size:'1 MB',description:'Demo',requires:['a','b']},
  {id:'b',title:'B',game:'ets2',category:'Ônibus',version:'1',size:'1 MB',description:'Demo',requires:['a'],conflictsWith:['a']}
 ]}));
 expect(incoming(circular,'a').requiredBy.map(m=>m.id)).toEqual(['b']);
 expect(incoming(circular,'a').requiredBy[0].differentGame).toBe(true);
 expect(incoming(circular,'a').conflictDeclaredBy.map(m=>m.id)).toEqual(['b']);
 expect(incoming(circular,'a').conflictDeclaredBy[0].reciprocalDeclaration).toBe(false);
});
test('reverse direct dependency has exact ID link and reversible diagnostic',async({page})=>{
 await setup(page);
 await page.getByRole('button',{name:'Pacote base OMSI',exact:true}).click();
 await expect(panel(page)).toContainText('Ônibus OF-1721 (exemplo)');
 await expect(panel(page)).not.toContainText('Sons do OF-1721 (exemplo)');
 await panel(page).getByRole('button',{name:/Localizar mod que declara depender Ônibus OF-1721/}).click();
 await expect(page.getByRole('textbox',{name:'Buscar mods'})).toHaveValue('omsi-bus-1721');
 await expect(page.getByText('1 resultado')).toBeVisible();
 await page.getByRole('button',{name:'Ônibus OF-1721 (exemplo)',exact:true}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar ao catálogo'}).click();
 await page.getByRole('region',{name:'Consulta de dependência declarada'})
  .getByRole('button',{name:'Voltar ao diagnóstico original'}).click();
 await expect(page.getByRole('heading',{name:'Pacote base OMSI',exact:true})).toBeVisible();
 await expect(panel(page)).toContainText('Ônibus OF-1721 (exemplo)');
});
test('reverse conflict is unilateral and 390px layout remains readable',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await setup(page);
 await page.getByRole('button',{name:'Sons do OF-1721 (exemplo)',exact:true}).click();
 await expect(panel(page)).toContainText('Pacote alternativo (exemplo)');
 await expect(panel(page)).toContainText('Declaração unilateral: apenas este outro registro indica conflito');
 await expect(panel(page)).toContainText('não comprova compatibilidade');
 await panel(page).getByRole('button',{name:/Localizar mod que declara conflito Pacote alternativo/}).click();
 await expect(page.getByRole('textbox',{name:'Buscar mods'})).toHaveValue('omsi-alternative');
 await expect(page.getByText('1 resultado')).toBeVisible();
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('empty and cross-game references do not imply installed compatibility',async({page})=>{
 const raw=JSON.stringify({schemaVersion:1,mods:[
  {id:'base',title:'Base de exemplo',game:'omsi',category:'Sons',version:'1',size:'1 MB',description:'Demo'},
  {id:'other',title:'Referência de outro jogo',game:'ats',category:'Sons',version:'1',size:'1 MB',description:'Demo',requires:['base']}
 ]});
 await setup(page,raw);
 await page.getByRole('button',{name:'Base de exemplo',exact:true}).click();
 await expect(panel(page)).toContainText('Referência de outro jogo');
 await expect(panel(page)).toContainText('American Truck Simulator');
 await expect(panel(page)).toContainText('Referência entre jogos diferentes · somente JSON');
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar ao catálogo'}).click();
 await page.getByRole('button',{name:'Referência de outro jogo',exact:true}).click();
 await expect(panel(page)).toContainText('Nenhuma referência recebida nesses campos do catálogo.');
});

test('mutual conflict is labeled only when both records explicitly name each other',async({page})=>{
 const source=JSON.stringify({schemaVersion:1,mods:[
  {id:'a',title:'Registro A',game:'omsi',category:'Sons',version:'1',size:'1 MB',
   description:'Somente demonstração',conflictsWith:['b']},
  {id:'b',title:'Registro B',game:'omsi',category:'Sons',version:'1',size:'1 MB',
   description:'Somente demonstração',conflictsWith:['a']},
  {id:'c',title:'Registro C',game:'omsi',category:'Sons',version:'1',size:'1 MB',
   description:'Somente demonstração',conflictsWith:['a']}
 ]});
 const parsedMutual=parseCatalogManifest(source);
 const result=incoming(parsedMutual,'a');
 expect(result.conflictDeclaredBy.map(m=>[m.id,m.reciprocalDeclaration]))
  .toEqual([['b',true],['c',false]]);
 await setup(page,source);
 await page.getByRole('button',{name:'Registro A',exact:true}).click();
 const entries=panel(page).locator('li');
 await expect(entries).toHaveCount(2);
 await expect(entries.nth(0)).toContainText('Ambos os registros declaram conflito no JSON');
 await expect(entries.nth(1)).toContainText('Declaração unilateral: apenas este outro registro indica conflito');
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
test('reciprocal conflict and cross-game warnings remain readable at 390px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 const source=JSON.stringify({schemaVersion:1,mods:[
  {id:'a',title:'Registro principal',game:'omsi',category:'Ônibus',version:'1',size:'1 MB',
   description:'Registro fictício',conflictsWith:['b']},
  {id:'b',title:'Registro de outro jogo',game:'ets2',category:'Caminhões',version:'1',size:'1 MB',
   description:'Registro fictício',conflictsWith:['a'],requires:['a']}
 ]});
 await setup(page,source);
 await page.getByRole('button',{name:'Registro principal',exact:true}).click();
 const section=panel(page);
 await expect(section).toContainText('Ambos os registros declaram conflito no JSON');
 await expect(section.locator('li').first()).toContainText('Referência entre jogos diferentes · somente JSON');
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('single index matches direct lookup, including cycles, missing IDs, cross-game and reciprocity',()=>{
 const exampleIndex=indexIncoming(parsed);
 expect([...exampleIndex.keys()]).toEqual(parsed.map(mod=>mod.id));
 for(const mod of parsed)expect(exampleIndex.get(mod.id)).toEqual(incoming(parsed,mod.id));
 expect(exampleIndex.get('nonexistent')).toBeUndefined();
 const fixture=parseCatalogManifest(JSON.stringify({schemaVersion:1,mods:[
  {id:'target',title:'Alvo',game:'omsi',category:'Ônibus',version:'1',description:'Demo',size:'1 MB',
   requires:['target'],conflictsWith:['source']},
  {id:'source',title:'Outro jogo',game:'ats',category:'Sons',version:'1',description:'Demo',size:'1 MB',
   requires:['target','missing'],conflictsWith:['target']},
  {id:'silent',title:'Sem arestas',game:'omsi',category:'Gráficos',version:'1',description:'Demo',size:'1 MB'}
 ]}));
 const byId=indexIncoming(fixture);
 expect(byId.get('target')?.requiredBy.map(x=>[x.id,x.differentGame])).toEqual([['source',true]]);
 expect(byId.get('target')?.conflictDeclaredBy.map(x=>[x.id,x.reciprocalDeclaration]))
  .toEqual([['source',true]]);
 expect(byId.get('silent')?.requiredBy).toEqual([]);
 expect(byId.get('silent')?.conflictDeclaredBy).toEqual([]);
 expect(byId.size).toBe(3);
 expect(byId.get('target')?.realInstallationVerified).toBe(false);
});
test('index preserves source catalog order instead of grouping by reference target',()=>{
 const parsedSource=parseCatalogManifest(JSON.stringify({schemaVersion:1,mods:[
  {id:'z',title:'Z',game:'omsi',category:'Sons',version:'1',description:'D',size:'1 MB',requires:['base'],conflictsWith:['base']},
  {id:'base',title:'Base',game:'omsi',category:'Sons',version:'1',description:'D',size:'1 MB'},
  {id:'a',title:'A',game:'omsi',category:'Sons',version:'1',description:'D',size:'1 MB',requires:['base'],conflictsWith:['base']}
 ]}));
 const indexed=indexIncoming(parsedSource).get('base');
 expect(indexed?.requiredBy.map(mod=>mod.id)).toEqual(['z','a']);
 expect(indexed?.conflictDeclaredBy.map(mod=>mod.id)).toEqual(['z','a']);
 expect(indexed?.conflictDeclaredBy.every(mod=>mod.reciprocalDeclaration===false)).toBe(true);
});
test('index handles 200 validated catalog entries and 4000 declared edges without duplicate or missing targets',()=>{
 const mods=Array.from({length:200},(_,i)=>({
  id:'mod-'+i,title:'Registro '+i,game:'omsi',category:'Sons',
  version:'1',description:'Dados fictícios',size:'1 MB',
  requires:Array.from({length:20},(_,j)=>'mod-'+((i+j+1)%200))
 }));
 const catalog=parseCatalogManifest(JSON.stringify({schemaVersion:1,mods}));
 const index=indexIncoming(catalog);
 expect(index.size).toBe(200);
 expect([...index.values()].reduce((count,x)=>count+x.requiredBy.length,0)).toBe(4000);
 expect(index.get('mod-0')?.requiredBy).toHaveLength(20);
 expect(index.get('mod-0')?.requiredBy.every(x=>x.id!=='mod-0')).toBe(true);
 expect([...index.values()].every(x=>x.realInstallationVerified===false)).toBe(true);
});

test('cross-game summary preserves origin, edge types, order and JSON-only trust state',()=>{
 const fixtures=parseCatalogManifest(JSON.stringify({schemaVersion:1,mods:[
  {id:'target',title:'Alvo',game:'omsi',category:'Ônibus',version:'1',size:'1 MB',description:'Demo'},
  {id:'ets-src',title:'ETS',game:'ets2',category:'Caminhões',version:'1',size:'1 MB',
   description:'Demo',requires:['target'],conflictsWith:['target']},
  {id:'ats-src',title:'ATS',game:'ats',category:'Caminhões',version:'1',size:'1 MB',
   description:'Demo',requires:['target']},
  {id:'same-src',title:'OMSI',game:'omsi',category:'Sons',version:'1',size:'1 MB',
   description:'Demo',requires:['target'],conflictsWith:['target']}
 ]}));
 const summary=summarizeCrossGameIncoming(indexIncoming(fixtures).get('target'));
 expect(summary).toEqual({
  total:3,dependencies:2,conflicts:1,
  byGame:[
   {game:'ets2',dependencies:1,conflicts:1,total:2},
   {game:'ats',dependencies:1,conflicts:0,total:1}
  ],source:'catalog-json-only',compatibilityVerified:false
 });
 expect(summarizeCrossGameIncoming(undefined)).toEqual({
  total:0,dependencies:0,conflicts:0,byGame:[],
  source:'catalog-json-only',compatibilityVerified:false
 });
 expect(summarizeCrossGameIncoming(indexIncoming(fixtures).get('same-src')).total).toBe(0);
});

test('Details groups cross-game incoming references by source simulator at 390px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 const raw=JSON.stringify({schemaVersion:1,mods:[
  {id:'target',title:'Alvo OMSI',game:'omsi',category:'Ônibus',version:'1',
   size:'1 MB',description:'Exemplo'},
  {id:'ets',title:'Fonte ETS2',game:'ets2',category:'Caminhões',version:'1',
   size:'1 MB',description:'Exemplo',requires:['target'],conflictsWith:['target']},
  {id:'ats',title:'Fonte ATS',game:'ats',category:'Sons',version:'1',
   size:'1 MB',description:'Exemplo',requires:['target']},
  {id:'same',title:'Fonte OMSI',game:'omsi',category:'Sons',version:'1',
   size:'1 MB',description:'Exemplo',requires:['target']}
 ]});
 await setup(page,raw);
 await page.getByRole('button',{name:'Alvo OMSI',exact:true}).click();
 const summary=panel(page).getByRole('note',{name:'Resumo de referências recebidas de outros simuladores'});
 await expect(summary).toContainText('3 referência(s) diretas recebidas de outros simuladores no JSON');
 await expect(summary).toContainText('Euro Truck Simulator 2');
 await expect(summary).toContainText('1 dependência(s) · 1 conflito(s) declarado(s)');
 await expect(summary).toContainText('American Truck Simulator');
 await expect(summary).toContainText('1 dependência(s) · 0 conflito(s) declarado(s)');
 await expect(summary).not.toContainText('Fonte OMSI');
 await expect(summary).toContainText('não de mods instalados nem de compatibilidade ou conversão confirmada');
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
 await page.getByRole('button',{name:'Voltar ao catálogo'}).click();
 await page.getByRole('button',{name:'Fonte ETS2',exact:true}).click();
 await expect(panel(page).getByRole('note',{name:'Resumo de referências recebidas de outros simuladores'})).toHaveCount(0);
});
