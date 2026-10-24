import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {createSyntheticValidationReadiness} from '../src/synthetic-validation-readiness';
import {createSyntheticReadAdmissionSession} from '../src/synthetic-read-admission';
import {createSyntheticContainerReview,advanceSyntheticContainerReview,
 issueSyntheticStreamDeclarationSource} from '../src/synthetic-container-screen';
import {createSyntheticStreamReview} from '../src/synthetic-stream-checkpoints';
import {
 createSyntheticReaderLifecycle,openSyntheticReaderLifecycle,stepSyntheticReaderLifecycle,
 closeSyntheticReaderLifecycle,simulateSyntheticReaderLifecycleProcessLoss,
 acknowledgeSyntheticReaderLifecycleLoss,type SyntheticReaderLifecycle
} from '../src/synthetic-reader-lifecycle';
import {
 createSyntheticOrphanRecovery,acknowledgeSyntheticOrphanRecovery,
 assessFreshSyntheticOrphanAnalysis,projectSyntheticRecoveryAudit,
 SYNTHETIC_RECOVERY_EVENT_LIMIT,type SyntheticOrphanRecovery
} from '../src/synthetic-orphan-recovery';
const plan=createSyntheticValidationReadiness(createSyntheticDiagnosticDemo()[3].timeline);
const session=createSyntheticReadAdmissionSession(plan);
function lifecycle(){
 const screen=createSyntheticContainerReview(session,{format:'zip-declared',entries:[
  {path:'def/stub.sii',kind:'file',compression:'deflate',encodedBytes:200,expandedBytes:400},
  {path:'sound/stub.ogg',kind:'file',compression:'deflate',encodedBytes:100,expandedBytes:200}
 ]});
 advanceSyntheticContainerReview(screen);advanceSyntheticContainerReview(screen);
 const source=issueSyntheticStreamDeclarationSource(screen);
 const stream=createSyntheticStreamReview(source,source.entries.map(e=>({
  entryOrdinal:e.ordinal,encodedBytes:e.encodedBytes,
  expandedBytes:e.expandedBytes,elapsedMs:10,endOfEntry:true
 })));
 return createSyntheticReaderLifecycle(stream);
}
function abandoned(){
 const old=lifecycle();openSyntheticReaderLifecycle(old);
 stepSyntheticReaderLifecycle(old);simulateSyntheticReaderLifecycleProcessLoss(old);
 return old;
}
function complete(h:SyntheticReaderLifecycle){
 openSyntheticReaderLifecycle(h);stepSyntheticReaderLifecycle(h);
 stepSyntheticReaderLifecycle(h);closeSyntheticReaderLifecycle(h);return h;
}
test('registro nasce com eventos numerados de detecção e invalidação',()=>{
 const r=createSyntheticOrphanRecovery(abandoned()),a=projectSyntheticRecoveryAudit(r);
 expect(a.eventCount).toBe(2);
 expect(a.events.map(e=>e.code)).toEqual(['orphan-detected','old-evidence-invalidated']);
 expect(a.events.map(e=>e.sequence)).toEqual([1,2]);
 expect(a.events.map(e=>e.previousSequence)).toEqual([null,1]);
 expect(a.originalEvidenceStatus).toBe('superseded');
 expect(a.activeEvidenceRevision).toBeNull();
});
test('o registro nunca transforma provas anteriores em provas atuais',()=>{
 const r=createSyntheticOrphanRecovery(abandoned());
 let a=projectSyntheticRecoveryAudit(r);
 expect(a.oldEvidenceReusable).toBe(false);
 expect(a.activeEvidenceStatus).toBe('pending');
 acknowledgeSyntheticOrphanRecovery(r);
 a=projectSyntheticRecoveryAudit(r);
 expect(a.oldEvidenceReusable).toBe(false);
 expect(a.activeEvidenceRevision).toBeNull();
});
test('reconhecimento registra novo evento sequencial',()=>{
 const r=createSyntheticOrphanRecovery(abandoned());
 acknowledgeSyntheticOrphanRecovery(r);
 const a=projectSyntheticRecoveryAudit(r);
 expect(a.eventCount).toBe(3);
 expect(a.events[2].code).toBe('orphan-acknowledged');
 expect(a.events[2].previousSequence).toBe(2);
});
test('reconhecimento repetido não fabrica novos eventos',()=>{
 const r=createSyntheticOrphanRecovery(abandoned());
 acknowledgeSyntheticOrphanRecovery(r);
 const first=projectSyntheticRecoveryAudit(r);
 acknowledgeSyntheticOrphanRecovery(r);
 expect(projectSyntheticRecoveryAudit(r)).toEqual(first);
});
test('tentativa antes de reconhecer é auditada, sem promover prova',()=>{
 const r=createSyntheticOrphanRecovery(abandoned());
 assessFreshSyntheticOrphanAnalysis(r,complete(lifecycle()));
 const a=projectSyntheticRecoveryAudit(r);
 expect(a.events.at(-1)?.code).toBe('acknowledgement-required');
 expect(a.activeEvidenceRevision).toBeNull();
 expect(a.oldEvidenceReusable).toBe(false);
});
test('tentativa de reutilizar o ciclo anterior deixa motivo verificável na sequência',()=>{
 const old=abandoned(),r=createSyntheticOrphanRecovery(old);
 acknowledgeSyntheticOrphanRecovery(r);
 assessFreshSyntheticOrphanAnalysis(r,old);
 const a=projectSyntheticRecoveryAudit(r);
 expect(a.events.at(-1)?.code).toBe('old-evidence-rejected');
 expect(a.events.at(-1)?.newEvidenceRevision).toBeNull();
});
test('nova triagem incompleta é registrada como recusa, não como revisão 2',()=>{
 const r=createSyntheticOrphanRecovery(abandoned());
 acknowledgeSyntheticOrphanRecovery(r);
 assessFreshSyntheticOrphanAnalysis(r,lifecycle());
 const a=projectSyntheticRecoveryAudit(r);
 expect(a.events.at(-1)?.code).toBe('new-evidence-incomplete');
 expect(a.activeEvidenceRevision).toBeNull();
});
test('nova triagem independente concluída substitui epoch fictício, sem autenticação',()=>{
 const r=createSyntheticOrphanRecovery(abandoned());
 acknowledgeSyntheticOrphanRecovery(r);
 assessFreshSyntheticOrphanAnalysis(r,complete(lifecycle()));
 const a=projectSyntheticRecoveryAudit(r);
 expect(a.events.at(-1)?.code).toBe('new-evidence-recorded');
 expect(a.events.at(-1)?.newEvidenceRevision).toBe(2);
 expect(a.activeEvidenceRevision).toBe(2);
 expect(a.activeEvidenceStatus).toBe('fixture-only');
 expect(a.originalEvidenceStatus).toBe('superseded');
 expect(a.cryptographicallyVerified).toBe(false);
});
test('tentativa recusada seguida de análise nova preserva ordem dos acontecimentos',()=>{
 const old=abandoned(),r=createSyntheticOrphanRecovery(old);
 acknowledgeSyntheticOrphanRecovery(r);
 assessFreshSyntheticOrphanAnalysis(r,old);
 assessFreshSyntheticOrphanAnalysis(r,complete(lifecycle()));
 const a=projectSyntheticRecoveryAudit(r);
 expect(a.events.map(e=>e.code)).toEqual([
  'orphan-detected','old-evidence-invalidated','orphan-acknowledged',
  'old-evidence-rejected','new-evidence-recorded'
 ]);
 expect(a.events.map(e=>e.sequence)).toEqual([1,2,3,4,5]);
});
test('novo registro de ciclo já reconhecido documenta reconhecimento anterior',()=>{
 const old=abandoned();acknowledgeSyntheticReaderLifecycleLoss(old);
 const r=createSyntheticOrphanRecovery(old);
 const a=projectSyntheticRecoveryAudit(r);
 expect(a.events.map(e=>e.code)).toEqual([
  'orphan-detected','old-evidence-invalidated','previously-acknowledged'
 ]);
 expect(a.activeEvidenceRevision).toBeNull();
});
test('eventos antigos não mudam quando novas ações acontecem',()=>{
 const r=createSyntheticOrphanRecovery(abandoned());
 const old=projectSyntheticRecoveryAudit(r);
 acknowledgeSyntheticOrphanRecovery(r);
 const newer=projectSyntheticRecoveryAudit(r);
 expect(old.eventCount).toBe(2);
 expect(newer.eventCount).toBe(3);
 expect(old.events.map(x=>x.code)).toEqual(['orphan-detected','old-evidence-invalidated']);
});
test('clone do registro não possui permissão de ler o journal em memória',()=>{
 const r=createSyntheticOrphanRecovery(abandoned());
 for(const fake of [JSON.parse(JSON.stringify(r)),{...r}] as SyntheticOrphanRecovery[]){
  expect(()=>projectSyntheticRecoveryAudit(fake)).toThrow('não emitida');
 }
});
test('todos os eventos são congelados e só contêm enums e índices sanitizados',()=>{
 const r=createSyntheticOrphanRecovery(abandoned());
 acknowledgeSyntheticOrphanRecovery(r);
 assessFreshSyntheticOrphanAnalysis(r,complete(lifecycle()));
 const a=projectSyntheticRecoveryAudit(r);
 expect(Object.isFrozen(a)).toBe(true);expect(Object.isFrozen(a.events)).toBe(true);
 expect(a.events.every(x=>Object.isFrozen(x))).toBe(true);
 const serialized=JSON.stringify(a);
 for(const secret of ['def/stub.sii','sound/stub.ogg','revisionTicket','synthetic-entry','C:\\','PRIVATE_FILE']){
  expect(serialized).not.toContain(secret);
 }
});
test('nenhum timestamp ou digest falso aparece como prova de auditoria',()=>{
 const a=projectSyntheticRecoveryAudit(createSyntheticOrphanRecovery(abandoned()));
 expect(a.isPersistent).toBe(false);expect(a.isTamperEvident).toBe(false);
 expect(a.realHistoryVerified).toBe(false);
 expect(JSON.stringify(a)).not.toContain('timestamp');
 expect(JSON.stringify(a)).not.toContain('digest');
});
test('o limite de eventos falha fechado sem eliminar a invalidação inicial',()=>{
 const old=abandoned(),r=createSyntheticOrphanRecovery(old);
 for(let i=2;i<SYNTHETIC_RECOVERY_EVENT_LIMIT;i++){
  assessFreshSyntheticOrphanAnalysis(r,old);
 }
 const atLimit=projectSyntheticRecoveryAudit(r);
 expect(atLimit.eventCount).toBe(SYNTHETIC_RECOVERY_EVENT_LIMIT);
 expect(()=>assessFreshSyntheticOrphanAnalysis(r,old)).toThrow('Limite do registro');
 expect(()=>acknowledgeSyntheticOrphanRecovery(r)).toThrow('Limite do registro');
 expect(projectSyntheticRecoveryAudit(r)).toEqual(atLimit);
 expect(atLimit.events[1].code).toBe('old-evidence-invalidated');
});
test('após conclusão novos candidatos não adicionam eventos nem reativam antigos',()=>{
 const r=createSyntheticOrphanRecovery(abandoned());
 acknowledgeSyntheticOrphanRecovery(r);
 assessFreshSyntheticOrphanAnalysis(r,complete(lifecycle()));
 const final=projectSyntheticRecoveryAudit(r);
 assessFreshSyntheticOrphanAnalysis(r,complete(lifecycle()));
 expect(projectSyntheticRecoveryAudit(r)).toEqual(final);
 expect(final.oldEvidenceReusable).toBe(false);
});
test('registro é independente de autorização, hashes e acesso ao disco',()=>{
 const r=createSyntheticOrphanRecovery(abandoned());
 acknowledgeSyntheticOrphanRecovery(r);assessFreshSyntheticOrphanAnalysis(r,complete(lifecycle()));
 const a=projectSyntheticRecoveryAudit(r);
 expect(a.operationsEnabled).toBe(false);
 expect(a.approvedForOperations).toBe(false);
 expect(a.realBytesRead).toBe(0);
 expect(a.eventLimit).toBe(48);
 expect(a.events.every(x=>!x.verified&&!x.operationsEnabled)).toBe(true);
});
