'use strict';
// Test-only bridge: accepts exactly two pre-authored synthetic payloads.
// Never use this wire format for user-selected config bytes.
const {analyzeCandidateBytes}=require('./m103-omsi-config-format-admission.cjs');
const {resolveSyntheticReferences}=require('./m81d-virtual-reference-resolution.cjs');
const deny=()=>{throw Error('M115_FIXED_FORMAT_FIXTURE_REFUSED');};
const samples=Object.freeze([
 Object.freeze({role:'vehicle-definition',text:'[model]\r\nmodel\\vehicle.cfg\r\n[sound]\r\nsound.cfg\r\n'}),
 Object.freeze({role:'vehicle-model',text:'[mesh]\r\nbody.o3d\r\n[mesh]\r\nmissing.o3d\r\n'})
]);
function record(v,keys){
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length)deny();
 const result=Object.create(null);
 for(const key of keys){
  const d=Object.getOwnPropertyDescriptor(v,key);
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable)deny();
  result[key]=d.value;
 }
 return result;
}
function reviewFixedNativeFormat(raw,platform){
 try{
  if(!['linux','win32'].includes(platform))deny();
  const d=record(raw,['schema','platform','cases','realModRead','operationsEnabled']);
  if(d.schema!=='omsi-m115-fixed-native-format-fixture-v1'||d.platform!==platform||
    d.realModRead!==false||d.operationsEnabled!==false||!Array.isArray(d.cases)||d.cases.length!==2)deny();
  const results=[];
  for(let i=0;i<samples.length;i++){
   const desc=Object.getOwnPropertyDescriptor(d.cases,String(i));
   if(!desc||!Object.hasOwn(desc,'value'))deny();
   const row=record(desc.value,['role','fixtureBase64','opened','readCalls','bytesRead']);
   const sample=samples[i],expected=Buffer.from(sample.text,'ascii');
   if(row.role!==sample.role||row.fixtureBase64!==expected.toString('base64')||row.opened!==1||
     !Number.isSafeInteger(row.readCalls)||row.readCalls<2||row.readCalls>2*expected.length||row.bytesRead!==2*expected.length)deny();
   const bytes=Buffer.from(row.fixtureBase64,'base64');
   const format=analyzeCandidateBytes(bytes,sample.role,'utf-8');
   const references=bytes.toString('ascii').split(/\r?\n/).flatMap((line,index,lines)=>{
    if(line!=='[model]'&&line!=='[mesh]')return [];
    return [{kind:sample.role,keyword:line,source:sample.role==='vehicle-definition'?'fixture.bus':'model/vehicle.cfg',target:lines[index+1]}];
   });
   // Explicit virtual inventory; no actual dependency files are inspected.
   const resolution=resolveSyntheticReferences({files:['fixture.bus','model/vehicle.cfg','model/body.o3d'],references,complete:true});
   results.push(Object.freeze({role:sample.role,knownMarkers:format.knownMarkers,
    references:references.length,exact:resolution.counts.exact??0,absentFromVirtualFixture:resolution.counts['absent-from-fixture']??0}));
  }
  return Object.freeze({schema:'omsi-m115-native-format-review-v1',platform,rows:Object.freeze(results),
   scope:'fixed-synthetic-content-and-virtual-dependencies',nativeContentFixtureAccepted:true,
   actualDependencyFilesInspected:false,nativeIdentityVerifiedForRealMods:false,compatibilityVerified:false,contentReadAuthorized:false,operationsEnabled:false});
 }catch{deny();}
}
module.exports={reviewFixedNativeFormat};
