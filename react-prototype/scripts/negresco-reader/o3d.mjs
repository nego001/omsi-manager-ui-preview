// F3.06a: bounded, unencrypted O3D mesh subset, synthetic buffers only.
// Layout reference: https://github.com/openOMSI-org/openOMSI/blob/main/docs/FORMATS.md
import {buildFixtureIndex} from './index.mjs';
const fail=()=>{throw Error('READER_FIXTURE_O3D_REFUSED');};
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
function indexed(path,bytes,maxBytes){
 return buildFixtureIndex({scope:'synthetic-fixture',limits:{maxEntries:1,maxNodes:32,maxDepth:32,maxBytes,maxEntryBytes:maxBytes},entries:[{path,kind:'file',bytes}]}).entries[0];
}
export function inspectFixtureO3d(input){try{return inspect(input);}catch{fail();}}
function inspect(input){
 const x=record(input,['scope','path','bytes','limits']);
 const l=record(x.limits,['maxBytes','maxVertices','maxTriangles','maxMaterials','maxTextureBytes']);
 if(x.scope!=='synthetic-fixture'||!Buffer.isBuffer(x.bytes)||!int(l.maxBytes,3,16*1024*1024)||x.bytes.length>l.maxBytes||
 !int(l.maxVertices,1,250000)||!int(l.maxTriangles,0,500000)||!int(l.maxMaterials,0,4096)||
 !int(l.maxTextureBytes,0,240))fail();
 const b=Buffer.from(x.bytes),source=indexed(x.path,b,l.maxBytes);
 if(!x.path.toLowerCase().endsWith('.o3d'))fail();
 let p=0;
 const need=n=>{if(!int(n,0,b.length-p))fail();};
 const u8=()=>{need(1);return b[p++];};
 const u16=()=>{need(2);const v=b.readUInt16LE(p);p+=2;return v;};
 const u32=()=>{need(4);const v=b.readUInt32LE(p);p+=4;return v;};
 const f32=()=>{need(4);const v=b.readFloatLE(p);p+=4;if(!Number.isFinite(v))fail();return v===0?0:v;};
 const tag=t=>{if(u8()!==t)fail();};
 if(u8()!==0x84||u8()!==0x19)fail();
 const version=u8();if(![1,3].includes(version))fail();
 const flags=version===3?u8():0;if(flags!==0&&flags!==1)fail();
 const count=version===3?u32:u16,index=flags===1?u32:u16;
 tag(0x17);const vertexCount=count();
 if(!int(vertexCount,1,l.maxVertices))fail();need(vertexCount*32);
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 const uvMin=[Infinity,Infinity],uvMax=[-Infinity,-Infinity];
 for(let i=0;i<vertexCount;i++){
  for(let k=0;k<3;k++){const v=f32();min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);}
  for(let k=0;k<3;k++)f32();
  for(let k=0;k<2;k++){const v=f32();uvMin[k]=Math.min(uvMin[k],v);uvMax[k]=Math.max(uvMax[k],v);}
 }
 tag(0x49);const triangleCount=count();
 if(!int(triangleCount,0,l.maxTriangles))fail();
 need(triangleCount*(flags===1?14:8));
 let maxMaterial=-1,repeatedIndexTriangleCount=0;
 const materialUsage=new Map();
 for(let i=0;i<triangleCount;i++){
  const a=index(),c=index(),d=index(),m=u16();
  if(a>=vertexCount||c>=vertexCount||d>=vertexCount||m>=l.maxMaterials)fail();
  if(a===c||a===d||c===d)repeatedIndexTriangleCount++;
  maxMaterial=Math.max(maxMaterial,m);materialUsage.set(m,(materialUsage.get(m)??0)+1);
 }
 tag(0x26);const materialCount=u16();
 if(materialCount>l.maxMaterials||maxMaterial>=materialCount)fail();
 const materials=[];
 for(let i=0;i<materialCount;i++){
  need(45);for(let k=0;k<11;k++)f32();
  const length=u8();if(length>l.maxTextureBytes)fail();need(length);
  const name=b.subarray(p,p+length);p+=length;
  if(name.some(v=>v<0x20||v>0x7e))fail();
  let textureCandidate=null;
  if(length){
   textureCandidate=name.toString('ascii').replace(/\\/g,'/');
   indexed(textureCandidate,Buffer.alloc(0),0);
  }
  materials.push(Object.freeze({index:i,triangleCount:materialUsage.get(i)??0,textureCandidate,resolution:'not-attempted'}));
 }
 tag(0x79);const matrix=[];for(let k=0;k<16;k++)matrix.push(f32());
 if(p!==b.length)fail(); // bones, unknown tags, extra bytes and duplicate sections refused
 const bounds=Object.freeze({min:Object.freeze(min),max:Object.freeze(max),size:Object.freeze(max.map((v,i)=>v-min[i]))});
 const uvBounds=Object.freeze({min:Object.freeze(uvMin),max:Object.freeze(uvMax)});
 return Object.freeze({schemaVersion:1,scope:x.scope,format:'o3d',source,version,indexBits:flags===1?32:16,
 vertexCount,triangleCount,materialCount,repeatedIndexTriangleCount,bounds,uvBounds,
 materials:Object.freeze(materials),pivotMatrix:Object.freeze(matrix),coordinateSpace:'raw-file',
 fixtureO3dSubsetValidated:true,fullO3dSupport:false,geometryRendered:false,dependenciesResolved:false,
 realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false});
}
