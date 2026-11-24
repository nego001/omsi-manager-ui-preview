'use strict';
// Test-only protocol admission. Native fixture JSON is not an authorization,
// cryptographic attestation, or proof of the identity of a selected game file.
const deny=()=>{throw Error('M114_NATIVE_EVIDENCE_REFUSED');};
const commonFlags=['nativeIdentityVerifiedForRealMods','atomicContainmentProven','abaRuledOut','osDeadlineProven','realModRead','operationsEnabled'];
const layouts=Object.freeze({
 linux:Object.freeze({schema:'omsi-m111-linux-dirfd-fixture-v1',flags:['nativeDirFdUsed'],cases:['normal','maximum','symlink','fifo','hardlink','oversized','empty','parent-replaced','file-replaced','changed-during-read','cancel-before','cancel-during-read']}),
 win32:Object.freeze({schema:'omsi-m112-windows-handle-fixture-v1',flags:['relativeNativeOpenUsed','nativeFileIdChecked'],cases:['normal','maximum','empty','oversized','directory-instead','hardlink','reparse','parent-replaced','file-replaced','changed-during-read','cancel-before','cancel-during-read']})
});
function record(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==keys.length)deny();
 const safe=Object.create(null);
 for(const k of keys){
  const d=Object.getOwnPropertyDescriptor(value,k);
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable)deny();
  safe[k]=d.value;
 }
 return safe;
}
function admitNativeFixture(platform,raw){
 try{
  if(typeof platform!=='string'||!Object.hasOwn(layouts,platform))deny();
  const spec=layouts[platform];
  const d=record(raw,['schema','cases',...spec.flags,...commonFlags]);
  if(d.schema!==spec.schema||!spec.flags.every(k=>d[k]===true)||!commonFlags.every(k=>d[k]===false)||
     !Array.isArray(d.cases)||d.cases.length!==spec.cases.length)deny();
  const seen=new Set();
  let unavailable=0,accepted=0,refused=0;
  for(let i=0;i<d.cases.length;i++){
   const item=Object.getOwnPropertyDescriptor(d.cases,String(i));
   if(!item||!Object.hasOwn(item,'value'))deny();
   const row=record(item.value,['scenario','outcome','opened','readCalls','bytesRead']);
   if(!spec.cases.includes(row.scenario)||seen.has(row.scenario))deny();
   seen.add(row.scenario);
   if(![row.opened,row.readCalls,row.bytesRead].every(n=>Number.isSafeInteger(n)&&n>=0)||
      row.opened>1||row.readCalls>131072||row.bytesRead>131072||row.readCalls>row.bytesRead)deny();
   if(row.scenario==='normal'||row.scenario==='maximum'){
    if(row.outcome!=='matching-two-snapshots'||row.opened!==1||row.readCalls<2||row.bytesRead<2||
       row.bytesRead%2!==0||row.readCalls<2*Math.ceil(row.bytesRead/8192)||
       (row.scenario==='maximum'&&row.bytesRead!==131072))deny();
    accepted++;continue;
   }
   if(platform==='win32'&&['reparse','parent-replaced'].includes(row.scenario)&&row.outcome==='fixture-unavailable'){
    if(row.opened||row.readCalls||row.bytesRead)deny();
    unavailable++;continue;
   }
   if(row.outcome!=='refused')deny();
   if(['changed-during-read','cancel-during-read'].includes(row.scenario)){
    if(row.opened!==1||row.readCalls!==1||row.bytesRead<1||row.bytesRead>4096)deny();
   }else if(row.readCalls!==0||row.bytesRead!==0||row.opened!==(row.scenario==='file-replaced'?1:0))deny();
   refused++;
  }
  return Object.freeze({schema:'omsi-m114-native-fixture-review-v1',platform,fixtureCases:seen.size,
   matchingSnapshots:accepted,refusals:refused,unavailableCases:unavailable,
   fixtureCoverageComplete:unavailable===0,reportShapeAccepted:true,
   independentlyVerified:false,nativeConsentVerified:false,productionReaderAvailable:false,
   contentReadAuthorized:false,operationsEnabled:false});
 }catch{deny();}
}
module.exports={admitNativeFixture};
