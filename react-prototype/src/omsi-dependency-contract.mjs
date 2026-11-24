// Shared pure report admission for renderer and test controller.
// Schema validity is not provenance, compatibility, or operational authority.
export const dependencyStatuses=Object.freeze(['exact-observed','case-only-observed','ambiguous-case','invalid-reference','not-observed-in-directory','not-regular-path','link-refused','budget-limited','unresolved-argument']);
export const dependencyFlags=Object.freeze(['dependencyContentsRead','fullGrammarVerified','compatibilityVerified','atomicContainmentVerified','nativeIdentityVerified','realModValidated','operationsEnabled']);
const keys=['schema','scope','role','encoding','referenceKind','referenceOccurrences','unexaminedKnownMarkers','entriesScanned','entryBudget','counts','budgetLimited',...dependencyFlags];
export const encodings=Object.freeze(['utf-8','windows-1250','windows-1251','windows-1252']);
function record(value,expected){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==expected.length)return null;
 const result=Object.create(null);
 for(const key of expected){
  const d=Object.getOwnPropertyDescriptor(value,key);
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable)return null;
  result[key]=d.value;
 }
 return result;
}
const bounded=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
export function validateDependencyObservation(raw){
 try{
  const d=record(raw,keys);
  if(!d||d.schema!=='omsi-m104-dependency-observation-v1'||d.scope!=='bounded-selected-directory-candidate'||
   !dependencyFlags.every(k=>d[k]===false)||d.entryBudget!==4096||
   !bounded(d.referenceOccurrences,256)||!bounded(d.unexaminedKnownMarkers,256)||
   d.referenceOccurrences+d.unexaminedKnownMarkers>256||!bounded(d.entriesScanned,4096)||
   !encodings.includes(d.encoding)||
   !((d.role==='vehicle-definition'&&d.referenceKind==='model')||(d.role==='vehicle-model'&&d.referenceKind==='mesh')))return null;
  const counts=record(d.counts,dependencyStatuses);
  if(!counts||!dependencyStatuses.every(k=>bounded(counts[k],256))||
   dependencyStatuses.reduce((sum,k)=>sum+counts[k],0)!==d.referenceOccurrences||
   d.budgetLimited!==(counts['budget-limited']>0)||
   (d.budgetLimited&&d.entriesScanned!==4096))return null;
  return Object.freeze({...d,counts:Object.freeze({...counts})});
 }catch{return null;}
}
