import {test,expect} from '@playwright/test';
import {buildSyntheticPackageIndex,issueSyntheticRevisionTicket,projectSyntheticIndex,type SyntheticPackageIndex} from '../src/synthetic-package-index';
import {runSyntheticIndexedWorkers,type SyntheticWorkerDeclaration} from '../src/synthetic-index-workers';
import {SYNTHETIC_MODULE_IDS,type SyntheticModuleId} from '../src/distributed-reader-contract';
import {createSyntheticEvidenceHistory,beginSyntheticHistoryRevision,completeSyntheticHistoryRevision,type SyntheticEvidenceHistory} from '../src/synthetic-evidence-history';
import {projectSyntheticDiagnosticTimeline} from '../src/synthetic-diagnostic-timeline';
const digest='1'.repeat(64);
type Specialist=Exclude<SyntheticModuleId,'container'>;
const names=['Vehicles/coach.bus','def/engine.sii','data/manifest.json','audio/engine.wav'];
const entry=(path:string)=>({path,kind:'file',encodedBytes:100,expandedBytes:150,declaredFormat:'well-formed'});
function index(files=names,hash=digest):SyntheticPackageIndex{
 const x=buildSyntheticPackageIndex(hash,files.map(entry));expect(x.status).toBe('ready');return x.index!;
}
function declarations(i:SyntheticPackageIndex,game:'omsi'|'ets2'|'ats'='omsi'):SyntheticWorkerDeclaration[]{
 return SYNTHETIC_MODULE_IDS.filter((id):id is Specialist=>id!=='container').map(moduleId=>{
  const suffix=moduleId==='structure'?'bus':moduleId==='manifest'?'json':moduleId==='definitions'?'sii':null;
  const file=suffix?projectSyntheticIndex(i,moduleId).entries.find(e=>e.suffix===suffix):undefined;
  return {moduleId,status:'ok' as const,fixtureDigest:i.fixtureDigest,
   revisionTicket:issueSyntheticRevisionTicket(i,moduleId),
   observations:file?[{handle:file.handle,game,revisionTicket:issueSyntheticRevisionTicket(i,moduleId,file.handle)}]:[]};
 });
}
function run(i:SyntheticPackageIndex,game:'omsi'|'ats'|'ets2'='omsi'){
 return runSyntheticIndexedWorkers(i,declarations(i,game));
}
function start(){
 const i=index();return {i,h:createSyntheticEvidenceHistory(i,run(i))};
}
function opened(h:SyntheticEvidenceHistory,files=names){
 const i=index(files);return {i,h:beginSyntheticHistoryRevision(h,i)};
}
test('primeira revisão tem sete módulos sintéticos OK e zero permissões reais',()=>{
 const {h}=start(),t=projectSyntheticDiagnosticTimeline(h),r=t.revisions[0];
 expect(r.events).toHaveLength(8);
 expect(r.events[0].code).toBe('new-analysis');
 expect(r.completedSpecialists).toBe(7);
 expect(r.pendingSpecialists).toBe(0);
 expect(r.blockedSpecialists).toBe(0);
 expect(r.events.slice(1).map(e=>e.moduleId)).toEqual(SYNTHETIC_MODULE_IDS.slice(1));
 expect(t.currentGameCandidate).toBe('omsi');
 expect(t.operationsEnabled).toBe(false);
 expect(t.digestVerified).toBe(false);
});
test('abertura de revisão torna conclusão anterior somente histórica',()=>{
 const {h}=start(),next=opened(h,[...names,'paint/skin.dds']);
 const t=projectSyntheticDiagnosticTimeline(next.h);
 expect(t.activeRevision).toBe(2);
 expect(t.state).toBe('recheck-required');
 expect(t.currentGameCandidate).toBeNull();
 expect(t.revisions[0].superseded).toBe(true);
 expect(t.revisions[0].candidateIsHistorical).toBe(true);
 expect(t.revisions[0].candidateGame).toBe('omsi');
 expect(t.revisions[1].candidateGame).toBeNull();
 expect(t.revisions[1].pendingSpecialists).toBe(7);
 expect(t.revisions[1].events.slice(1).every(e=>e.status==='pending')).toBe(true);
});
test('textura nova prioriza mídia e recursos sem dispensar os demais',()=>{
 const {h}=start(),t=projectSyntheticDiagnosticTimeline(opened(h,[...names,'paint/skin.dds']).h);
 const events=t.revisions[1].events;
 expect(events.find(e=>e.moduleId==='media')?.code).toBe('module-pending-affected');
 expect(events.find(e=>e.moduleId==='resources')?.code).toBe('module-pending-affected');
 expect(events.find(e=>e.moduleId==='audio')?.code).toBe('module-pending');
 expect(t.revisions[1].pendingSpecialists).toBe(7);
});
test('declarações idênticas não validam conteúdo e não reutilizam indícios',()=>{
 const {h}=start(),t=projectSyntheticDiagnosticTimeline(opened(h).h);
 expect(t.revisions[1].events[0].title).toContain('sem diferenças declaradas');
 expect(t.revisions[1].events.slice(1).every(e=>e.code==='module-pending')).toBe(true);
 expect(t.currentGameCandidate).toBeNull();
 expect(t.previousEvidenceReusable).toBe(false);
});
test('mudança do digest declarado obriga todos os módulos',()=>{
 const {h}=start(),i=index(names,'2'.repeat(64));
 const t=projectSyntheticDiagnosticTimeline(beginSyntheticHistoryRevision(h,i));
 expect(t.revisions[1].events[0].description).toContain('Não é hash verificado');
 expect(t.revisions[1].events.slice(1).every(e=>e.affectedByDeclaredChange)).toBe(true);
});
test('reanálise nova pode indicar ATS mantendo OMSI apenas no histórico',()=>{
 const {h}=start(),next=opened(h);
 const done=completeSyntheticHistoryRevision(next.h,run(next.i,'ats'));
 const t=projectSyntheticDiagnosticTimeline(done);
 expect(t.state).toBe('candidate');
 expect(t.currentGameCandidate).toBe('ats');
 expect(t.revisions[0].candidateGame).toBe('omsi');
 expect(t.revisions[0].superseded).toBe(true);
 expect(t.revisions[1].events[0].code).toBe('reanalysis-finished');
 expect(t.revisions[1].completedSpecialists).toBe(7);
});
test('relatório de áudio ausente não é apresentado como concluído',()=>{
 const {h}=start(),next=opened(h);
 const output=runSyntheticIndexedWorkers(next.i,declarations(next.i).filter(x=>x.moduleId!=='audio'));
 const t=projectSyntheticDiagnosticTimeline(completeSyntheticHistoryRevision(next.h,output));
 const audio=t.revisions[1].events.find(e=>e.moduleId==='audio');
 expect(audio?.status).toBe('missing');
 expect(audio?.code).toBe('module-missing');
 expect(t.revisions[1].pendingSpecialists).toBe(1);
 expect(t.currentGameCandidate).toBeNull();
});
test('relatório de recursos incompleto continua explícito',()=>{
 const {h}=start(),next=opened(h);
 const inputs=declarations(next.i).map(x=>x.moduleId==='resources'?{...x,status:'incomplete' as const}:x);
 const t=projectSyntheticDiagnosticTimeline(completeSyntheticHistoryRevision(next.h,runSyntheticIndexedWorkers(next.i,inputs)));
 expect(t.revisions[1].events.find(e=>e.moduleId==='resources')?.code).toBe('module-incomplete');
 expect(t.revisions[1].pendingSpecialists).toBe(1);
 expect(t.currentGameCandidate).toBeNull();
});
test('bloqueio de áudio é diferente de falta de relatório',()=>{
 const {h}=start(),next=opened(h);
 const inputs=declarations(next.i).map(x=>x.moduleId==='audio'?{...x,status:'blocked' as const}:x);
 const t=projectSyntheticDiagnosticTimeline(completeSyntheticHistoryRevision(next.h,runSyntheticIndexedWorkers(next.i,inputs)));
 expect(t.revisions[1].events.find(e=>e.moduleId==='audio')?.code).toBe('module-blocked');
 expect(t.revisions[1].blockedSpecialists).toBe(1);
 expect(t.revisions[1].pendingSpecialists).toBe(0);
 expect(t.currentGameCandidate).toBeNull();
});
test('indícios OMSI e ATS conflitantes continuam ambíguos',()=>{
 const {h}=start(),next=opened(h);
 const inputs=declarations(next.i).map(x=>x.moduleId==='manifest'?{...x,observations:x.observations.map(o=>({...o,game:'ats' as const}))}:x);
 const t=projectSyntheticDiagnosticTimeline(completeSyntheticHistoryRevision(next.h,runSyntheticIndexedWorkers(next.i,inputs)));
 expect(t.state).toBe('ambiguous');
 expect(t.currentGameCandidate).toBeNull();
 expect(t.operationsEnabled).toBe(false);
});
test('ordem e contagens dos especialistas permanecem determinísticas',()=>{
 const {h}=start(),t=projectSyntheticDiagnosticTimeline(h);
 const events=t.revisions[0].events.slice(1);
 expect(events.map(e=>e.moduleId)).toEqual(SYNTHETIC_MODULE_IDS.slice(1));
 expect(events.map(e=>e.observations)).toEqual([1,1,1,0,0,0,0]);
 expect(projectSyntheticDiagnosticTimeline(h)).toEqual(t);
});
test('três revisões não trazem candidato antigo para revisão pendente',()=>{
 const {h}=start(),v2=opened(h);
 const finished=completeSyntheticHistoryRevision(v2.h,run(v2.i,'ets2'));
 const v3=opened(finished);
 const t=projectSyntheticDiagnosticTimeline(v3.h);
 expect(t.revisions.map(x=>x.revision)).toEqual([1,2,3]);
 expect(t.revisions.filter(x=>x.superseded)).toHaveLength(2);
 expect(t.revisions[2].state).toBe('recheck-required');
 expect(t.currentGameCandidate).toBeNull();
});
test('projeção não revela caminhos, nomes, digest, handles nem tickets',()=>{
 const before=index(['Vehicles/PRIVATE_TEXT_A9.bus','def/engine.sii','data/manifest.json','audio/engine.wav']);
 const h=createSyntheticEvidenceHistory(before,run(before));
 const after=index(['Vehicles/PRIVATE_TEXT_B9.bus','def/engine.sii','data/manifest.json','audio/engine.wav']);
 const str=JSON.stringify(projectSyntheticDiagnosticTimeline(beginSyntheticHistoryRevision(h,after)));
 for(const privateValue of ['PRIVATE_TEXT','vehicles/','synthetic-entry-','revisionTicket',digest,'/'])
  expect(str).not.toContain(privateValue);
});
test('histórico clonado ou forjado não emite diagnóstico',()=>{
 const {h}=start();
 expect(()=>projectSyntheticDiagnosticTimeline(JSON.parse(JSON.stringify(h)) as SyntheticEvidenceHistory)).toThrow();
 expect(()=>projectSyntheticDiagnosticTimeline({...h})).toThrow();
});
test('eventos, módulos e revisões da timeline são imutáveis',()=>{
 const {h}=start(),t=projectSyntheticDiagnosticTimeline(opened(h).h);
 expect(Object.isFrozen(t)).toBe(true);expect(Object.isFrozen(t.revisions)).toBe(true);
 expect(t.revisions.every(x=>Object.isFrozen(x)&&Object.isFrozen(x.events))).toBe(true);
 expect(t.revisions.flatMap(r=>r.events).every(e=>Object.isFrozen(e))).toBe(true);
 expect(t.revisions.flatMap(r=>r.events).every(e=>e.operationsEnabled===false&&e.verified===false)).toBe(true);
});
test('limite de 24 revisões resulta em 192 eventos, sem cortar histórico',()=>{
 let {h}=start();
 for(let n=2;n<=24;n++){const next=opened(h);h=completeSyntheticHistoryRevision(next.h,run(next.i));}
 const t=projectSyntheticDiagnosticTimeline(h);
 expect(t.revisions).toHaveLength(24);
 expect(t.revisions.reduce((acc,r)=>acc+r.events.length,0)).toBe(192);
 expect(t.revisions[0].revision).toBe(1);
 expect(t.revisions[23].revision).toBe(24);
});
