import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {compareSyntheticRevisions} from '../src/synthetic-revision-comparison';
import {filterSyntheticDiagnosticTimeline} from '../src/synthetic-timeline-filter';
import type {SyntheticDiagnosticTimeline} from '../src/synthetic-diagnostic-timeline';

const scenarios=createSyntheticDiagnosticDemo();
const comparison=(step:number,from:number,to:number)=>
 compareSyntheticRevisions(scenarios[step].timeline,from,to);

test('análise inicial tem somente uma revisão e não pode ser comparada a ela mesma',()=>{
 expect(()=>comparison(0,1,1)).toThrow('Selecione revisões diferentes');
 expect(()=>comparison(0,1,2)).toThrow('Revisão sintética não encontrada');
});
test('pintura alterada deixa todos os sete especialistas pendentes',()=>{
 const x=comparison(1,1,2);
 expect(x.before.revision).toBe(1);
 expect(x.after.revision).toBe(2);
 expect(x.before.state).toBe('candidate');
 expect(x.after.state).toBe('recheck-required');
 expect(x.changedModules).toBe(7);
 expect(x.unchangedModules).toBe(0);
 expect(x.modules.every(m=>m.beforeStatus==='ok'&&m.afterStatus==='pending')).toBe(true);
 expect(x.modules.every(m=>m.change==='status-changed')).toBe(true);
 expect(x.actualContentCompared).toBe(false);
 expect(x.compatibilityVerified).toBe(false);
 expect(x.operationsEnabled).toBe(false);
});
test('reanálise incompleta deixa apenas áudio ausente, além das pistas declaradas de impacto',()=>{
 const x=comparison(2,1,2);
 expect(x.before.state).toBe('candidate');
 expect(x.after.state).toBe('incomplete');
 const audio=x.modules.find(m=>m.moduleId==='audio')!;
 expect(audio.beforeStatus).toBe('ok');
 expect(audio.afterStatus).toBe('missing');
 expect(audio.explanation).toContain('não apresentou relatório');
 expect(x.changedModules).toBe(5);
 expect(x.unchangedModules).toBe(2);
 expect(x.modules.filter(m=>m.change==='affected-marker-changed').map(m=>m.moduleId))
  .toEqual(['structure','definitions','resources','media']);
});
test('nova revisão sonora muda situação de todos os módulos, inclusive áudio ausente',()=>{
 const x=comparison(3,2,3);
 expect(x.before.state).toBe('incomplete');
 expect(x.after.state).toBe('recheck-required');
 expect(x.changedModules).toBe(7);
 expect(x.modules.find(m=>m.moduleId==='audio')?.beforeStatus).toBe('missing');
 expect(x.modules.find(m=>m.moduleId==='audio')?.afterStatus).toBe('pending');
 expect(x.explanation).toContain('Nova revisão pendente');
});
test('seleção não consecutiva permite comparar primeira com terceira sem reaproveitar resultado antigo',()=>{
 const x=comparison(3,1,3);
 expect(x.before.revision).toBe(1);
 expect(x.after.revision).toBe(3);
 expect(x.before.candidateGame).toBe('omsi');
 expect(x.before.superseded).toBe(true);
 expect(x.after.candidateGame).toBeNull();
 expect(x.previousEvidenceReusable).toBe(false);
 expect(x.changedModules).toBe(7);
});
test('mesmo status e contagem não provam bytes iguais',()=>{
 const x=comparison(2,1,2);
 const manifest=x.modules.find(m=>m.moduleId==='manifest')!;
 expect(manifest.changed).toBe(false);
 expect(manifest.change).toBe('no-declared-change');
 expect(manifest.explanation).toContain('não comprova que o conteúdo real permaneceu igual');
 expect(x.actualContentCompared).toBe(false);
});
test('filtro que oculta módulos nunca altera os dados que a comparação aceita',()=>{
 const original=scenarios[3].timeline;
 const filtered=filterSyntheticDiagnosticTimeline(original,'blocked');
 expect(filtered.visibleModules).toBe(0);
 const x=compareSyntheticRevisions(original,2,3);
 expect(x.modules).toHaveLength(7);
 expect(x.changedModules).toBe(7);
 expect(()=>compareSyntheticRevisions(filtered,2,3)).toThrow('Linha do tempo sintética não emitida');
});
test('nunca compara a mesma revisão, ordem inversa, decimais ou IDs fora do histórico',()=>{
 const timeline=scenarios[3].timeline;
 for(const args of [[3,3],[3,1],[1.2,3],[-1,3],[1,NaN],[0,1]] as const){
  expect(()=>compareSyntheticRevisions(timeline,args[0],args[1])).toThrow();
 }
});
test('histórico falso ou cópia JSON não pode se passar por projeção autorizada',()=>{
 const src=scenarios[3].timeline;
 const clone=JSON.parse(JSON.stringify(src)) as SyntheticDiagnosticTimeline;
 expect(()=>compareSyntheticRevisions(clone,2,3)).toThrow('Linha do tempo sintética não emitida');
 expect(()=>compareSyntheticRevisions({...src},2,3)).toThrow('Linha do tempo sintética não emitida');
});
test('modulos preservam ordem canônica em toda comparação',()=>{
 const x=comparison(3,1,2);
 expect(x.modules.map(m=>m.moduleId)).toEqual([
  'structure','manifest','definitions','resources','audio','media','relations'
 ]);
});
test('campos de comparação não incluem identificadores, handles, paths ou digest de fixture',()=>{
 const text=JSON.stringify(comparison(3,1,2));
 for(const forbidden of ['synthetic-entry-','/','Vehicles','skins/','audio/','revisionTicket','eeeeeeee']){
  expect(text).not.toContain(forbidden);
 }
});
test('resultado, colunas e cada módulo são imutáveis',()=>{
 const x=comparison(2,1,2);
 expect(Object.isFrozen(x)).toBe(true);
 expect(Object.isFrozen(x.before)).toBe(true);
 expect(Object.isFrozen(x.after)).toBe(true);
 expect(Object.isFrozen(x.modules)).toBe(true);
 expect(x.modules.every(m=>Object.isFrozen(m))).toBe(true);
});
test('comparação é determinística, sem mutar a timeline original',()=>{
 const src=scenarios[3].timeline;
 const before=JSON.stringify(src);
 const a=comparison(3,2,3),b=comparison(3,2,3);
 expect(a).toEqual(b);
 expect(JSON.stringify(src)).toBe(before);
});
