// F3.08c: bounded sound reference association within supplied fixture inventory.
import {buildFixtureIndex} from './index.mjs';
import {inspectFixtureSoundReferences} from './sound-references.mjs';
import {inspectFixtureAudio} from './audio.mjs';
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('READER_FIXTURE_SOUND_GRAPH_REFUSED');};
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
export function inspectFixtureSoundGraph(input){try{return inspect(input);}catch{fail();}}
function inspect(input){
 const x=record(input,['scope','root','files','encoding','limits']),l=record(x.limits,['maxBytes','maxEntries','maxReferences','maxReportBytes']);
 if(x.scope!=='synthetic-fixture'||!['utf-8','windows-1252'].includes(x.encoding)||
 !int(l.maxBytes,1,16*1024*1024)||!int(l.maxEntries,1,256)||!int(l.maxReferences,0,4096)||!int(l.maxReportBytes,1,4*1024*1024)||
 !Array.isArray(x.files)||x.files.length>l.maxEntries||Reflect.ownKeys(x.files).length!==x.files.length+1)fail();
 const files=new Map();let total=0;
 for(let j=0;j<x.files.length;j++){
  const d=Object.getOwnPropertyDescriptor(x.files,String(j));if(!d||!Object.hasOwn(d,'value'))fail();
  const f=record(d.value,['path','bytes']);
  if(typeof f.path!=='string'||!/\.(cfg|soundref|bank|wav|ogg|opus|mp3)$/i.test(f.path)||!Buffer.isBuffer(f.bytes)||files.has(f.path)||f.bytes.length>l.maxBytes-total)fail();
  total+=f.bytes.length;files.set(f.path,Buffer.from(f.bytes));
 }
 const idx=buildFixtureIndex({scope:x.scope,limits:{maxEntries:l.maxEntries,maxNodes:4096,maxDepth:32,maxBytes:l.maxBytes,maxEntryBytes:l.maxBytes},entries:[...files].map(([path,bytes])=>({path,kind:'file',bytes}))});
 if(typeof x.root!=='string'||!/\.(cfg|soundref)$/i.test(x.root)||!files.has(x.root))fail();
 const folded=new Map([...files.keys()].map(p=>[p.toLowerCase(),p])),nodes=new Map(),edges=[],issues=[],queue=[x.root],scheduled=new Set(queue);
 const issue=(code,extra)=>issues.push(Object.freeze({code,...extra}));
 for(let k=0;k<queue.length;k++){
  const path=queue[k],format=path.split('.').pop().toLowerCase(),bytes=files.get(path),base={scope:x.scope,path,bytes};
  let r;
  try{
   r=['cfg','soundref','bank'].includes(format)?
   inspectFixtureSoundReferences({...base,encoding:format==='cfg'?x.encoding:'utf-8',limits:{maxBytes:Math.min(l.maxBytes,1048576),maxLines:16384,maxReferences:4096}}):
   inspectFixtureAudio({...base,limits:{maxBytes:l.maxBytes,maxChunks:4096,maxChannels:8,maxSampleRate:384000,maxSamples:2**32}});
  }catch(e){
   if(!['READER_FIXTURE_SOUND_REFUSED','READER_FIXTURE_AUDIO_REFUSED'].includes(e?.message))fail();
   nodes.set(path,Object.freeze({path,format,status:'invalid-or-unsupported'}));issue('UNREADABLE_SUBSET',{path});continue;
  }
  const detail=r.fixtureAudioStructureValidated?{codec:r.codec,channels:r.channels,sampleRate:r.sampleRate,durationSeconds:r.durationSeconds,durationBasis:r.durationBasis}:
   format==='bank'?{signature:r.bankSignature,eventExistenceVerified:false}:{};
  nodes.set(path,Object.freeze({path,format,status:format==='bank'?'signature-candidate':'parsed-subset',...detail}));
  for(const ref of r.references??[]){
   if(edges.length>=l.maxReferences)fail();
   const parent=path.slice(0,path.lastIndexOf('/')+1),target=ref.namespace==='game-virtual-root'?ref.path.slice(1):parent+ref.path;
   let status;
   if(files.has(target)){
    status='matched';if(!scheduled.has(target)){scheduled.add(target);queue.push(target);}
   }else if(folded.has(target.toLowerCase())){
    status='case-mismatch';issue('CASE_MISMATCH',{from:path,target,available:folded.get(target.toLowerCase())});
   }else{status='missing';issue('MISSING_REFERENCE',{from:path,target});}
   edges.push(Object.freeze({from:path,target,role:ref.role,line:ref.line,event:ref.event,status,eventExistenceVerified:false}));
  }
 }
 const sources=Object.freeze(idx.entries.map(e=>Object.freeze({path:e.path,sha256:e.contentDigest})));
 const digest=createHash('sha256').update(JSON.stringify({root:x.root,encoding:x.encoding,sources})).digest('hex');
 const report=Object.freeze({schemaVersion:1,scope:x.scope,root:x.root,sources,digest,totalBytes:total,
 nodes:Object.freeze([...nodes.values()]),edges:Object.freeze(edges),issues:Object.freeze(issues),
 unreferencedFiles:Object.freeze([...files.keys()].filter(p=>!scheduled.has(p)).sort()),
 allReferencesMatched:edges.every(e=>e.status==='matched'),allReachableAccepted:[...nodes.values()].every(n=>n.status!=='invalid-or-unsupported'),
 fixtureSoundGraphValidated:true,bankEventsVerified:false,fullSoundSupport:false,realDependenciesResolved:false,audioPlayed:false,
 realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false});
 if(Buffer.byteLength(JSON.stringify(report),'utf8')>l.maxReportBytes)fail();
 return report;
}
