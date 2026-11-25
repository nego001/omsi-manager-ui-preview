// F3.06c: narrow PMX payload evidence; synthetic buffers only.
import {inspectFixturePmx} from './pmx-header.mjs';
import {buildFixtureIndex} from './index.mjs';
const fail=()=>{throw Error('READER_FIXTURE_PMX_PAYLOAD_REFUSED');};
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
export function inspectFixturePmxPayload(input){try{return inspect(input);}catch{fail();}}
function inspect(input){
 const x=record(input,['scope','path','bytes','limits']);
 const l=record(x.limits,['maxBytes','maxRecords','maxVertices','maxTriangles','maxReferences']);
 if(x.scope!=='synthetic-fixture'||!Buffer.isBuffer(x.bytes)||!int(l.maxBytes,4,16*1024*1024)||x.bytes.length>l.maxBytes||
 !int(l.maxVertices,0,250000)||!int(l.maxTriangles,0,500000)||!int(l.maxReferences,0,4096))fail();
 const b=Buffer.from(x.bytes);
 const h=inspectFixturePmx({scope:x.scope,path:x.path,bytes:b,limits:{maxBytes:l.maxBytes,maxRecords:l.maxRecords}});
 const u=o=>b.readUInt32LE(o),i=o=>b.readInt32LE(o);
 const f=o=>{const v=b.readFloatLE(o);if(!Number.isFinite(v))fail();return v===0?0:v;};
 const range=name=>{const r=h.ranges.find(r=>r.name===name);if(!r)fail();return r;};
 const inside=(o,n,r)=>{if(!int(o,r.offset,r.offset+r.length)||!int(n,0,r.offset+r.length-o))fail();};
 const occupied=[],pieces=[],references=[];
 let vertexCount=0,triangleCount=0,repeatedIndexTriangleCount=0;
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 function claim(o,n,r){inside(o,n,r);if(n)occupied.push({offset:o,length:n});}
 function mesh(v,edges,pos,indices,stride,normal,vr,ir,materialIndex){
  if(!int(v,1,Math.min(65536,l.maxVertices-vertexCount))||!int(edges,0,(l.maxTriangles-triangleCount)*3)||edges%3)fail();
  claim(pos,v*stride,vr);claim(indices,edges*2,ir);
  let repeated=0;
  for(let j=0;j<v;j++)for(let k=0;k<3;k++){
   const p=f(pos+j*stride+k*4);min[k]=Math.min(min[k],p);max[k]=Math.max(max[k],p);
   if(normal)f(pos+j*stride+12+k*4);
  }
  for(let j=0;j<edges;j+=3){
   const a=b.readUInt16LE(indices+j*2),c=b.readUInt16LE(indices+j*2+2),d=b.readUInt16LE(indices+j*2+4);
   if(a>=v||c>=v||d>=v)fail();if(a===c||a===d||c===d)repeated++;
  }
  vertexCount+=v;triangleCount+=edges/3;repeatedIndexTriangleCount+=repeated;
  pieces.push(Object.freeze({index:pieces.length,vertexCount:v,triangleCount:edges/3,materialIndex,repeatedIndexTriangleCount:repeated}));
 }
 if(h.format==='pmg'){
  if(h.counts.bones||h.counts.weightWidth||h.counts.locators||range('strings').length)fail();
  const pr=range('pieces'),vr=range('vertices'),ir=range('indices');
  for(let j=0;j<h.counts.pieces;j++){
   const o=pr.offset+j*100,edges=i(o),v=i(o+4),mat=i(o+16),pos=i(o+64),normal=i(o+68);
   if(i(o+8)!==0||i(o+12)!==0||!int(mat,0,l.maxRecords)||i(o+60)!==-1||
     [72,76,80,84,92,96].some(k=>i(o+k)!==-1)||!(normal===-1||normal===pos+12))fail();
   mesh(v,edges,pos,i(o+88),normal===-1?12:24,normal!==-1,vr,ir,mat);
  }
 }else if(h.format==='pmc'){
  // Only standalone convex piece mesh arrays, no variant/locator payload.
  if(h.counts.looks||h.counts.variants||h.counts.materials)fail();
  const pr=range('pieces'),payload={offset:h.headerBytes,length:b.length-h.headerBytes};
  for(const r of h.ranges)if(r.length)occupied.push(r);
  for(let j=0;j<h.counts.pieces;j++){
   const o=pr.offset+j*16;
   mesh(u(o+4),u(o),u(o+8),u(o+12),12,false,payload,payload,null);
  }
 }else{
  const offsets=range('material-offsets'),data=range('material-data'),count=offsets.length/4;
  if(count>l.maxReferences)fail();
  for(let j=0;j<count;j++){
   const o=u(offsets.offset+j*4);inside(o,1,data);
   // Require a string boundary; do not accept pointers into a string.
   if(o!==data.offset&&b[o-1]!==0)fail();
   let end=o;while(end<data.offset+data.length&&end-o<=240&&b[end]!==0)end++;
   if(end===o||end>=data.offset+data.length||end-o>240||b[end]!==0)fail();
   const raw=b.subarray(o,end);if(raw.some(c=>c<32||c>126))fail();
   const path=raw.toString('ascii'),rooted=path.startsWith('/');
   if(!path.toLowerCase().endsWith('.mat'))fail();
   buildFixtureIndex({scope:x.scope,limits:{maxEntries:1,maxNodes:32,maxDepth:32,maxBytes:0,maxEntryBytes:0},
    entries:[{path:rooted?path.slice(1):path,kind:'file',bytes:Buffer.alloc(0)}]});
   references.push(Object.freeze({role:'material-candidate',lookIndex:Math.floor(j/h.counts.materials),materialIndex:j%h.counts.materials,path,
    namespace:rooted?'game-virtual-root':'relative-unresolved',resolution:'not-attempted'}));
  }
 }
 occupied.sort((a,c)=>a.offset-c.offset);
 for(let j=1;j<occupied.length;j++)if(occupied[j].offset<occupied[j-1].offset+occupied[j-1].length)fail();
 const bounds=vertexCount?Object.freeze({min:Object.freeze(min),max:Object.freeze(max),size:Object.freeze(max.map((v,j)=>v-min[j]))}):null;
 return Object.freeze({schemaVersion:1,scope:x.scope,format:h.format,version:h.version,source:h.source,
 vertexCount,triangleCount,repeatedIndexTriangleCount,bounds,pieces:Object.freeze(pieces),references:Object.freeze(references),
 fixturePmxPayloadSubsetValidated:true,geometryDecoded:h.format==='pmg',collisionMeshDecoded:h.format==='pmc',
 materialReferencesDecoded:h.format==='pmd',fullPmxSupport:false,fullPayloadValidated:false,
 dependenciesResolved:false,realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false});
}
