'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createFixtureHandoff}=require('../scripts/m125-native-selection-handoff.cjs');
const {createDocumentEpochGate}=require('./document-epoch-gate.cjs');
const {MAX_AGE}=require('../scripts/m113-content-consent.cjs');
function fixture(platform='linux'){
 let now=0;
 const gate=createFixtureHandoff({platform,now:()=>now}),owner={},epoch=createDocumentEpochGate(),proof=epoch.snapshot(),selection={};
 const args=[owner,epoch,proof,selection];
 const begin=()=>gate.begin(...args,'vehicle-definition','utf-8');
 const confirm=(r,c=true,d=false)=>gate.confirm(r,...args,c,d);
 const consume=(t,s='selected-content-only')=>gate.consume(t,...args,s);
 return {gate,owner,epoch,proof,selection,args,begin,confirm,consume,advance:n=>now+=n};
}
test('both platforms produce non-authorizing one-use reviews with explicit separate scopes',()=>{
 for(const platform of ['linux','win32']){
  const f=fixture(platform);
  for(const dependency of [false,true]){
   const t=f.confirm(f.begin(),true,dependency);
   const r=f.consume(t,dependency?'selected-content-and-bounded-dependency-metadata':'selected-content-only');
   assert.equal(r.platform,platform);assert.equal(r.maxDependencyEntries,dependency?4096:0);
   for(const key of ['osHandleTransferred','nativeConsentVerified','contentReadAuthorized','dependencyReadAuthorized','realModRead','operationsEnabled'])assert.equal(r[key],false);
   assert.throws(()=>f.consume(t));
  }
 }
});
test('no implicit consent or dependency escalation; failed redemption consumes ticket',()=>{
 const f=fixture();
 assert.throws(()=>f.confirm(f.begin(),false,true));
 const t=f.confirm(f.begin());
 assert.throws(()=>f.consume(t,'selected-content-and-bounded-dependency-metadata'));
 assert.throws(()=>f.consume(t));
});
test('clones and foreign selections/owners cannot redeem; identity is not a path',()=>{
 const f=fixture();
 const t=f.confirm(f.begin());
 assert.throws(()=>f.consume({...t}));
 assert.throws(()=>f.gate.consume(t,f.owner,f.epoch,f.proof,{},'selected-content-only'));
 assert.throws(()=>f.consume(t));
 const other=f.confirm(f.begin());
 assert.throws(()=>f.gate.consume(other,{},f.epoch,f.proof,f.selection,'selected-content-only'));
 assert.throws(()=>f.consume(other));
});
test('expiry, document changes, supersession, explicit cancellation and revocation retire tickets',()=>{
 const f=fixture();
 const t=f.confirm(f.begin());f.advance(MAX_AGE+1);assert.throws(()=>f.consume(t));
 const p=f.confirm(f.begin());const q=f.begin();assert.throws(()=>f.consume(p));
 assert.equal(f.gate.cancel(q),true);assert.throws(()=>f.confirm(q));
 const h=f.confirm(f.begin());assert.equal(f.gate.revoke(f.owner),true);assert.throws(()=>f.consume(h));
 const n=f.confirm(f.begin());f.epoch.invalidate();assert.throws(()=>f.consume(n));
 assert.equal(f.gate.cancel(n),false);
});
test('deadline spans selection and confirmation; backwards clock and unsupported platforms refuse',()=>{
 const f=fixture();const p=f.begin();f.advance(MAX_AGE-1);const t=f.confirm(p);f.advance(2);
 assert.throws(()=>f.consume(t));const n=f.confirm(f.begin());f.advance(-1);assert.throws(()=>f.consume(n));
 assert.throws(()=>createFixtureHandoff({platform:'darwin'}));
 assert.throws(()=>createFixtureHandoff({platform:'linux',now:1}));
});
