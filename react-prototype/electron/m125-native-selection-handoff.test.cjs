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

test('M130 refuses rollback within the total lifetime, not just before creation',()=>{
 const f=fixture();const q=f.begin();f.advance(500);const t=f.confirm(q);
 f.advance(-1);assert.throws(()=>f.consume(t),/M125_HANDOFF_REFUSED/);
 assert.equal(f.gate.cancel(t),false);
});
test('M130 exact expiry boundary refuses both confirmation and redemption',()=>{
 const f=fixture();let q=f.begin();f.advance(MAX_AGE);
 assert.throws(()=>f.confirm(q));assert.equal(f.gate.cancel(q),false);
 q=f.begin();const t=f.confirm(q);f.advance(MAX_AGE);
 assert.throws(()=>f.consume(t));assert.equal(f.gate.cancel(t),false);
});
test('M130 replacing the epoch signal without changing its proof is refused',()=>{
 const owner={},selection={},proof={},original=new AbortController(),replacement=new AbortController();
 let signal=original.signal;
 const epoch={isCurrent:p=>p===proof,signalFor:p=>p===proof?signal:null};
 const gate=createFixtureHandoff({platform:'linux',now:()=>0});
 const args=[owner,epoch,proof,selection];
 let q=gate.begin(...args,'vehicle-definition','utf-8');
 signal=replacement.signal;
 assert.throws(()=>gate.confirm(q,...args,true,false));assert.equal(gate.cancel(q),false);
 signal=original.signal;
 q=gate.begin(...args,'vehicle-definition','utf-8');
 const t=gate.confirm(q,...args,true,false);
 signal=replacement.signal;
 assert.throws(()=>gate.consume(t,...args,'selected-content-only'));
 assert.equal(gate.cancel(t),false);
});
test('M130 revocation during the injected clock check prevents publishing a ticket',()=>{
 const owner={},selection={},epoch=createDocumentEpochGate(),proof=epoch.snapshot();
 let invalidate=false;
 const gate=createFixtureHandoff({platform:'linux',now:()=>{
  if(invalidate){invalidate=false;epoch.invalidate();}
  return 0;
 }});
 const args=[owner,epoch,proof,selection],q=gate.begin(...args,'vehicle-definition','utf-8');
 invalidate=true;
 assert.throws(()=>gate.confirm(q,...args,true,false));assert.equal(gate.cancel(q),false);
});
