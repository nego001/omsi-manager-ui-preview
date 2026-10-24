import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseCatalogManifest} from '../src/catalog';
import {analyzeModRelations,type RelationIssue} from '../src/relation-analysis';
import {explainRelationIssue,summarizeRelationIssues} from '../src/relation-guidance';

const fixture=readFileSync(resolve('examples/catalog.versions.example.json'),'utf8');
const upload=(text:string)=>({name:'relacoes-demo.json',mimeType:'application/json',buffer:Buffer.from(text)});

test('cada tipo reconhecido tem orientação humana, sem prometer ação ou compatibilidade',()=>{
 const codes:RelationIssue['code'][]=[
  'dependency-missing','different-game','dependency-cycle','conflict-in-plan',
  'declared-conflict','unknown-conflict','dependency-version-too-low',
  'dependency-version-unknown','game-version-unknown','game-version-invalid','game-version-outside-range'
 ];
 for(const code of codes){
  const guide=explainRelationIssue({code,severity:'notice',message:'exemplo'});
  expect(guide.heading.length).toBeGreaterThan(12);
  expect(guide.meaning.length).toBeGreaterThan(30);
  expect(guide.nextStep.length).toBeGreaterThan(35);
  expect(['Dependências','Conflitos','Versões']).toContain(guide.group);
  expect(guide.nextStep).not.toMatch(/compatibilidade garantida|instalar automaticamente/i);
 }
 const catalog=parseCatalogManifest(fixture);
 const rel=analyzeModRelations(catalog,'ets2-sound-engine');
 const summary=summarizeRelationIssues(rel.issues);
 expect(summary.blocking).toBeGreaterThan(0);
 expect(summary.attention).toBeGreaterThan(0);
 expect(summary.declaredCount).toBe(rel.issues.length);
 expect(summary.realCompatibilityVerified).toBe(false);
 expect(summarizeRelationIssues([])).toEqual({
  blocking:0,attention:0,declaredCount:0,realCompatibilityVerified:false
 });
});

test('Detalhes explica requisitos declarados com detalhes expansíveis e versão simulada',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(upload(fixture));
 await page.getByRole('button',{name:'Som de motor (exemplo)',exact:true}).click();
 const relation=page.getByRole('region',{name:'Simulação de dependências'});
 await expect(relation.getByRole('heading',{name:'O que significam os alertas'})).toBeVisible();
 await expect(relation.getByLabel('Resumo das relações declaradas')).toContainText('Bloqueios no catálogo');
 await expect(relation.locator('.relation-issues li.blocking')).toHaveCount(1);
 await expect(relation.locator('.relation-issues li.notice')).toHaveCount(1);
 const dep=relation.locator('.relation-issues li.blocking').first();
 await expect(dep.getByText('Versão declarada da dependência abaixo do mínimo')).toBeVisible();
 await expect(dep.getByText(/exige Biblioteca de áudio/)).toBeVisible();
 const explanation=dep.getByText('Entender e conferir este alerta');
 await expect(explanation).toBeVisible();
 await explanation.click();
 await expect(dep.getByText(/A versão instalada no jogo não foi consultada/)).toBeVisible();
 await expect(dep.getByText(/Uma atualização real só poderá ser proposta após leitura segura/)).toBeVisible();
 await page.getByRole('textbox',{name:'Versão hipotética do jogo'}).fill('1.57');
 await expect(relation.getByText('Versão hipotética fora da faixa declarada')).toBeVisible();
 await expect(relation.locator('.relation-issues li.blocking')).toHaveCount(2);
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});

test('conflitos declarados ganham explicação sem serem confundidos com mods instalados',async({page})=>{
 const text=JSON.stringify({schemaVersion:1,mods:[
  {id:'bus',title:'Ônibus fictício',game:'omsi',category:'Ônibus',version:'1.0',description:'Demo',size:'15 MB'},
  {id:'skin',title:'Skin fictícia',game:'omsi',category:'Gráficos',version:'1.0',description:'Demo',size:'1 MB',requires:['bus'],conflictsWith:['bus']}
 ]});
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(upload(text));
 await page.getByRole('button',{name:'Skin fictícia',exact:true}).click();
 const issue=page.getByRole('region',{name:'Simulação de dependências'}).locator('.relation-issues li.blocking');
 await expect(issue).toContainText('Conflito entre registros da mesma sequência');
 await issue.getByText('Entender e conferir este alerta').click();
 await expect(issue.getByText(/Não sabemos se estão instalados/)).toBeVisible();
 await expect(issue.getByText(/Não copie ambos automaticamente/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});

test('painel de relações não gera cortes horizontais a 390 e 850 pixels',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(upload(fixture));
 await page.getByRole('button',{name:'Som de motor (exemplo)',exact:true}).click();
 const region=page.getByRole('region',{name:'Simulação de dependências'});
 await region.getByText('Entender e conferir este alerta').first().click();
 for(const width of [390,850]){
  await page.setViewportSize({width,height:790});
  const positions=await region.evaluate(el=>({
   pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
   viewWidth:document.documentElement.clientWidth,
   elements:[...el.querySelectorAll('.relation-overview,.relation-issues li,.relation-guide summary')].map(x=>{
    const r=x.getBoundingClientRect();return {left:r.left,right:r.right};
   })
  }));
  expect(positions.pageOverflow,'Rolagem horizontal em '+width).toBeLessThanOrEqual(3);
  for(const bounds of positions.elements){
   expect(bounds.left).toBeGreaterThanOrEqual(-3);
   expect(bounds.right).toBeLessThanOrEqual(positions.viewWidth+3);
  }
 }
});
