import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {mkdtemp,realpath,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {dependencyPreviewExample,projectDependencyObservation} from '../src/omsi-dependency-report';
const require=createRequire(import.meta.url);
const {observeDependencies}=require('../scripts/m104-bounded-local-dependency-observation.cjs');
test('real laboratory result satisfies fixed view contract without exposing filenames',async()=>{
 const root=await mkdtemp(path.join(await realpath(os.tmpdir()),'omsi-m105-view-'));
 try{
  await writeFile(path.join(root,'Test.bus'),'[model]\nprivate.cfg\n[model]\nmissing.cfg\n',{flag:'wx'});
  await writeFile(path.join(root,'private.cfg'),'fixture only',{flag:'wx'});
  const result=await observeDependencies(root,'Test.bus','vehicle-definition','utf-8');
  const view=projectDependencyObservation(result);
  expect(view?.state).toBe('review-required');
  expect(view?.rows.find(r=>r.status==='exact-observed')?.count).toBe(1);
  expect(view?.rows.find(r=>r.status==='not-observed-in-directory')?.count).toBe(1);
  expect(JSON.stringify(view)).not.toMatch(/private\.cfg|missing\.cfg|Test\.bus/);
  expect(view?.actualGameInspection).toBe(false);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('malformed report, forged permission, extra path and inconsistent totals fail closed',()=>{
 const base=dependencyPreviewExample('mixed');
 for(const raw of [{...base,operationsEnabled:true},{...base,path:'/private'},
  {...base,referenceOccurrences:6},{...base,budgetLimited:true},
  {...base,counts:{...base.counts,'exact-observed':-1}},
  {...base,counts:{...base.counts,extra:0}},{...base,encoding:'auto'},null])
  expect(projectDependencyObservation(raw)).toBeNull();
 let invoked=false;
 const getter=Object.defineProperty({...base},'role',{enumerable:true,get(){invoked=true;return 'vehicle-definition';}});
 expect(projectDependencyObservation(getter)).toBeNull();expect(invoked).toBe(false);
});
test('library shows explicit demonstration and never offers native file selection',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Minha biblioteca'}).click();
 const section=page.getByRole('region',{name:'Prévia de dependências OMSI'});
 await expect(section).toBeVisible();
 await expect(section.getByText('DEMONSTRAÇÃO FICTÍCIA · somente leitura')).toBeVisible();
 await expect(section.getByRole('button',{name:'Selecionar configuração OMSI (bloqueado)'})).toBeDisabled();
 await expect(section.getByText('Diferença de maiúsculas/minúsculas: 1')).toBeVisible();
 await section.getByRole('combobox',{name:'Cenário de dependências fictícias'}).selectOption('limited');
 await expect(section.getByText('Busca incompleta — revisão necessária')).toBeVisible();
 await expect(section.getByText('Não localizado na busca concluída:')).toHaveCount(0);
 await section.getByRole('combobox',{name:'Cenário de dependências fictícias'}).selectOption('empty');
 await expect(section.getByText('Sem evidência de referências')).toBeVisible();
});
