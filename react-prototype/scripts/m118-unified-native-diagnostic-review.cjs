'use strict';
// Test-only aggregation of independently supplied fixture reports, not provenance.
const {admitNativeFixture}=require('./m114-native-reader-evidence-boundary.cjs');
const {reviewFixedNativeFormat}=require('./m115-fixed-native-format-bridge.cjs');
const deny=()=>{throw Error('M118_DIAGNOSTIC_REVIEW_REFUSED');};
const layouts={
 linux:{schema:'omsi-m116-linux-dependency-metadata-fixture-v1',flag:'nativeDirectoryDescriptorUsed',cases:{exact:'exact-observed','case-only':'case-only-observed',missing:'not-observed-in-directory',ambiguous:'ambiguous-case',link:'link-refused',directory:'not-regular-path',limited:'budget-limited'}},
 win32:{schema:'omsi-m117-windows-dependency-metadata-fixture-v1',flag:'nativeDirectoryEnumerationByHandle',cases:{exact:'exact-observed','case-only':'case-only-observed',missing:'not-observed-in-directory',ambiguous:'ambiguous-case',link:'link-refused',directory:'not-regular-path',hardlink:'not-regular-path'}}
};
function record(v,keys){
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length)deny();
 const out=Object.create(null);
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)deny();out[key]=d.value;}
 return out;
}
function dependencySummary(platform,raw){
 const l=layouts[platform];
 const flags=['dependencyContentsRead','realModValidated','atomicContainmentProven','operationsEnabled'];
 const d=record(raw,['schema','cases',l.flag,...flags]);
 if(d.schema!==l.schema||d[l.flag]!==true||!flags.every(k=>d[k]===false)||!Array.isArray(d.cases)||d.cases.length!==7)deny();
 const seen=new Set(),gaps=[];
 for(let i=0;i<7;i++){
  const descriptor=Object.getOwnPropertyDescriptor(d.cases,String(i));if(!descriptor||!Object.hasOwn(descriptor,'value'))deny();
  const row=record(descriptor.value,platform==='linux'?['scenario','outcome','entriesScanned']:['scenario','outcome']);
  if(typeof row.scenario!=='string'||!Object.hasOwn(l.cases,row.scenario)||seen.has(row.scenario))deny();
  seen.add(row.scenario);
  if(platform==='win32'&&['ambiguous','link'].includes(row.scenario)&&row.outcome==='fixture-unavailable')gaps.push(row.scenario);
  else if(row.outcome!==l.cases[row.scenario])deny();
  if(platform==='linux'&&(!Number.isSafeInteger(row.entriesScanned)||row.entriesScanned<1||row.entriesScanned>64||(row.scenario==='limited'&&row.entriesScanned!==1)))deny();
 }
 return Object.freeze({cases:7,observedCases:7-gaps.length,unavailableCases:Object.freeze(gaps),partialBudgetFixtureCovered:platform==='linux',hardlinkFixtureCovered:platform==='win32'});
}
function createUnifiedReview(platform,input){
 try{
  if(typeof platform!=='string'||!Object.hasOwn(layouts,platform))deny();
  const d=record(input,['reader','format','dependencies']);
  const reader=admitNativeFixture(platform,d.reader);
  const format=reviewFixedNativeFormat(d.format,platform);
  const dependencies=dependencySummary(platform,d.dependencies);
  return Object.freeze({schema:'omsi-m118-native-diagnostic-review-v1',platform,scope:'independent-disposable-fixture-reports',
   reader,format,dependencies,coverageGaps:reader.unavailableCases+dependencies.unavailableCases.length,
   status:reader.unavailableCases||dependencies.unavailableCases.length?'fixture-coverage-incomplete':'declared-fixture-cases-observed',
   linkedSameFileIdentityVerified:false,independentlyVerified:false,realModValidated:false,compatibilityVerified:false,
   contentReadAuthorized:false,operationsEnabled:false});
 }catch{deny();}
}
module.exports={createUnifiedReview,dependencySummary};
