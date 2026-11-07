import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseCatalogManifest} from '../src/catalog';
import {analyzeModRelations} from '../src/relation-analysis';
import {buildRelationTimeline} from '../src/relation-timeline';

const example=readFileSync(resolve('examples/catalog.dependencies.example.json'),'utf8');
const uploaded=(source:string)=>({name:'timeline-demo.json',mimeType:'application/json',buffer:Buffer.from(source)});

test('modelo da linha do tempo identifica dependências diretas e indiretas com ordem determinística',()=>{
 const catalog=parseCatalogManifest(example);
 const analysis=analyzeModRelations(catalog,'omsi-audio');
 const timeline=buildRelationTimeline(analysis,'omsi-audio');
 expect(timeline.stages.map(s=>[s.id,s.role,s.step])).toEqual([
  ['omsi-core','indirect',1],
  ['omsi-bus-1721','direct',2],
  ['omsi-audio','selected',3]
 ]);
 expect(timeline.hasCycle).toBe(false);
 expect(timeline.hasMissingOrCrossGameDependency).toBe(false);
 expect(timeline.noDeclaredDependencies).toBe(false);
 expect(timeline.realInstallationVerified).toBe(false);
 const noDeps=buildRelationTimeline(analyzeModRelations(catalog,'omsi-core'),'omsi-core');
 expect(noDeps.noDeclaredDependencies).toBe(true);
 expect(noDeps.stages).toHaveLength(1);
 expect(noDeps.stages[0].role).toBe('selected');
});

test('sequência circular e referências ausentes nunca ganham rótulo de ordem válida',()=>{
 const fixture=parseCatalogManifest(JSON.stringify({schemaVersion:1,mods:[
  {id:'a',title:'Mod A',game:'omsi',category:'Ônibus',version:'1.0',size:'1 MB',description:'Demo',requires:['b','ghost']},
  {id:'b',title:'Mod B',game:'omsi',category:'Ônibus',version:'1.0',size:'1 MB',description:'Demo',requires:['a']}
 ]}));
 const analysis=analyzeModRelations(fixture,'a');
 const timeline=buildRelationTimeline(analysis,'a');
 expect(timeline.hasCycle).toBe(true);
 expect(timeline.hasMissingOrCrossGameDependency).toBe(true);
 expect(timeline.realInstallationVerified).toBe(false);
 expect(timeline.stages.map(s=>s.id)).toEqual(['b','a']);
});

test('Detalhes exibe dependências na ordem e metadados reveláveis sem acessar mods reais',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(uploaded(example));
 await page.getByRole('button',{name:'Sons do OF-1721 (exemplo)',exact:true}).click();
 const relation=page.getByRole('region',{name:'Simulação de dependências'});
 const stages=relation.locator('ol.relation-timeline > li');
 await expect(stages).toHaveCount(3);
 await expect(stages.nth(0)).toHaveAttribute('data-stage-role','indirect');
 await expect(stages.nth(0)).toContainText('Pacote base OMSI');
 await expect(stages.nth(0)).toContainText('DEPENDÊNCIA INDIRETA');
 await expect(stages.nth(1)).toHaveAttribute('data-stage-role','direct');
 await expect(stages.nth(1)).toContainText('DEPENDÊNCIA DIRETA');
 await expect(stages.nth(2)).toHaveAttribute('data-stage-role','selected');
 await expect(stages.nth(2)).toContainText('MOD SELECIONADO');
 const show=stages.nth(0).getByText('Ver dados declarados');
 await show.focus();
 await page.keyboard.press('Enter');
 await expect(stages.nth(0).getByText('Categoria: Ônibus · Versão declarada: 1.0 · Jogo: OMSI 2.')).toBeVisible();
 await expect(stages.nth(0).getByText(/Presença, versão instalada, ativação e integridade.*não verificadas/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});

test('ciclos e IDs ausentes avisam que a ordem do catálogo é incompleta',async({page})=>{
 const fixture=JSON.stringify({schemaVersion:1,mods:[
  {id:'a',title:'Mod A',game:'omsi',category:'Ônibus',version:'1.0',size:'1 MB',description:'Demo',requires:['b','ghost']},
  {id:'b',title:'Mod B',game:'omsi',category:'Ônibus',version:'1.0',size:'1 MB',description:'Demo',requires:['a']}
 ]});
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(uploaded(fixture));
 await page.getByRole('button',{name:'Mod A',exact:true}).click();
 const relation=page.getByRole('region',{name:'Simulação de dependências'});
 await expect(relation.getByText(/dependência circular\. A ordem abaixo é apenas ilustrativa/)).toBeVisible();
 await expect(relation.getByText(/A lista abaixo não inclui esses componentes e está incompleta/)).toBeVisible();
 await expect(relation.locator('.relation-timeline>li')).toHaveCount(2);
 await expect(relation.getByText(/ID ausente: ghost/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});

test('linha do tempo não corta conteúdo em larguras 390/850/1440',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(uploaded(example));
 await page.getByRole('button',{name:'Sons do OF-1721 (exemplo)',exact:true}).click();
 const stages=page.locator('.relation-timeline>li');
 await stages.nth(0).getByText('Ver dados declarados').click();
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:790});
  const geometry=await page.evaluate(()=>{
   const viewport=document.documentElement.clientWidth;
   return {viewport,overflow:Math.max(0,document.documentElement.scrollWidth-viewport),
    rects:[...document.querySelectorAll('.relation-timeline>li,.relation-stage-body,.relation-stage-detail summary')].map(el=>{
     const r=el.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};
    })
   };
  });
  expect(geometry.overflow,'Rolagem horizontal '+width).toBeLessThanOrEqual(3);
  for(const rect of geometry.rects){
   expect(rect.left).toBeGreaterThanOrEqual(-3);
   expect(rect.right).toBeLessThanOrEqual(geometry.viewport+3);
   expect(rect.height).toBeGreaterThan(16);
  }
 }
});
