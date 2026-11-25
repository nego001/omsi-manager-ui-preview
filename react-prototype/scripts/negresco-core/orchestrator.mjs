// F2.07 — integrated fixture laboratory; never a real reader or authorization.
// F2.08 uses one transaction for publication and completion.
// Trusted synthetic inputs only; no paths, IPC, external worker or real bytes.
import {createFixtureSnapshot,MODULES} from './snapshot.mjs';
import {createFixtureQueue} from './queue.mjs';
import {createFixtureBudget} from './budget.mjs';
import {createFixtureCache} from './cache.mjs';
import {createFixturePublicationLab} from './publication.mjs';
const fail=()=>{throw Error('CORE_FIXTURE_ORCHESTRATION_REFUSED');};
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
const VERSION=/^[1-9][0-9]{0,5}\.[0-9]{1,6}\.[0-9]{1,6}$/;
const int=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
function canonicalInput(s){return {scope:s.scope,sourceDigest:s.sourceDigest,gate:s.gate,observations:s.observations};}
function reply(state,snapshot=null,cacheHit=false){
 return Object.freeze({state,snapshot,cacheHit,scope:'synthetic-fixture',operationsEnabled:false,realReadsPerformed:false});
}
export function createFixtureCoreLab(){
 const publication=createFixturePublicationLab();
 try{publication.open();}catch{publication.dispose();fail();}
 const cache=createFixtureCache({scope:'synthetic-fixture',maxEntries:16,maxBytes:262144,ttlMs:60000});
 let active=null,closed=false,next=0;
 function status(){
  if(closed)fail();
  return Object.freeze({scope:'synthetic-fixture',active:active!==null,
   ...publication.status(),cache:cache.snapshot(),
   operationsEnabled:false,productionIntegrated:false});
 }
 function cancel(){
  if(!active||active.cancelled)return false;
  active.cancelled=true;active.budget?.cancel();active.queue?.close();return true;
 }
 async function analyze(request){
  if(closed||active||next>=128)fail();
  const x=record(request,['scope','policyVersion','input','charges','limits','fault']);
  if(x.scope!=='synthetic-fixture'||typeof x.policyVersion!=='string'||!VERSION.test(x.policyVersion)||
    !['none','audio-failure','after-snapshot-insert','after-completion-event'].includes(x.fault))fail();
  const expected=createFixtureSnapshot(x.input),input=canonicalInput(expected);
  const rawCharges=record(x.charges,MODULES),charges={};
  for(const id of MODULES){
   const c=record(rawCharges[id],['bytes','entries','steps','depth']);
   if(!int(c.bytes,2**40)||!int(c.entries,2**40)||!int(c.steps,2**40)||!int(c.depth,128)||
      c.bytes+c.entries+c.steps===0)fail();
   charges[id]=c;
  }
  const limits=record(x.limits,['bytes','entries','steps','depth','durationMs']);
  const budget=createFixtureBudget({scope:'synthetic-fixture',...limits});
  const job={id:'analysis-'+(++next),budget,queue:null,cancelled:false};
  active=job;
  let phase='none';
  try{
   publication.transition(job.id,'queued');phase='queued';
   publication.transition(job.id,'running');phase='running';
   // A failed or incomplete gate is never allowed to reuse prior evidence.
   if(expected.status!=='probable'){
    cache.invalidateSource(expected.sourceDigest);
    publication.transition(job.id,'failed');phase='terminal';
    return reply(expected.status);
   }
   const key={scope:x.scope,sourceDigest:expected.sourceDigest,policyVersion:x.policyVersion,
    rules:Object.fromEntries(expected.observations.map(o=>[o.moduleId,o.ruleVersion]))};
   // Fixture requests supply expected observations (not real content);
   // verify exact identity AND the persisted row before serving a hit.
   // Fault injection always exercises workers rather than a cache hit.
   const hit=x.fault==='none'?cache.lookup(key):null;
   if(hit){
    if(hit.snapshotId!==expected.snapshotId){
     cache.publish(key,input);publication.transition(job.id,'failed');phase='terminal';return reply('conflict');
    }
    const stored=publication.select(hit.snapshotId);
    if(!stored||stored.snapshotId!==hit.snapshotId){
     cache.invalidateSource(expected.sourceDigest);fail();
    }
    publication.complete(job.id,input);phase='terminal';
    return reply('completed',stored,true);
   }
   const queue=createFixtureQueue({scope:x.scope,parallelism:2,memoryUnits:4,workUnits:7,maxJobs:7});
   job.queue=queue;
   const results=new Map();
   const pending=expected.observations.map(row=>queue.enqueue({
    id:row.moduleId,priority:row.moduleId==='structure'?'high':'normal',memoryUnits:2,workUnits:1
   },({signal})=>{
    const handle=budget.openModule(row.moduleId);
    try{
     if(signal.aborted||job.cancelled)fail();
     handle.consume(charges[row.moduleId]);
     if(x.fault==='audio-failure'&&row.moduleId==='audio')fail();
     handle.checkpoint();results.set(row.moduleId,row);
    }finally{handle.close();}
   }));
   const outcomes=await Promise.all(pending);
   if(job.cancelled){
    publication.transition(job.id,'cancelled');phase='terminal';return reply('cancelled');
   }
   const meter=budget.snapshot();
   if(meter.state!=='active'||outcomes.some(r=>r.state!=='completed')||results.size!==MODULES.length){
    cache.invalidateSource(expected.sourceDigest);
    publication.transition(job.id,'failed');phase='terminal';
    return reply(meter.state==='exhausted'||meter.state==='expired'?'budget-refused':'failed');
   }
   const finished={...input,observations:MODULES.map(id=>results.get(id))};
   const actual=createFixtureSnapshot(finished);
   if(actual.snapshotId!==expected.snapshotId)fail();
   const stored=publication.complete(job.id,finished,x.fault==='audio-failure'?'none':x.fault);
   phase='terminal';
   if(stored.snapshotId!==actual.snapshotId)fail();
   // Cache is optional, never the commit point; only publish after persistence
   // and terminal journal event. A conflict disables reuse in the cache.
   cache.publish(key,finished);
   return reply('completed',stored);
  }catch{
   cache.invalidateSource(expected.sourceDigest);
   if(phase==='running'||phase==='queued'){
    try{publication.transition(job.id,phase==='queued'?'cancelled':'failed');}catch{fail();}
   }
   return reply('failed');
  }finally{
   budget.close();job.queue?.close();active=null;
  }
 }
 function reopen(){
  if(closed||active)fail();
  publication.close();return publication.open();
 }
 function dispose(){
  if(active)fail();if(closed)return false;
  publication.dispose();closed=true;return true;
 }
 return Object.freeze({analyze,cancel,status,reopen,dispose});
}
