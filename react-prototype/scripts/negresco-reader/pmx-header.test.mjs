import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectFixturePmx as inspect} from './pmx-header.mjs';
const input=(format,bytes,over={})=>({scope:'synthetic-fixture',path:'vehicle/fixture.'+format,bytes,limits:{maxBytes:4096,maxRecords:100,...over}});
const refuse=/^Error: READER_FIXTURE_PMX_REFUSED$/;
function pmd(){
 const b=Buffer.alloc(96);b.writeUInt32LE(4,0);
 for(const o of [4,8,16,20])b.writeUInt32LE(1,o);
 for(const [o,v] of [[32,4],[36,64],[40,72],[44,80],[48,88],[52,88],[56,88],[60,92]])b.writeUInt32LE(v,o);
 return b;
}
function pmc(){
 const b=Buffer.alloc(68);b.writeUInt32LE(6,0);b.writeUInt32LE(1,8);b.writeUInt32LE(1,16);
 for(const [o,v] of [[20,40],[24,40],[28,48],[32,48],[36,64]])b.writeUInt32LE(v,o);
 return b;
}
function pmg(version=0x15){
 const d=version===0x15?8:0,h=104+d,b=Buffer.alloc(h+124);b[0]=version;b.write('gmP',1);
 b.writeInt32LE(1,4);b.writeInt32LE(1,8);
 for(const [o,v] of [[64,h],[68,h],[72,h+24],[76,h+24],[80,h+124],[88,h+124],[96,h+124]])b.writeInt32LE(v,o+d);
 b.writeFloatLE(2,36+d);b.writeFloatLE(1,52+d);b.writeFloatLE(2,56+d);b.writeFloatLE(3,60+d);return b;
}
test('PMD v4 records counts and bounded tables',()=>{
 const r=inspect(input('pmd',pmd()));assert.equal(r.version,4);assert.equal(r.counts.materials,1);
 assert.deepEqual(r.ranges.find(x=>x.name==='material-data'),{name:'material-data',offset:92,length:4});
});
test('PMC v6 records pieces and variants without decoding collision',()=>{
 const r=inspect(input('pmc',pmc()));assert.equal(r.counts.pieces,1);assert.equal(r.collisionDecoded,false);
 assert.equal(r.ranges.find(x=>x.name==='pieces').length,16);
});
test('PMG versions 0x14 and 0x15 parse declared bounds and section sizes',()=>{
 for(const v of [0x14,0x15]){
  const r=inspect(input('pmg',pmg(v)));assert.equal(r.version,v);assert.equal(r.headerBytes,v===0x15?112:104);
  assert.deepEqual(r.declaredBounds.max,[1,2,3]);assert.equal(r.counts.parts,1);
  assert.equal(r.ranges.find(x=>x.name==='pieces').length,100);
 }
});
test('wrong version, signature and truncated header refused',()=>{
 for(const [format,b] of [['pmd',pmd()],['pmc',pmc()],['pmg',pmg()]]){
  const wrong=Buffer.from(b);wrong[0]=0;
  assert.throws(()=>inspect(input(format,wrong)),refuse);
  for(const size of [0,3,20])assert.throws(()=>inspect(input(format,b.subarray(0,size))),refuse);
 }
 const b=pmg();b[1]=0;assert.throws(()=>inspect(input('pmg',b)),refuse);
});
test('table overflow and overlap refused for each supported format',()=>{
 for(const [f,b,o] of [['pmd',pmd(),40],['pmc',pmc(),32],['pmg',pmg(),84]]){
  const over=Buffer.from(b);over.writeUInt32LE(b.length,o);assert.throws(()=>inspect(input(f,over)),refuse);
  const overlap=Buffer.from(b);overlap.writeUInt32LE(f==='pmd'?64:f==='pmc'?40:112,o);assert.throws(()=>inspect(input(f,overlap)),refuse);
 }
});
test('signed negative counts, record cap and excessive product refused',()=>{
 const b=pmg();b.writeInt32LE(-1,4);assert.throws(()=>inspect(input('pmg',b)),refuse);
 assert.throws(()=>inspect(input('pmd',pmd(),{maxRecords:0})),refuse);
 const a=pmd();a.writeUInt32LE(100,4);a.writeUInt32LE(100,8);assert.throws(()=>inspect(input('pmd',a)),refuse);
});
test('nonfinite or reversed PMG bounds refused',()=>{
 for(const [o,v] of [[32,NaN],[44,-1],[48,5]]){
  const b=pmg();b.writeFloatLE(v,o);assert.throws(()=>inspect(input('pmg',b)),refuse);
 }
});
test('invalid scope, source path, limits and extension refused',()=>{
 const b=pmd(),x=input('pmd',b);
 for(const v of [{...x,scope:'real-mod'},{...x,path:'../a.pmd'},input('txt',b),input('pmd',b,{maxBytes:4}),{...x,extra:true}])assert.throws(()=>inspect(v),refuse);
});
test('immutable evidence explicitly disclaims payload and runtime verification',()=>{
 const r=inspect(input('pmg',pmg()));for(const o of [r,r.source,r.counts,r.ranges,r.ranges[0],r.declaredBounds,r.declaredBounds.min])assert.ok(Object.isFrozen(o));
 for(const k of ['payloadValidated','geometryDecoded','collisionDecoded','dependenciesResolved','fullPmxSupport','realSecurityGateVerified','realReadsPerformed','operationsEnabled'])assert.equal(r[k],false);
});

test('PMG magic rejects high-bit aliases in both supported versions',()=>{
 for(const v of [0x14,0x15])for(const o of [1,2,3]){
  const b=pmg(v);b[o]|=128;assert.throws(()=>inspect(input('pmg',b)),refuse);
 }
});
