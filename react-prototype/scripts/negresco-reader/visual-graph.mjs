// F3.07c: bounded visual graph from synthetic buffers only; no filesystem resolution.
import {buildFixtureIndex} from './index.mjs';
import {inspectFixturePmxPayload} from './pmx-payload.mjs';
import {inspectFixtureMaterial} from './material.mjs';
import {inspectFixtureTexture} from './texture.mjs';
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('READER_FIXTURE_VISUAL_REFUSED');};
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
export function inspectFixtureVisualGraph(input){try{return inspect(input);}catch{fail();}}
function inspect(input){
 const x=record(input,['scope','root','files','limits']);
 const l=record(x.limits,['maxBytes','maxEntries','maxReferences','maxReportBytes']);
 if(x.scope!=='synthetic-fixture'||!int(l.maxBytes,1,16*1024*1024)||!int(l.maxEntries,1,256)||
 !int(l.maxReferences,0,4096)||!int(l.maxReportBytes,1,4*1024*1024)||
 !Array.isArray(x.files)||x.files.length>l.maxEntries||Reflect.ownKeys(x.files).length!==x.files.length+1)fail();
 const files=new Map();let total=0;
 for(let j=0;j<x.files.length;j++){
  const d=Object.getOwnPropertyDescriptor(x.files,String(j));if(!d||!Object.hasOwn(d,'value'))fail();
  const f=record(d.value,['path','bytes']);
  if(typeof f.path!=='string'||!/\.(pmd|mat|tobj|dds)$/.test(f.path)||!Buffer.isBuffer(f.bytes)||files.has(f.path)||f.bytes.length>l.maxBytes-total)fail();
  total+=f.bytes.length;files.set(f.path,Buffer.from(f.bytes));
 }
 const index=buildFixtureIndex({scope:x.scope,limits:{maxEntries:l.maxEntries,maxNodes:4096,maxDepth:32,maxBytes:l.maxBytes,maxEntryBytes:l.maxBytes},
 entries:[...files].map(([path,bytes])=>({path,kind:'file',bytes}))});
 if(typeof x.root!=='string'||!x.root.endsWith('.pmd')||!files.has(x.root))fail();
 const folded=new Map([...files.keys()].map(p=>[p.toLowerCase(),p]));
 const nodes=new Map(),edges=[],issues=[],queue=[x.root],scheduled=new Set(queue);
 const issue=(code,extra)=>issues.push(Object.freeze({code,...extra}));
 function parse(path){
  const bytes=files.get(path),base={scope:x.scope,path,bytes},format=path.split('.').pop();
  if(format==='pmd')return inspectFixturePmxPayload({...base,limits:{maxBytes:l.maxBytes,maxRecords:250000,maxVertices:0,maxTriangles:0,maxReferences:4096}});
  if(format==='mat'||format==='tobj')return inspectFixtureMaterial({...base,limits:{maxBytes:Math.min(l.maxBytes,1048576),maxLines:16384,maxReferences:4096}});
  return inspectFixtureTexture({...base,limits:{maxBytes:l.maxBytes,maxDimension:16384,maxPixels:67108864,maxChunks:4096,maxMipmaps:15}});
 }
 for(let k=0;k<queue.length;k++){
  const path=queue[k],format=path.split('.').pop();let r;
  try{r=parse(path);}catch(e){
   if(!['READER_FIXTURE_PMX_PAYLOAD_REFUSED','READER_FIXTURE_MATERIAL_REFUSED','READER_FIXTURE_TEXTURE_REFUSED'].includes(e?.message))fail();
   nodes.set(path,Object.freeze({path,format,status:'invalid-or-unsupported'}));issue('UNREADABLE_SUBSET',{path});continue;
  }
  const detail=format==='dds'?{width:r.width,height:r.height,compression:r.compression,mipmapCount:r.mipmapCount}:
   format==='tobj'?{sampler:r.sampler}:format==='mat'?{effect:r.effect}:{materialCount:r.counts.materials,lookCount:r.counts.looks};
  nodes.set(path,Object.freeze({path,format,status:'parsed-subset',...detail}));
  for(const ref of r.references??[]){
   if(edges.length>=l.maxReferences)fail();
   const parent=path.slice(0,path.lastIndexOf('/')+1);
   const target=ref.namespace==='game-virtual-root'?ref.path.slice(1):parent+ref.path;
   let status;
   if(files.has(target)){
    status='matched';
    if(!scheduled.has(target)){scheduled.add(target);queue.push(target);}
   }else if(folded.has(target.toLowerCase())){status='case-mismatch';issue('CASE_MISMATCH',{from:path,target,available:folded.get(target.toLowerCase())});}
   else{status='missing';issue('MISSING_REFERENCE',{from:path,target});}
   edges.push(Object.freeze({from:path,target,role:ref.role,status}));
  }
 }
 // Matched paths are not proof of parseable content. Keep edges and node status distinct.
 for(const e of edges){
  if(e.status!=='matched')continue;
  const a=nodes.get(e.from),b=nodes.get(e.target);
  if(a?.format==='tobj'&&b?.format==='dds'&&b.status==='parsed-subset'&&[0,1].includes(a.sampler.mipFilter)&&b.mipmapCount===1)
   issue('MIP_FILTER_WITH_SINGLE_LEVEL',{from:e.from,target:e.target});
 }
 const sources=Object.freeze(index.entries.map(e=>Object.freeze({path:e.path,sha256:e.contentDigest})));
 const digest=createHash('sha256').update(JSON.stringify({root:x.root,sources})).digest('hex');
 const report=Object.freeze({schemaVersion:1,scope:x.scope,root:x.root,sources,digest,totalBytes:total,
 nodes:Object.freeze([...nodes.values()]),edges:Object.freeze(edges),issues:Object.freeze(issues),
 unreferencedFiles:Object.freeze([...files.keys()].filter(p=>!scheduled.has(p)).sort()),
 fixtureVisualGraphValidated:true,allReferencesMatched:edges.every(e=>e.status==='matched'),
 allReachableParsed:[...nodes.values()].every(n=>n.status==='parsed-subset'),
 fullVisualSupport:false,realDependenciesResolved:false,pixelsDecoded:false,shaderExecuted:false,
 realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false});
 if(Buffer.byteLength(JSON.stringify(report),'utf8')>l.maxReportBytes)fail();
 return report;
}
