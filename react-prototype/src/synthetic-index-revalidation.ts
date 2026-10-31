// Declarative synthetic revalidation only. No file reads, actual hashes, or reused evidence.
import {SYNTHETIC_MODULE_IDS,type SyntheticModuleId} from './distributed-reader-contract';
import {
 compareSyntheticIndexDeclarations,
 type SyntheticPackageIndex,type SyntheticSuffix,type SyntheticIndexDelta
} from './synthetic-package-index';

export type SyntheticRevalidationReason=
 'untrusted-index'|'declared-digest-changed'|'declared-structure-changed'|
 'identical-declarations-unverified';
export type SyntheticRevalidationPlan=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';
 status:'blocked'|'recheck-required';
 reason:SyntheticRevalidationReason;
 declaredStructureChanged:boolean;
 sameDeclaredDigest:boolean;
 changeCounts:Readonly<{added:number;removed:number;modified:number}>;
 affectedModules:readonly SyntheticModuleId[];
 requiredBeforeNewClaims:readonly SyntheticModuleId[];
 previousSnapshotInvalidated:true;
 previousEvidenceReusable:false;
 handlesReusableAcrossIndexes:false;
 actualContentVerified:false;
 operationsEnabled:false;
}>;
function impacted(suffix:SyntheticSuffix,kind:'file'|'directory'):readonly SyntheticModuleId[]{
 if(kind==='directory'||suffix==='unknown'||suffix==='scs'||suffix==='zip')
  return SYNTHETIC_MODULE_IDS;
 if(suffix==='dds'||suffix==='png'||suffix==='jpg')
  return ['structure','resources','media','definitions'];
 if(suffix==='wav'||suffix==='ogg'||suffix==='bank')
  return ['structure','audio','definitions'];
 if(suffix==='json')return ['structure','manifest','relations'];
 if(suffix==='sii')return ['structure','manifest','definitions','relations','audio'];
 if(['bus','cfg','sco','sli'].includes(suffix))
  return ['structure','definitions','relations','audio','resources'];
 return SYNTHETIC_MODULE_IDS;
}
// Narrow, declarative influence hints. Not a dependency graph or a proven cause.
export function affectedSyntheticModulesForDeclaration(
 suffix:SyntheticSuffix,kind:'file'|'directory'
):readonly SyntheticModuleId[]{
 return Object.freeze([...impacted(suffix,kind)]);
}

export function planSyntheticRevalidation(
 previous:unknown,next:unknown
):SyntheticRevalidationPlan{
 const delta:SyntheticIndexDelta=compareSyntheticIndexDeclarations(previous,next);
 const blocked=delta.status!=='compared';
 const reason:SyntheticRevalidationReason=blocked?'untrusted-index':
  !delta.sameDeclaredDigest?'declared-digest-changed':
  delta.declaredStructureChanged?'declared-structure-changed':
  'identical-declarations-unverified';
 const affected=new Set<SyntheticModuleId>();
 for(const change of delta.changes)for(const id of impacted(change.suffix,change.kind))affected.add(id);
 // Digest disagreements trigger all specialists, even if the declared entry tree looks identical.
 if(!blocked&&!delta.sameDeclaredDigest)for(const id of SYNTHETIC_MODULE_IDS)affected.add(id);
 // These are only hints. A different issued index ALWAYS requires re-evaluation of all claims,
 // because digest/times/sizes are declared by fixtures, never authenticated.
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,
  status:blocked?'blocked' as const:'recheck-required' as const,reason,
  declaredStructureChanged:delta.declaredStructureChanged,
  sameDeclaredDigest:delta.sameDeclaredDigest,
  changeCounts:Object.freeze({added:delta.added,removed:delta.removed,modified:delta.modified}),
  affectedModules:Object.freeze(SYNTHETIC_MODULE_IDS.filter(id=>affected.has(id))),
  requiredBeforeNewClaims:Object.freeze([...SYNTHETIC_MODULE_IDS]),
  previousSnapshotInvalidated:true as const,
  previousEvidenceReusable:false as const,handlesReusableAcrossIndexes:false as const,
  actualContentVerified:false as const,operationsEnabled:false as const
 });
}

// A stale view cannot show a previously guessed game as a current decision.
// The caller must build a NEW index, issue NEW fixture observations and fuse a NEW snapshot.
export function projectPendingSyntheticRevalidation(plan:SyntheticRevalidationPlan){
 return Object.freeze({
  state:plan.status==='blocked'?'blocked' as const:'recheck-required' as const,
  gameCandidate:null,compatible:false as const,installationVerified:false as const,
  diagnostics:Object.freeze({
   reason:plan.reason,affectedModules:Object.freeze([...plan.affectedModules]),
   changedEntryCount:plan.changeCounts.added+plan.changeCounts.removed+plan.changeCounts.modified
  }),
  workshop:Object.freeze({skinEnabled:false as const,audioEnabled:false as const}),
  installer:Object.freeze({enabled:false as const}),
  operationsEnabled:false as const
 });
}
