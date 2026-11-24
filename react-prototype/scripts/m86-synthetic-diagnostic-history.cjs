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
 function close(){
  planning.close();active=null;records=[];closed=true;
 }
 return Object.freeze({begin,snapshot,reviewStep,reviewRequirement,close});
}
module.exports={createDiagnosticHistory,MAX_REVISIONS};
