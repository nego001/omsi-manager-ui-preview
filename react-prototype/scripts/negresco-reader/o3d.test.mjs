import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectFixtureO3d as inspect} from './o3d.mjs';
const u8=n=>Buffer.from([n]);
const u16=n=>{const b=Buffer.alloc(2);b.writeUInt16LE(n);return b;};
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
const floats=a=>{const b=Buffer.alloc(a.length*4);a.forEach((v,i)=>b.writeFloatLE(v,i*4));return b;};
const vertices=[[-2,0,1,0,1,0,0,0],[3,1,1,0,1,0,1,0],[0,4,-1,0,1,0,0,2]];
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mesh({version=1,flags=0,verts=vertices,tris=[[0,1,2,0]],names=['body.dds'],matrix=identity}={}){
 const count=version===3?u32:u16,idx=flags===1?u32:u16;
 return Buffer.concat([u8(0x84),u8(0x19),u8(version),...(version===3?[u8(flags)]:[]),
 u8(0x17),count(verts.length),...verts.map(floats),u8(0x49),count(tris.length),
 ...tris.flatMap(t=>[idx(t[0]),idx(t[1]),idx(t[2]),u16(t[3])]),
 u8(0x26),u16(names.length),...names.flatMap(n=>{const b=Buffer.from(n);return [floats(Array(11).fill(1)),u8(b.length),b];}),
 u8(0x79),floats(matrix)]);
}
const limits={maxBytes:8192,maxVertices:100,maxTriangles:100,maxMaterials:10,maxTextureBytes:80};
const input=(bytes=mesh(),over={},path='Vehicles/Fixture/model/body.o3d')=>({scope:'synthetic-fixture',path,bytes,limits:{...limits,...over}});
const refuse=/^Error: READER_FIXTURE_O3D_REFUSED$/;
test('v1 validates geometry counts and raw XYZ/UV bounds',()=>{
 const b=mesh(),r=inspect(input(b));assert.equal(r.version,1);assert.equal(r.indexBits,16);
 assert.equal(r.vertexCount,3);assert.equal(r.triangleCount,1);assert.equal(r.materialCount,1);
 assert.deepEqual(r.bounds,{min:[-2,0,-1],max:[3,4,1],size:[5,4,2]});
 assert.deepEqual(r.uvBounds,{min:[0,0],max:[1,2]});assert.deepEqual(r.pivotMatrix,identity);
 assert.equal(r.source.contentDigest,createHash('sha256').update(b).digest('hex'));
});
test('v3 accepts both short and long triangle indices',()=>{
 for(const flags of [0,1]){const r=inspect(input(mesh({version:3,flags})));assert.equal(r.indexBits,flags?32:16);assert.equal(r.triangleCount,1);}
});
test('32-bit indices above 65535 are decoded without truncation',()=>{
 const verts=Array.from({length:65537},()=>vertices[0]);
 const b=mesh({version:3,flags:1,verts,tris:[[0,1,65536,0]]});
 const r=inspect(input(b,{maxBytes:b.length,maxVertices:65537}));
 assert.equal(r.vertexCount,65537);assert.equal(r.repeatedIndexTriangleCount,0);
});
test('material usage and normalized texture candidates preserve order',()=>{
 const r=inspect(input(mesh({names:['tex\\body.dds','', 'unused.bmp'],tris:[[0,1,2,0],[1,2,0,0],[0,0,1,1]]})));
 assert.deepEqual(r.materials.map(m=>[m.triangleCount,m.textureCandidate]),[[2,'tex/body.dds'],[1,null],[0,'unused.bmp']]);
 assert.equal(r.repeatedIndexTriangleCount,1);
});
test('zero triangles/materials supported, zero vertices refused',()=>{
 const r=inspect(input(mesh({tris:[],names:[]})));assert.equal(r.triangleCount,0);assert.equal(r.materialCount,0);
 assert.throws(()=>inspect(input(mesh({verts:[],tris:[],names:[]}))),refuse);
});
test('invalid vertex or material references refused',()=>{
 for(const tris of [[[0,1,3,0]],[[0,1,2,1]],[[0,1,2,65535]]])assert.throws(()=>inspect(input(mesh({tris}))),refuse);
});
test('nonfinite positions, normals, UV and pivot rejected',()=>{
 for(const k of [0,4,7]){const verts=vertices.map(v=>[...v]);verts[0][k]=NaN;assert.throws(()=>inspect(input(mesh({verts}))),refuse);}
 const matrix=[...identity];matrix[15]=Infinity;assert.throws(()=>inspect(input(mesh({matrix}))),refuse);
});
test('unsafe texture paths rejected without resolution',()=>{
 for(const n of ['../x.dds','/a.dds','C:\\a.dds','NUL.dds','a//b.dds','é.dds','a\0.dds'])assert.throws(()=>inspect(input(mesh({names:[n]}))),refuse);
});
test('unsupported versions, flags, sections and trailing bytes refused',()=>{
 for(const version of [0,2,4,5,7])assert.throws(()=>inspect(input(mesh({version}))),refuse);
 assert.throws(()=>inspect(input(mesh({version:3,flags:2}))),refuse);
 const b=mesh(),tag=Buffer.from(b);tag[3]=0x54;const magic=Buffer.from(b);magic[0]=0;
 for(const x of [tag,magic,Buffer.concat([b,Buffer.from([0x54,0,0])]),Buffer.concat([b,Buffer.from([0])])])assert.throws(()=>inspect(input(x)),refuse);
});
test('every truncated prefix rejected',()=>{
 const b=mesh();for(let i=0;i<b.length;i++)assert.throws(()=>inspect(input(b.subarray(0,i))),refuse);
});
test('resource caps and malicious declared count rejected',()=>{
 const b=mesh();for(const over of [{maxBytes:b.length-1},{maxVertices:2},{maxTriangles:0},{maxMaterials:0},{maxTextureBytes:3},{maxBytes:Infinity}])assert.throws(()=>inspect(input(b,over)),refuse);
 const huge=mesh({version:3});huge.writeUInt32LE(0xffffffff,5);assert.throws(()=>inspect(input(huge)),refuse);
});
test('source path, scope and accessors rejected',()=>{
 const x=input();let invoked=false;Object.defineProperty(x,'bytes',{get(){invoked=true;return mesh()},enumerable:true});
 assert.throws(()=>inspect(x),refuse);assert.equal(invoked,false);
 for(const y of [input(mesh(),{},'../a.o3d'),input(mesh(),{},'a.pmg'),{...input(),scope:'real-mod'},{...input(),extra:true}])assert.throws(()=>inspect(y),refuse);
});
test('evidence deterministic, immutable and never authorizes operations',()=>{
 const x=input(),r=inspect(x);assert.deepEqual(r,inspect(x));
 for(const o of [r,r.source,r.bounds,r.bounds.min,r.bounds.size,r.uvBounds,r.uvBounds.max,r.pivotMatrix,r.materials,r.materials[0]])assert.ok(Object.isFrozen(o));
 for(const k of ['fullO3dSupport','geometryRendered','dependenciesResolved','realSecurityGateVerified','realReadsPerformed','operationsEnabled'])assert.equal(r[k],false);
 x.bytes.fill(0);assert.equal(r.vertexCount,3);
});
