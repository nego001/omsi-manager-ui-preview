// F4.02a: fixed child-process laboratory, not an OS sandbox.
import {spawn} from 'node:child_process';
import {inspectFixtureCpu} from './runtime-fixture-cpu.mjs';
import {FIXTURE_V8_ARGS} from './runtime-fixture-memory.mjs';
import {randomBytes,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const worker=fileURLToPath(new URL('./runtime-fixture-worker.mjs',import.meta.url));
const refuse=()=>{throw Error('CORE_RUNTIME_WORKER_REFUSED');};
const scenarios=['missing-reference','clean-reference'];
const MAX_OUTPUT=4096;
const CLOSE_GRACE_MS=2000;
const MAX_CONSECUTIVE_FAILURES=3;
function validate(x,scenario,jobId,pid){
 if(!x||Object.getPrototypeOf(x)!==Object.prototype)return false;
 const keys=['schemaVersion','scope','scenario','jobId','pid','bridgeDigest','fixtureStatus','findings','cpuSample','operationsEnabled','realReadsPerformed','productionIntegrated'];
 if(Object.keys(x).length!==keys.length||!keys.every(k=>Object.hasOwn(x,k)))return false;
 const missing=scenario==='missing-reference';
 return x.schemaVersion===1&&x.scope==='synthetic-fixture'&&x.scenario===scenario&&x.jobId===jobId&&
  Number.isSafeInteger(pid)&&pid>0&&pid!==process.pid&&x.pid===pid&&
  typeof x.bridgeDigest==='string'&&/^[a-f0-9]{64}$/.test(x.bridgeDigest)&&
  x.fixtureStatus===(missing?'fixture-reference-errors':'no-discovered-findings')&&
  Array.isArray(x.findings)&&x.findings.length===(missing?1:0)&&(!missing||x.findings[0]==='MISSING_REFERENCE')&&
  inspectFixtureCpu(x.cpuSample).decision==='admit-fixture-only'&&x.operationsEnabled===false&&x.realReadsPerformed===false&&x.productionIntegrated===false;
}
export function createFixtureProcessSupervisor(options=undefined){
 let timeoutMs=15000;
 if(options!==undefined){
  if(!options||Object.getPrototypeOf(options)!==Object.prototype||Reflect.ownKeys(options).length!==1)refuse();
  const d=Object.getOwnPropertyDescriptor(options,'timeoutMs');
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable||!Number.isInteger(d.value)||d.value<0||d.value>15000)refuse();
  timeoutMs=d.value;
 }
 let active=false,closed=false,accepted=0,activeJobId=null,cancelActive=null,quarantined=false,cleanupPending=false;
 let consecutiveFailures=0,circuitOpen=false;
 async function analyze(input){
  if(closed||quarantined||circuitOpen||cleanupPending||active||accepted>=8||!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).length!==2)refuse();
  const a=Object.getOwnPropertyDescriptor(input,'scope'),b=Object.getOwnPropertyDescriptor(input,'scenario');
  if(!a||!b||!Object.hasOwn(a,'value')||!Object.hasOwn(b,'value')||a.value!=='synthetic-fixture'||!scenarios.includes(b.value))refuse();
  const scenario=b.value,jobId=randomBytes(16).toString('hex');
  const deadline=process.hrtime.bigint()+BigInt(timeoutMs)*1000000n;
  const expired=()=>process.hrtime.bigint()>=deadline;
  active=true;activeJobId=jobId;accepted++;
  try{
   const outcome=await new Promise(resolve=>{
    let child;try{
     const env={};if(process.platform==='win32'&&process.env.SystemRoot)env.SystemRoot=process.env.SystemRoot;
     child=spawn(process.execPath,[...FIXTURE_V8_ARGS,worker],{cwd:fileURLToPath(new URL('.',import.meta.url)),env,stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false});
    }catch{resolve(failed('spawn-failed'));return;}
    const out=[];let size=0,reason=null,closeSeen=false,closeWatchdog=null,closeDeadline=null;
    const quarantine=()=>{
     quarantined=true;cancelActive=null;out.length=0;
     resolve(failed('termination-unconfirmed'));
    };
    const stop=(r,terminate=true)=>{
     if(reason!==null)return false;
     reason=r;out.length=0;
     if(terminate&&!closeSeen){
      cleanupPending=true;
      closeDeadline=process.hrtime.bigint()+BigInt(CLOSE_GRACE_MS)*1000000n;
      closeWatchdog=setTimeout(()=>{
       if(closeSeen)return;
       quarantine();
      },CLOSE_GRACE_MS);
      // The retained ChildProcess is the only termination target; never signal by a caller PID.
      if(child.exitCode===null&&child.signalCode===null){try{child.kill('SIGKILL');}catch{}}
     }
     return true;
    };
    cancelActive=()=>{if(expired()){stop('timeout');return false;}return stop('cancelled');};
    const timer=setTimeout(()=>stop('timeout'),Math.max(0,Number((deadline-process.hrtime.bigint()+999999n)/1000000n)));
    child.on('error',()=>stop('process-error'));
    child.stdin.on('error',()=>stop('input-error'));
    child.stdout.on('data',chunk=>{if(expired()){stop('timeout');return;}if(reason)return;size+=chunk.length;if(size>MAX_OUTPUT){stop('output-limit');return;}if(!reason)out.push(chunk);});
    child.stderr.on('data',()=>stop('worker-stderr'));
    child.on('close',(code,signal)=>{
     // A late close cannot escape quarantine just because timer delivery was delayed.
     const closeLate=closeDeadline!==null&&process.hrtime.bigint()>=closeDeadline;
     closeSeen=true;clearTimeout(timer);clearTimeout(closeWatchdog);cleanupPending=false;cancelActive=null;
     if(quarantined)return;
     if(closeLate){quarantine();return;}
     if(expired())stop('timeout',false);
     if(reason||code!==0||signal){resolve(failed(reason||'worker-exit'));return;}
     try{
      const wire=Buffer.concat(out).toString('utf8'),x=JSON.parse(wire);
      if(JSON.stringify(x)!==wire||!validate(x,scenario,jobId,child.pid)){resolve(failed('invalid-report'));return;}
      const body={schemaVersion:1,scope:'synthetic-fixture',scenario,jobId,workerPid:child.pid,bridgeDigest:x.bridgeDigest,fixtureStatus:x.fixtureStatus,findings:Object.freeze([...x.findings]),cpuObservation:inspectFixtureCpu(x.cpuSample),separateProcessObserved:true,osIsolationVerified:false,resourceLimitsVerified:false,realReadsPerformed:false,operationsEnabled:false,productionIntegrated:false};
      const result=Object.freeze({state:'fixture-worker-report',report:Object.freeze({...body,reportDigest:createHash('sha256').update(JSON.stringify(body)).digest('hex')}),operationsEnabled:false});
      if(expired()){stop('timeout',false);resolve(failed(reason));return;}
      resolve(result);
     }catch{resolve(failed('invalid-report'));}
    });
    try{
     if(expired()){stop('timeout');child.stdin.end();}
     else child.stdin.end(JSON.stringify({scope:'synthetic-fixture',scenario,jobId}));
    }catch{stop('input-error');}
   });
   // Count only completed accepted jobs, before another admission can occur.
   // User cancellation is neutral: it neither increments nor clears prior failures.
   if(outcome.state==='fixture-worker-report')consecutiveFailures=0;
   else if(outcome.reason!=='cancelled'){
    consecutiveFailures=Math.min(MAX_CONSECUTIVE_FAILURES,consecutiveFailures+1);
    if(consecutiveFailures===MAX_CONSECUTIVE_FAILURES)circuitOpen=true;
   }
   return outcome;
  }finally{cancelActive=null;activeJobId=null;active=false;}
 }
 function failed(reason){return Object.freeze({state:'fixture-worker-failed',reason,report:null,operationsEnabled:false});}
 function cancel(jobId){
  if(typeof jobId!=='string'||!(/^[a-f0-9]{32}$/).test(jobId))refuse();
  if(closed||quarantined||!active||jobId!==activeJobId||cancelActive===null)return false;
  return cancelActive();
 }
 function status(){return Object.freeze({active,activeJobId,closed,quarantined,cleanupPending,acceptedJobs:accepted,consecutiveFailures,circuitOpen,operationsEnabled:false});}
 function dispose(){if(active||cleanupPending)refuse();if(closed)return false;closed=true;return true;}
 return Object.freeze({analyze,cancel,status,dispose});
}
