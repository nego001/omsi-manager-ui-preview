import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {consolidateFixtureNativeEvidence as consolidate} from './runtime-native-evidence.mjs';
const refuse=/^Error: CORE_RUNTIME_NATIVE_EVIDENCE_REFUSED$/;
const flags={atomicContainmentProven:false,abaRuledOut:false,realReadsPerformed:false,operationsEnabled:false,releaseAuthorized:false};
function fixture(){
 return {scope:'synthetic-fixture',
 linux:{scope:'disposable-linux-fixture',cases:['nested-regular-same-handle','leaf-symlink','parent-symlink','traversal','absolute','hardlink','fifo','directory','size-cap','in-place-mutation','file-replacement','parent-substitution','sibling-unchanged'],nativeOpenat2Observed:true,...flags},
 windows:{scope:'disposable-windows-fixture',cases:['nested-regular-same-handle','parent-junction','leaf-junction','traversal','absolute','alternate-stream','hardlink','directory','size-cap','in-place-mutation','file-replacement','parent-substitution-os-blocked-5','sibling-unchanged'],nativeRelativeHandleObserved:true,...flags}};
}
test('native evidence consolidates both fixture contracts without granting authority',()=>{
 const r=consolidate(fixture());assert.equal(r.reportedCaseCount,26);
 assert.deepEqual(r.observations.map(x=>x.platform),['linux','win32']);
 assert.equal(r.contractValidated,true);assert.equal(r.decision,'deny-real-access');
 for(const k of [...Object.keys(flags),'independentCiVerification','nativeAttestationVerified','crossVolumeProtectionVerified','osIsolationVerified','realSecurityGateVerified'])assert.equal(r[k],false);
 assert.ok(r.observations.every(o=>o.observationOrigin==='caller-supplied-fixture-report'&&o.nativeAttestationVerified===false));
});
test('parent substitution distinguishes Windows OS refusal from actual detection',()=>{
 for(const code of [5,32,33]){
  const x=fixture();x.windows.cases[11]='parent-substitution-os-blocked-'+code;
  const r=consolidate(x);assert.deepEqual(r.observations[1].parentSubstitution,{outcome:'os-blocked',win32Code:code});
  assert.deepEqual(r.observations[0].parentSubstitution,{outcome:'detected-after-mutation',win32Code:null});
 }
 const x=fixture();x.windows.cases[11]='parent-substitution-detected';
 assert.deepEqual(consolidate(x).observations[1].parentSubstitution,{outcome:'detected-after-mutation',win32Code:null});
});
test('missing, duplicated, reordered, foreign or unsupported cases refuse',()=>{
 for(const modify of [x=>x.linux.cases.pop(),x=>x.windows.cases[1]=x.windows.cases[2],x=>x.linux.cases.reverse(),x=>x.windows.cases[11]='parent-substitution',x=>x.windows.cases[11]='parent-substitution-os-blocked-87',x=>x.windows=x.linux]){
  const x=fixture();modify(x);assert.throws(()=>consolidate(x),refuse);
 }
});
test('native report cannot supply self-attested authority, identifiers or real scope',()=>{
 for(const modify of [x=>x.scope='real-mod',x=>x.windows.nativeRelativeHandleObserved=false,x=>x.linux.atomicContainmentProven=true,x=>x.windows.abaRuledOut=true,x=>x.linux.realReadsPerformed=true,x=>x.windows.operationsEnabled=true,x=>x.windows.releaseAuthorized=true,x=>x.windows.root='C:/secret',x=>x.ciRun='fake']){
  const x=fixture();modify(x);assert.throws(()=>consolidate(x),refuse);
 }
});
test('native evidence rejects accessors, sparse and augmented case arrays',()=>{
 let invoked=false;const a=fixture();Object.defineProperty(a.windows,'scope',{get(){invoked=true;return 'disposable-windows-fixture';}});
 assert.throws(()=>consolidate(a),refuse);assert.equal(invoked,false);
 const b=fixture();Object.defineProperty(b.linux.cases,'1',{get(){invoked=true;return 'leaf-symlink';}});
 assert.throws(()=>consolidate(b),refuse);assert.equal(invoked,false);
 const c=fixture();delete c.windows.cases[0];assert.throws(()=>consolidate(c),refuse);
 const d=fixture();d.linux.cases.extra=true;assert.throws(()=>consolidate(d),refuse);
});
test('evidence digests canonical deterministic and immutable',()=>{
 const x=fixture(),r=consolidate(x);assert.deepEqual(consolidate(x),r);
 const hash=body=>createHash('sha256').update(JSON.stringify(body)).digest('hex');
 const {evidenceDigest,...body}=r;assert.equal(evidenceDigest,hash(body));
 for(const o of r.observations){const {observationDigest,...b}=o;assert.equal(observationDigest,hash(b));for(const a of [o,o.cases,o.parentSubstitution])assert.ok(Object.isFrozen(a));}
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.observations));
 x.windows.cases[11]='parent-substitution-os-blocked-32';assert.notEqual(consolidate(x).evidenceDigest,r.evidenceDigest);
 assert.equal(r.observations[1].parentSubstitution.win32Code,5);
});
