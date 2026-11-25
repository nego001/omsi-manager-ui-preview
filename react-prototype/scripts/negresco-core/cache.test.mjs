import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFixtureCache as cache} from './cache.mjs';
import {createFixtureSnapshot,MODULES} from './snapshot.mjs';
const hash='a'.repeat(64),other='b'.repeat(64);
const limits={scope:'synthetic-fixture',maxEntries:3,maxBytes:65536,ttlMs:1000};
const refuse=/CORE_FIXTURE_CACHE_REFUSED/;
function fixture(sourceDigest=hash,version='1.0.0'){
 return {scope:'synthetic-fixture',sourceDigest,gate:'fixture-pass',observations:MODULES.map(moduleId=>({
  moduleId,sourceDigest,ruleVersion:version,state:'complete',evidence:moduleId==='definitions'?[{game:'omsi',signal:'format-specific'}]:[]
 }))};
}
const request=(sourceDigest=hash,version='1.0.0',policyVersion='1.0.0')=>({
 scope:'synthetic-fixture',sourceDigest,policyVersion,rules:Object.fromEntries(MODULES.map(id=>[id,version]))});
test('exact digest, rules and policy match returns immutable snapshot; no authority',()=>{
 const c=cache(limits,()=>0),r=request(),f=fixture();
 assert.equal(c.lookup(r),null);assert.equal(c.publish(r,f),'stored');
 const s=c.lookup(r);assert.deepEqual(s,createFixtureSnapshot(f));assert.ok(Object.isFrozen(s.observations));
 assert.equal(s.operationsEnabled,false);assert.equal(s.compatibility,'unknown');
 assert.equal(c.snapshot().hits,1);assert.equal(c.snapshot().misses,1);
});
test('digest, policy and any rule version change cause misses',()=>{
 const c=cache(limits,()=>0);c.publish(request(),fixture());
 assert.equal(c.lookup(request(other)),null);assert.equal(c.lookup(request(hash,'2.0.0')),null);
 assert.equal(c.lookup(request(hash,'1.0.0','2.0.0')),null);
 const changed=request();changed.rules.audio='2.0.0';assert.equal(c.lookup(changed),null);
 const reordered=request();reordered.rules=Object.fromEntries(Object.entries(reordered.rules).reverse());
 assert.notEqual(c.lookup(reordered),null);
});
test('blocked, incomplete, ambiguous or weak evidence is never reusable and invalidates stale hit',()=>{
 for(const change of [
  f=>f.gate='fixture-refused',f=>f.gate='fixture-incomplete',
  f=>f.observations.pop(),f=>f.observations[0].state='blocked',
  f=>f.observations[0].evidence=[{game:'ats',signal:'declared'}],
  f=>f.observations[2].evidence[0].signal='filename'
 ]){
  const c=cache(limits,()=>0),r=request(),f=fixture();c.publish(r,f);change(f);
  assert.equal(c.publish(r,f),'not-cacheable');assert.equal(c.lookup(r),null);
  assert.equal(c.snapshot().invalidations,1);
 }
});
test('conflicting complete snapshots under one key disable the cache, not last writer wins',()=>{
 const c=cache(limits,()=>0),r=request(),f=fixture();c.publish(r,f);
 c.publish(request(other),fixture(other));f.observations[2].evidence[0].game='ats';
 assert.equal(c.publish(r,f),'conflict');assert.equal(c.snapshot().state,'disabled');
 assert.equal(c.snapshot().conflicts,1);assert.equal(c.snapshot().entries,0);
 assert.equal(c.lookup(request(other)),null);assert.equal(c.publish(r,f),'disabled');
});
test('TTL is absolute from insertion, not extended by hits or duplicate writes',()=>{
 let now=0;const c=cache(limits,()=>now),r=request(),f=fixture();c.publish(r,f);
 now=900;assert.ok(c.lookup(r));assert.equal(c.publish(r,f),'unchanged');
 now=1000;assert.equal(c.lookup(r),null);assert.equal(c.snapshot().expirations,1);
 assert.equal(c.publish(r,f),'stored');assert.ok(c.lookup(r));
});
test('LRU eviction obeys entry limit and lookup refreshes recency',()=>{
 const c=cache({...limits,maxEntries:2},()=>0),third='c'.repeat(64);
 c.publish(request(),fixture());c.publish(request(other),fixture(other));c.lookup(request());
 c.publish(request(third),fixture(third));assert.equal(c.lookup(request(other)),null);
 assert.ok(c.lookup(request()));assert.ok(c.lookup(request(third)));assert.equal(c.snapshot().evictions,1);
});
test('serialized-byte cap evicts safely and refuses oversized individual records',()=>{
 const probe=cache(limits,()=>0);probe.publish(request(),fixture());
 const size=probe.snapshot().serializedBytes;
 const c=cache({...limits,maxBytes:size},()=>0);
 assert.equal(c.publish(request(),fixture()),'stored');assert.equal(c.publish(request(other),fixture(other)),'stored');
 assert.equal(c.snapshot().entries,1);assert.equal(c.snapshot().serializedBytes,size);
 const tiny=cache({...limits,maxBytes:size-1},()=>0);assert.equal(tiny.publish(request(),fixture()),'too-large');
 assert.equal(tiny.snapshot().entries,0);
});
test('source invalidation removes every policy/rule variant, preserves unrelated source',()=>{
 const c=cache(limits,()=>0);
 c.publish(request(),fixture());c.publish(request(hash,'2.0.0'),fixture(hash,'2.0.0'));
 c.publish(request(other),fixture(other));assert.equal(c.invalidateSource(hash),2);
 assert.equal(c.invalidateSource(hash),0);assert.ok(c.lookup(request(other)));
 assert.equal(c.snapshot().invalidations,2);
});
test('backward or invalid clock disables reuse irreversibly',()=>{
 let now=100;const c=cache(limits,()=>now);c.publish(request(),fixture());
 now=99;assert.equal(c.lookup(request()),null);assert.equal(c.snapshot().reason,'clock-invalid');
 now=200;assert.equal(c.publish(request(),fixture()),'disabled');
 assert.throws(()=>cache(limits,()=>NaN),refuse);
});
test('malformed requests, foreign digest/rules and accessors refuse without mutation',()=>{
 const c=cache(limits,()=>0);c.publish(request(),fixture());
 for(const r of [{...request(),scope:'real-mod'},{...request(),path:'/secret'},
 {...request(),policyVersion:'latest'},{...request(),rules:{}},request('../path')]){
  assert.throws(()=>c.lookup(r),refuse);
 }
 assert.throws(()=>c.publish(request(other),fixture()),refuse);
 assert.throws(()=>c.publish(request(hash,'2.0.0'),fixture()),refuse);
 let invoked=false;const r=request();Object.defineProperty(r.rules,'audio',{get(){invoked=true;return '1.0.0';},enumerable:true});
 assert.throws(()=>c.lookup(r),refuse);assert.equal(invoked,false);
 assert.equal(c.snapshot().entries,1);assert.equal(JSON.stringify(c.snapshot()).includes('secret'),false);
});
