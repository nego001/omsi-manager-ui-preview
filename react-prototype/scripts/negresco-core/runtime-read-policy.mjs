// F4.01a: dry-run read-policy contract, never a filesystem authorization.
import {buildFixtureIndex} from '../negresco-reader/index.mjs';
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('CORE_RUNTIME_POLICY_REFUSED');};
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
const gates=Object.freeze(['explicit-root-selection','root-handle-identity','component-no-follow','regular-file-only','same-handle-bounded-read','mutation-detection','os-isolation','cancellation-and-deadline','packaged-linux-f1']);
export function inspectRuntimeReadPlan(input){try{return inspect(input);}catch{fail();}}
function inspect(input){
 const x=record(input,['scope','platform','requests','limits']);
 const l=record(x.limits,['maxEntries','maxTotalBytes','maxFileBytes','maxDepth']);
 if(x.scope!=='synthetic-fixture'||!['win32','linux'].includes(x.platform)||
 !int(l.maxEntries,1,256)||!int(l.maxTotalBytes,1,16*1024*1024)||!int(l.maxFileBytes,1,l.maxTotalBytes)||!int(l.maxDepth,1,32)||
 !Array.isArray(x.requests)||!x.requests.length||x.requests.length>l.maxEntries||Reflect.ownKeys(x.requests).length!==x.requests.length+1)fail();
 const requests=[],seen=new Set();let reservedBytes=0;
 for(let i=0;i<x.requests.length;i++){
  const d=Object.getOwnPropertyDescriptor(x.requests,String(i));if(!d||!Object.hasOwn(d,'value'))fail();
  const r=record(d.value,['path','operation','maxBytes']);
  if(typeof r.path!=='string'||seen.has(r.path)||!['metadata','read-bytes'].includes(r.operation)||
   (r.operation==='metadata'?r.maxBytes!==0:!int(r.maxBytes,1,l.maxFileBytes))||r.maxBytes>l.maxTotalBytes-reservedBytes)fail();
  seen.add(r.path);reservedBytes+=r.maxBytes;requests.push(Object.freeze({...r}));
 }
 // Reuse the portable path/collision contract, with no file data or path access.
 buildFixtureIndex({scope:x.scope,limits:{maxEntries:l.maxEntries,maxNodes:4096,maxDepth:l.maxDepth,maxBytes:0,maxEntryBytes:0},
 entries:requests.map(r=>({path:r.path,kind:'file',bytes:Buffer.alloc(0)}))});
 requests.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const body={schemaVersion:1,policyVersion:'4.1.0',scope:x.scope,platform:x.platform,
 requests:Object.freeze(requests),limits:Object.freeze(l),reservedBytes,
 pendingGates:gates,decision:'deny-real-access',dryRunValidated:true,
 filesystemOpened:false,realReadsPerformed:false,osIsolationVerified:false,
 realSecurityGateVerified:false,operationsEnabled:false,releaseAuthorized:false};
 return Object.freeze({...body,planDigest:createHash('sha256').update(JSON.stringify(body)).digest('hex')});
}
