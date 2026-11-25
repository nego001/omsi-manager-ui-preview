// F2.02. Trusted synthetic workers only. Reservations are logical estimates,
// not OS resource enforcement. Cancellation is cooperative; slots stay reserved
// until the actual worker settles. No IO, real mod access, or runtime integration.
const fail=()=>{throw Error('CORE_FIXTURE_QUEUE_REFUSED');};
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const ID=/^[a-z][a-z0-9-]{0,47}$/;
const priorities=Object.freeze({high:0,normal:1,low:2});
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const result={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();result[k]=d.value;}return result;
}
export function createFixtureQueue(options){
 const o=record(options,['scope','parallelism','memoryUnits','workUnits','maxJobs']);
 if(o.scope!=='synthetic-fixture'||!integer(o.parallelism,1,8)||!integer(o.memoryUnits,1,1048576)||
    !integer(o.workUnits,1,1000000)||!integer(o.maxJobs,1,256))fail();
 const jobs=new Map();let pending=[],active=0,memory=0,spent=0,scheduled=false,closed=false;
 function view(j){return Object.freeze({id:j.id,priority:j.priority,state:j.state,memoryUnits:j.memoryUnits,
  workUnits:j.workUnits,operationsEnabled:false});}
 function settle(j,state){
  j.state=state;j.worker=null;j.controller=null;j.resolve(view(j));j.resolve=null;
 }
 function dispatch(){
  scheduled=false;
  pending.sort((a,b)=>priorities[a.priority]-priorities[b.priority]||a.sequence-b.sequence);
  // Strict priority/FIFO: never bypass a head task that is waiting for memory.
  while(pending.length&&active<o.parallelism){
   const j=pending[0];if(memory+j.memoryUnits>o.memoryUnits)break;
   pending.shift();active++;memory+=j.memoryUnits;spent+=j.workUnits;j.state='running';
   const signal=j.controller.signal;
   Promise.resolve().then(()=>{if(signal.aborted)return;return j.worker(Object.freeze({signal,scope:o.scope}));})
    .then(()=>finish(j,signal.aborted?'cancelled':'completed'),
     ()=>finish(j,signal.aborted?'cancelled':'failed'));
  }
 }
 function schedule(){if(!scheduled){scheduled=true;queueMicrotask(dispatch);}}
 function finish(j,state){active--;memory-=j.memoryUnits;settle(j,state);schedule();}
 function enqueue(spec,worker){
  const x=record(spec,['id','priority','memoryUnits','workUnits']);
  if(closed||typeof x.id!=='string'||!ID.test(x.id)||jobs.has(x.id)||jobs.size>=o.maxJobs||
   typeof x.priority!=='string'||!Object.hasOwn(priorities,x.priority)||
   !integer(x.memoryUnits,1,o.memoryUnits)||!integer(x.workUnits,1,o.workUnits)||typeof worker!=='function')fail();
  // The total budget includes work already started and every waiting reservation.
  // Queued cancellations refund their reservation; started work never refunds it.
  if(spent+pending.reduce((n,j)=>n+j.workUnits,0)+x.workUnits>o.workUnits)fail();
  let resolve;const done=new Promise(r=>{resolve=r;});
  const j={...x,sequence:jobs.size,state:'queued',controller:new AbortController(),worker,resolve};
  jobs.set(j.id,j);pending.push(j);schedule();return done;
 }
 function cancel(id){
  const j=jobs.get(id);if(!j)return false;
  if(j.state==='queued'){pending=pending.filter(x=>x!==j);settle(j,'cancelled');schedule();return true;}
  if(j.state==='running'){j.state='cancelling';j.controller.abort();return true;}
  return false;
 }
 function close(){if(closed)return false;closed=true;for(const id of jobs.keys())cancel(id);return true;}
 function snapshot(){
  return Object.freeze({scope:o.scope,closed,active,memoryReserved:memory,workSpent:spent,
   workReserved:pending.reduce((n,j)=>n+j.workUnits,0),queued:pending.length,
   jobs:Object.freeze([...jobs.values()].map(view)),operationsEnabled:false,osResourceLimitsEnforced:false});
 }
 return Object.freeze({enqueue,cancel,close,snapshot});
}
