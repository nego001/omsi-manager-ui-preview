import {test,expect} from '@playwright/test';
import {analyzeDeclaredBatch} from '../src/batch-declared-analysis';
import {prepareBatchReviewReadiness} from '../src/batch-review-readiness';
import {SYNTHETIC_MODULE_IDS} from '../src/distributed-reader-contract';
import type {CatalogMod} from '../src/catalog';

const mod=(id:string,game:'omsi'|'ets2'|'ats'='omsi'):CatalogMod=>({
 id,title:id,game,category:'Ônibus',version:'1.0',description:'Fictício',size:'1 MB',safe:true,
 requires:[],conflictsWith:[]
});
test('usa os oito especialistas compartilhados com gate antes dos demais',()=>{
 const report=analyzeDeclaredBatch([mod('bus'),mod('sound')],['bus','sound']);
 const result=prepareBatchReviewReadiness(report);
 expect(result.specialists.map(x=>x.id)).toEqual([...SYNTHETIC_MODULE_IDS]);
 expect(result.specialists[0].phase).toBe('gate');
 expect(result.specialists.slice(1).every(x=>x.phase==='specialists')).toBe(true);
 expect(result.specialists.every(x=>x.status==='not-run')).toBe(true);
 expect(result.realPackagesRead).toBe(false);
 expect(result.evidenceVerified).toBe(false);
 expect(result.compatibilityVerified).toBe(false);
 expect(result.installEnabled).toBe(false);
 expect(Object.isFrozen(result)).toBe(true);
 expect(Object.isFrozen(result.specialists)).toBe(true);
 expect(Object.isFrozen(result.specialists[0])).toBe(true);
});
test('bloqueios declarativos continuam sem desbloquear instalação ou simular leitura',()=>{
 const report=analyzeDeclaredBatch([
  {...mod('broken'),requires:['missing']}
 ],['broken']);
 expect(report.blockers).toBe(1);
 const ready=prepareBatchReviewReadiness(report);
 expect(ready.declaredBlockers).toBe(1);
 expect(ready.state).toBe('awaiting-real-reader');
 expect(ready.specialists).toHaveLength(8);
 expect(ready.installEnabled).toBe(false);
});
test('contrato incompleto ou uma falsa permissão de escrita são rejeitados',()=>{
 const report=analyzeDeclaredBatch([mod('bus')],['bus']);
 for(const patch of [{mode:'real'},{canInstall:true},{compatibilityVerified:true},
  {installationVerified:true},{selectedCount:0},{blockers:-1}]){
  expect(()=>prepareBatchReviewReadiness({...report,...patch} as typeof report))
   .toThrow('BATCH_READINESS_REFUSED');
 }
});
test('Biblioteca mostra etapas compartilhadas não executadas após análise declarativa',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const card=page.locator('.mod-card').filter({
  has:page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})
 });
 await card.getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 const results=page.getByRole('region',{name:'Resultado da análise conjunta'});
 await results.getByText('O que o analisador cooperativo precisará verificar?').click();
 const steps=results.getByRole('list',{name:'Verificações cooperativas pendentes'}).locator('li');
 await expect(steps).toHaveCount(8);
 await expect(steps.first()).toContainText('Segurança do pacote');
 await expect(steps.last()).toContainText('Versões, dependências e conflitos');
 await expect(results).toContainText('Nenhum especialista executado');
 await expect(page.getByRole('navigation',{name:'Navegação principal'})).toBeVisible();
 await nav.getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});
