// F3.10b: reproducible bounded diagnostic fusion, only from re-parsed synthetic bytes.
import {inspectFixtureDependencyGraphWithPolicy} from './dependency-graph.mjs';
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('READER_FIXTURE_FUSION_REFUSED');};
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
const severity=Object.freeze({
 MISSING_REFERENCE:'error',MISSING_TEXTURE_CANDIDATE:'error',CFG_KIND_MISMATCH:'error',
 CASE_MISMATCH:'warning',AMBIGUOUS_TEXTURE_REFERENCE:'warning',SEARCH_POLICY_UNRESOLVED:'unknown',
 UNREADABLE_SUBSET:'unknown',CANDIDATE_CYCLE:'warning',MATCHED_UNREADABLE_TARGET:'unknown',
 INDEXED_ONLY:'unknown',BANK_SIGNATURE_ONLY:'unknown',
 PMX_PIECE_COUNT_MISMATCH:'warning',PMX_PART_COUNT_MISMATCH:'warning',PMX_MATERIAL_SLOT_OUT_OF_RANGE:'warning',
 PMX_NO_MATERIAL_LOOK:'warning',MIP_FILTER_WITH_SINGLE_LEVEL:'warning',FMOD_EVENT_UNVERIFIED:'unknown'
});
const rank={error:0,warning:1,unknown:2};
export function inspectFixtureEvidenceFusion(input){try{return inspect(input);}catch{fail();}}
function inspect(input){
 const x=record(input,['scope','roots','files','encoding','textureRoots','limits']);
 const l=record(x.limits,['maxBytes','maxEntries','maxReferences','maxGraphBytes','maxFindings','maxReportBytes']);
 if(x.scope!=='synthetic-fixture'||!int(l.maxFindings,0,8192)||!int(l.maxReportBytes,1,4*1024*1024))fail();
 const g=inspectFixtureDependencyGraphWithPolicy({scope:x.scope,roots:x.roots,files:x.files,encoding:x.encoding,textureRoots:x.textureRoots,
 limits:{maxBytes:l.maxBytes,maxEntries:l.maxEntries,maxReferences:l.maxReferences,maxReportBytes:l.maxGraphBytes}});
 const source=new Map(g.sources.map(s=>[s.path,s]));
 const foldedSources=new Map(g.sources.map(s=>[s.path.toLowerCase(),s.path]));
 const node=new Map(g.nodes.map(n=>[n.path,n]));
 const adj=new Map(g.nodes.map(n=>[n.path,new Set()]));
 for(const e of g.edges)if(e.status==='matched')adj.get(e.from).add(e.target);
 // Compute fixture reachability once per root; bounded by 32 * (256 + 4096).
 const impact=new Map(g.nodes.map(n=>[n.path,[]]));
 for(const root of g.roots){
  const seen=new Set([root]),queue=[root];
  for(let i=0;i<queue.length;i++){
   const p=queue[i];impact.get(p).push(root);
   for(const q of adj.get(p))if(!seen.has(q)){seen.add(q);queue.push(q);}
  }
 }
 const findings=new Map();
 function add(code,paths,detail,edgeIndex=null){
  if(!Object.hasOwn(severity,code))fail();
  const origins=[...new Set(paths)].sort();
  if(origins.some(p=>!source.has(p)))fail();
  const body={code,severity:severity[code],origins,detail};
  const key=hash(body);
  let f=findings.get(key);
  if(!f){
   if(findings.size>=l.maxFindings)fail();
   f={id:key,...body,edgeIndices:[],occurrences:0};findings.set(key,f);
  }
  f.occurrences++;
  if(edgeIndex!==null)f.edgeIndices.push(edgeIndex);
 }
 // Diagnostics from graph edges preserve exact references and never invent missing source hashes.
 const edgeCode={missing:'MISSING_REFERENCE','case-mismatch':'CASE_MISMATCH','kind-mismatch':'CFG_KIND_MISMATCH',
 ambiguous:'AMBIGUOUS_TEXTURE_REFERENCE','search-policy-unresolved':'SEARCH_POLICY_UNRESOLVED'};
 for(let i=0;i<g.edges.length;i++){
  const e=g.edges[i];
  if(e.status==='matched'){
   if(node.get(e.target).status==='invalid-or-unsupported')add('MATCHED_UNREADABLE_TARGET',[e.from,e.target],{reference:e.reference,target:e.target,role:e.role},i);
   const a=node.get(e.from),b=node.get(e.target);
   if(a.format==='tobj'&&b.format==='dds'&&a.status==='parsed-subset'&&b.status==='parsed-subset'&&
     [0,1].includes(a.detail.sampler.mipFilter)&&b.detail.mipmapCount===1)
    add('MIP_FILTER_WITH_SINGLE_LEVEL',[a.path,b.path],{mipFilter:a.detail.sampler.mipFilter,mipmapCount:b.detail.mipmapCount},i);
   if(e.role==='fmod-bank'&&e.event!==null&&b.status==='signature-candidate')
    add('FMOD_EVENT_UNVERIFIED',[a.path,b.path],{event:e.event,bank:b.path},i);
  }else{
   const code=e.status==='missing'&&e.target===null?'MISSING_TEXTURE_CANDIDATE':edgeCode[e.status];
   const paths=[e.from,...(e.candidates??[])];if(e.target!==null&&source.has(e.target))paths.push(e.target);
   if(e.status==='case-mismatch'&&e.target!==null){const actual=foldedSources.get(e.target.toLowerCase());if(actual)paths.push(actual);}
   add(code,paths,{reference:e.reference,target:e.target,role:e.role,candidates:e.candidates},i);
  }
 }
 for(const n of g.nodes){
  const code=n.status==='invalid-or-unsupported'?'UNREADABLE_SUBSET':n.status==='indexed-only'?'INDEXED_ONLY':n.status==='signature-candidate'?'BANK_SIGNATURE_ONLY':null;
  if(code)add(code,[n.path],{format:n.format});
 }
 // Compare only same-stem PMD/PMG candidates already reached independently.
 // No fabricated companion edge; same stem is a fixture association, not runtime proof.
 for(const a of g.nodes){
  if(a.format!=='pmd'||a.status!=='parsed-subset')continue;
  const b=node.get(a.path.slice(0,-4)+'.pmg');
  if(b?.format!=='pmg'||b.status!=='parsed-subset')continue;
  const p=a.detail,q=b.detail,paths=[a.path,b.path];
  if(p.pieceCount!==q.pieceCount)add('PMX_PIECE_COUNT_MISMATCH',paths,{descriptor:p.pieceCount,geometry:q.pieceCount});
  if(p.partCount!==q.partCount)add('PMX_PART_COUNT_MISMATCH',paths,{descriptor:p.partCount,geometry:q.partCount});
  if(q.maxMaterialIndex>=p.materialCount)add('PMX_MATERIAL_SLOT_OUT_OF_RANGE',paths,{maxMaterialIndex:q.maxMaterialIndex,materialCount:p.materialCount});
  if(q.pieceCount>0&&p.lookCount===0)add('PMX_NO_MATERIAL_LOOK',paths,{pieceCount:q.pieceCount,lookCount:p.lookCount});
 }
 for(const group of g.cycles)add('CANDIDATE_CYCLE',group,{memberCount:group.length});
 const list=[...findings.values()].map(f=>{
  const roots=[...new Set(f.origins.flatMap(p=>impact.get(p)??[]))].sort();
  return Object.freeze({id:f.id,code:f.code,severity:f.severity,
   origins:Object.freeze(f.origins.map(p=>Object.freeze({path:p,sha256:source.get(p).sha256}))),
   detail:Object.freeze(f.detail),edgeIndices:Object.freeze(f.edgeIndices),occurrences:f.occurrences,
   affectedFixtureRoots:Object.freeze(roots),runtimeImpactVerified:false});
 }).sort((a,b)=>rank[a.severity]-rank[b.severity]||(a.id<b.id?-1:a.id>b.id?1:0));
 const counts=Object.freeze({errors:list.filter(f=>f.severity==='error').length,warnings:list.filter(f=>f.severity==='warning').length,
 unknown:list.filter(f=>f.severity==='unknown').length,findings:list.length});
 const summary=Object.freeze({fixtureStatus:counts.errors?'fixture-reference-errors':counts.warnings?'fixture-review-required':counts.unknown?'fixture-evidence-incomplete':'no-discovered-findings',
  ...counts,sourceCount:g.sources.length,reachableCount:g.nodes.length,unreachedCount:g.unreferencedFiles.length});
 const body={schemaVersion:1,scope:x.scope,graphDigest:g.digest,graphEvidenceDigest:hash(g),summary,
 roots:g.roots,sources:g.sources,findings:Object.freeze(list),
 fixtureEvidenceFusionValidated:true,fullAnalysisComplete:false,gameCompatibilityVerified:false,
 runtimeImpactVerified:false,realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false};
 const report=Object.freeze({...body,evidenceDigest:hash(body)});
 if(Buffer.byteLength(JSON.stringify(report),'utf8')>l.maxReportBytes)fail();
 return report;
}
