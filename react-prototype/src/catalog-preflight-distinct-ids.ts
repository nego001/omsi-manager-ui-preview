import type {CrossGameIdReuse} from './catalog-cross-game-reuse';
import type {ProposedRelationRegressionSummary} from './catalog-relation-regressions';
import type {DeclaredReferenceChangeSummary} from './catalog-reference-changes';
import type {DeclaredVersionConstraintSummary} from './catalog-version-constraints';

// A declared ID can belong to several preflight groups at once.
// This never counts installed files, package identities or security risks.
export type DeclaredPreflightDistinctIdSummary={
 distinctIds:number;overlappingIds:number;
 installedFilesChecked:false;realCompatibilityVerified:false;
};
const validId=/^[a-z0-9][a-z0-9_-]*$/;
const invalid=():never=>{throw Error('DECLARED_PREFLIGHT_DISTINCT_IDS_INVALID');};
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
 const groups=[
  crossIds,relationIds,checkedGroup(references.changed),
  checkedGroup(versions.changed)
 ];
 const occurrences=new Map<string,number>();
 for(const group of groups)for(const id of group)
  occurrences.set(id,(occurrences.get(id)??0)+1);
 if(occurrences.size>200)return invalid();
 return Object.freeze({
  distinctIds:occurrences.size,
  overlappingIds:[...occurrences.values()].filter(count=>count>1).length,
  installedFilesChecked:false,realCompatibilityVerified:false
 });
}
