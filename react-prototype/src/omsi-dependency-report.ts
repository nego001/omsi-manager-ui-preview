// Pure view contract, not a trusted attestation or a native file grant.
// Only fixed categorical observations and bounded counts enter the UI.
import {dependencyStatuses,dependencyFlags as flags,validateDependencyObservation} from './omsi-dependency-contract.mjs';
export {dependencyStatuses};
export type DependencyStatus=typeof dependencyStatuses[number];
const labels:Record<DependencyStatus,string>={
 'exact-observed':'Nome exato observado','case-only-observed':'Diferença de maiúsculas/minúsculas',
 'ambiguous-case':'Nome ambíguo','invalid-reference':'Referência não admitida',
 'not-observed-in-directory':'Não localizado na busca concluída','not-regular-path':'Não é arquivo regular',
 'link-refused':'Link recusado','budget-limited':'Busca limitada','unresolved-argument':'Argumento inconclusivo'
};
export function projectDependencyObservation(raw:unknown){
 const d=validateDependencyObservation(raw);
 if(!d)return null;
 const counts=d.counts;
 const rows=dependencyStatuses.map(status=>({status,label:labels[status],count:counts[status]}));
 const total=d.referenceOccurrences;
 const exact=counts['exact-observed'] as number;
  return Object.freeze({referenceKind:d.referenceKind as 'model'|'mesh',referenceOccurrences:d.referenceOccurrences,
   entriesScanned:d.entriesScanned,unexaminedKnownMarkers:d.unexaminedKnownMarkers,budgetLimited:d.budgetLimited as boolean,
   state:d.referenceOccurrences===0?'no-evidence':d.budgetLimited?'incomplete':exact===total?'exact-hints-only':'review-required',
   rows:Object.freeze(rows.map(row=>Object.freeze({...row,count:row.count as number}))),
   actualGameInspection:false,compatibilityVerified:false,operationsEnabled:false});
}
// Authored example, not an actual filesystem observation.
export function dependencyPreviewExample(mode:'mixed'|'limited'|'empty'){
 const counts=Object.fromEntries(dependencyStatuses.map(k=>[k,0]));
 if(mode==='mixed'){counts['exact-observed']=2;counts['case-only-observed']=1;counts['not-observed-in-directory']=1;counts['invalid-reference']=1;}
 if(mode==='limited'){counts['exact-observed']=1;counts['budget-limited']=2;}
 return {schema:'omsi-m104-dependency-observation-v1',scope:'bounded-selected-directory-candidate',
  role:'vehicle-definition',encoding:'utf-8',referenceKind:'model',referenceOccurrences:Object.values(counts).reduce((a,b)=>a+b,0),
  unexaminedKnownMarkers:0,entriesScanned:mode==='limited'?4096:mode==='mixed'?18:0,entryBudget:4096,counts,
  budgetLimited:mode==='limited',...Object.fromEntries(flags.map(k=>[k,false]))};
}
