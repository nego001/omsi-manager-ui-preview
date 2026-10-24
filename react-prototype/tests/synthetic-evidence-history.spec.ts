import {test,expect} from '@playwright/test';
import {buildSyntheticPackageIndex,issueSyntheticRevisionTicket,projectSyntheticIndex,type SyntheticPackageIndex} from '../src/synthetic-package-index';
import {runSyntheticIndexedWorkers,type SyntheticWorkerDeclaration,type SyntheticWorkerOutcome} from '../src/synthetic-index-workers';
import {SYNTHETIC_MODULE_IDS,type SyntheticModuleId} from '../src/distributed-reader-contract';
import {createSyntheticEvidenceHistory,beginSyntheticHistoryRevision,completeSyntheticHistoryRevision,
 projectSyntheticEvidenceHistory,type SyntheticEvidenceHistory} from '../src/synthetic-evidence-history';
const digest='c'.repeat(64);
const entry=(path:string)=>({path,kind:'file',encodedBytes:100,expandedBytes:150,declaredFormat:'well-formed'});
type Specialist=Exclude<SyntheticModuleId,'container'>;
function index(paths=['Vehicles/demo.bus','def/game.sii','meta/manifest.json','audio/engine.wav'],hash=digest){
 const output=buildSyntheticPackageIndex(hash,paths.map(entry));expect(output.status).toBe('ready');return output.index!;
}
function input(i:SyntheticPackageIndex,game:'omsi'|'ats'|'ets2'='omsi'):SyntheticWorkerDeclaration[]{
 return SYNTHETIC_MODULE_IDS.filter((id):id is Specialist=>id!=='container').map(moduleId=>{
  const suffix=moduleId==='structure'?'bus':moduleId==='manifest'?'json':moduleId==='definitions'?'sii':null;
  const part=suffix?projectSyntheticIndex(i,moduleId).entries.find(e=>e.suffix===suffix):undefined;
  return {moduleId,fixtureDigest:i.fixtureDigest,status:'ok' as const,
   revisionTicket:issueSyntheticRevisionTicket(i,moduleId),
   observations:part?[{handle:part.handle,game,revisionTicket:issueSyntheticRevisionTicket(i,moduleId,part.handle)}]:[]};
 });
}
function outcome(i:SyntheticPackageIndex,game:'omsi'|'ats'|'ets2'='omsi'){
 return runSyntheticIndexedWorkers(i,input(i,game));
}
function start(){const i=index(),o=outcome(i);return {i,o,h:createSyntheticEvidenceHistory(i,o)}}
test('primeira revisão registra candidato fictício, indícios e estado imutável',()=>{
 const {h}=start(),r=h.revisions[0];
 expect(h.activeRevision).toBe(1);expect(h.currentGameCandidate).toBe('omsi');
 expect(r.reason).toBe('initial-analysis');expect(r.evidenceCount).toBe(3);
 expect(r.pendingModules).toEqual([]);expect(r.superseded).toBe(false);
 expect(Object.isFrozen(h)).toBe(true);expect(Object.isFrozen(r)).toBe(true);
 expect(projectSyntheticEvidenceHistory(h).installer.enabled).toBe(false);
});
test('nova revisão substitui conclusão antiga e deixa sete especialistas pendentes',()=>{
 const {h}=start(),next=index(['Vehicles/demo.bus','def/game.sii','meta/manifest.json','audio/engine.wav','skins/new.dds']);
 const p=beginSyntheticHistoryRevision(h,next);
 expect(p.revisionCount).toBe(2);expect(p.state).toBe('recheck-required');
 expect(p.currentGameCandidate).toBeNull();expect(p.revisions[0].superseded).toBe(true);
 expect(p.revisions[1].pendingModules).toHaveLength(7);
 expect(p.revisions[1].evidenceCount).toBe(0);
 expect(p.revisions[1].previousRevision).toBe(1);
 expect(projectSyntheticEvidenceHistory(p).library.gameCandidate).toBeNull();
});
test('mesmas declarações e digest não autorizam aproveitar resultado antigo',()=>{
 const {h}=start(),p=beginSyntheticHistoryRevision(h,index());
 expect(p.revisions[1].reason).toBe('declarations-same-unverified');
 expect(p.revisions[1].changes).toEqual({added:0,removed:0,modified:0});
 expect(p.currentGameCandidate).toBeNull();
});
test('mudança de digest declarado registra necessidade de reanálise completa',()=>{
 const {h}=start(),p=beginSyntheticHistoryRevision(h,index(undefined,'b'.repeat(64)));
 expect(p.revisions[1].reason).toBe('declared-digest-changed');
 expect(p.revisions[1].affectedModules).toEqual(SYNTHETIC_MODULE_IDS);
});
test('resultado novo substitui pendência e preserva conclusão anterior só como histórica',()=>{
 const {h}=start(),next=index(),pending=beginSyntheticHistoryRevision(h,next);
 const done=completeSyntheticHistoryRevision(pending,outcome(next,'ats'));
 expect(done.state).toBe('candidate');expect(done.currentGameCandidate).toBe('ats');
 expect(done.revisions[0].candidateGame).toBe('omsi');
 expect(done.revisions[0].superseded).toBe(true);
 expect(done.revisions[1].reason).toBe('reanalysis-complete');
 expect(done.revisions[1].evidenceCount).toBe(3);
 expect(done.revisions[1].pendingModules).toEqual([]);
 expect(done.previousEvidenceReusable).toBe(false);
});
test('resultado antigo não pode encerrar nova revisão',()=>{
 const {h,o}=start(),p=beginSyntheticHistoryRevision(h,index());
 expect(()=>completeSyntheticHistoryRevision(p,o)).toThrow('não pertence à revisão');
});
test('resultado clonado ou fabricado não cria histórico válido',()=>{
 const {i,o}=start();
 expect(()=>createSyntheticEvidenceHistory(i,JSON.parse(JSON.stringify(o)) as SyntheticWorkerOutcome)).toThrow();
 expect(()=>createSyntheticEvidenceHistory(i,{...o,snapshot:{...o.snapshot,candidateGame:'ats'}})).toThrow();
});
test('resultado do mesmo digest mas emitido para outro índice não é aceito',()=>{
 const a=index(),b=index();
 expect(a.entries).toEqual(b.entries);
 expect(()=>createSyntheticEvidenceHistory(b,outcome(a))).toThrow();
});
test('não abre duas revisões pendentes nem encerra a mesma duas vezes',()=>{
 const {h}=start(),i=index(),p=beginSyntheticHistoryRevision(h,i);
 expect(()=>beginSyntheticHistoryRevision(p,index())).toThrow('já pendente');
 const done=completeSyntheticHistoryRevision(p,outcome(i));
 expect(()=>completeSyntheticHistoryRevision(done,outcome(i))).toThrow('não possui revisão pendente');
});
test('reutilizar mesmo objeto de índice não cria revisão fictícia nova',()=>{
 const {h,i}=start();
 expect(()=>beginSyntheticHistoryRevision(h,i)).toThrow('novo índice');
});
test('histórico clonado não pode abrir revisão nem renderizar projeções',()=>{
 const {h}=start(),cloned=JSON.parse(JSON.stringify(h)) as SyntheticEvidenceHistory;
 expect(()=>beginSyntheticHistoryRevision(cloned,index())).toThrow('Histórico sintético inválido');
 expect(()=>projectSyntheticEvidenceHistory(cloned)).toThrow('Histórico sintético inválido');
});
test('módulo ausente permanece pendente e não ressuscita candidato',()=>{
 const {h}=start(),i=index(),p=beginSyntheticHistoryRevision(h,i);
 const result=runSyntheticIndexedWorkers(i,input(i).filter(d=>d.moduleId!=='audio'));
 const done=completeSyntheticHistoryRevision(p,result);
 expect(done.state).toBe('incomplete');expect(done.currentGameCandidate).toBeNull();
 expect(done.revisions[1].reason).toBe('reanalysis-incomplete');
 expect(done.revisions[1].pendingModules).toEqual(['audio']);
 expect(done.revisions[1].findings).toContain('module-missing');
});
test('especialista bloqueado não substitui bloqueio por candidato antigo',()=>{
 const {h}=start(),i=index(),p=beginSyntheticHistoryRevision(h,i);
 const tasks=input(i).map(d=>d.moduleId==='resources'?{...d,status:'blocked' as const}:d);
 const done=completeSyntheticHistoryRevision(p,runSyntheticIndexedWorkers(i,tasks));
 expect(done.state).toBe('blocked');expect(done.currentGameCandidate).toBeNull();
 expect(done.revisions[1].pendingModules).toEqual(['resources']);
 expect(done.revisions[1].reason).toBe('reanalysis-blocked');
});
test('indícios contraditórios mantêm estado ambíguo após nova revisão',()=>{
 const {h}=start(),i=index(),p=beginSyntheticHistoryRevision(h,i);
 const tasks=input(i).map(d=>d.moduleId==='manifest'?{...d,observations:d.observations.map(o=>({...o,game:'ats' as const}))}:d);
 const done=completeSyntheticHistoryRevision(p,runSyntheticIndexedWorkers(i,tasks));
 expect(done.state).toBe('ambiguous');expect(done.currentGameCandidate).toBeNull();
 expect(done.revisions[1].findings).toContain('ambiguous-game');
});
test('histórico de três revisões mantém anteriores substituídas e terceira pendente',()=>{
 const {h}=start(),i2=index(),i3=index();
 const second=completeSyntheticHistoryRevision(beginSyntheticHistoryRevision(h,i2),outcome(i2,'ets2'));
 const third=beginSyntheticHistoryRevision(second,i3);
 expect(third.revisions.map(x=>x.revision)).toEqual([1,2,3]);
 expect(third.revisions.slice(0,2).every(x=>x.superseded)).toBe(true);
 expect(third.currentGameCandidate).toBeNull();
});
test('lote rejeitado antes do snapshot não pode entrar no histórico',()=>{
 const {h}=start(),i=index(),p=beginSyntheticHistoryRevision(h,i);
 const broken=input(i).map(d=>d.moduleId==='audio'?{...d,revisionTicket:null}:d);
 const result=runSyntheticIndexedWorkers(i,broken);
 expect(result.status).toBe('blocked');
 expect(()=>completeSyntheticHistoryRevision(p,result)).toThrow();
});
test('projeção não publica nomes, caminhos, handles, tickets nem digest',()=>{
 const old=index(['Vehicles/PRIVATECUSTOMER123.bus','def/game.sii','meta/manifest.json','audio/engine.wav']);
 const h=createSyntheticEvidenceHistory(old,outcome(old));
 const next=index(['Vehicles/PRIVATECUSTOMER124.bus','def/game.sii','meta/manifest.json','audio/engine.wav']);
 const p=beginSyntheticHistoryRevision(h,next);
 const text=JSON.stringify(p)+JSON.stringify(projectSyntheticEvidenceHistory(p));
 for(const secret of ['PRIVATECUSTOMER','synthetic-entry-','revisionTicket','/','\\',digest])
  expect(text).not.toContain(secret);
 expect(Object.isFrozen(p.revisions)).toBe(true);
 expect(Object.isFrozen(p.revisions[1].pendingModules)).toBe(true);
});
test('limite de 24 revisões impede crescimento ilimitado sem cortar histórico',()=>{
 let {h}=start();
 for(let n=2;n<=24;n++){const i=index();h=completeSyntheticHistoryRevision(beginSyntheticHistoryRevision(h,i),outcome(i));}
 expect(h.revisionCount).toBe(24);expect(h.revisions[0].revision).toBe(1);
 expect(()=>beginSyntheticHistoryRevision(h,index())).toThrow('atingiu limite');
});
test('Oficina e Instalador permanecem bloqueados em todos os estados',()=>{
 const {h}=start(),p=beginSyntheticHistoryRevision(h,index());
 for(const record of [h,p]){
  const proj=projectSyntheticEvidenceHistory(record);
  expect(proj.workshop.skinEnabled).toBe(false);
  expect(proj.workshop.audioEnabled).toBe(false);
  expect(proj.installer.enabled).toBe(false);
  expect(proj.operationsEnabled).toBe(false);
  expect(record.digestVerified).toBe(false);
 }
});
