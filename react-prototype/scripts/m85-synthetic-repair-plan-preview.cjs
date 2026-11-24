'use strict';
// Lab-only, non-executable planning. No filesystem, IPC, commands or runtime imports.
// Confirmation is a rehearsal tied to one issued immutable plan, not consent
// or permission to make changes. The registry is instance-local and ephemeral.
const {createSyntheticReviewGuidance}=require('./m84-synthetic-review-guidance.cjs');
const refuse=()=>{throw Error('M85_PLAN_REFUSED');};
function createPlanningSession(){
 let active=null,revision=0,reviewed=new Set(),backupReviewed=false,reversalReviewed=false;
 function requireActive(plan){if(!active||active!==plan)refuse();}
 function begin(fixture){
  const guide=createSyntheticReviewGuidance(fixture);
  const steps=guide.items.map(item=>Object.freeze({
   id:item.id,findingCode:item.findingCode,priority:item.priority,
   referenceOccurrences:item.referenceOccurrences,title:item.title,
   description:item.description,
   affectedFilesKnown:false,manualReviewOnly:true,executable:false
  }));
  // Retain only aggregate observations; no target paths, proposed bytes
  // or mutation recipes exist at this stage.
  const plan=Object.freeze({schema:'omsi-manager-synthetic-plan-preview-v1',
   scope:'synthetic-virtual-inventory-only',revision:++revision,
   steps:Object.freeze(steps),prerequisites:Object.freeze([...guide.prerequisites]),
   totalReferences:guide.totalReferences,reviewOccurrences:guide.reviewOccurrences,
   backupRequiredForFutureRepair:true,rollbackRequiredForFutureRepair:true,
   affectedFilesKnown:false,realFilesInspected:false,compatibilityVerified:false,
   repairAllowed:false,operationsEnabled:false});
  active=plan;reviewed=new Set();backupReviewed=false;reversalReviewed=false;
  return plan;
 }
 function status(plan){
  requireActive(plan);
  const allReviewed=plan.steps.length>0&&plan.steps.every(s=>reviewed.has(s.id));
  const blockers=['real-targets-unverified','backup-unverified','rollback-unverified','execution-not-implemented'];
  return Object.freeze({revision:plan.revision,
   reviewedSteps:Object.freeze(plan.steps.filter(s=>reviewed.has(s.id)).map(s=>s.id)),
   backupRequirementReviewed:backupReviewed,reversalRequirementReviewed:reversalReviewed,
   rehearsalChecklistComplete:allReviewed&&backupReviewed&&reversalReviewed,
   evidencePrerequisites:plan.prerequisites,executionBlockers:Object.freeze(blockers),
   backupVerified:false,rollbackVerified:false,actualConsentGranted:false,
   repairAllowed:false,operationsEnabled:false});
 }
 function reviewStep(plan,id){
  requireActive(plan);
  if(typeof id!=='string'||!plan.steps.some(s=>s.id===id))refuse();
  reviewed.add(id);
  return status(plan);
 }
 function reviewRequirement(plan,id){
  requireActive(plan);
  if(id==='backup')backupReviewed=true;
  else if(id==='reversal')reversalReviewed=true;
  else refuse();
  return status(plan);
 }
 function close(){active=null;reviewed.clear();backupReviewed=false;reversalReviewed=false;}
 return Object.freeze({begin,status,reviewStep,reviewRequirement,close});
}
module.exports={createPlanningSession};
