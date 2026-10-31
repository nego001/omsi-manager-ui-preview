import {test,expect} from '@playwright/test';
import {
 SYNTHETIC_MODULE_IDS,coordinateSyntheticEvidence,
 createSyntheticPlan,projectSyntheticSnapshot,type SyntheticModuleReport
} from '../src/distributed-reader-contract';

const digest='a'.repeat(64);
const anotherDigest='b'.repeat(64);
function reports(target='omsi' as 'omsi'|'ets2'|'ats'):SyntheticModuleReport[]{
 return SYNTHETIC_MODULE_IDS.map(moduleId=>({
  moduleId,contractVersion:1 as const,fixtureDigest:digest,status:'ok' as const,
  signals:moduleId==='structure'?[{game:target,evidenceId:'tree-marker'}]:
   moduleId==='manifest'?[{game:target,evidenceId:'manifest-marker'}]:
   moduleId==='definitions'?[{game:target,evidenceId:'definition-marker'}]:[]
 }));
}
function revise(all:SyntheticModuleReport[],id:SyntheticModuleReport['moduleId'],
 changes:Partial<SyntheticModuleReport>):SyntheticModuleReport[]{
 return all.map(entry=>entry.moduleId===id?{...entry,...changes}:entry);
}
test('plano sintético põe gate antes dos especialistas, sem execução habilitada',()=>{
 const plan=createSyntheticPlan();
 expect(plan.scope).toBe('synthetic-only');
 expect(plan.executionEnabled).toBe(false);
 expect(plan.phases).toHaveLength(2);
 expect(plan.phases[0].name).toBe('gate');
 expect(plan.phases[0].modules).toEqual(['container']);
 expect(plan.phases[1].modules).not.toContain('container');
 expect(Object.isFrozen(plan.phases)).toBe(true);
});

test('indícios complementares dão somente candidato fictício, nunca compatibilidade',()=>{
 const snapshot=coordinateSyntheticEvidence(digest,reports());
 expect(snapshot.state).toBe('candidate');
 expect(snapshot.candidateGame).toBe('omsi');
 expect(snapshot.evidence.map(item=>item.moduleId)).toEqual(['structure','manifest','definitions']);
 expect(snapshot.source).toBe('synthetic-fixture');
 expect(snapshot.digestVerified).toBe(false);
 expect(snapshot.compatibilityVerified).toBe(false);
 expect(snapshot.installationVerified).toBe(false);
 expect(snapshot.operationsEnabled).toBe(false);
 expect(Object.isFrozen(snapshot)).toBe(true);
 expect(Object.isFrozen(snapshot.evidence[0])).toBe(true);
});

test('ordem de conclusão e ordem dos sinais não mudam o snapshot compartilhado',()=>{
 const baseline=reports();
 const a=coordinateSyntheticEvidence(digest,baseline);
 const b=coordinateSyntheticEvidence(digest,[...baseline].reverse());
 expect(a).toEqual(b);
 expect(a.findings).toEqual([]);
});

test('manifesto ETS2 contra estrutura e definições ATS exige estado ambíguo',()=>{
 let all=reports('ats');
 all=revise(all,'manifest',{signals:[{game:'ets2',evidenceId:'manifest-says-ets2'}]});
 const snapshot=coordinateSyntheticEvidence(digest,all);
 expect(snapshot.state).toBe('ambiguous');
 expect(snapshot.candidateGame).toBeNull();
 expect(snapshot.findings).toContain('ambiguous-game');
 expect(projectSyntheticSnapshot(snapshot).library.gameCandidate).toBeNull();
 expect(projectSyntheticSnapshot(snapshot).installer.enabled).toBe(false);
});

test('nome ou manifesto isolado não vence ausência de evidência especializada',()=>{
 const onlyManifest=reports().map(r=>r.moduleId==='structure'||r.moduleId==='definitions'?{...r,signals:[]}:r);
 const snapshot=coordinateSyntheticEvidence(digest,onlyManifest);
 expect(snapshot.state).toBe('unknown');
 expect(snapshot.findings).toContain('insufficient-evidence');
 expect(snapshot.candidateGame).toBeNull();
});

test('ausência total de indícios permanece desconhecida, sem aprovar nada',()=>{
 const all=reports().map(r=>({...r,signals:[]}));
 const snapshot=coordinateSyntheticEvidence(digest,all);
 expect(snapshot.state).toBe('unknown');
 expect(snapshot.findings).toEqual(['no-evidence']);
 expect(snapshot.compatibilityVerified).toBe(false);
});

test('módulo não entregue ou incompleto impede classificação automática',()=>{
 const missing=coordinateSyntheticEvidence(digest,reports().filter(x=>x.moduleId!=='audio'));
 expect(missing.state).toBe('incomplete');
 expect(missing.findings).toContain('module-missing');
 expect(missing.candidateGame).toBeNull();
 const incomplete=coordinateSyntheticEvidence(digest,revise(reports(),'media',{status:'incomplete'}));
 expect(incomplete.state).toBe('incomplete');
 expect(incomplete.findings).toContain('module-incomplete');
 expect(incomplete.operationsEnabled).toBe(false);
});

test('gate é obrigatório e bloqueio de segurança prevalece sobre reconhecimento',()=>{
 expect(coordinateSyntheticEvidence(digest,reports().filter(x=>x.moduleId!=='container')).findings).toEqual(['gate-missing']);
 const gateIncomplete=coordinateSyntheticEvidence(digest,revise(reports(),'container',{status:'incomplete'}));
 expect(gateIncomplete.state).toBe('incomplete');
 expect(gateIncomplete.findings).toEqual(['gate-incomplete']);
 const blocked=coordinateSyntheticEvidence(digest,revise(reports(),'container',{status:'blocked'}));
 expect(blocked.state).toBe('blocked');
 expect(blocked.evidence).toHaveLength(0);
 expect(blocked.findings).toEqual(['gate-blocked']);
 const specialist=coordinateSyntheticEvidence(digest,revise(reports(),'audio',{status:'blocked'}));
 expect(specialist.state).toBe('blocked');
 expect(specialist.findings).toEqual(['module-blocked']);
});

test('digest declarado diferente ou inválido é bloqueado antes da fusão',()=>{
 const mismatch=coordinateSyntheticEvidence(digest,revise(reports(),'media',{fixtureDigest:anotherDigest}));
 expect(mismatch.state).toBe('blocked');
 expect(mismatch.findings).toEqual(['invalid-contract']);
 expect(coordinateSyntheticEvidence('../unsafe',reports()).state).toBe('blocked');
 expect(coordinateSyntheticEvidence('A'.repeat(64),reports()).state).toBe('blocked');
});

test('relatório duplicado, desconhecido ou extra é recusado',()=>{
 const all=reports();
 const duplicate=coordinateSyntheticEvidence(digest,[...all,all[0]]);
 expect(duplicate.state).toBe('blocked');
 const spoof={...all[0],moduleId:'fake-module'} as unknown as SyntheticModuleReport;
 expect(coordinateSyntheticEvidence(digest,[spoof,...all.slice(1)]).state).toBe('blocked');
 const extra={...all[0],absolutePath:'C:\\Users\\example\\Documents'} as SyntheticModuleReport;
 expect(coordinateSyntheticEvidence(digest,[extra,...all.slice(1)]).state).toBe('blocked');
});

test('evidências com caminho ou campo desconhecido não são publicadas',()=>{
 const all=reports();
 const unsafe=revise(all,'structure',{signals:[{game:'omsi',evidenceId:'../Users/private'}]});
 const snapshot=coordinateSyntheticEvidence(digest,unsafe);
 expect(snapshot.state).toBe('blocked');
 expect(JSON.stringify(snapshot)).not.toContain('Users');
 const injectedSignal={game:'omsi',evidenceId:'valid-marker',command:'install'} as unknown as SyntheticModuleReport['signals'][number];
 expect(coordinateSyntheticEvidence(digest,revise(all,'structure',{signals:[injectedSignal]})).state).toBe('blocked');
});

test('setores compartilham resultado sanitizado e Oficina/Instalador permanecem bloqueados',()=>{
 const snapshot=coordinateSyntheticEvidence(digest,reports('ets2'));
 const sectors=projectSyntheticSnapshot(snapshot);
 expect(sectors.library.gameCandidate).toBe('ets2');
 expect(sectors.library.installed).toBe(false);
 expect(sectors.library.compatibilityVerified).toBe(false);
 expect(sectors.diagnostics.evidenceCount).toBe(3);
 expect(sectors.workshop.skinEnabled).toBe(false);
 expect(sectors.workshop.audioEnabled).toBe(false);
 expect(sectors.installer.enabled).toBe(false);
 expect(JSON.stringify(sectors)).not.toContain(digest);
});
