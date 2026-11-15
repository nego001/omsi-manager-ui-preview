import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseCatalogManifest} from '../src/catalog';
import {summarizeDeclaredStatus} from '../src/library-declared-status';

const catalogText=readFileSync(resolve('examples/catalog.versions.example.json'),'utf8');
const mods=parseCatalogManifest(catalogText);
const fixture={name:'alerts-example.json',mimeType:'application/json',buffer:Buffer.from(catalogText)};

test('estados derivados refletem somente relações declaradas, não compatibilidade',()=>{
 const blocked=summarizeDeclaredStatus(mods,'ets2-sound-engine');
 expect(blocked.kind).toBe('blocking');
 expect(blocked.blockers).toBeGreaterThan(0);
 expect(blocked.compatibilityVerified).toBe(false);
 expect(blocked.installationVerified).toBe(false);
 const uncertain=summarizeDeclaredStatus(mods,'ets2-paint');
 expect(uncertain.kind).toBe('attention');
 expect(uncertain.notices).toBeGreaterThan(0);
 expect(uncertain.compatibilityVerified).toBe(false);
 const noIssues=summarizeDeclaredStatus(mods,'ets2-sound-core');
 expect(noIssues.kind).toBe('no-issues');
 expect(noIssues.issueCount).toBe(0);
 expect(noIssues.compatibilityVerified).toBe(false);
 expect(noIssues.installationVerified).toBe(false);
});

test('biblioteca agrupa bloqueios, avisos e sem alertas no JSON, todos não verificados',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(fixture);
 for(const title of ['Biblioteca de áudio (exemplo)','Som de motor (exemplo)','Pintura demonstrativa']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.locator('.library-mod-status')).toHaveCount(3);
 await expect(page.locator('.library-mod-status.blocking')).toHaveCount(1);
 await expect(page.locator('.library-mod-status.attention')).toHaveCount(1);
 await expect(page.locator('.library-mod-status.no-issues')).toHaveCount(1);
 await expect(page.getByText('1 com bloqueios',{exact:false})).toBeVisible();
 await expect(page.getByText('Ausência de alertas declarados não comprova compatibilidade nem instalação.',{exact:false})).toBeVisible();
 const state=page.getByRole('combobox',{name:'Filtrar alertas declarados'});
 await state.selectOption('blocking');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await expect(page.getByRole('button',{name:'Som de motor (exemplo)',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Pintura demonstrativa',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Som de motor (exemplo)',exact:true}).click();
 await expect(page.getByRole('region',{name:'Relatório consolidado'}).getByText('Inconsistências no catálogo')).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(state).toHaveValue('blocking');
 await state.selectOption('attention');
 await expect(page.getByRole('button',{name:'Pintura demonstrativa',exact:true})).toBeVisible();
 await state.selectOption('no-issues');
 await expect(page.getByRole('button',{name:'Biblioteca de áudio (exemplo)',exact:true})).toBeVisible();
 await expect(page.locator('.library-mod-status.no-issues')).toContainText('não verificado');
 await state.selectOption('all');
 await expect(page.getByText('3 favoritos exibidos')).toBeVisible();
});

test('limpar filtros recupera favoritos e não afeta catálogo nem instalação',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(fixture);
 const item=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Som de motor (exemplo)',exact:true})});
 await item.getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('combobox',{name:'Filtrar alertas declarados'}).selectOption('no-issues');
 await expect(page.getByRole('heading',{name:'Nenhum favorito nesses filtros'})).toBeVisible();
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(page.getByRole('combobox',{name:'Filtrar alertas declarados'})).toHaveValue('all');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await expect(page.locator('.mod-card')).toHaveCount(3);
 await page.getByRole('button',{name:'Som de motor (exemplo)',exact:true}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});
