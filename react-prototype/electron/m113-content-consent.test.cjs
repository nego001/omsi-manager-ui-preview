'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createConsentReview,MAX_AGE}=require('../scripts/m113-content-consent.cjs');
const {createDocumentEpochGate}=require('./document-epoch-gate.cjs');
const setup=()=>{let time=0;const gate=createConsentReview({now:()=>time}),owner={},epoch=createDocumentEpochGate(),proof=epoch.snapshot(),selection={};
 return {gate,owner,epoch,proof,selection,advance:n=>time+=n,request:()=>gate.request(owner,epoch,proof,selection,'vehicle-definition','utf-8'),
 confirm:(t,c,d)=>gate.confirm(t,owner,epoch,proof,selection,c,d)};};
test('separate explicit consent scopes remain non-authorizing',()=>{
 const f=setup();
 const a=f.confirm(f.request(),true,false),b=f.confirm(f.request(),true,true);
 assert.equal(a.requestedScope,'selected-content-only');assert.equal(a.maxDependencyEntries,0);
 assert.equal(b.requestedScope,'selected-content-and-bounded-dependency-metadata');assert.equal(b.maxDependencyEntries,4096);
 for(const r of [a,b])for(const k of ['nativeConsentVerified','nativeHandleVerified','contentReadAuthorized','dependencyReadAuthorized','realModRead','operationsEnabled'])assert.equal(r[k],false);
});
test('no implicit consent, metadata alone, replay, clone or changed selection',()=>{
 const f=setup();
 for(const args of [[false,true],[true,undefined],[1,true]])assert.throws(()=>f.confirm(f.request(),...args),/M113_CONSENT_REFUSED/);
 const t=f.request();assert.throws(()=>f.confirm({...t},true,true));
 assert.throws(()=>f.gate.confirm(t,f.owner,f.epoch,f.proof,{},true,true));
 assert.throws(()=>f.confirm(t,true,true));
});
test('supersession, cancellation, monotonic expiry and epoch invalidation',()=>{
 const f=setup();let t=f.request();const next=f.request();
 assert.throws(()=>f.confirm(t,true,false));assert.equal(f.gate.cancel(next),true);assert.throws(()=>f.confirm(next,true,false));
 t=f.request();f.advance(MAX_AGE+1);assert.throws(()=>f.confirm(t,true,false));
 t=f.request();f.epoch.invalidate();assert.throws(()=>f.confirm(t,true,false));
});
test('shared report contract accepts actual M104 lab output and rejects malformed observations',async t=>{
 const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
 const {validateDependencyObservation:validate}=await import('../src/omsi-dependency-contract.mjs');
 const {observeDependencies}=require('../scripts/m104-bounded-local-dependency-observation.cjs');
 const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'omsi-m113-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.writeFile(path.join(root,'Test.bus'),'[model]\na.cfg\n');
 await fs.writeFile(path.join(root,'a.cfg'),'fixture');
 const r=await observeDependencies(root,'Test.bus','vehicle-definition','utf-8');
 const safe=validate(r);assert.deepEqual(safe,r);assert.ok(Object.isFrozen(safe.counts));
 for(const raw of [{...r,operationsEnabled:true},{...r,path:'private'},{...r,referenceOccurrences:2},{...r,encoding:'auto'},
 {...r,counts:{...r.counts,'exact-observed':-1}},{...r,budgetLimited:true}])assert.equal(validate(raw),null);
});
