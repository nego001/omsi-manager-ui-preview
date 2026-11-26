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
export function createFixtureProcessSupervisor(){
 let active=false,closed=false,accepted=0,activeJobId=null,cancelActive=null;
 async function analyze(input){
  if(closed||active||accepted>=8||!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).length!==2)refuse();
  const a=Object.getOwnPropertyDescriptor(input,'scope'),b=Object.getOwnPropertyDescriptor(input,'scenario');
  if(!a||!b||!Object.hasOwn(a,'value')||!Object.hasOwn(b,'value')||a.value!=='synthetic-fixture'||!scenarios.includes(b.value))refuse();
  const scenario=b.value,jobId=randomBytes(16).toString('hex');
  active=true;activeJobId=jobId;accepted++;
  try{
   return await new Promise(resolve=>{
    let child;try{
     const env={};if(process.platform==='win32'&&process.env.SystemRoot)env.SystemRoot=process.env.SystemRoot;
     child=spawn(process.execPath,[...FIXTURE_V8_ARGS,worker],{cwd:fileURLToPath(new URL('.',import.meta.url)),env,stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false});
    }catch{resolve(failed('spawn-failed'));return;}
    const out=[];let size=0,reason=null;
    const stop=r=>{
     if(reason!==null)return false;
     reason=r;out.length=0;
     try{child.kill('SIGKILL');}catch{}
     return true;
    };
    cancelActive=()=>stop('cancelled');
    const timer=setTimeout(()=>stop('timeout'),15000);
    child.on('error',()=>stop('process-error'));
    child.stdin.on('error',()=>stop('input-error'));
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>MAX_OUTPUT){stop('output-limit');return;}if(!reason)out.push(chunk);});
    child.stderr.on('data',()=>stop('worker-stderr'));
    child.on('close',(code,signal)=>{
     clearTimeout(timer);cancelActive=null;
     if(reason||code!==0||signal){resolve(failed(reason||'worker-exit'));return;}
     try{
      const wire=Buffer.concat(out).toString('utf8'),x=JSON.parse(wire);
      if(JSON.stringify(x)!==wire||!validate(x,scenario,jobId,child.pid)){resolve(failed('invalid-report'));return;}
      const body={schemaVersion:1,scope:'synthetic-fixture',scenario,jobId,workerPid:child.pid,bridgeDigest:x.bridgeDigest,fixtureStatus:x.fixtureStatus,findings:Object.freeze([...x.findings]),cpuObservation:inspectFixtureCpu(x.cpuSample),separateProcessObserved:true,osIsolationVerified:false,resourceLimitsVerified:false,realReadsPerformed:false,operationsEnabled:false,productionIntegrated:false};
      resolve(Object.freeze({state:'fixture-worker-report',report:Object.freeze({...body,reportDigest:createHash('sha256').update(JSON.stringify(body)).digest('hex')}),operationsEnabled:false}));
     }catch{resolve(failed('invalid-report'));}
    });
    child.stdin.end(JSON.stringify({scope:'synthetic-fixture',scenario,jobId}));
   });
  }finally{cancelActive=null;activeJobId=null;active=false;}
 }
 function failed(reason){return Object.freeze({state:'fixture-worker-failed',reason,report:null,operationsEnabled:false});}
 function cancel(jobId){
  if(typeof jobId!=='string'||!(/^[a-f0-9]{32}$/).test(jobId))refuse();
  if(closed||!active||jobId!==activeJobId||cancelActive===null)return false;
  return cancelActive();
 }
 function status(){return Object.freeze({active,activeJobId,closed,acceptedJobs:accepted,operationsEnabled:false});}
 function dispose(){if(active)refuse();if(closed)return false;closed=true;return true;}
 return Object.freeze({analyze,cancel,status,dispose});
}
