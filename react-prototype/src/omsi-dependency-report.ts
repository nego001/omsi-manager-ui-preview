// Pure view contract, not a trusted attestation or a native file grant.
// Only fixed categorical observations and bounded counts enter the UI.
export const dependencyStatuses=['exact-observed','case-only-observed','ambiguous-case','invalid-reference','not-observed-in-directory','not-regular-path','link-refused','budget-limited','unresolved-argument'] as const;
export type DependencyStatus=typeof dependencyStatuses[number];
const labels:Record<DependencyStatus,string>={
 'exact-observed':'Nome exato observado','case-only-observed':'Diferença de maiúsculas/minúsculas',
 'ambiguous-case':'Nome ambíguo','invalid-reference':'Referência não admitida',
 'not-observed-in-directory':'Não localizado na busca concluída','not-regular-path':'Não é arquivo regular',
 'link-refused':'Link recusado','budget-limited':'Busca limitada','unresolved-argument':'Argumento inconclusivo'
};
const flags=['dependencyContentsRead','fullGrammarVerified','compatibilityVerified','atomicContainmentVerified','nativeIdentityVerified','realModValidated','operationsEnabled'] as const;
const keys=['schema','scope','role','encoding','referenceKind','referenceOccurrences','unexaminedKnownMarkers','entriesScanned','entryBudget','counts','budgetLimited',...flags];
type Data=Record<string,unknown>;
function record(value:unknown,expected:readonly string[]):Data|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const proto=Object.getPrototypeOf(value);
 if(proto!==Object.prototype&&proto!==null)return null;
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(descriptors).length!==expected.length)return null;
 const result:Data=Object.create(null);
 for(const key of expected){
  const d=Object.getOwnPropertyDescriptor(value,key);
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable)return null;
  result[key]=d.value;
 }
 return result;
}
const bounded=(value:unknown,max:number):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=max;
export function projectDependencyObservation(raw:unknown){
 try{
  const d=record(raw,keys);
  if(!d||d.schema!=='omsi-m104-dependency-observation-v1'||d.scope!=='bounded-selected-directory-candidate'||
   !flags.every(k=>d[k]===false)||d.entryBudget!==4096||
   !bounded(d.referenceOccurrences,256)||!bounded(d.unexaminedKnownMarkers,256)||
   d.referenceOccurrences+d.unexaminedKnownMarkers>256||!bounded(d.entriesScanned,4096)||
   !['utf-8','windows-1250','windows-1251','windows-1252'].includes(d.encoding as string)||
   !((d.role==='vehicle-definition'&&d.referenceKind==='model')||(d.role==='vehicle-model'&&d.referenceKind==='mesh')))return null;
  const counts=record(d.counts,dependencyStatuses);
  if(!counts)return null;
  const rows=dependencyStatuses.map(status=>({status,label:labels[status],count:counts[status]}));
  let total=0;
  for(const row of rows){if(!bounded(row.count,256))return null;total+=row.count;}
  if(total!==d.referenceOccurrences||d.budgetLimited!==(counts['budget-limited']!==0)||
    (d.budgetLimited===true&&d.entriesScanned!==4096))return null;
  const exact=counts['exact-observed'] as number;
  return Object.freeze({referenceKind:d.referenceKind as 'model'|'mesh',referenceOccurrences:d.referenceOccurrences,
   entriesScanned:d.entriesScanned,unexaminedKnownMarkers:d.unexaminedKnownMarkers,budgetLimited:d.budgetLimited as boolean,
   state:d.referenceOccurrences===0?'no-evidence':d.budgetLimited?'incomplete':exact===total?'exact-hints-only':'review-required',
   rows:Object.freeze(rows.map(row=>Object.freeze({...row,count:row.count as number}))),
   actualGameInspection:false,compatibilityVerified:false,operationsEnabled:false});
 }catch{return null;}
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
