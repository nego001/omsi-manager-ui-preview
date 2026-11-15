import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {
 createSyntheticValidationReadiness,filterSyntheticValidationReadiness,
 type SyntheticValidationReadiness,type ValidationReadinessFilter
} from '../src/synthetic-validation-readiness';
import {filterSyntheticDiagnosticTimeline} from '../src/synthetic-timeline-filter';
const steps=createSyntheticDiagnosticDemo();
const make=(index:number)=>createSyntheticValidationReadiness(steps[index].timeline);
test('doze requisitos ficam não avaliados, sem autorização, mesmo com candidato inicial',()=>{
 const r=make(0);
 expect(r.totalRequirements).toBe(12);
 expect(r.notEvaluated).toBe(12);
 expect(r.completed).toBe(0);
 expect(r.receivedSyntheticReports).toBe(7);
 expect(r.declaredObservations).toBe(3);
 expect(r.requirements).toHaveLength(12);
 expect(r.requirements.every(x=>x.status==='not-evaluated'&&!x.completed&&!x.realWorldVerified)).toBe(true);
 expect(r.approvedForOperations).toBe(false);
 expect(r.readyForRealValidation).toBe(false);
 expect(r.operationPermissionGranted).toBe(false);
});
test('fases fixas distribuem três requisitos em cada etapa',()=>{
 const r=make(3);
 const phases=r.requirements.map(x=>x.phase);
 expect(phases).toEqual([
  'origin','origin','origin','integrity','integrity','integrity',
  'compatibility','compatibility','compatibility','execution','execution','execution'
 ]);
 for(const phase of ['origin','integrity','compatibility','execution'] as const){
  expect(filterSyntheticValidationReadiness(r,phase).shown).toBe(3);
 }
});
test('autorização e confinamento são requisitos, não permissões disponíveis',()=>{
 const r=make(0);
 expect(r.requirements.slice(0,3).map(x=>x.id)).toEqual([
  'explicit-file-consent','bounded-path-isolation','archive-resource-limits'
 ]);
 expect(r.requirements[1].proofNeeded).toContain('symlinks/junctions');
 expect(r.requirements.slice(0,3).every(x=>!x.operationsEnabled)).toBe(true);
});
test('SHA-256 real, parser seguro e evidências independentes ficam pendentes',()=>{
 const r=make(0);
 expect(r.requirements.slice(3,6).map(x=>x.id)).toEqual([
  'real-cryptographic-digest','safe-container-parser','independent-module-evidence'
 ]);
 expect(r.requirements[3].proofNeeded).toContain('SHA-256');
 expect(r.realHashesCalculated).toBe(false);
 expect(r.realFilesRead).toBe(false);
});
test('compatibilidade de jogo não é inferida por coincidência das declarações',()=>{
 const r=make(0);
 expect(r.requirements.slice(6,9).map(x=>x.id)).toEqual([
  'dependency-resolution','real-game-compatibility','physical-windows-validation'
 ]);
 expect(r.requirements[8].proofNeeded).toContain('Windows real');
 expect(r.approvedForOperations).toBe(false);
});
test('backup, TOCTOU e aprovação explícita aparecem como requisitos de operação',()=>{
 const r=make(3);
 expect(r.requirements.slice(9).map(x=>x.id)).toEqual([
  'backup-and-rollback','prewrite-recheck','separate-user-approval'
 ]);
 expect(r.requirements[10].proofNeeded).toContain('TOCTOU');
 expect(r.notice).toContain('nenhuma operação está autorizada');
});
test('abertura de nova revisão não libera um único item',()=>{
 const r=make(1);
 expect(r.currentState).toBe('recheck-required');
 expect(r.receivedSyntheticReports).toBe(0);
 expect(r.notEvaluated).toBe(12);
 expect(r.requirements.every(x=>x.status==='not-evaluated')).toBe(true);
});
test('relatório de áudio ausente não altera progresso da validação real',()=>{
 const r=make(2);
 expect(r.currentState).toBe('incomplete');
 expect(r.receivedSyntheticReports).toBe(6);
 expect(r.unresolvedSyntheticReasons).toContain('report-missing');
 expect(r.completed).toBe(0);
 expect(r.notEvaluated).toBe(12);
});
test('filtro por fase não altera totais nem autoriza ações',()=>{
 const r=make(3),f=filterSyntheticValidationReadiness(r,'execution');
 expect(f.shown).toBe(3);
 expect(f.totalRequirements).toBe(12);
 expect(f.notEvaluated).toBe(12);
 expect(f.completed).toBe(0);
 expect(f.approvedForOperations).toBe(false);
 expect(f.requirements.every(x=>x.phase==='execution')).toBe(true);
 expect(r.requirements).toHaveLength(12);
});
test('filtro inválido é recusado, inclusive texto de aprovação fabricado',()=>{
 const r=make(3);
 for(const filter of ['approved','ready','','ALL',null] as unknown as ValidationReadinessFilter[]){
  expect(()=>filterSyntheticValidationReadiness(r,filter)).toThrow('Filtro de requisitos inválido');
 }
});
test('projeção falsa, clonada ou filtrada não pode produzir checklist real',()=>{
 const r=make(3);
 expect(()=>filterSyntheticValidationReadiness({...r},'all')).toThrow('não emitido');
 expect(()=>filterSyntheticValidationReadiness(JSON.parse(JSON.stringify(r)) as SyntheticValidationReadiness,'origin')).toThrow('não emitido');
 expect(()=>createSyntheticValidationReadiness(filterSyntheticDiagnosticTimeline(steps[3].timeline,'blocked'))).toThrow('Timeline sintética não emitida');
});
test('requisitos, coleções e filtros são todos imutáveis',()=>{
 const r=make(0),f=filterSyntheticValidationReadiness(r,'all');
 expect(Object.isFrozen(r)).toBe(true);
 expect(Object.isFrozen(r.requirements)).toBe(true);
 expect(r.requirements.every(x=>Object.isFrozen(x))).toBe(true);
 expect(Object.isFrozen(r.unresolvedSyntheticReasons)).toBe(true);
 expect(Object.isFrozen(f)).toBe(true);
 expect(Object.isFrozen(f.requirements)).toBe(true);
});
test('nenhum campo serializado divulga caminhos privados, handles ou digest',()=>{
 const r=make(3),serial=JSON.stringify(r);
 for(const forbidden of ['Vehicles/','paint.dds','ambient.ogg','synthetic-entry','revisionTicket','eeeeeeee']){
  expect(serial).not.toContain(forbidden);
 }
 expect(r.operationsEnabled).toBe(false);
 expect(r.previousEvidenceReusable).toBe(false);
});
test('o checklist é determinístico sem alterar o diagnóstico original',()=>{
 const t=steps[3].timeline,before=JSON.stringify(t);
 expect(make(3)).toEqual(make(3));
 expect(JSON.stringify(t)).toBe(before);
});
