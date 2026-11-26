// F3.01: bounded index of synthetic byte buffers. Never opens a path,
// extracts archives, follows links, or authorizes reading real mods.
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('READER_FIXTURE_INDEX_REFUSED');};
const hash=x=>createHash('sha256').update(x).digest('hex');
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
// Conservative portable subset, not a claim to support every valid mod name.
// No normalization of ambiguous, absolute or traversal paths.
function parts(path,maxDepth){
 if(typeof path!=='string'||path.length<1||path.length>240)fail();
 const segments=path.split('/');
 if(segments.length>maxDepth)fail();
 for(const name of segments){
  if(name.length<1||name.length>80||!/^[A-Za-z0-9_. ()+-]+$/.test(name)||
    name.startsWith(' ')||name.endsWith(' ')||name.endsWith('.')||name==='.'||name==='..'||
    /^(?:CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|$)/i.test(name))fail();
 }
 return segments;
}
export function buildFixtureIndex(input){
 const x=record(input,['scope','limits','entries']);
 const l=record(x.limits,['maxEntries','maxNodes','maxDepth','maxBytes','maxEntryBytes']);
 if(x.scope!=='synthetic-fixture'||!int(l.maxEntries,1,1024)||!int(l.maxNodes,1,4096)||
  !int(l.maxDepth,1,32)||!int(l.maxBytes,0,16*1024*1024)||!int(l.maxEntryBytes,0,l.maxBytes)||
  !Array.isArray(x.entries)||x.entries.length>l.maxEntries||Reflect.ownKeys(x.entries).length!==x.entries.length+1)fail();
 const nodes=new Map(),entries=[];let bytes=0;
 for(let i=0;i<x.entries.length;i++){
  const d=Object.getOwnPropertyDescriptor(x.entries,String(i));if(!d||!Object.hasOwn(d,'value'))fail();
  const e=record(d.value,['path','kind','bytes']);
  if(!['file','directory'].includes(e.kind))fail();
  const segments=parts(e.path,l.maxDepth);
  if(e.kind==='file'){
   if(!Buffer.isBuffer(e.bytes)||e.bytes.length>l.maxEntryBytes||e.bytes.length>l.maxBytes-bytes)fail();
  }else if(e.bytes!==null)fail();
  for(let n=1;n<=segments.length;n++){
   const path=segments.slice(0,n).join('/'),key=path.toLowerCase(),last=n===segments.length;
   const kind=last?e.kind:'directory',existing=nodes.get(key);
   if(existing){
    if(existing.path!==path||existing.kind!==kind||(last&&existing.explicit))fail();
    if(last)existing.explicit=true;
   }else{
    if(nodes.size>=l.maxNodes)fail();
    nodes.set(key,{path,kind,explicit:last});
   }
  }
  const size=e.kind==='file'?e.bytes.length:0;
  const contentDigest=e.kind==='file'?hash(e.bytes):null;
  bytes+=size;
  entries.push(Object.freeze({path:e.path,kind:e.kind,size,contentDigest}));
 }
 entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const body={schemaVersion:1,scope:x.scope,entries:Object.freeze(entries),entryCount:entries.length,
  nodeCount:nodes.size,totalBytes:bytes};
 return Object.freeze({indexDigest:hash(JSON.stringify(body)),...body,
  fixtureIndexValidated:true,realSecurityGateVerified:false,realReadsPerformed:false,
  extractionPerformed:false,operationsEnabled:false});
}
