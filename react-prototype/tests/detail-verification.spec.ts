import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const versions=readFileSync(resolve('examples/catalog.versions.example.json'),'utf8');
const imported={name:'diagnostico-demo.json',mimeType:'application/json',buffer:Buffer.from(versions)};

test('resumo de verificação distingue metadados, pastas, conteúdo e compatibilidade',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 const checklist=page.getByRole('region',{name:'Etapas de verificação do mod'});
 await expect(checklist).toBeVisible();
 await expect(checklist.getByRole('heading',{name:'O que já sabemos sobre este mod'})).toBeVisible();
 await expect(checklist.getByText('Exemplo demonstrativo, não extraído do mod.')).toBeVisible();
 await expect(checklist.getByText('Nenhuma inspeção de pasta realizada.')).toBeVisible();
 await expect(checklist.getByText('Arquivos internos, modelos, texturas e sons não analisados.')).toBeVisible();
 await expect(checklist.getByText(/Não verificada\. Sem comprovação de funcionamento/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 const report=page.getByRole('region',{name:'Relatório consolidado'});
 await expect(report).toHaveAttribute('id','relatorio-consolidado');
 await checklist.getByRole('link',{name:'Consultar evidências e limitações'}).click();
 await expect(page).toHaveURL(/#relatorio-consolidado$/);
 await expect(report.getByRole('heading',{name:'Relatório consolidado'})).toBeVisible();
});

test('JSON importado e inconsistências declaradas nunca viram compatibilidade atestada',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(imported);
 await page.getByRole('button',{name:'Som de motor (exemplo)',exact:true}).click();
 const checklist=page.getByRole('region',{name:'Etapas de verificação do mod'});
 await expect(checklist.getByText('JSON fornecido pelo usuário, sem validação contra o mod.')).toBeVisible();
 const compat=checklist.locator('.detail-check-item').filter({hasText:'Compatibilidade com o jogo'});
 await expect(compat.getByText('Não verificada.',{exact:false})).toBeVisible();
 await expect(compat.getByText(/inconsistência\(s\) declarada\(s\) no catálogo/)).toBeVisible();
 const report=page.getByRole('region',{name:'Relatório consolidado'});
 await expect(report.getByText('Inconsistências no catálogo')).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});

test('atalho de inspeção leva somente à escolha manual de pasta sem escanear sozinho',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 const checklist=page.getByRole('region',{name:'Etapas de verificação do mod'});
 await checklist.getByRole('button',{name:'Inspecionar pasta manualmente'}).click();
 await expect(page.getByRole('heading',{name:'Escolha seu simulador'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Inspeção de pastas de jogos'})).toBeVisible();
 await expect(page.locator('.inspection-result')).toHaveCount(0);
 await expect(page.getByText('Somente leitura',{exact:false}).first()).toBeVisible();
});

test('cartões de evidência continuam legíveis de 390 a 1440 pixels',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 for(const width of [390,850,1024,1440]){
  await page.setViewportSize({width,height:800});
  const checklist=page.getByRole('region',{name:'Etapas de verificação do mod'});
  await expect(checklist.locator('.detail-check-item')).toHaveCount(4);
  const measurement=await checklist.evaluate(el=>{
   const viewport=document.documentElement.clientWidth;
   const items=[...el.querySelectorAll('.detail-check-item,.detail-checklist-actions a,.detail-checklist-actions button')];
   return {viewport,overflow:document.documentElement.scrollWidth-viewport,items:items.map(x=>{
     const r=x.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};
   })};
  });
  expect(measurement.overflow,'Rolagem horizontal em '+width).toBeLessThanOrEqual(3);
  for(const item of measurement.items){
   expect(item.left,'Controle à esquerda em '+width).toBeGreaterThanOrEqual(-3);
   expect(item.right,'Controle à direita em '+width).toBeLessThanOrEqual(measurement.viewport+3);
   expect(item.height).toBeGreaterThan(20);
  }
 }
});
