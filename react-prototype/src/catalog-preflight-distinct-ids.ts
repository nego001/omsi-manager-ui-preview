import type {CrossGameIdReuse} from './catalog-cross-game-reuse';
import type {ProposedRelationRegressionSummary} from './catalog-relation-regressions';
import type {DeclaredReferenceChangeSummary} from './catalog-reference-changes';
import type {DeclaredVersionConstraintSummary} from './catalog-version-constraints';

// A declared ID can belong to several preflight groups at once.
// This never counts installed files, package identities or security risks.
export type DeclaredPreflightGroup='cross-game'|'blockers'|'references'|'versions';
export const declaredPreflightGroupLabels:Readonly<Record<DeclaredPreflightGroup,string>>=Object.freeze({
 'cross-game':'Entre simuladores',
 blockers:'Bloqueios declarados',
 references:'Dependências/conflitos',
 versions:'Exigências de versão'
});
export type DeclaredPreflightOverlap={
 id:string;groups:readonly DeclaredPreflightGroup[];
};
export type DeclaredPreflightDistinctIdSummary={
 distinctIds:number;overlappingIds:number;
 overlapExamples:readonly DeclaredPreflightOverlap[];
 overlapExamplesOmitted:number;
 installedFilesChecked:false;realCompatibilityVerified:false;
};
const validId=/^[a-z0-9][a-z0-9_-]*$/;
const invalid=():never=>{throw Error('DECLARED_PREFLIGHT_DISTINCT_IDS_INVALID');};
const validCount=(v:unknown):v is number=>
 typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=200;
type IdRecord={id:string};
function checkedGroup(items:readonly IdRecord[]):ReadonlySet<string>{
 if(!Array.isArray(items)||items.length>200)return invalid();
 const ids=new Set<string>();
 for(const item of items){
  if(!item||typeof item!=='object'||typeof item.id!=='string'||
   item.id.length<1||item.id.length>64||!validId.test(item.id)||
   ids.has(item.id))return invalid();
  ids.add(item.id);
 }
 return ids;
}
export function summarizeDistinctDeclaredPreflightIds(
 crossGame:readonly CrossGameIdReuse[],
 relations:ProposedRelationRegressionSummary,
 references:DeclaredReferenceChangeSummary,
 versions:DeclaredVersionConstraintSummary
):DeclaredPreflightDistinctIdSummary{
 if(!relations||!references||!versions||
  relations.installedPackagesChecked!==false||
  relations.realCompatibilityVerified!==false||
  references.installedFilesChecked!==false||
  references.compatibilityVerified!==false||
  versions.installedFilesChecked!==false||
  versions.realCompatibilityVerified!==false)return invalid();
 const crossIds=checkedGroup(crossGame);
 const relationIds=new Set<string>();
 for(const group of [
  relations.newlyBlocked,relations.worsened,
  relations.changedReasons,relations.addedBlocked
 ]){
  for(const id of checkedGroup(group)){
   // Different relation categories must not claim the same record.
   if(relationIds.has(id))return invalid();
   relationIds.add(id);
  }
 }
 if(relationIds.size>200)return invalid();
 const referenceIds=checkedGroup(references.changed);
 const versionIds=checkedGroup(versions.changed);
 // These four synthetic summaries must describe the same catalog comparison.
 // Consistent counters are not a proof of a real package or installation.
 if(!validCount(references.comparedIds)||
  !validCount(references.unchangedReferences)||
  !validCount(versions.comparedIds)||
  !validCount(versions.unchangedConstraints)||
  !validCount(relations.comparedExisting)||
  !validCount(relations.addedRecords)||
  !validCount(relations.improvedExisting)||
  references.comparedIds!==versions.comparedIds||
  references.comparedIds!==relations.comparedExisting||
  references.unchangedReferences+referenceIds.size!==references.comparedIds||
  versions.unchangedConstraints+versionIds.size!==versions.comparedIds||
  relations.comparedExisting+relations.addedRecords>200||
  relations.improvedExisting>relations.comparedExisting||
  crossIds.size>relations.comparedExisting||
  relationIds.size>relations.comparedExisting+relations.addedRecords||
  relations.addedBlocked.length>relations.addedRecords||
  relations.newlyBlocked.length+relations.worsened.length+
   relations.changedReasons.length>relations.comparedExisting)return invalid();
 const groups:readonly {name:DeclaredPreflightGroup;ids:ReadonlySet<string>}[]=[
  {name:'cross-game',ids:crossIds},{name:'blockers',ids:relationIds},
  {name:'references',ids:referenceIds},
  {name:'versions',ids:versionIds}
 ];
 const occurrences=new Map<string,DeclaredPreflightGroup[]>();
 for(const group of groups)for(const id of group.ids){
  const names=occurrences.get(id)??[];
  names.push(group.name);
  occurrences.set(id,names);
 }
 if(occurrences.size>200)return invalid();
 const overlapping=[...occurrences].filter(([,names])=>names.length>1)
  .sort(([a],[b])=>a<b?-1:a>b?1:0);
 const overlapExamples=Object.freeze(overlapping.slice(0,5).map(([id,names])=>
  Object.freeze({id,groups:Object.freeze([...names])})));
 return Object.freeze({
  distinctIds:occurrences.size,
  overlappingIds:overlapping.length,
  overlapExamples,
  overlapExamplesOmitted:overlapping.length-overlapExamples.length,
  installedFilesChecked:false,realCompatibilityVerified:false
 });
}
