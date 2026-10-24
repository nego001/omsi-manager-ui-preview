// Synthetic scenario simulator only: never parses or reads real archives.
import {coordinateSyntheticEvidence,SYNTHETIC_MODULE_IDS,
 type SyntheticModuleId,type SyntheticModuleReport,type SyntheticSnapshot} from './distributed-reader-contract';

export const SYNTHETIC_LIMITS=Object.freeze({
 entries:128,path:160,depth:12,expandedBytes:4_000_000,encodedBytes:2_000_000,
 ratio:100,moduleMs:600,totalMs:2500
});
export type ScenarioReason='none'|'invalid-fixture'|'unsafe-entry'|'malformed-entry'|'resource-limit'|'cancelled'|'simulated-timeout'|'module-blocked'|'missing-module';
export type ScenarioStatus='complete'|'blocked'|'incomplete'|'cancelled'|'timed-out';
export type ScenarioResult=Readonly<{
 status:ScenarioStatus;reason:ScenarioReason;logicalElapsedMs:number;
 completedModules:readonly SyntheticModuleId[];snapshot:SyntheticSnapshot;
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
function inspectEntries(v:unknown):ScenarioReason{
 if(!Array.isArray(v)||v.length>SYNTHETIC_LIMITS.entries)return 'invalid-fixture';
 let expanded=0,encoded=0;
 const seen=new Set<string>();
 for(const item of v as unknown[]){
  if(!obj(item)||!fields(item,['path','kind','encodedBytes','expandedBytes','declaredFormat'])||
     typeof item.path!=='string'||!uint(item.encodedBytes)||!uint(item.expandedBytes)||
     !['file','directory','symlink'].includes(String(item.kind))||
     !['well-formed','broken'].includes(String(item.declaredFormat)))return 'invalid-fixture';
  const path=item.path;
  if(!path||path.length>SYNTHETIC_LIMITS.path||!/^[a-zA-Z0-9_./-]+$/.test(path))
   return 'unsafe-entry';
  const parts=path.split('/');
  if(parts.length>SYNTHETIC_LIMITS.depth||
     parts.some(p=>!p||p==='.'||p==='..'||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(p)))
   return 'unsafe-entry';
  if(seen.has(path.toLowerCase()))return 'unsafe-entry';
  seen.add(path.toLowerCase());
  if(item.kind==='symlink')return 'unsafe-entry';
  if(item.declaredFormat==='broken')return 'malformed-entry';
  if(item.kind==='directory'&&(item.encodedBytes!==0||item.expandedBytes!==0))
   return 'invalid-fixture';
  if(item.kind==='file'&&item.expandedBytes>0&&item.encodedBytes===0)
   return 'resource-limit';
  encoded+=item.encodedBytes;
  expanded+=item.expandedBytes;
  if(encoded>SYNTHETIC_LIMITS.encodedBytes||expanded>SYNTHETIC_LIMITS.expandedBytes||
    (item.kind==='file'&&item.expandedBytes>SYNTHETIC_LIMITS.ratio*item.encodedBytes))
   return 'resource-limit';
 }
 return 'none';
}
function gate(digest:string,blocked:boolean):SyntheticModuleReport{
 return {moduleId:'container',contractVersion:1,fixtureDigest:digest,
  status:blocked?'blocked':'ok',signals:[]};
}
function outcome(status:ScenarioStatus,reason:ScenarioReason,elapsed:number,
 completed:readonly SyntheticModuleId[],snapshot:SyntheticSnapshot):ScenarioResult{
 return Object.freeze({status,reason,logicalElapsedMs:elapsed,completedModules:Object.freeze([...completed]),
  snapshot,realTimeMeasured:false as const,realPackageRead:false as const,operationsEnabled:false as const});
}
type Task={moduleId:SyntheticModuleId;simulatedDurationMs:number;report:SyntheticModuleReport};
// Times are VIRTUAL, provided by fixtures, with no real task execution or waiting.
export function simulateSyntheticScenario(input:unknown):ScenarioResult{
 const raw=obj(input)?input:null;
 const digest=raw&&typeof raw.fixtureDigest==='string'&&digestRegex.test(raw.fixtureDigest)?raw.fixtureDigest:null;
 const invalid=()=>outcome('blocked','invalid-fixture',0,[],coordinateSyntheticEvidence(digest??'',[]));
 if(!raw||!digest||!fields(raw,['fixtureDigest','entries','modules','cancelAtMs']))return invalid();
 const entryReason=inspectEntries(raw.entries);
 if(entryReason!=='none')return outcome('blocked',entryReason,0,[],
  coordinateSyntheticEvidence(digest,[gate(digest,true)]));
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
 if(raw.cancelAtMs===0)return outcome('cancelled','cancelled',0,completed,snapshot());
 for(const id of specialistIds){
  const task=tasks.get(id);if(!task)continue;
  const finishes=elapsed+task.simulatedDurationMs;
  const deadline=Math.min(elapsed+SYNTHETIC_LIMITS.moduleMs,SYNTHETIC_LIMITS.totalMs);
  if(raw.cancelAtMs!==null&&raw.cancelAtMs<=Math.min(finishes,deadline))
   return outcome('cancelled','cancelled',raw.cancelAtMs,completed,snapshot());
  if(finishes>deadline)return outcome('timed-out','simulated-timeout',deadline,completed,snapshot());
  elapsed=finishes;
  delivered.push(task.report);completed.push(id);
  const intermediate=snapshot();
  if(intermediate.state==='blocked')return outcome('blocked','module-blocked',elapsed,completed,intermediate);
 }
 const final=snapshot();
 if(final.state==='blocked')return outcome('blocked','module-blocked',elapsed,completed,final);
 if(final.state==='incomplete')return outcome('incomplete','missing-module',elapsed,completed,final);
 return outcome('complete','none',elapsed,completed,final);
}
