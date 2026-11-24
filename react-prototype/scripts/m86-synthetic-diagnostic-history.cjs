'use strict';
// Test-only session history. No timestamps, persistence, real activity log,
// paths, IPC, or operation authority. Internally computed reports only.
const {createSyntheticDiagnosticReport}=require('./m83-synthetic-diagnostic-report.cjs');
const {createPlanningSession}=require('./m85-synthetic-repair-plan-preview.cjs');
const MAX_REVISIONS=16;
const refuse=()=>{throw Error('M86_HISTORY_REFUSED');};
function freeze(value){
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){
  for(const child of Object.values(value))freeze(child);
  Object.freeze(value);
 }
 return value;
}
function createDiagnosticHistory(){
 const planning=createPlanningSession();
 let records=[],active=null,closed=false;
 function requireOpen(){if(closed)refuse();}
 function requireActive(ticket){requireOpen();if(!active||ticket!==active.ticket)refuse();}
 function snapshot(){
  requireOpen();
  return freeze({schema:'omsi-manager-synthetic-diagnostic-history-v1',
   scope:'synthetic-session-only',activeRevision:active?.ticket.revision??null,
   revisionCount:records.length,revisions:records.map(record=>({
    revision:record.revision,report:record.report,review:record.review
   })),realFilesInspected:false,actualActivityLog:false,compatibilityVerified:false,operationsEnabled:false});
 }
 function updateReview(){
  const status=planning.status(active.plan);
  const record=records.at(-1);
  record.review=freeze({reviewedSteps:[...status.reviewedSteps],
   backupRequirementReviewed:status.backupRequirementReviewed,
   reversalRequirementReviewed:status.reversalRequirementReviewed,
   rehearsalChecklistComplete:status.rehearsalChecklistComplete,
   backupVerified:false,rollbackVerified:false,actualConsentGranted:false,repairAllowed:false});
 }
 function begin(fixture){
  requireOpen();if(records.length>=MAX_REVISIONS)refuse();
  // Derive both projections from the same bounded input in one synchronous call.
  // Do not retain the fixture, path strings or source bytes after this call.
  const report=freeze(createSyntheticDiagnosticReport(fixture));
  const plan=planning.begin(fixture);
  const ticket=freeze({revision:records.length+1,scope:'synthetic-review-ticket'});
  records.push({revision:ticket.revision,report,review:null});
  active={ticket,plan};updateReview();
  return ticket;
 }
 function reviewStep(ticket,id){
  requireActive(ticket);planning.reviewStep(active.plan,id);updateReview();return snapshot();
 }
 function reviewRequirement(ticket,id){
  requireActive(ticket);planning.reviewRequirement(active.plan,id);updateReview();return snapshot();
 }
 // Compare internally retained reports, never caller-supplied snapshots.
 function compare(beforeRevision,afterRevision){
  requireOpen();
  if(!Number.isSafeInteger(beforeRevision)||!Number.isSafeInteger(afterRevision)||
     beforeRevision<1||afterRevision>records.length||beforeRevision>=afterRevision)refuse();
  const before=records[beforeRevision-1].report,after=records[afterRevision-1].report;
  const codes=['invalid-reference','ambiguous-case','not-file-path','absent-from-fixture',
   'case-only','source-unconfirmed','not-observed','unsupported-reference','exact'];
  const count=(report,code)=>report.findings.find(item=>item.code===code)?.count??0;
  const categories=codes.map(code=>{
   const a=count(before,code),b=count(after,code);
   return {code,before:a,after:b,delta:b-a,direction:b>a?'increased':b<a?'decreased':'unchanged'};
  });
  const priorities=['high','review','info'].map(priority=>({
   priority,before:before.counts[priority],after:after.counts[priority],
   delta:after.counts[priority]-before.counts[priority]
  }));
  const limitations=['Comparação de contagens agregadas de referências fictícias, não de arquivos identificados.',
   'Contagens iguais não provam referências iguais; reduções não comprovam correção.'];
  if(!before.inventoryComplete||!after.inventoryComplete)limitations.push('Ao menos um inventário é incompleto.');
  if(before.totalReferences!==after.totalReferences)limitations.push('O total de referências avaliadas mudou.');
  if(before.totalReferences===0||after.totalReferences===0)limitations.push('Ao menos uma revisão não possui evidência de referências.');
  if(before.state==='review-required'||after.state==='review-required'||
    categories.some(c=>['unsupported-reference','source-unconfirmed','not-observed','invalid-reference'].includes(c.code)&&(c.before+c.after)>0))
   limitations.push('Existem limitações de avaliação ou referências que exigem revisão.');
  return freeze({schema:'omsi-manager-synthetic-diagnostic-comparison-v1',
   scope:'synthetic-session-only',beforeRevision,afterRevision,
   beforeState:before.state,afterState:after.state,
   coverage:{beforeComplete:before.inventoryComplete,afterComplete:after.inventoryComplete,
    beforeReferences:before.totalReferences,afterReferences:after.totalReferences,
    equalReferenceCounts:before.totalReferences===after.totalReferences},
   categories,priorities,limitations,
   sameReferencesVerified:false,correctionVerified:false,realFilesInspected:false,
   compatibilityVerified:false,operationsEnabled:false});
 }
 function close(){
  planning.close();active=null;records=[];closed=true;
 }
 return Object.freeze({begin,snapshot,reviewStep,reviewRequirement,compare,close});
}
module.exports={createDiagnosticHistory,MAX_REVISIONS};
