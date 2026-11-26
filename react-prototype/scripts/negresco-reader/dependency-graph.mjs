// F3.09a: cross-format graph of supplied synthetic files, never real game resolution.
import {buildFixtureIndex} from './index.mjs';
import {inspectFixtureOmsi} from './omsi.mjs';
import {inspectFixtureScsDefinition} from './scs-definition.mjs';
import {inspectFixtureSoundReferences} from './sound-references.mjs';
import {inspectFixturePmxPayload} from './pmx-payload.mjs';
import {inspectFixtureMaterial} from './material.mjs';
import {inspectFixtureO3d} from './o3d.mjs';
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('READER_FIXTURE_DEPENDENCY_REFUSED');};
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
function array(a,max){
 if(!Array.isArray(a)||a.length>max||Reflect.ownKeys(a).length!==a.length+1)fail();
 return Array.from({length:a.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(a,String(i));if(!d||!Object.hasOwn(d,'value'))fail();return d.value;});
}
const ext=p=>p.slice(p.lastIndexOf('.')+1).toLowerCase();
const known=new Set(['bus','ovh','cfg','sii','sui','pmd','mat','tobj','o3d','soundref','bank']);
const refused=new Set(['READER_FIXTURE_OMSI_REFUSED','READER_FIXTURE_SCS_REFUSED','READER_FIXTURE_PMX_PAYLOAD_REFUSED','READER_FIXTURE_MATERIAL_REFUSED','READER_FIXTURE_O3D_REFUSED','READER_FIXTURE_SOUND_REFUSED']);
// Tarjan SCC: recursion bounded by maxEntries (256), edges bounded independently.
function cycles(paths,edges){
 const adj=new Map(paths.map(p=>[p,[]]));
 for(const e of edges)if(e.status==='matched')adj.get(e.from).push(e.target);
 const seen=new Map(),low=new Map(),stack=[],on=new Set(),out=[];let seq=0;
 function visit(v){
  seen.set(v,seq);low.set(v,seq++);stack.push(v);on.add(v);
  for(const w of adj.get(v)){
   if(!seen.has(w)){visit(w);low.set(v,Math.min(low.get(v),low.get(w)));}
   else if(on.has(w))low.set(v,Math.min(low.get(v),seen.get(w)));
  }
  if(low.get(v)===seen.get(v)){
   const group=[];let w;do{w=stack.pop();on.delete(w);group.push(w);}while(w!==v);
   if(group.length>1||adj.get(v).includes(v))out.push(Object.freeze(group.sort()));
  }
 }
 for(const p of paths)if(!seen.has(p))visit(p);
 return Object.freeze(out.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0));
}
export function inspectFixtureDependencyGraph(input){try{return inspect(input);}catch{fail();}}
function inspect(input){
 const x=record(input,['scope','roots','files','encoding','limits']);
 const l=record(x.limits,['maxBytes','maxEntries','maxReferences','maxReportBytes']);
 if(x.scope!=='synthetic-fixture'||!['utf-8','windows-1252'].includes(x.encoding)||!int(l.maxBytes,1,16*1024*1024)||
 !int(l.maxEntries,1,256)||!int(l.maxReferences,0,4096)||!int(l.maxReportBytes,1,4*1024*1024))fail();
 const files=new Map();let totalBytes=0;
 for(const raw of array(x.files,l.maxEntries)){
  const f=record(raw,['path','bytes','cfgKind']);
  if(typeof f.path!=='string'||!Buffer.isBuffer(f.bytes)||files.has(f.path)||f.bytes.length>l.maxBytes-totalBytes||
  (ext(f.path)==='cfg'?!['model','sound'].includes(f.cfgKind):f.cfgKind!==null))fail();
  totalBytes+=f.bytes.length;files.set(f.path,{bytes:Buffer.from(f.bytes),cfgKind:f.cfgKind});
 }
 const index=buildFixtureIndex({scope:x.scope,limits:{maxEntries:l.maxEntries,maxNodes:4096,maxDepth:32,maxBytes:l.maxBytes,maxEntryBytes:l.maxBytes},
 entries:[...files].map(([path,f])=>({path,kind:'file',bytes:f.bytes}))});
 const roots=array(x.roots,32);
 if(!roots.length||roots.some(p=>typeof p!=='string'||!files.has(p))||new Set(roots).size!==roots.length)fail();
 roots.sort();
 const folded=new Map([...files.keys()].map(p=>[p.toLowerCase(),p]));
 const nodes=new Map(),edges=[],issues=[],queue=[...roots],scheduled=new Set(queue);
 const issue=(code,extra)=>issues.push(Object.freeze({code,...extra}));
 function parse(path){
  const f=files.get(path),format=ext(path),base={scope:x.scope,path,bytes:f.bytes};
  const textLimits={maxBytes:Math.min(l.maxBytes,1048576),maxLines:16384,maxReferences:4096};
  if(['bus','ovh'].includes(format)||(format==='cfg'&&f.cfgKind==='model'))
   return inspectFixtureOmsi({...base,encoding:x.encoding,limits:{...textLimits,maxLineLength:2048,maxSections:2048}});
  if(['sii','sui'].includes(format))return inspectFixtureScsDefinition({...base,limits:{...textLimits,maxLineLength:2048,maxUnits:2048,maxFields:8192}});
  if(['soundref','bank'].includes(format)||(format==='cfg'&&f.cfgKind==='sound'))
   return inspectFixtureSoundReferences({...base,encoding:format==='cfg'?x.encoding:'utf-8',limits:textLimits});
  if(['mat','tobj'].includes(format))return inspectFixtureMaterial({...base,limits:textLimits});
  if(format==='pmd')return inspectFixturePmxPayload({...base,limits:{maxBytes:l.maxBytes,maxRecords:250000,maxVertices:0,maxTriangles:0,maxReferences:4096}});
  if(format==='o3d')return inspectFixtureO3d({...base,limits:{maxBytes:l.maxBytes,maxVertices:250000,maxTriangles:500000,maxMaterials:4096,maxTextureBytes:240}});
  return null;
 }
 for(let k=0;k<queue.length;k++){
  const path=queue[k],format=ext(path),cfgKind=files.get(path).cfgKind;
  if(!known.has(format)){nodes.set(path,Object.freeze({path,format,cfgKind,status:'indexed-only'}));continue;}
  let r;
  try{r=parse(path);}catch(e){
   if(!refused.has(e?.message))fail();
   nodes.set(path,Object.freeze({path,format,cfgKind,status:'invalid-or-unsupported'}));issue('UNREADABLE_SUBSET',{path});continue;
  }
  nodes.set(path,Object.freeze({path,format,cfgKind,status:format==='bank'?'signature-candidate':'parsed-subset'}));
  const refs=format==='o3d'?r.materials.filter(m=>m.textureCandidate!==null).map(m=>({path:m.textureCandidate,role:'o3d-texture-candidate',position:m.index,namespace:'unresolved-texture-search'})):r.references??[];
  for(const ref of refs){
   if(edges.length>=l.maxReferences)fail();
   const parent=path.slice(0,path.lastIndexOf('/')+1);
   // O3D texture search depends on game layout. Never invent a lookup location.
   const target=ref.namespace==='unresolved-texture-search'?null:ref.namespace==='game-virtual-root'?ref.path.slice(1):parent+ref.path;
   let status;
   if(target===null){status='search-policy-unresolved';issue('SEARCH_POLICY_UNRESOLVED',{from:path,reference:ref.path});}
   else if(files.has(target)){
    const expected=ref.role==='model-config'?'model':ref.role==='sound-config'?'sound':null;
    if(expected&&files.get(target).cfgKind!==expected){status='kind-mismatch';issue('CFG_KIND_MISMATCH',{from:path,target,expected});}
    else{status='matched';if(!scheduled.has(target)){scheduled.add(target);queue.push(target);}}
   }else if(folded.has(target.toLowerCase())){status='case-mismatch';issue('CASE_MISMATCH',{from:path,target,available:folded.get(target.toLowerCase())});}
   else{status='missing';issue('MISSING_REFERENCE',{from:path,target});}
   edges.push(Object.freeze({from:path,target,reference:ref.path,role:ref.role,status,
    position:ref.line??ref.position??ref.materialIndex??null,event:ref.event??null,
    semanticDependencyVerified:false}));
  }
 }
 const components=cycles([...nodes.keys()],edges);
 const sources=Object.freeze(index.entries.map(e=>Object.freeze({path:e.path,sha256:e.contentDigest,cfgKind:files.get(e.path).cfgKind})));
 const digest=createHash('sha256').update(JSON.stringify({roots,encoding:x.encoding,sources})).digest('hex');
 const report=Object.freeze({schemaVersion:1,scope:x.scope,roots:Object.freeze(roots),sources,digest,totalBytes,
 nodes:Object.freeze([...nodes.values()]),edges:Object.freeze(edges),issues:Object.freeze(issues),cycles:components,
 unreferencedFiles:Object.freeze([...files.keys()].filter(p=>!scheduled.has(p)).sort()),
 allDiscoveredReferencesMatched:edges.every(e=>e.status==='matched'),
 fixtureDependencyGraphValidated:true,allDependenciesKnown:false,realDependenciesResolved:false,includesExpanded:false,
 scriptsExecuted:false,realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false});
 if(Buffer.byteLength(JSON.stringify(report),'utf8')>l.maxReportBytes)fail();
 return report;
}
