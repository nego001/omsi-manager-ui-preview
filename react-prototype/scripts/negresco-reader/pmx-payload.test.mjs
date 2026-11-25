import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectFixturePmxPayload as inspect} from './pmx-payload.mjs';
const input=(format,bytes,over={})=>({scope:'synthetic-fixture',path:'vehicle/fixture.'+format,bytes,limits:{maxBytes:4096,maxRecords:100,maxVertices:100,maxTriangles:100,maxReferences:20,...over}});
const refuse=/^Error: READER_FIXTURE_PMX_PAYLOAD_REFUSED$/;
const verts=[-2,0,1,3,1,1,0,4,-1];
function pmg(version=0x15,normal=false){
 const d=version===0x15?8:0,h=104+d,p=h,v=p+100,stride=normal?24:12,ix=v+3*stride,b=Buffer.alloc(ix+6);
 b[0]=version;b.write('gmP',1);b.writeInt32LE(1,4);
 for(const [o,val] of [[64,h],[68,h],[72,h],[76,p],[80,v],[88,v],[92,3*stride],[96,ix],[100,6]])b.writeInt32LE(val,o+d);
 for(const [o,val] of [[0,3],[4,3],[16,0],[60,-1],[64,v],[68,normal?v+12:-1],[72,-1],[76,-1],[80,-1],[84,-1],[88,ix],[92,-1],[96,-1]])b.writeInt32LE(val,p+o);
 for(let j=0;j<3;j++){for(let k=0;k<3;k++)b.writeFloatLE(verts[j*3+k],v+j*stride+k*4);if(normal)b.writeFloatLE(1,v+j*stride+16);}
 [0,1,2].forEach((n,j)=>b.writeUInt16LE(n,ix+j*2));return {b,p,v,ix};
}
function pmc(){
 const p=40,v=56,ix=92,b=Buffer.alloc(98);b.writeUInt32LE(6,0);b.writeUInt32LE(1,16);
 for(const o of [20,24,28,32,36])b.writeUInt32LE(p,o);
 [3,3,v,ix].forEach((n,j)=>b.writeUInt32LE(n,p+j*4));
 verts.forEach((n,j)=>b.writeFloatLE(n,v+j*4));[0,1,2].forEach((n,j)=>b.writeUInt16LE(n,ix+j*2));return {b,p,v,ix};
}
function pmd(path='/material/body.mat'){
 const data=Buffer.from(path+'\0'),b=Buffer.alloc(76+data.length);b.writeUInt32LE(4,0);
 b.writeUInt32LE(1,4);b.writeUInt32LE(1,8);b.writeUInt32LE(data.length,32);
 for(const [o,v] of [[36,64],[40,72],[44,72],[48,72],[52,72],[56,72],[60,76]])b.writeUInt32LE(v,o);
 b.writeUInt32LE(76,72);data.copy(b,76);return b;
}
test('PMG 0x14 and 0x15 positions and indices decoded with actual bounds',()=>{
 for(const version of [0x14,0x15])for(const normal of [false,true]){
  const r=inspect(input('pmg',pmg(version,normal).b));assert.equal(r.geometryDecoded,true);
  assert.equal(r.vertexCount,3);assert.equal(r.triangleCount,1);
  assert.deepEqual(r.bounds,{min:[-2,0,-1],max:[3,4,1],size:[5,4,2]});
 }
});
test('PMC standalone collision mesh arrays decode without claiming collision behavior',()=>{
 const r=inspect(input('pmc',pmc().b));assert.equal(r.collisionMeshDecoded,true);
 assert.equal(r.geometryDecoded,false);assert.equal(r.vertexCount,3);assert.equal(r.triangleCount,1);
 assert.equal(r.pieces[0].materialIndex,null);
});
test('PMD absolute virtual and relative material candidates',()=>{
 for(const path of ['/material/body.mat','body.mat']){
  const r=inspect(input('pmd',pmd(path)));assert.equal(r.materialReferencesDecoded,true);
  assert.deepEqual(r.references[0],{role:'material-candidate',lookIndex:0,materialIndex:0,path,namespace:path[0]==='/'?'game-virtual-root':'relative-unresolved',resolution:'not-attempted'});
 }
});
test('repeated triangle indices are counted, invalid indices rejected',()=>{
 for(const [format,fixture] of [['pmg',pmg()],['pmc',pmc()]]){
  fixture.b.writeUInt16LE(0,fixture.ix+2);assert.equal(inspect(input(format,fixture.b)).repeatedIndexTriangleCount,1);
  fixture.b.writeUInt16LE(3,fixture.ix+2);assert.throws(()=>inspect(input(format,fixture.b)),refuse);
 }
});
test('PMG unsupported skinning, UV, and noncanonical interleaving refused',()=>{
 for(const [o,value] of [[12,1],[16,1],[20,1]]){
  const {b}=pmg();b.writeInt32LE(value,o);assert.throws(()=>inspect(input('pmg',b)),refuse);
 }
 for(const [o,value] of [[8,1],[12,1],[60,0],[68,0],[72,0],[92,0]]){
  const {b,p}=pmg();b.writeInt32LE(value,p+o);assert.throws(()=>inspect(input('pmg',b)),refuse);
 }
});
test('PMC variants and collision stream overlap refused',()=>{
 const {b,p,v}=pmc();const variant=Buffer.from(b);variant.writeUInt32LE(1,8);
 assert.throws(()=>inspect(input('pmc',variant)),refuse);
 for(const offset of [p,v]){
  const x=Buffer.from(b);x.writeUInt32LE(offset,p+12);assert.throws(()=>inspect(input('pmc',x)),refuse);
 }
});
test('invalid PMG pool offsets, incomplete triangles and nonfinite coordinates refused',()=>{
 for(const [o,val] of [[0,2],[4,0],[64,0],[88,0]]){
  const {b,p}=pmg();b.writeInt32LE(val,p+o);assert.throws(()=>inspect(input('pmg',b)),refuse);
 }
 const {b,v}=pmg(0x15,true);b.writeFloatLE(Infinity,v+12);assert.throws(()=>inspect(input('pmg',b)),refuse);
});
test('PMD unsafe material strings and invalid pointers refused',()=>{
 for(const p of ['../a.mat','//host/a.mat','C:/a.mat','/a/../b.mat','/a.dds','/é.mat',''])assert.throws(()=>inspect(input('pmd',pmd(p))),refuse);
 for(const o of [0,77,999]){const b=pmd();b.writeUInt32LE(o,72);assert.throws(()=>inspect(input('pmd',b)),refuse);}
 const b=pmd();b[b.length-1]=65;assert.throws(()=>inspect(input('pmd',b)),refuse);
});
test('aggregate resource limits enforced',()=>{
 for(const over of [{maxVertices:2},{maxTriangles:0},{maxRecords:0},{maxBytes:8}])assert.throws(()=>inspect(input('pmg',pmg().b,over)),refuse);
 assert.throws(()=>inspect(input('pmd',pmd(),{maxReferences:0})),refuse);
});
test('evidence immutable, deterministic and explicitly partial',()=>{
 const x=input('pmg',pmg().b),r=inspect(x);assert.deepEqual(r,inspect(x));
 for(const o of [r,r.source,r.bounds,r.bounds.min,r.bounds.max,r.pieces,r.pieces[0],r.references])assert.ok(Object.isFrozen(o));
 for(const k of ['fullPmxSupport','fullPayloadValidated','dependenciesResolved','realSecurityGateVerified','realReadsPerformed','operationsEnabled'])assert.equal(r[k],false);
 x.bytes.fill(0);assert.equal(r.vertexCount,3);
});
