// F3.06d: cross-file evidence from synthetic input buffers, never caller-provided reports.
import {inspectFixturePmxPayload} from './pmx-payload.mjs';
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('READER_FIXTURE_PMX_SET_REFUSED');};
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
export function inspectFixturePmxSet(input){try{return inspect(input);}catch{fail();}}
function inspect(input){
 const x=record(input,['scope','pmd','pmg','pmc','limits']);
 const l=record(x.limits,['maxTotalBytes','maxBytes','maxRecords','maxVertices','maxTriangles','maxReferences']);
 if(x.scope!=='synthetic-fixture'||!int(l.maxTotalBytes,8,32*1024*1024)||
 !int(l.maxBytes,4,16*1024*1024)||!int(l.maxRecords,0,250000)||
 !int(l.maxVertices,0,250000)||!int(l.maxTriangles,0,500000)||!int(l.maxReferences,0,4096))fail();
 const files=[];
 let totalBytes=0,stem=null;
 for(const format of ['pmd','pmg','pmc']){
  if(format==='pmc'&&x[format]===null)continue;
  const v=record(x[format],['path','bytes']);
  if(typeof v.path!=='string'||!v.path.endsWith('.'+format)||!Buffer.isBuffer(v.bytes)||
   v.bytes.length>l.maxBytes||v.bytes.length>l.maxTotalBytes-totalBytes)fail();
  const base=v.path.slice(0,-4);
  if(stem===null)stem=base;else if(stem!==base)fail();
  totalBytes+=v.bytes.length;files.push({format,path:v.path,bytes:Buffer.from(v.bytes)});
 }
 let vertices=0,triangles=0,referenceCount=0;
 const reports={};
 for(const file of files){
  const r=inspectFixturePmxPayload({scope:x.scope,path:file.path,bytes:file.bytes,limits:{
   maxBytes:l.maxBytes,maxRecords:l.maxRecords,maxVertices:l.maxVertices-vertices,
   maxTriangles:l.maxTriangles-triangles,maxReferences:l.maxReferences-referenceCount}});
  if(r.format!==file.format)fail();
  vertices+=r.vertexCount;triangles+=r.triangleCount;referenceCount+=r.references.length;
  reports[file.format]=r;
 }
 const {pmd,pmg,pmc}=reports;
 const issues=[];
 const issue=(code,extra={})=>issues.push(Object.freeze({code,...extra}));
 if(pmd.counts.pieces!==pmg.counts.pieces)issue('PIECE_COUNT_MISMATCH',{descriptor:pmd.counts.pieces,geometry:pmg.counts.pieces});
 if(pmd.counts.parts!==pmg.counts.parts)issue('PART_COUNT_MISMATCH',{descriptor:pmd.counts.parts,geometry:pmg.counts.parts});
 if(pmg.pieces.length&&pmd.counts.looks===0)issue('NO_MATERIAL_LOOK');
 const links=[];
 // Index once; no quadratic search over material references.
 const materialPaths=new Map();
 for(const ref of pmd.references){
  let list=materialPaths.get(ref.materialIndex);
  if(!list){list=[];materialPaths.set(ref.materialIndex,list);}
  list.push(ref);
 }
 for(const [slot,list] of materialPaths)materialPaths.set(slot,Object.freeze(list));
 for(const p of pmg.pieces){
  const valid=p.materialIndex<pmd.counts.materials;
  if(!valid)issue('MATERIAL_SLOT_OUT_OF_RANGE',{pieceIndex:p.index,materialIndex:p.materialIndex});
  const refs=valid?materialPaths.get(p.materialIndex):undefined;
  links.push(Object.freeze({pieceIndex:p.index,materialIndex:p.materialIndex,status:!valid?'invalid-slot':refs?'candidate-linked':'no-look-reference',
   candidates:refs??Object.freeze([])}));
 }
 // Collision is an independent mesh; no assumption of matching vertex counts or containment.
 const sourceDigests=Object.freeze(files.map(f=>Object.freeze({format:f.format,path:f.path,sha256:reports[f.format].source.contentDigest})));
 const digest=createHash('sha256').update(JSON.stringify(sourceDigests)).digest('hex');
 return Object.freeze({schemaVersion:1,scope:x.scope,modelStem:stem,sourceDigests,digest,totalBytes,
  vertexCount:vertices,triangleCount:triangles,referenceCount,issues:Object.freeze(issues),
  materialLinks:Object.freeze(links),descriptorGeometryConsistent:issues.length===0,
  collisionStatus:pmc?'mesh-evidence-only':'not-supplied',
  geometryBounds:pmg.bounds,collisionBounds:pmc?.bounds??null,
  fixturePmxSetValidated:true,fullPmxSupport:false,dependenciesResolved:false,
  collisionBehaviorValidated:false,realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false});
}
