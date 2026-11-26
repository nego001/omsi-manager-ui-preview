// F3.11a: controlled Core/Reader adapter. No production IPC, persistence or authority.
import {createFixtureBudget} from './budget.mjs';
import {createFixtureQueue} from './queue.mjs';
import {createFixtureSnapshot,projectFixtureSnapshot,MODULES} from './snapshot.mjs';
import {inspectFixtureEvidenceFusion} from '../negresco-reader/evidence-fusion.mjs';
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('CORE_FIXTURE_READER_REFUSED');};
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
function seq(a,max){
 if(!Array.isArray(a)||a.length>max||Reflect.ownKeys(a).length!==a.length+1)fail();
 return Array.from({length:a.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(a,String(i));if(!d||!Object.hasOwn(d,'value'))fail();return d.value;});
}
export function createFixtureReaderBridge(options){
 const o=record(options,['scope','maxJobs']);
 if(o.scope!=='synthetic-fixture'||!int(o.maxJobs,1,128))fail();
 let active=null,closed=false,count=0;
 function status(){return Object.freeze({scope:o.scope,active:active!==null,closed,acceptedJobs:count,operationsEnabled:false,productionIntegrated:false});}
 function cancel(){
  if(!active||active.cancelled)return false;
  active.cancelled=true;active.budget.cancel();active.queue.close();return true;
 }
 async function analyze(request){
  if(closed||active||count>=o.maxJobs)fail();
  const x=record(request,['scope','roots','files','encoding','textureRoots','limits','budget']);
  const l=record(x.limits,['maxBytes','maxEntries','maxReferences','maxGraphBytes','maxFindings','maxReportBytes']);
  const b=record(x.budget,['bytes','entries','steps','depth','durationMs']);
  if(x.scope!==o.scope||!int(l.maxBytes,1,16*1024*1024)||!int(l.maxEntries,1,256)||
   !int(l.maxReferences,0,4096)||!int(l.maxGraphBytes,1,4*1024*1024)||!int(l.maxFindings,0,8192)||
   !int(l.maxReportBytes,1,4*1024*1024)||!['utf-8','windows-1252'].includes(x.encoding))fail();
  const roots=seq(x.roots,32),textureRoots=seq(x.textureRoots,16);
  if(!roots.length||[...roots,...textureRoots].some(p=>typeof p!=='string'||p.length>240))fail();
  let bytes=0,depth=0;
  const files=seq(x.files,l.maxEntries).map(raw=>{
   const f=record(raw,['path','bytes','cfgKind']);
   if(typeof f.path!=='string'||f.path.length>240||!Buffer.isBuffer(f.bytes)||f.bytes.length>l.maxBytes-bytes)fail();
   bytes+=f.bytes.length;depth=Math.max(depth,f.path.split('/').length);
   // Copy only after budget preflight below.
   return f;
  });
  const budget=createFixtureBudget({scope:o.scope,...b});
  const queue=createFixtureQueue({scope:o.scope,parallelism:1,memoryUnits:1,workUnits:1,maxJobs:1});
  const job={budget,queue,cancelled:false};active=job;count++;
  const deny=state=>Object.freeze({scope:o.scope,state,report:null,operationsEnabled:false,productionIntegrated:false});
  let result=null;
  try{
   const handle=budget.openModule('structure');
   // Reserve conservative logical graph/finding work units, not CPU instructions.
   handle.consume({bytes,entries:files.length,steps:1+files.length+l.maxReferences+l.maxFindings,depth});
   handle.checkpoint();
   const owned=files.map(f=>({...f,bytes:Buffer.from(f.bytes)}));
   const outcome=await queue.enqueue({id:'reader-fusion',priority:'high',memoryUnits:1,workUnits:1},({signal})=>{
    if(signal.aborted||job.cancelled)fail();
    handle.checkpoint();
    const fusion=inspectFixtureEvidenceFusion({scope:o.scope,roots,files:owned,encoding:x.encoding,textureRoots,limits:l});
    handle.checkpoint();
    // Never manufacture game identity or module completion from partial reader evidence.
    const coreInput={scope:o.scope,sourceDigest:fusion.graphDigest,gate:'fixture-incomplete',
     observations:MODULES.map(moduleId=>({moduleId,ruleVersion:'3.11.0',sourceDigest:fusion.graphDigest,state:'incomplete',evidence:[]}))};
    const snapshot=createFixtureSnapshot(coreInput);
    const projections=Object.freeze(Object.fromEntries(['library','diagnostics','planner','studio'].map(sector=>[sector,projectFixtureSnapshot(coreInput,sector)])));
    const body={schemaVersion:1,scope:o.scope,readerRuleVersion:'3.11.0',fusion,snapshot,projections,
     cacheEligible:false,persistencePerformed:false,realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false,productionIntegrated:false};
    const candidate=Object.freeze({...body,bridgeDigest:hash(body)});
    if(Buffer.byteLength(JSON.stringify(candidate),'utf8')>l.maxReportBytes)fail();
    handle.checkpoint();result=candidate;
   });
   if(job.cancelled||outcome.state==='cancelled')return deny('cancelled');
   if(outcome.state!=='completed'||!result||budget.snapshot().state!=='active')return deny(budget.snapshot().state==='expired'?'budget-refused':'failed');
   return Object.freeze({scope:o.scope,state:'fixture-report-ready',report:result,operationsEnabled:false,productionIntegrated:false});
  }catch{return deny(job.cancelled?'cancelled':['exhausted','expired'].includes(budget.snapshot().state)?'budget-refused':'failed');}
  finally{budget.close();queue.close();active=null;}
 }
 function dispose(){if(active)fail();if(closed)return false;closed=true;return true;}
 return Object.freeze({analyze,cancel,status,dispose});
}
