// F2.05 — bounded, in-memory fixture cache. Not a security or compatibility
// authority. No disk access, real content, IPC or installation operations.
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {createFixtureSnapshot,MODULES} from './snapshot.mjs';
const fail=()=>{throw Error('CORE_FIXTURE_CACHE_REFUSED');};
const DIGEST=/^[a-f0-9]{64}$/;
const VERSION=/^[1-9][0-9]{0,5}\.[0-9]{1,6}\.[0-9]{1,6}$/;
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
function identity(input){
 const x=record(input,['scope','sourceDigest','policyVersion','rules']);
 if(x.scope!=='synthetic-fixture'||typeof x.sourceDigest!=='string'||!DIGEST.test(x.sourceDigest)||
 typeof x.policyVersion!=='string'||!VERSION.test(x.policyVersion))fail();
 const rules=record(x.rules,MODULES);
 for(const id of MODULES)if(typeof rules[id]!=='string'||!VERSION.test(rules[id]))fail();
 const canonical={scope:x.scope,schemaVersion:1,sourceDigest:x.sourceDigest,policyVersion:x.policyVersion,
 rules:MODULES.map(moduleId=>({moduleId,ruleVersion:rules[moduleId]}))};
 return {...canonical,key:createHash('sha256').update(JSON.stringify(canonical)).digest('hex')};
}
export function createFixtureCache(options,clock=()=>performance.now()){
 const o=record(options,['scope','maxEntries','maxBytes','ttlMs']);
 if(o.scope!=='synthetic-fixture'||!integer(o.maxEntries,1,256)||!integer(o.maxBytes,1,16*1024*1024)||
 !integer(o.ttlMs,1,86400000)||typeof clock!=='function')fail();
 let last=clock();if(!Number.isFinite(last)||last<0)fail();
 const entries=new Map();let bytes=0,state='active',reason=null;
 const counts={hits:0,misses:0,evictions:0,expirations:0,invalidations:0,conflicts:0};
 function remove(key){const e=entries.get(key);if(!e)return false;entries.delete(key);bytes-=e.bytes;return true;}
 function stop(why){state='disabled';reason=why;entries.clear();bytes=0;}
 function refresh(){
  if(state!=='active')return false;
  const now=clock();
  if(!Number.isFinite(now)||now<last){stop('clock-invalid');return false;}
  last=now;
  for(const [key,e] of entries)if(last-e.created>=o.ttlMs){remove(key);counts.expirations++;}
  return true;
 }
 function lookup(request){
  const id=identity(request);
  if(!refresh()||!entries.has(id.key)){counts.misses++;return null;}
  const e=entries.get(id.key);entries.delete(id.key);entries.set(id.key,e);
  counts.hits++;return e.snapshot;
 }
 function publish(request,input){
  const id=identity(request);
  let s;try{s=createFixtureSnapshot(input);}catch{fail();}
  if(s.sourceDigest!==id.sourceDigest||s.observations.some(row=>id.rules.find(r=>r.moduleId===row.moduleId)?.ruleVersion!==row.ruleVersion))fail();
  if(!refresh())return 'disabled';
  const existing=entries.get(id.key);
  if(s.status!=='probable'||s.gate!=='fixture-pass'||s.missingModules.length!==0){
   if(remove(id.key))counts.invalidations++;
   return 'not-cacheable';
  }
  if(existing){
   if(existing.snapshot.snapshotId!==s.snapshotId){counts.conflicts++;stop('conflicting-snapshot');return 'conflict';}
   // Same identity cannot prolong TTL. Only a fresh insertion after expiry
   // can establish a new lifetime.
   entries.delete(id.key);entries.set(id.key,existing);return 'unchanged';
  }
  const size=Buffer.byteLength(JSON.stringify({identity:id,snapshot:s}));
  if(size>o.maxBytes)return 'too-large';
  while(entries.size>=o.maxEntries||bytes+size>o.maxBytes){
   remove(entries.keys().next().value);counts.evictions++;
  }
  entries.set(id.key,{sourceDigest:id.sourceDigest,snapshot:s,bytes:size,created:last});bytes+=size;
  return 'stored';
 }
 function invalidateSource(source){
  if(typeof source!=='string'||!DIGEST.test(source))fail();
  if(!refresh())return 0;
  let n=0;for(const [key,e] of entries)if(e.sourceDigest===source){remove(key);n++;}counts.invalidations+=n;return n;
 }
 function snapshot(){
  refresh();return Object.freeze({scope:o.scope,state,reason,entries:entries.size,serializedBytes:bytes,
   maxEntries:o.maxEntries,maxBytes:o.maxBytes,ttlMs:o.ttlMs,...counts,
   operationsEnabled:false,realReadsPerformed:false,osResourceLimitsEnforced:false});
 }
 return Object.freeze({lookup,publish,invalidateSource,snapshot});
}
