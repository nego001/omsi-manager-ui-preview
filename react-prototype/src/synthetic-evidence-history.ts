// Pure synthetic evidence history. No filesystem, real hashes, IPC, timers or writes.
import {SYNTHETIC_MODULE_IDS,type SyntheticModuleId,type SyntheticSnapshotState,type SyntheticFindingCode} from './distributed-reader-contract';
import type {GameId} from './catalog';
import type {SyntheticPackageIndex} from './synthetic-package-index';
import {matchesSyntheticWorkerOutcome,type SyntheticWorkerOutcome} from './synthetic-index-workers';
import {planSyntheticRevalidation} from './synthetic-index-revalidation';
type Specialist=Exclude<SyntheticModuleId,'container'>;
const specialists=SYNTHETIC_MODULE_IDS.filter((id):id is Specialist=>id!=='container');
const MAX_REVISIONS=24;
export type HistoryReason='initial-analysis'|'source-revision-changed'|'declared-digest-changed'|
 'declarations-same-unverified'|'reanalysis-complete'|'reanalysis-incomplete'|'reanalysis-blocked';
export type HistoryState=SyntheticSnapshotState|'recheck-required';
export type HistoryRevision=Readonly<{
 revision:number;phase:'analysis'|'pending';state:HistoryState;reason:HistoryReason;
 superseded:boolean;candidateGame:GameId|null;evidenceCount:number;
 findings:readonly SyntheticFindingCode[];pendingModules:readonly Specialist[];
 affectedModules:readonly SyntheticModuleId[];
 changes:Readonly<{added:number;removed:number;modified:number}>;
 previousRevision:number|null;verified:false;operationsEnabled:false;
}>;
export type SyntheticEvidenceHistory=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';revisionCount:number;activeRevision:number;
 state:HistoryState;currentGameCandidate:GameId|null;revisions:readonly HistoryRevision[];
 previousEvidenceReusable:false;digestVerified:false;operationsEnabled:false;
}>;
const binding=new WeakMap<object,Readonly<{index:SyntheticPackageIndex;pending:boolean}>>();
function pendingWorkers(result:SyntheticWorkerOutcome):readonly Specialist[]{
 const byId=new Map(result.reports.map(report=>[report.moduleId,report.status] as const));
 return Object.freeze(specialists.filter(id=>byId.get(id)!=='ok'));
}
function frozenRevision(r:HistoryRevision):HistoryRevision{
 return Object.freeze({...r,findings:Object.freeze([...r.findings]),
  pendingModules:Object.freeze([...r.pendingModules]),
  affectedModules:Object.freeze([...r.affectedModules]),
  changes:Object.freeze({...r.changes})});
}
function seal(revisions:readonly HistoryRevision[],index:SyntheticPackageIndex,pending:boolean):SyntheticEvidenceHistory{
 const copy=Object.freeze(revisions.map(frozenRevision)),latest=copy[copy.length-1];
 if(!latest)throw Error('Histórico vazio.');
 const result:SyntheticEvidenceHistory=Object.freeze({
  schemaVersion:1,source:'synthetic-fixture',revisionCount:copy.length,
  activeRevision:latest.revision,state:latest.state,
  currentGameCandidate:latest.phase==='analysis'&&latest.state==='candidate'?latest.candidateGame:null,
  revisions:copy,previousEvidenceReusable:false,digestVerified:false,operationsEnabled:false
 });
 binding.set(result,Object.freeze({index,pending}));
 return result;
}
function bound(h:unknown){
 if(!h||typeof h!=='object')throw Error('Histórico sintético inválido.');
 const found=binding.get(h);
 if(!found)throw Error('Histórico sintético inválido.');
 return found;
}
function verified(index:SyntheticPackageIndex,outcome:unknown):SyntheticWorkerOutcome{
 if(!matchesSyntheticWorkerOutcome(index,outcome))throw Error('Resultado não pertence à revisão sintética.');
 return outcome as SyntheticWorkerOutcome;
}
function analyzed(revision:number,outcome:SyntheticWorkerOutcome,reason:HistoryReason,prior:number|null):HistoryRevision{
 return frozenRevision({
  revision,phase:'analysis',state:outcome.snapshot.state,reason,superseded:false,
  candidateGame:outcome.snapshot.state==='candidate'?outcome.snapshot.candidateGame:null,
  evidenceCount:outcome.snapshot.evidence.length,findings:outcome.snapshot.findings,
  pendingModules:pendingWorkers(outcome),affectedModules:[],
  changes:{added:0,removed:0,modified:0},previousRevision:prior,
  verified:false,operationsEnabled:false
 });
}
export function createSyntheticEvidenceHistory(index:SyntheticPackageIndex,outcome:SyntheticWorkerOutcome):SyntheticEvidenceHistory{
 return seal([analyzed(1,verified(index,outcome),'initial-analysis',null)],index,false);
}
// Opening a new revision NEVER imports old claims, even with identical ordinal handles and digest.
export function beginSyntheticHistoryRevision(history:SyntheticEvidenceHistory,nextIndex:SyntheticPackageIndex):SyntheticEvidenceHistory{
 const previous=bound(history);
 if(previous.pending)throw Error('Revisão sintética já pendente.');
 if(previous.index===nextIndex)throw Error('Revisão requer novo índice sintético.');
 const plan=planSyntheticRevalidation(previous.index,nextIndex);
 if(plan.status==='blocked')throw Error('Novo índice sintético inválido.');
 if(history.revisions.length>=MAX_REVISIONS)throw Error('Histórico sintético atingiu limite.');
 const last=history.revisions[history.revisions.length-1];
 const reason:HistoryReason=plan.reason==='declared-digest-changed'?'declared-digest-changed':
  plan.reason==='identical-declarations-unverified'?'declarations-same-unverified':'source-revision-changed';
 const old=history.revisions.map(r=>frozenRevision({...r,superseded:true}));
 const pending=frozenRevision({
  revision:last.revision+1,phase:'pending',state:'recheck-required',reason,superseded:false,
  candidateGame:null,evidenceCount:0,findings:[],pendingModules:specialists,
  affectedModules:plan.affectedModules,changes:plan.changeCounts,
  previousRevision:last.revision,verified:false,operationsEnabled:false
 });
 return seal([...old,pending],nextIndex,true);
}
// Rechecking requires a NEW genuine synthetic worker result issued for exactly the pending index.
export function completeSyntheticHistoryRevision(history:SyntheticEvidenceHistory,outcome:SyntheticWorkerOutcome):SyntheticEvidenceHistory{
 const current=bound(history);
 if(!current.pending)throw Error('Histórico não possui revisão pendente.');
 const accepted=verified(current.index,outcome);
 const last=history.revisions[history.revisions.length-1];
 const reason:HistoryReason=accepted.status==='complete'?'reanalysis-complete':
  accepted.status==='blocked'?'reanalysis-blocked':'reanalysis-incomplete';
 const currentRevision=frozenRevision({
  ...analyzed(last.revision,accepted,reason,last.previousRevision),
  affectedModules:last.affectedModules,changes:last.changes
 });
 return seal([...history.revisions.slice(0,-1),currentRevision],current.index,false);
}
export function projectSyntheticEvidenceHistory(history:SyntheticEvidenceHistory){
 bound(history);
 const last=history.revisions[history.revisions.length-1];
 return Object.freeze({
  state:history.state,currentGameCandidate:history.currentGameCandidate,
  activeRevision:history.activeRevision,historyLength:history.revisionCount,reason:last.reason,
  pendingModules:Object.freeze([...last.pendingModules]),
  previousEvidenceReusable:false as const,digestVerified:false as const,
  library:Object.freeze({gameCandidate:history.currentGameCandidate,verified:false as const}),
  diagnostics:Object.freeze({revision:last.revision,findings:Object.freeze([...last.findings]),
   supersededCount:history.revisions.filter(r=>r.superseded).length,
   changedEntryCount:last.changes.added+last.changes.removed+last.changes.modified}),
  workshop:Object.freeze({skinEnabled:false as const,audioEnabled:false as const}),
  installer:Object.freeze({enabled:false as const}),operationsEnabled:false as const
 });
}
