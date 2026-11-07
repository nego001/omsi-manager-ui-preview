import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {explainSyntheticDiagnosticDecision} from '../src/synthetic-decision-explanation';
import {filterSyntheticDiagnosticTimeline} from '../src/synthetic-timeline-filter';
import {buildSyntheticPackageIndex,projectSyntheticIndex,issueSyntheticRevisionTicket,type SyntheticPackageIndex} from '../src/synthetic-package-index';
import {runSyntheticIndexedWorkers,type SyntheticWorkerDeclaration} from '../src/synthetic-index-workers';
import {createSyntheticEvidenceHistory} from '../src/synthetic-evidence-history';
import {projectSyntheticDiagnosticTimeline,type SyntheticDiagnosticTimeline} from '../src/synthetic-diagnostic-timeline';
import {SYNTHETIC_MODULE_IDS,type SyntheticModuleId} from '../src/distributed-reader-contract';
const steps=createSyntheticDiagnosticDemo(), ids=SYNTHETIC_MODULE_IDS.slice(1);
type Specialist=Exclude<SyntheticModuleId,'container'>;
const declaredPaths=['Vehicles/fictive.bus','def/engine.sii','meta/manifest.json','audio/engine.wav'];
function makeIndex():SyntheticPackageIndex{
 const x=buildSyntheticPackageIndex('f'.repeat(64),declaredPaths.map(path=>({
  path,kind:'file',encodedBytes:100,expandedBytes:150,declaredFormat:'well-formed'
 })));
 expect(x.status).toBe('ready');return x.index!;
}
function declarations(i:SyntheticPackageIndex):SyntheticWorkerDeclaration[]{
 return SYNTHETIC_MODULE_IDS.filter((id):id is Specialist=>id!=='container').map(moduleId=>{
  const suffix=moduleId==='structure'?'bus':moduleId==='manifest'?'json':moduleId==='definitions'?'sii':null;
  const item=suffix?projectSyntheticIndex(i,moduleId).entries.find(e=>e.suffix===suffix):undefined;
  return {moduleId,status:'ok' as const,fixtureDigest:i.fixtureDigest,
   revisionTicket:issueSyntheticRevisionTicket(i,moduleId),
   observations:item?[{handle:item.handle,game:'omsi' as const,
    revisionTicket:issueSyntheticRevisionTicket(i,moduleId,item.handle)}]:[]};
 });
}
function timelineWith(change:(x:SyntheticWorkerDeclaration)=>SyntheticWorkerDeclaration){
 const i=makeIndex();
 const result=runSyntheticIndexedWorkers(i,declarations(i).map(change));
 return projectSyntheticDiagnosticTimeline(createSyntheticEvidenceHistory(i,result));
}
test('candidato fictício não se torna compatibilidade ou instalação confirmada',()=>{
 const timeline=steps[0].timeline,d=explainSyntheticDiagnosticDecision(timeline,1);
 expect(d.state).toBe('candidate');
 expect(d.candidateGame).toBe('omsi');
 expect(d.confirmation).toBe('not-confirmed');
 expect(d.receivedReports).toBe(7);
 expect(d.waitingReports).toBe(0);
 expect(d.totalDeclaredObservations).toBe(3);
 expect(d.reasons.map(r=>r.code)).toContain('candidate-provisional');
 expect(d.compatibilityVerified).toBe(false);
 expect(d.installationVerified).toBe(false);
 expect(d.operationsEnabled).toBe(false);
});
test('limitações essenciais estão presentes inclusive quando os sete relatórios foram recebidos',()=>{
 const d=explainSyntheticDiagnosticDecision(steps[0].timeline,1);
 expect(d.reasons.slice(0,5).map(r=>r.code)).toEqual([
  'fixture-only','real-bytes-unverified','digest-unverified','compatibility-unverified','installation-unverified'
 ]);
 expect(d.reasons.every(r=>r.realWorldProof===false)).toBe(true);
 expect(d.realBytesRead).toBe(false);
 expect(d.digestVerified).toBe(false);
});
test('revisão recém-aberta suspende candidato e exige sete novos relatos',()=>{
 const d=explainSyntheticDiagnosticDecision(steps[1].timeline,2);
 expect(d.state).toBe('recheck-required');
 expect(d.candidateGame).toBeNull();
 expect(d.waitingReports).toBe(7);
 expect(d.receivedReports).toBe(0);
 expect(d.totalDeclaredObservations).toBe(0);
 expect(d.declaredEvidence.every(x=>x.status==='pending')).toBe(true);
 expect(d.reasons.map(x=>x.code)).toContain('reanalysis-pending');
});
test('reanálise incompleta identifica módulo ausente sem criar relação causal com textura',()=>{
 const d=explainSyntheticDiagnosticDecision(steps[2].timeline,2);
 expect(d.state).toBe('incomplete');
 expect(d.waitingReports).toBe(1);
 expect(d.receivedReports).toBe(6);
 const audio=d.declaredEvidence.find(e=>e.moduleId==='audio')!;
 expect(audio.status).toBe('missing');
 expect(audio.declaredImpactHint).toBe(false);
 expect(audio.description).toContain('Nenhum relatório fictício recebido');
 expect(d.reasons.map(x=>x.code)).toContain('report-missing');
 expect(d.candidateGame).toBeNull();
});
test('nova revisão sonora reinicia contagens e não reutiliza relatório ausente antigo',()=>{
 const d=explainSyntheticDiagnosticDecision(steps[3].timeline,3);
 expect(d.revision).toBe(3);
 expect(d.state).toBe('recheck-required');
 expect(d.receivedReports).toBe(0);
 expect(d.waitingReports).toBe(7);
 expect(d.blockedReports).toBe(0);
 expect(d.totalDeclaredObservations).toBe(0);
});
test('explicação histórica identifica candidato como não vigente',()=>{
 const d=explainSyntheticDiagnosticDecision(steps[3].timeline,1);
 expect(d.isHistorical).toBe(true);
 expect(d.candidateGame).toBe('omsi');
 expect(d.headline).toContain('histórica');
 expect(d.reasons.map(r=>r.code)).toContain('revision-superseded');
 expect(d.confirmation).toBe('not-confirmed');
 expect(d.previousEvidenceReusable).toBe(false);
});
test('estado histórico incompleto mantém motivo passado, sem promover candidato',()=>{
 const d=explainSyntheticDiagnosticDecision(steps[3].timeline,2);
 expect(d.isHistorical).toBe(true);
 expect(d.state).toBe('incomplete');
 expect(d.candidateGame).toBeNull();
 expect(d.reasons.map(r=>r.code)).toContain('report-missing');
 expect(d.reasons.map(r=>r.code)).toContain('revision-superseded');
});
test('ambiguidade entre reivindicações fictícias proíbe candidato',()=>{
 const t=timelineWith(x=>x.moduleId==='manifest'?{
  ...x,observations:x.observations.map(o=>({...o,game:'ats' as const}))
 }:x);
 const d=explainSyntheticDiagnosticDecision(t,1);
 expect(d.state).toBe('ambiguous');
 expect(d.candidateGame).toBeNull();
 expect(d.reasons.map(r=>r.code)).toContain('contradictory-claims');
 expect(d.operationsEnabled).toBe(false);
});
test('sete relatórios sem indicação de jogo continuam insuficientes',()=>{
 const t=timelineWith(x=>({...x,observations:[]}));
 const d=explainSyntheticDiagnosticDecision(t,1);
 expect(d.state).toBe('unknown');
 expect(d.receivedReports).toBe(7);
 expect(d.totalDeclaredObservations).toBe(0);
 expect(d.reasons.map(r=>r.code)).toContain('insufficient-claims');
});
test('especialista bloqueado apresenta bloqueio como estado fictício',()=>{
 const t=timelineWith(x=>x.moduleId==='audio'?{...x,status:'blocked' as const}:x);
 const d=explainSyntheticDiagnosticDecision(t,1);
 expect(d.state).toBe('blocked');
 expect(d.blockedReports).toBe(1);
 expect(d.reasons.map(r=>r.code)).toContain('report-blocked');
 expect(d.declaredEvidence.find(e=>e.moduleId==='audio')?.status).toBe('blocked');
 expect(d.installationVerified).toBe(false);
});
test('especialista incompleto não se confunde com relatório ausente',()=>{
 const t=timelineWith(x=>x.moduleId==='resources'?{...x,status:'incomplete' as const}:x);
 const d=explainSyntheticDiagnosticDecision(t,1);
 expect(d.state).toBe('incomplete');
 expect(d.waitingReports).toBe(1);
 expect(d.reasons.map(r=>r.code)).toContain('report-incomplete');
 expect(d.reasons.map(r=>r.code)).not.toContain('report-missing');
});
test('ordem fixa dos sete especialistas independe do tipo de problema',()=>{
 const t=steps[3].timeline;
 for(const revision of [1,2,3]){
  const d=explainSyntheticDiagnosticDecision(t,revision);
  expect(d.declaredEvidence.map(e=>e.moduleId)).toEqual(ids);
  expect(d.declaredEvidence.every(e=>!e.verified&&e.source==='synthetic-fixture')).toBe(true);
 }
});
test('filtros que escondem dados não são aceitos como fonte de evidências',()=>{
 const filtered=filterSyntheticDiagnosticTimeline(steps[3].timeline,'blocked');
 expect(filtered.visibleModules).toBe(0);
 expect(()=>explainSyntheticDiagnosticDecision(filtered,3)).toThrow('não emitida');
});
test('timeline clonada ou reconstruída não permite fabricar parecer',()=>{
 const valid=steps[3].timeline;
 const fake=JSON.parse(JSON.stringify(valid)) as SyntheticDiagnosticTimeline;
 expect(()=>explainSyntheticDiagnosticDecision(fake,3)).toThrow('não emitida');
 expect(()=>explainSyntheticDiagnosticDecision({...valid},3)).toThrow('não emitida');
});
test('índice não numérico, inexistente, decimal ou fora do intervalo falha fechado',()=>{
 const t=steps[3].timeline;
 for(const revision of [-1,0,1.5,4,999,NaN,Infinity]){
  expect(()=>explainSyntheticDiagnosticDecision(t,revision)).toThrow();
 }
});
test('não expõe path, nome de arquivo, digest ou token',()=>{
 const serialized=JSON.stringify(explainSyntheticDiagnosticDecision(steps[3].timeline,3));
 for(const secret of ['Vehicles/','ambient.ogg','paint.dds','synthetic-entry','revisionTicket','eeeeeeee','/']){
  expect(serialized).not.toContain(secret);
 }
});
test('parecer, motivos e todas as evidências são imutáveis',()=>{
 const d=explainSyntheticDiagnosticDecision(steps[2].timeline,2);
 expect(Object.isFrozen(d)).toBe(true);
 expect(Object.isFrozen(d.reasons)).toBe(true);
 expect(Object.isFrozen(d.declaredEvidence)).toBe(true);
 expect(d.reasons.every(x=>Object.isFrozen(x))).toBe(true);
 expect(d.declaredEvidence.every(x=>Object.isFrozen(x))).toBe(true);
});
test('repetir projeção não modifica ou reclassifica o estado original',()=>{
 const t=steps[3].timeline,before=JSON.stringify(t);
 const first=explainSyntheticDiagnosticDecision(t,3);
 expect(explainSyntheticDiagnosticDecision(t,3)).toEqual(first);
 expect(JSON.stringify(t)).toBe(before);
 expect(first.previousEvidenceReusable).toBe(false);
});
