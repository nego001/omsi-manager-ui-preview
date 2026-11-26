// F4.01e: synthetic laboratory observation normalization, not native attestation.
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('CORE_RUNTIME_NATIVE_EVIDENCE_REFUSED');};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
const shared=['nested-regular-same-handle'];
const linux=[...shared,'leaf-symlink','parent-symlink','traversal','absolute','hardlink','fifo','directory','size-cap','in-place-mutation','file-replacement','parent-substitution','sibling-unchanged'];
const windows=[...shared,'parent-junction','leaf-junction','traversal','absolute','alternate-stream','hardlink','directory','size-cap','in-place-mutation','file-replacement',null,'sibling-unchanged'];
const parentResults=Object.freeze(['parent-substitution-detected','parent-substitution-os-blocked-5','parent-substitution-os-blocked-32','parent-substitution-os-blocked-33']);
const flags=['atomicContainmentProven','abaRuledOut','realReadsPerformed','operationsEnabled','releaseAuthorized'];
function normalize(input,platform){
 const nativeKey=platform==='linux'?'nativeOpenat2Observed':'nativeRelativeHandleObserved';
 const x=record(input,['scope','cases',nativeKey,...flags]);
 if(x.scope!=='disposable-'+(platform==='linux'?'linux':'windows')+'-fixture'||x[nativeKey]!==true||flags.some(k=>x[k]!==false))fail();
 const expected=platform==='linux'?linux:windows;
 if(!Array.isArray(x.cases)||x.cases.length!==expected.length||Reflect.ownKeys(x.cases).length!==expected.length+1)fail();
 const cases=expected.map((value,i)=>{
  const d=Object.getOwnPropertyDescriptor(x.cases,String(i));
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable||(value===null?!parentResults.includes(d.value):d.value!==value))fail();
  return d.value;
 });
 const parent=cases[platform==='linux'?11:11];
 const outcome=parent.includes('-os-blocked-')?'os-blocked':'detected-after-mutation';
 const body={platform,scope:x.scope,cases:Object.freeze(cases),caseCount:cases.length,parentSubstitution:Object.freeze({outcome,win32Code:outcome==='os-blocked'?Number(parent.split('-').at(-1)):null}),observationOrigin:'caller-supplied-fixture-report',nativeAttestationVerified:false};
 return Object.freeze({...body,observationDigest:digest(body)});
}
export function consolidateFixtureNativeEvidence(input){
 try{
  const x=record(input,['scope','linux','windows']);
  if(x.scope!=='synthetic-fixture')fail();
  const a=normalize(x.linux,'linux'),b=normalize(x.windows,'win32');
  const body={schemaVersion:1,scope:x.scope,observations:Object.freeze([a,b]),reportedCaseCount:a.caseCount+b.caseCount,
   contractValidated:true,independentCiVerification:false,nativeAttestationVerified:false,atomicContainmentProven:false,abaRuledOut:false,
   crossVolumeProtectionVerified:false,osIsolationVerified:false,realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false,releaseAuthorized:false,
   decision:'deny-real-access'};
  return Object.freeze({...body,evidenceDigest:digest(body)});
 }catch{fail();}
}
