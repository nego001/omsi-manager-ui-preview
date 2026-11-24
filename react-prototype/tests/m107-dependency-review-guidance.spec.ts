import {test,expect} from '@playwright/test';
import {dependencyPreviewExample,dependencyStatuses} from '../src/omsi-dependency-report';
import {dependencyReviewGuidance as review} from '../src/omsi-dependency-guidance';
test('guidance prioritizes review, distinguishes incomplete evidence and never enables operations',()=>{
 const mixed=review(dependencyPreviewExample('mixed'))!;
 expect(mixed.items.map(i=>i.priority)).toEqual(['review','review','attention','information']);
 expect(mixed.referenceOccurrences).toBe(5);
 const limited=review(dependencyPreviewExample('limited'))!;
 expect(limited.coverage).toBe('partial-observation');
 expect(limited.items.some(i=>i.status==='not-observed-in-directory')).toBe(false);
 expect(review(dependencyPreviewExample('empty'))?.coverage).toBe('no-reference-evidence');
 for(const k of ['actualGameInspection','compatibilityVerified','automaticRepairAllowed','operationsEnabled'] as const)expect(mixed[k]).toBe(false);
 expect(review({...dependencyPreviewExample('mixed'),operationsEnabled:true})).toBeNull();
});
test('all nine categories have fixed guidance and omitted markers keep coverage partial',()=>{
 const counts=Object.fromEntries(dependencyStatuses.map(k=>[k,1]));
 const raw={...dependencyPreviewExample('limited'),counts,referenceOccurrences:9,unexaminedKnownMarkers:1};
 const r=review(raw)!;
 expect(r.items).toHaveLength(9);expect(r.coverage).toBe('partial-observation');
 expect(r.items.every(x=>x.title.length>0&&x.detail.length>0)).toBe(true);
 const exact={...dependencyPreviewExample('empty'),counts:{...dependencyPreviewExample('empty').counts,'exact-observed':1},referenceOccurrences:1,unexaminedKnownMarkers:1,entriesScanned:1};
 expect(review(exact)?.coverage).toBe('partial-observation');
});
test('library guidance switches with scenario and remains fictitious',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Minha biblioteca'}).click();
 const section=page.getByRole('region',{name:'Orientações fictícias de diagnóstico'});
 await expect(section.getByText('Conferir maiúsculas e minúsculas',{exact:false})).toBeVisible();
 await page.getByRole('combobox',{name:'Cenário de dependências fictícias'}).selectOption('limited');
 await expect(section.getByText('Parte do diagnóstico permanece inconclusiva.')).toBeVisible();
 await expect(section.getByText('Conferir origem da dependência',{exact:false})).toHaveCount(0);
 await expect(section.getByText('Busca parcial',{exact:false})).toBeVisible();
 await page.getByRole('combobox',{name:'Cenário de dependências fictícias'}).selectOption('empty');
 await expect(section.getByText('Sem evidência suficiente para concluir.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Selecionar configuração OMSI (bloqueado)'})).toBeDisabled();
});
