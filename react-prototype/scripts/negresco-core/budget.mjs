// F2.03: cooperative, synthetic-only global consumption meter.
// No real reads, OS limits, timers, worker termination or authorization.
import {performance} from 'node:perf_hooks';
import {MODULES} from './snapshot.mjs';
const fail=()=>{throw Error('CORE_FIXTURE_BUDGET_REFUSED');};
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
const dimensions=['bytes','entries','steps'];
const zeros=()=>({bytes:0,entries:0,steps:0,depth:0});
export function createFixtureBudget(options,clock=()=>performance.now()){
 const o=record(options,['scope','bytes','entries','steps','depth','durationMs']);
 if(o.scope!=='synthetic-fixture'||!integer(o.bytes,1,2**40)||!integer(o.entries,1,1000000)||
 !integer(o.steps,1,100000000)||!integer(o.depth,0,128)||!integer(o.durationMs,1,3600000)||
 typeof clock!=='function')fail();
 const start=clock();if(!Number.isFinite(start)||start<0)fail();
 let last=start,state='active',reason=null;
 const total=zeros(),modules=new Map(),controller=new AbortController();
 function stop(next,why){if(state==='active'){state=next;reason=why;controller.abort();}}
 function refresh(){
  if(state!=='active')return;
  const now=clock();
  if(!Number.isFinite(now)||now<last){stop('refused','clock-invalid');return;}
  last=now;
  if(last-start>=o.durationMs)stop('expired','duration');
 }
 function check(){refresh();if(state!=='active')fail();}
 function snapshot(){
  refresh();return Object.freeze({scope:o.scope,state,reason,limits:Object.freeze({
    bytes:o.bytes,entries:o.entries,steps:o.steps,depth:o.depth,durationMs:o.durationMs}),
   consumed:Object.freeze({...total}),elapsedMs:last-start,
   modules:Object.freeze(MODULES.filter(id=>modules.has(id)).map(id=>Object.freeze({moduleId:id,...modules.get(id)}))),
   operationsEnabled:false,osResourceLimitsEnforced:false,realReadsPerformed:false});
 }
 function openModule(id){
  check();if(!MODULES.includes(id)||modules.has(id))fail();
  const used=zeros();modules.set(id,used);
  let closed=false;
  function consume(input){
   check();if(closed)fail();
   const x=record(input,['bytes','entries','steps','depth']);
   if(!dimensions.every(k=>integer(x[k],0,2**40))||!integer(x.depth,0,128)||
    !dimensions.some(k=>x[k]>0))fail();
   // Check all dimensions before charging any of them. Latch the first
   // exceeded dimension in fixed order and revoke all module handles.
   for(const k of dimensions){if(x[k]>o[k]-total[k]){stop('exhausted',k);fail();}}
   if(x.depth>o.depth){stop('exhausted','depth');fail();}
   for(const k of dimensions){total[k]+=x[k];used[k]+=x[k];}
   total.depth=Math.max(total.depth,x.depth);used.depth=Math.max(used.depth,x.depth);
   return Object.freeze({...used});
  }
  function checkpoint(){check();if(closed)fail();return true;}
  function close(){if(closed)return false;closed=true;return true;}
  return Object.freeze({consume,checkpoint,close,signal:controller.signal});
 }
 return Object.freeze({openModule,snapshot,signal:controller.signal,
  cancel(){refresh();if(state!=='active')return false;stop('cancelled','caller-cancelled');return true;},
  close(){refresh();if(state!=='active')return false;stop('closed','scope-closed');return true;}});
}
