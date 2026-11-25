import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectFixtureTexture as texture} from './texture.mjs';
import {inspectFixtureMaterial as material} from './material.mjs';
const t=(ext,bytes,over={})=>({scope:'synthetic-fixture',path:'vehicle/a.'+ext,bytes,limits:{maxBytes:8192,maxDimension:128,maxPixels:16384,maxChunks:20,maxMipmaps:8,...over}});
const m=(ext,bytes,over={})=>({scope:'synthetic-fixture',path:'vehicle/a.'+ext,bytes:Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes),limits:{maxBytes:8192,maxLines:100,maxReferences:20,...over}});
const rt=/^Error: READER_FIXTURE_TEXTURE_REFUSED$/,rm=/^Error: READER_FIXTURE_MATERIAL_REFUSED$/;
function tga({rle=false,bits=32,gray=false}={}){
 const h=Buffer.alloc(18);h[2]=gray?(rle?11:3):(rle?10:2);h.writeUInt16LE(2,12);h.writeUInt16LE(2,14);h[16]=bits;h[17]=32+(bits===32?8:0);
 return Buffer.concat([h,rle?Buffer.concat([Buffer.from([0x83]),Buffer.alloc(bits/8)]):Buffer.alloc(4*bits/8)]);
}
function seg(marker,bytes){const h=Buffer.alloc(4);h[0]=255;h[1]=marker;h.writeUInt16BE(bytes.length+2,2);return Buffer.concat([h,bytes]);}
function jpeg(n=3){
 const f=Buffer.from([8,0,3,0,2,n,...Array.from({length:n},(_,i)=>[i+1,0x11,0]).flat()]);
 const s=Buffer.from([n,...Array.from({length:n},(_,i)=>[i+1,0]).flat(),0,63,0]);
 return Buffer.concat([Buffer.from([255,216]),seg(0xc0,f),seg(0xda,s),Buffer.from([5,255,0,7,255,217])]);
}
function tobj(path='/vehicle/body.dds'){
 const p=Buffer.from(path),b=Buffer.alloc(48+p.length);b.writeUInt32LE(1890650625);b[24]=2;b[26]=1;b[27]=1;b[28]=1;b[38]=1;b.writeUInt32LE(p.length,40);p.copy(b,48);return b;
}
const mat=(p='/vehicle/body.tobj')=>'material : "eut2.dif" {\ntexture[0]: "'+p+'"\ndiffuse: { 1, 0.5, 0 }\nshininess: 4\n}';
test('TGA raw RGB RGBA grayscale and RLE packets expose dimensions',()=>{
 for(const rle of [false,true])for(const bits of [8,24,32]){
  const r=texture(t('tga',tga({rle,bits,gray:bits===8})));assert.equal(r.channels,bits/8);assert.equal(r.width,2);assert.equal(r.height,2);assert.equal(r.compression,rle?'rle':'none');
 }
});
test('TGA packet overrun, truncation, unsupported flags and trailing bytes refused',()=>{
 const b=tga({rle:true});b[18]=0x84;const a=tga();a[17]=0x80;
 for(const x of [b,a,tga().subarray(0,-1),Buffer.concat([tga(),Buffer.alloc(1)])])assert.throws(()=>texture(t('tga',x)),rt);
});
test('baseline JPEG one or three components and stuffed scan bytes accepted as structure only',()=>{
 for(const n of [1,3]){
  const r=texture(t('jpeg',jpeg(n)));assert.equal(r.channels,n);assert.equal(r.width,2);assert.equal(r.height,3);assert.equal(r.pixelsDecoded,false);
 }
});
test('JPEG progressive marker, invalid lengths, truncation and trailing bytes refused',()=>{
 const a=jpeg();a[3]=0xc2;const b=jpeg();b.writeUInt16BE(1,4);
 for(const x of [a,b,jpeg().subarray(0,-1),Buffer.concat([jpeg(),Buffer.alloc(1)])])assert.throws(()=>texture(t('jpg',x)),rt);
});
test('MAT legacy effect and typed texture references retained',()=>{
 const r=material(m('mat',mat()));assert.equal(r.effect,'eut2.dif');assert.equal(r.attributes.length,3);
 assert.deepEqual(r.references[0],{role:'texture-object',path:'/vehicle/body.tobj',namespace:'game-virtual-root',position:2,resolution:'not-attempted'});
});
test('MAT refuses malformed or duplicate attributes and unsafe texture paths',()=>{
 for(const p of ['../x.tobj','//host/a.tobj','C:/a.tobj','a.dds'])assert.throws(()=>material(m('mat',mat(p))),rm);
 for(const s of [mat().slice(0,-1),mat().replace('shininess: 4','shininess: 1e999'),mat().replace('shininess: 4','texture[0]: "a.tobj"'),mat().replace('material','effect')])assert.throws(()=>material(m('mat',s)),rm);
});
test('TOBJ generic binary sampler and path evidence',()=>{
 const r=material(m('tobj',tobj()));assert.equal(r.sampler.colorSpace,'linear');assert.equal(r.sampler.minFilter,1);
 assert.equal(r.references[0].path,'/vehicle/body.dds');assert.equal(r.references[0].position,48);
});
test('TOBJ invalid magic, cube type, filters, path size and trailing bytes refused',()=>{
 for(const [o,v] of [[0,0],[24,5],[26,2],[38,2],[40,255]]){const b=tobj();b[o]=v;assert.throws(()=>material(m('tobj',b)),rm);}
 for(const p of ['../a.dds','a.tga','//host/a.dds'])assert.throws(()=>material(m('tobj',tobj(p))),rm);
 assert.throws(()=>material(m('tobj',Buffer.concat([tobj(),Buffer.alloc(1)]))),rm);
});
test('resource limits and immutable synthetic evidence enforced',()=>{
 assert.throws(()=>texture(t('jpeg',jpeg(),{maxChunks:1})),rt);
 assert.throws(()=>material(m('mat',mat(),{maxReferences:0})),rm);
 assert.throws(()=>material(m('mat',mat(),{maxLines:2})),rm);
 const r=material(m('tobj',tobj()));for(const o of [r,r.source,r.sampler,r.references,r.references[0]])assert.ok(Object.isFrozen(o));
 for(const k of ['fullMaterialSupport','dependenciesResolved','shaderExecuted','realSecurityGateVerified','realReadsPerformed','operationsEnabled'])assert.equal(r[k],false);
});
