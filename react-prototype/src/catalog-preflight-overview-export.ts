import type {DeclaredCatalogDiff} from './catalog-replacement-diff';
import type {DeclaredPreflightDistinctIdSummary,DeclaredPreflightGroup}
 from './catalog-preflight-distinct-ids';
import {serializeDeclaredCatalogDiff} from './catalog-diff-export';
import {serializeDeclaredPreflightOverlaps} from './catalog-preflight-overlap-export';

// Manual and metadata-only. This is not an installed-mod audit or a risk score.
export type DeclaredPreflightGroupCounts=Readonly<Record<DeclaredPreflightGroup,number>>;
export type DeclaredPreflightOverviewInput={
 diff:DeclaredCatalogDiff;
 summary:DeclaredPreflightDistinctIdSummary;
 groups:DeclaredPreflightGroupCounts;
};
const groupNames:readonly DeclaredPreflightGroup[]=[
 'cross-game','blockers','references','versions'
];
const invalid=():never=>{throw Error('DECLARED_PREFLIGHT_OVERVIEW_EXPORT_INVALID');};
const validCount=(v:unknown):v is number=>
 typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=200;
export function serializeDeclaredPreflightOverview(
 input:DeclaredPreflightOverviewInput
):string{
 if(!input||typeof input!=='object'||!input.diff||!input.summary||
  !input.groups||typeof input.groups!=='object'||
  Array.isArray(input.groups)||Object.keys(input.groups).length!==4||
  Object.keys(input.groups).some(x=>!groupNames.includes(x as DeclaredPreflightGroup)))
  return invalid();
 // Reuse strict serializers as fail-closed validators before projecting counts.
 serializeDeclaredCatalogDiff(input.diff);
 serializeDeclaredPreflightOverlaps(input.summary);
 const counts=groupNames.map(name=>input.groups[name]);
 if(counts.some(v=>!validCount(v)))return invalid();
 const sum=counts.reduce((a,b)=>a+b,0);
 const distinct=input.summary.distinctIds,overlap=input.summary.overlappingIds;
 if(sum>800||distinct>sum||overlap>distinct)return invalid();
 const seenGroups=groupNames.map(name=>
  input.summary.allOverlaps.filter(entry=>entry.groups.includes(name)).length);
 if(seenGroups.some((count,i)=>count>counts[i]))return invalid();
 const expectedMentions=distinct-overlap+
  input.summary.allOverlaps.reduce((n,entry)=>n+entry.groups.length,0);
 if(sum!==expectedMentions)return invalid();
 const diff=input.diff;
 const current=diff.unchanged+diff.changed.length+diff.removed.length;
 const proposed=diff.unchanged+diff.changed.length+diff.added.length;
 if(current<1||proposed<1||current>200||proposed>200)return invalid();
 const hasChanges=diff.changed.length+diff.removed.length+diff.added.length>0;
 const result={
  schema:'omsi-manager-declared-preflight-overview-v1',
  scope:'pending-catalog-preflight-summary-metadata-only',
  source:'catalog-declarations-unverified',
  counts:{
   catalog:{current,proposed,unchanged:diff.unchanged,
    changed:diff.changed.length,removed:diff.removed.length,
    added:diff.added.length},
   alerts:{groups:{
    'cross-game':input.groups['cross-game'],
    blockers:input.groups.blockers,
    references:input.groups.references,
    versions:input.groups.versions
   },distinctIds:distinct,overlappingIds:overlap}
  },
  hasCatalogChangesOutsideFourAlertGroups:hasChanges&&distinct===0,
  completeCatalogCounts:true,
  metadataOnly:true,
  alertCountsAreNotRiskScores:true,
  alertGroupsMayOverlap:true,
  proposedCatalogApplied:false,
  installedFilesChecked:false,
  compatibilityVerified:false,
  sourceAuthenticated:false,
  installedPackageIdentityVerified:false,
  restorableByPreview:false,
  disclaimer:'Contagens de metadados JSON. Alertas dos quatro grupos podem se sobrepor e não incluem todas as mudanças. Nenhuma inspeção, identidade de pacote, segurança, compatibilidade ou instalação foi comprovada.'
 };
 const json=JSON.stringify(result,null,2)+'\n';
 if(new TextEncoder().encode(json).byteLength>16384)
  throw Error('DECLARED_PREFLIGHT_OVERVIEW_EXPORT_TOO_LARGE');
 return json;
}
