import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {filterSyntheticDiagnosticTimeline,type SyntheticTimelineFilter} from '../src/synthetic-timeline-filter';
const steps=createSyntheticDiagnosticDemo();
const filter=(step:number,mode:SyntheticTimelineFilter)=>filterSyntheticDiagnosticTimeline(steps[step].timeline,mode);

test('todos preservam as sete entradas de cada revisão e contagem coerente',()=>{
 const all=filter(3,'all');
 expect(all.revisions).toHaveLength(3);
 expect(all.visibleModules).toBe(21);
 expect(all.totalModules).toBe(21);
 expect(all.revisions.every(r=>r.events.length===8&&r.matchingModules===7)).toBe(true);
 expect(all.currentGameCandidate).toBeNull();
 expect(all.operationsEnabled).toBe(false);
});
test('pendentes incluem ausência e incompletude, mas não OK',()=>{
 const pending=filter(2,'pending');
 expect(pending.revisions[0].matchingModules).toBe(0);
 expect(pending.revisions[1].matchingModules).toBe(1);
 expect(pending.revisions[1].events[1].moduleId).toBe('audio');
 expect(pending.revisions[1].events[1].status).toBe('missing');
 expect(pending.revisions[1].pendingSpecialists).toBe(1);
});
test('bloqueados sem correspondências continuam exibindo todos os cabeçalhos históricos',()=>{
 const result=filter(3,'blocked');
 expect(result.visibleModules).toBe(0);
 expect(result.revisions.map(r=>r.events.length)).toEqual([1,1,1]);
 expect(result.revisions.map(r=>r.matchingModules)).toEqual([0,0,0]);
 expect(result.revisions[0].superseded).toBe(true);
 expect(result.revisions[2].current).toBe(true);
});
test('mudança de pintura indica exatamente quatro especialistas prioritários',()=>{
 const changed=filter(1,'changed');
 expect(changed.revisions[0].matchingModules).toBe(0);
 expect(changed.revisions[1].matchingModules).toBe(4);
 expect(changed.revisions[1].events.slice(1).map(e=>e.moduleId)).toEqual(['structure','definitions','resources','media']);
 expect(changed.revisions[1].pendingSpecialists).toBe(7);
});
test('terceira revisão de som altera especialistas sem ressuscitar indícios velhos',()=>{
 const changed=filter(3,'changed');
 expect(changed.currentGameCandidate).toBeNull();
 expect(changed.revisions[2].matchingModules).toBeGreaterThan(0);
 expect(changed.revisions[0].candidateIsHistorical).toBe(true);
 expect(changed.revisions[2].state).toBe('recheck-required');
});
test('filtro em cenário inicial mantém candidato como fictício sem criar permissões',()=>{
 const x=filter(0,'pending');
 expect(x.visibleModules).toBe(0);
 expect(x.currentGameCandidate).toBe('omsi');
 expect(x.digestVerified).toBe(false);
 expect(x.previousEvidenceReusable).toBe(false);
 expect(x.operationsEnabled).toBe(false);
});
test('filtro inválido é recusado em vez de tratado como modo permissivo',()=>{
 expect(()=>filterSyntheticDiagnosticTimeline(steps[0].timeline,'all-mods' as SyntheticTimelineFilter)).toThrow('Filtro sintético inválido');
});
test('resultados e eventos filtrados são imutáveis sem mutar a timeline original',()=>{
 const src=steps[3].timeline;
 const before=JSON.stringify(src);
 const p=filter(3,'pending');
 expect(Object.isFrozen(p)).toBe(true);
 expect(Object.isFrozen(p.revisions)).toBe(true);
 expect(p.revisions.every(r=>Object.isFrozen(r)&&Object.isFrozen(r.events))).toBe(true);
 expect(JSON.stringify(src)).toBe(before);
 expect(src.revisions[0].events.length).toBe(8);
});
test('ordem dos eventos preserva cabeçalho e posições dos módulos',()=>{
 const x=filter(1,'changed');
 const r=x.revisions[1];
 expect(r.events[0].kind).toBe('revision');
 expect(r.events.slice(1).every(e=>e.kind==='specialist')).toBe(true);
 expect(r.events.every(e=>e.verified===false&&e.operationsEnabled===false)).toBe(true);
});
