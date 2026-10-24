// Pure fixture-driven cooperative specialist pipeline. NO real reader, I/O, IPC or file resolver.
import {
 SYNTHETIC_MODULE_IDS,coordinateSyntheticEvidence,
 type SyntheticModuleId,type SyntheticModuleReport,type SyntheticSnapshot
} from './distributed-reader-contract';
import {projectSyntheticIndex,matchesSyntheticRevisionTicket,type SyntheticPackageIndex,type SyntheticIndexEntry,type SyntheticRevisionTicket} from './synthetic-package-index';
import type {GameId} from './catalog';

const specialistIds=SYNTHETIC_MODULE_IDS.filter((id):id is Exclude<SyntheticModuleId,'container'>=>id!=='container');
const specialists:ReadonlySet<string>=new Set(specialistIds);
const identifying:ReadonlySet<string>=new Set(['structure','manifest','definitions']);
export type SyntheticWorkerReason='none'|'invalid-fixture'|'out-of-scope-handle'|'stale-revision'|'missing-module'|'module-blocked';
export type SyntheticWorkerOutcome=Readonly<{
 status:'complete'|'incomplete'|'blocked';
 reason:SyntheticWorkerReason;
 fixtureDigest:string;
 snapshot:SyntheticSnapshot;
 reports:readonly Readonly<SyntheticModuleReport>[];
 coverage:readonly Readonly<{
  moduleId:Exclude<SyntheticModuleId,'container'>;
  visibleEntries:number;observations:number;status:'ok'|'incomplete'|'blocked';
 }>[];
 operationsEnabled:false;realPackageRead:false;
}>;

// This is user-declared, unverified fixture metadata, NOT evidence from actual mod bytes.
export type SyntheticWorkerDeclaration=Readonly<{
 moduleId:Exclude<SyntheticModuleId,'container'>;
 fixtureDigest:string;
 revisionTicket:SyntheticRevisionTicket;
 status:'ok'|'incomplete'|'blocked';
 observations:readonly Readonly<{handle:string;game:GameId;revisionTicket:SyntheticRevisionTicket}>[];
}>;
function obj(x:unknown):x is Record<string,unknown>{
 return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
}
function exact(obj:Record<string,unknown>,keys:readonly string[]){
 return Object.keys(obj).length===keys.length&&keys.every(key=>Object.hasOwn(obj,key));
}
function game(x:unknown):x is GameId{return x==='omsi'||x==='ets2'||x==='ats'}
function gate(digest:string):SyntheticModuleReport{
 return Object.freeze({moduleId:'container',contractVersion:1,fixtureDigest:digest,status:'ok',signals:Object.freeze([])});
}
function fail(digest:string,reason:Exclude<SyntheticWorkerReason,'none'|'missing-module'|'module-blocked'>):SyntheticWorkerOutcome{
 // Duplicate gate reports deliberately force the central coordinator's invalid-contract state.
 // Untrusted claims never survive a malformed worker batch.
 const snapshot=coordinateSyntheticEvidence(digest,[gate(digest),gate(digest)]);
 return Object.freeze({
  status:'blocked',reason,fixtureDigest:digest,snapshot,
  reports:Object.freeze([]),coverage:Object.freeze([]),
  operationsEnabled:false,realPackageRead:false
 });
}
function finish(
 digest:string,reports:readonly SyntheticModuleReport[],coverage:SyntheticWorkerOutcome['coverage'],
 reason:SyntheticWorkerReason
):SyntheticWorkerOutcome{
 const snapshot=coordinateSyntheticEvidence(digest,reports);
 const status=snapshot.state==='blocked'?'blocked':snapshot.state==='incomplete'?'incomplete':'complete';
 return Object.freeze({
  status,reason,fixtureDigest:digest,snapshot,
  reports:Object.freeze(reports.map(report=>Object.freeze({
   ...report,signals:Object.freeze(report.signals.map(signal=>Object.freeze({...signal})))
  }))),
  coverage:Object.freeze(coverage.map(item=>Object.freeze({...item}))),
  operationsEnabled:false as const,realPackageRead:false as const
 });
}
// Gate must have issued the index. Each worker receives only its own projection.
// Claims cite opaque handles that exist in THAT module's scoped view.
// Sources/claims are synthetic; extension and root cannot identify any game on their own.
export function runSyntheticIndexedWorkers(index:SyntheticPackageIndex,declarations:unknown):SyntheticWorkerOutcome{
 const digest=typeof index?.fixtureDigest==='string'?index.fixtureDigest:'';
 try{projectSyntheticIndex(index,'container');}catch{return fail(digest,'invalid-fixture');}
 if(!Array.isArray(declarations)||declarations.length>specialistIds.length)
  return fail(digest,'invalid-fixture');
 const inputs=new Map<Exclude<SyntheticModuleId,'container'>,SyntheticWorkerDeclaration>();
 // Validate the full batch before publishing ANY report.
 for(const raw of declarations as unknown[]){
  if(!obj(raw)||!exact(raw,['moduleId','fixtureDigest','revisionTicket','status','observations'])||
     typeof raw.moduleId!=='string'||!specialists.has(raw.moduleId)||inputs.has(raw.moduleId as Exclude<SyntheticModuleId,'container'>)||
     raw.fixtureDigest!==digest||
     (raw.status!=='ok'&&raw.status!=='incomplete'&&raw.status!=='blocked')||
     !Array.isArray(raw.observations)||raw.observations.length>4||
     (raw.status!=='ok'&&raw.observations.length!==0))
   return fail(digest,'invalid-fixture');
  const id=raw.moduleId as Exclude<SyntheticModuleId,'container'>;
  // A declared SHA-like fixture digest or a positional handle is NOT a revision proof.
  if(!matchesSyntheticRevisionTicket(index,id,null,raw.revisionTicket))
   return fail(digest,'stale-revision');
  if(!identifying.has(id)&&raw.observations.length>0)
   return fail(digest,'invalid-fixture');
  const view=projectSyntheticIndex(index,id);
  const visible=new Map(view.entries.map(item=>[item.handle,item] as const));
  const found=new Set<string>();
  for(const observation of raw.observations as unknown[]){
   if(!obj(observation)||!exact(observation,['handle','game','revisionTicket'])||
      typeof observation.handle!=='string'||!game(observation.game))
    return fail(digest,'invalid-fixture');
   const item:SyntheticIndexEntry|undefined=visible.get(observation.handle);
   if(!item||item.kind!=='file')return fail(digest,'out-of-scope-handle');
   // Per-observation ticket prevents old claims from being transplanted into
   // a newly stamped worker report for another issued revision.
   if(!matchesSyntheticRevisionTicket(index,id,observation.handle,observation.revisionTicket))
    return fail(digest,'stale-revision');
   const key=observation.handle+'|'+observation.game;
   if(found.has(key))return fail(digest,'invalid-fixture');
   found.add(key);
  }
  inputs.set(id,raw as SyntheticWorkerDeclaration);
 }
 const reports:SyntheticModuleReport[]=[gate(digest)];
 const coverage:Array<{moduleId:Exclude<SyntheticModuleId,'container'>;visibleEntries:number;observations:number;status:'ok'|'incomplete'|'blocked'}>=[];
 for(const id of specialistIds){
  const input=inputs.get(id);
  if(!input)continue;
  const view=projectSyntheticIndex(index,id);
  coverage.push({moduleId:id,visibleEntries:view.entries.length,observations:input.observations.length,status:input.status});
  const signals=input.observations
   .map(({handle,game})=>({game,evidenceId:handle}))
   .sort((a,b)=>a.evidenceId.localeCompare(b.evidenceId)||a.game.localeCompare(b.game));
  reports.push({moduleId:id,contractVersion:1,fixtureDigest:digest,status:input.status,signals});
 }
 const snapshot=coordinateSyntheticEvidence(digest,reports);
 const reason=snapshot.state==='blocked'?'module-blocked':
  snapshot.state==='incomplete'?'missing-module':'none';
 return finish(digest,reports,coverage,reason);
}
