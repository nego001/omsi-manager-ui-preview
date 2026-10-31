// Synthetic scenario simulator only: never parses or reads real archives.
import {coordinateSyntheticEvidence,SYNTHETIC_MODULE_IDS,
 type SyntheticModuleId,type SyntheticModuleReport,type SyntheticSnapshot} from './distributed-reader-contract';

import {buildSyntheticPackageIndex,SYNTHETIC_ENTRY_LIMITS,type SyntheticPackageIndex} from './synthetic-package-index';

export const SYNTHETIC_LIMITS=Object.freeze({...SYNTHETIC_ENTRY_LIMITS,moduleMs:600,totalMs:2500});
export type ScenarioReason='none'|'invalid-fixture'|'unsafe-entry'|'malformed-entry'|'resource-limit'|'cancelled'|'simulated-timeout'|'module-blocked'|'missing-module';
export type ScenarioStatus='complete'|'blocked'|'incomplete'|'cancelled'|'timed-out';
export type ScenarioResult=Readonly<{
 status:ScenarioStatus;reason:ScenarioReason;logicalElapsedMs:number;
 completedModules:readonly SyntheticModuleId[];snapshot:SyntheticSnapshot;
 index:SyntheticPackageIndex|null;
 realTimeMeasured:false;realPackageRead:false;operationsEnabled:false;
}>;
const digestRegex=/^[a-f0-9]{64}$/;
const specialistIds=SYNTHETIC_MODULE_IDS.filter(id=>id!=='container');
const specialistSet:ReadonlySet<string>=new Set(specialistIds);
function obj(v:unknown):v is Record<string,unknown>{
 return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
}
function fields(v:Record<string,unknown>,names:readonly string[]){
 return Object.keys(v).length===names.length&&names.every(key=>Object.hasOwn(v,key));
}
function uint(v:unknown):v is number{return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0}
function gate(digest:string,blocked:boolean):SyntheticModuleReport{
 return {moduleId:'container',contractVersion:1,fixtureDigest:digest,
  status:blocked?'blocked':'ok',signals:[]};
}
function outcome(status:ScenarioStatus,reason:ScenarioReason,elapsed:number,
 completed:readonly SyntheticModuleId[],snapshot:SyntheticSnapshot,index:SyntheticPackageIndex|null=null):ScenarioResult{
 return Object.freeze({status,reason,logicalElapsedMs:elapsed,completedModules:Object.freeze([...completed]),
  snapshot,index,realTimeMeasured:false as const,realPackageRead:false as const,operationsEnabled:false as const});
}
type Task={moduleId:SyntheticModuleId;simulatedDurationMs:number;report:SyntheticModuleReport};
// Times are VIRTUAL, provided by fixtures, with no real task execution or waiting.
export function simulateSyntheticScenario(input:unknown):ScenarioResult{
 const raw=obj(input)?input:null;
 const digest=raw&&typeof raw.fixtureDigest==='string'&&digestRegex.test(raw.fixtureDigest)?raw.fixtureDigest:null;
 const invalid=()=>outcome('blocked','invalid-fixture',0,[],coordinateSyntheticEvidence(digest??'',[]));
 if(!raw||!digest||!fields(raw,['fixtureDigest','entries','modules','cancelAtMs']))return invalid();
 const inspected=buildSyntheticPackageIndex(digest,raw.entries);
 if(inspected.status!=='ready')return outcome('blocked',inspected.reason,0,[],
  coordinateSyntheticEvidence(digest,[gate(digest,true)]));
 const sharedIndex=inspected.index;
 if(!Array.isArray(raw.modules)||raw.modules.length>specialistIds.length||
    (raw.cancelAtMs!==null&&(!uint(raw.cancelAtMs)||raw.cancelAtMs>SYNTHETIC_LIMITS.totalMs)))return invalid();
 const tasks=new Map<string,Task>();
 for(const task of raw.modules as unknown[]){
  if(!obj(task)||!fields(task,['moduleId','simulatedDurationMs','report'])||
     typeof task.moduleId!=='string'||!specialistSet.has(task.moduleId)||
     tasks.has(task.moduleId)||!uint(task.simulatedDurationMs)||task.simulatedDurationMs>10000||
     !obj(task.report)||task.report.moduleId!==task.moduleId)return invalid();
  tasks.set(task.moduleId,task as Task);
 }
 let elapsed=0;
 const completed:SyntheticModuleId[]=['container'];
 const delivered:SyntheticModuleReport[]=[gate(digest,false)];
 const snapshot=()=>coordinateSyntheticEvidence(digest,delivered);
 const end=(status:ScenarioStatus,reason:ScenarioReason,at:number)=>outcome(status,reason,at,completed,snapshot(),sharedIndex);
 if(raw.cancelAtMs===0)return end('cancelled','cancelled',0);
 for(const id of specialistIds){
  const task=tasks.get(id);if(!task)continue;
  const finishes=elapsed+task.simulatedDurationMs;
  const deadline=Math.min(elapsed+SYNTHETIC_LIMITS.moduleMs,SYNTHETIC_LIMITS.totalMs);
  if(raw.cancelAtMs!==null&&raw.cancelAtMs<=Math.min(finishes,deadline))
   return end('cancelled','cancelled',raw.cancelAtMs);
  if(finishes>deadline)return end('timed-out','simulated-timeout',deadline);
  elapsed=finishes;
  delivered.push(task.report);completed.push(id);
  const intermediate=snapshot();
  if(intermediate.state==='blocked')return outcome('blocked','module-blocked',elapsed,completed,intermediate,sharedIndex);
 }
 const final=snapshot();
 if(final.state==='blocked')return outcome('blocked','module-blocked',elapsed,completed,final,sharedIndex);
 if(final.state==='incomplete')return outcome('incomplete','missing-module',elapsed,completed,final,sharedIndex);
 return outcome('complete','none',elapsed,completed,final,sharedIndex);
}
