import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {compareSyntheticRevisions} from '../src/synthetic-revision-comparison';
import {reviewSyntheticComparison} from '../src/synthetic-comparison-review';
import {filterSyntheticDiagnosticTimeline} from '../src/synthetic-timeline-filter';
import type {SyntheticRevisionComparison} from '../src/synthetic-revision-comparison';
const demos=createSyntheticDiagnosticDemo();
function review(stage:number,before:number,after:number){
 return reviewSyntheticComparison(compareSyntheticRevisions(demos[stage].timeline,before,after));
}
test('pintura alterada destaca quatro especialistas afetados, sem inventar sete falhas',()=>{
 const r=review(1,1,2);
 expect(r.investigateFirst).toBe(4);
 expect(r.recheckRequired).toBe(3);
 expect(r.informational).toBe(0);
 expect(r.items.filter(m=>m.priority==='investigate-first').map(m=>m.moduleId))
  .toEqual(['structure','definitions','resources','media']);
 expect(r.items.every(m=>m.statusChanged)).toBe(true);
 expect(r.items.every(m=>m.realRiskAssessed===false)).toBe(true);
});
test('pendência sem impacto declarado pede reanálise mas não vira risco confirmado',()=>{
 const r=review(1,1,2);
 for(const id of ['manifest','audio','relations']){
  const m=r.items.find(x=>x.moduleId===id)!;
  expect(m.priority).toBe('recheck-required');
  expect(m.cause).toBe('pending-report');
  expect(m.detail).toContain('não comprova modificação dos bytes');
 }
});
test('relatório ausente se diferencia de impacto em textura e de estado regular',()=>{
 const r=review(2,1,2);
 expect(r.investigateFirst).toBe(5);
 expect(r.recheckRequired).toBe(0);
 expect(r.informational).toBe(2);
 const audio=r.items.find(x=>x.moduleId==='audio')!;
 expect(audio.priority).toBe('investigate-first');
 expect(audio.cause).toBe('missing-report');
 expect(audio.headline).toBe('Relatório ausente');
 expect(audio.detail).toContain('não é aprovação');
});
test('observações iguais sem mudanças não são prova de bytes iguais',()=>{
 const r=review(2,1,2);
 for(const id of ['manifest','relations']){
  const item=r.items.find(m=>m.moduleId===id)!;
  expect(item.priority).toBe('informational');
  expect(item.cause).toBe('unchanged-indicators');
  expect(item.detail).toContain('não prova que os arquivos reais continuaram iguais');
 }
});
test('terceira revisão de som mantém orientação separada da gravidade',()=>{
 const r=review(3,2,3);
 expect(r.items).toHaveLength(7);
 expect(r.investigateFirst).toBe(3);
 expect(r.recheckRequired).toBe(4);
 expect(r.informational).toBe(0);
 expect(r.items.find(m=>m.moduleId==='audio')?.priority).toBe('investigate-first');
 expect(r.priorityDoesNotMeanRisk).toBe(true);
 expect(r.operationsEnabled).toBe(false);
});
test('comparação histórica não consecutiva mantém sete módulos e revisões certas',()=>{
 const r=review(3,1,3);
 expect(r.beforeRevision).toBe(1);
 expect(r.afterRevision).toBe(3);
 expect(r.items).toHaveLength(7);
 expect(r.items.map(m=>m.moduleId)).toEqual(['structure','manifest','definitions','resources','audio','media','relations']);
});
test('nenhum sinal de falso risco, compatibilidade ou permissão aparece nos resultados',()=>{
 const r=review(2,1,2);
 expect(r.actualContentCompared).toBe(false);
 expect(r.compatibilityVerified).toBe(false);
 expect(r.operationsEnabled).toBe(false);
 expect(r.items.every(m=>!m.verified&&!m.operationsEnabled&&!m.realRiskAssessed)).toBe(true);
 expect(r.investigateFirst+r.recheckRequired+r.informational).toBe(7);
});
test('comparação clonada, copiada ou fabricada não pode virar orientação emitida',()=>{
 const original=compareSyntheticRevisions(demos[3].timeline,1,3);
 expect(()=>reviewSyntheticComparison(JSON.parse(JSON.stringify(original)) as SyntheticRevisionComparison)).toThrow('Comparação sintética não emitida');
 expect(()=>reviewSyntheticComparison({...original})).toThrow('Comparação sintética não emitida');
});
test('linha do tempo filtrada é recusada pelo comparador antes da emissão de orientações',()=>{
 const filtered=filterSyntheticDiagnosticTimeline(demos[3].timeline,'blocked');
 expect(filtered.visibleModules).toBe(0);
 expect(()=>compareSyntheticRevisions(filtered,1,3)).toThrow('Linha do tempo sintética não emitida');
});
test('prioridade é determinística e não modifica a comparação fonte',()=>{
 const comparison=compareSyntheticRevisions(demos[3].timeline,2,3);
 const before=JSON.stringify(comparison);
 const first=reviewSyntheticComparison(comparison);
 const again=reviewSyntheticComparison(comparison);
 expect(first).toEqual(again);
 expect(JSON.stringify(comparison)).toBe(before);
});
test('conclusões e orientações são profundamente imutáveis',()=>{
 const r=review(2,1,2);
 expect(Object.isFrozen(r)).toBe(true);
 expect(Object.isFrozen(r.items)).toBe(true);
 expect(r.items.every(Object.isFrozen)).toBe(true);
});
test('não revela caminhos internos, tickets, handles ou digest declarado',()=>{
 const text=JSON.stringify(review(3,1,3));
 for(const forbidden of ['synthetic-entry-','Vehicles','skins/','audio/','revisionTicket','eeeeeeee','/'])
  expect(text).not.toContain(forbidden);
});
test('seletor inicial sem segundo índice não gera uma comparação fictícia',()=>{
 expect(()=>compareSyntheticRevisions(demos[0].timeline,1,2)).toThrow('Revisão sintética não encontrada');
});
test('pista declarada continua destacada mesmo quando status voltou a OK',()=>{
 const r=review(2,1,2);
 const media=r.items.find(m=>m.moduleId==='media')!;
 expect(media.statusChanged).toBe(false);
 expect(media.declaredImpactChanged).toBe(true);
 expect(media.priority).toBe('investigate-first');
 expect(media.cause).toBe('declared-impact');
});
