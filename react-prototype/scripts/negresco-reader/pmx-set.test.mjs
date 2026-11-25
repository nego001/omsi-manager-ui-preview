import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectFixturePmxSet as inspect} from './pmx-set.mjs';
import {inspectFixturePmxPayload as payload} from './pmx-payload.mjs';
const limits={maxTotalBytes:4096,maxBytes:2048,maxRecords:100,maxVertices:100,maxTriangles:100,maxReferences:20};
const refuse=/^Error: READER_FIXTURE_PMX_SET_REFUSED$/;
const refusePayload=/^Error: READER_FIXTURE_PMX_PAYLOAD_REFUSED$/;
function pmd(){
 const data=Buffer.from('/material/a.mat\0'),b=Buffer.alloc(76+data.length);
 for(const [o,v] of [[0,4],[4,1],[8,1],[12,1],[32,data.length],[36,64],[40,72],[44,72],[48,72],[52,72],[56,72],[60,76],[72,76]])b.writeUInt32LE(v,o);
 data.copy(b,76);return b;
}
function pmg(width=0,normal=false,version=0x15){
 const d=version===0x15?8:0,h=104+d,p=h,v=p+100,base=normal?24:12,stride=base+width*8,ix=v+3*stride,b=Buffer.alloc(ix+6);
 b[0]=version;b.write('gmP',1);b.writeInt32LE(1,4);
 for(const [o,val] of [[64,h],[68,h],[72,h],[76,p],[80,v],[88,v],[92,3*stride],[96,ix],[100,6]])b.writeInt32LE(val,o+d);
 for(const [o,val] of [[0,3],[4,3],[8,2**width-1],[12,width],[16,0],[60,-1],[64,v],[68,normal?v+12:-1],[72,width?v+base:-1],[76,-1],[80,-1],[84,-1],[88,ix],[92,-1],[96,-1]])b.writeInt32LE(val,p+o);
 for(let j=0;j<3;j++){
  b.writeFloatLE(j,v+j*stride);
  if(normal)b.writeFloatLE(1,v+j*stride+16);
  for(let k=0;k<width;k++){b.writeFloatLE(j-k,v+j*stride+base+k*8);b.writeFloatLE(k-j,v+j*stride+base+k*8+4);}
 }
 [0,1,2].forEach((n,j)=>b.writeUInt16LE(n,ix+j*2));return {b,p,v,base};
}
function pmc(){
 const b=Buffer.alloc(98);b.writeUInt32LE(6,0);b.writeUInt32LE(1,16);
 for(const o of [20,24,28,32,36])b.writeUInt32LE(40,o);
 [3,3,56,92].forEach((n,j)=>b.writeUInt32LE(n,40+j*4));b.writeFloatLE(5,56);[0,1,2].forEach((n,j)=>b.writeUInt16LE(n,92+j*2));return b;
}
const file=(ext,bytes)=>({path:'vehicle/a.'+ext,bytes});
const input=(collision=false)=>({scope:'synthetic-fixture',pmd:file('pmd',pmd()),pmg:file('pmg',pmg().b),pmc:collision?file('pmc',pmc()):null,limits:{...limits}});
const uvInput=b=>({scope:'synthetic-fixture',...file('pmg',b),limits:{maxBytes:2048,maxRecords:100,maxVertices:100,maxTriangles:100,maxReferences:20}});
test('PMG UV channels 1 to 4 and optional normals produce finite channel bounds',()=>{
 for(const version of [0x14,0x15])for(const normal of [false,true])for(let width=1;width<=4;width++){
  const r=payload(uvInput(pmg(width,normal,version).b));assert.equal(r.pieces[0].uvBounds.length,width);
  assert.deepEqual(r.pieces[0].uvBounds[width-1],{min:[1-width,width-3],max:[3-width,width-1]});
 }
});
test('PMG invalid UV width, mask, offset and nonfinite values refused',()=>{
 for(const [o,v] of [[8,0],[12,5],[72,0]]){const f=pmg(1);f.b.writeInt32LE(v,f.p+o);assert.throws(()=>payload(uvInput(f.b)),refusePayload);}
 const f=pmg(1);f.b.writeFloatLE(NaN,f.v+f.base);assert.throws(()=>payload(uvInput(f.b)),refusePayload);
});
test('descriptor and geometry with same stem link per-look material candidates',()=>{
 const r=inspect(input());assert.equal(r.descriptorGeometryConsistent,true);assert.equal(r.vertexCount,3);
 assert.equal(r.materialLinks[0].status,'candidate-linked');assert.equal(r.materialLinks[0].candidates[0].path,'/material/a.mat');
 assert.equal(r.collisionStatus,'not-supplied');
});
test('collision remains independent evidence and need not fit geometry bounds',()=>{
 const r=inspect(input(true));assert.equal(r.descriptorGeometryConsistent,true);assert.equal(r.vertexCount,6);
 assert.equal(r.collisionStatus,'mesh-evidence-only');assert.equal(r.collisionBounds.max[0],5);assert.equal(r.geometryBounds.max[0],2);
});
test('piece and material slot mismatches reported without fabricating dependencies',()=>{
 const x=input();x.pmd.bytes.writeUInt32LE(2,12);x.pmg.bytes.writeInt32LE(1,112+16);
 const r=inspect(x);assert.equal(r.descriptorGeometryConsistent,false);
 assert.deepEqual(r.issues.map(i=>i.code),['PIECE_COUNT_MISMATCH','MATERIAL_SLOT_OUT_OF_RANGE']);assert.equal(r.materialLinks[0].status,'invalid-slot');
});
test('different file stems and invalid scope refused',()=>{
 const x=input();x.pmg.path='vehicle/b.pmg';assert.throws(()=>inspect(x),refuse);
 assert.throws(()=>inspect({...input(),scope:'real-mod'}),refuse);
});
test('aggregate byte and mesh budgets enforced across all files',()=>{
 for(const over of [{maxTotalBytes:100},{maxVertices:5},{maxTriangles:1},{maxReferences:0}]){
  const x=input(true);Object.assign(x.limits,over);assert.throws(()=>inspect(x),refuse);
 }
});
test('malformed member cannot be replaced by caller-authored evidence',()=>{
 const x=input();x.pmg={path:'vehicle/a.pmg',bytes:Buffer.alloc(4),report:{geometryDecoded:true}};assert.throws(()=>inspect(x),refuse);
 const y=input();y.pmc=file('pmc',Buffer.alloc(40));assert.throws(()=>inspect(y),refuse);
});
test('source binding and results are deterministic and immutable',()=>{
 const x=input(true),r=inspect(x);assert.deepEqual(r,inspect(x));assert.match(r.digest,/^[a-f0-9]{64}$/);
 for(const o of [r,r.sourceDigests,r.sourceDigests[0],r.materialLinks,r.materialLinks[0],r.materialLinks[0].candidates,r.issues])assert.ok(Object.isFrozen(o));
 for(const k of ['fullPmxSupport','dependenciesResolved','collisionBehaviorValidated','realSecurityGateVerified','realReadsPerformed','operationsEnabled'])assert.equal(r[k],false);
 x.pmg.bytes.writeFloatLE(1,x.pmg.bytes.length-6-12);assert.notEqual(inspect(x).digest,r.digest);
});

test('PMX repeated material candidate expansion is bounded before serialization',()=>{
 const count=64,looks=65,h=112,p=h,v=p+count*100,ix=v+count*12,b=Buffer.alloc(ix);
 b[0]=0x15;b.write('gmP',1);b.writeInt32LE(count,4);
 for(const [o,val] of [[72,h],[76,h],[80,h],[84,p],[88,v],[96,v],[100,count*12],[104,ix]])b.writeInt32LE(val,o);
 for(let j=0;j<count;j++){
  const o=p+j*100;
  for(const [k,val] of [[4,1],[60,-1],[64,v+j*12],[68,-1],[72,-1],[76,-1],[80,-1],[84,-1],[88,ix],[92,-1],[96,-1]])b.writeInt32LE(val,o+k);
 }
 const off=64+looks*8,dataOff=off+looks*4,data=Buffer.from('body.mat\0'),d=Buffer.alloc(dataOff+data.length);
 for(const [o,val] of [[0,4],[4,1],[8,looks],[12,count],[32,data.length],[36,64],[40,off],[44,off],[48,off],[52,off],[56,off],[60,dataOff]])d.writeUInt32LE(val,o);
 for(let j=0;j<looks;j++)d.writeUInt32LE(dataOff,off+j*4);data.copy(d,dataOff);
 const x=input();x.pmd.bytes=d;x.pmg.bytes=b;Object.assign(x.limits,{maxTotalBytes:65536,maxBytes:32768,maxReferences:100});
 assert.throws(()=>inspect(x),refuse);
});
