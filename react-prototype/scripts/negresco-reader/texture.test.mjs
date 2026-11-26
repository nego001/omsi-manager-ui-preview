import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {inspectFixtureTexture as inspect} from './texture.mjs';
const limits={maxBytes:8192,maxDimension:128,maxPixels:16384,maxChunks:20,maxMipmaps:8};
const input=(format,bytes,over={})=>({scope:'synthetic-fixture',path:'vehicle/a.'+format,bytes,limits:{...limits,...over}});
const refuse=/^Error: READER_FIXTURE_TEXTURE_REFUSED$/;
function crc(b){let v=0xffffffff;for(const x of b){v^=x;for(let j=0;j<8;j++)v=v&1?(v>>>1)^0xedb88320:v>>>1;}return (v^0xffffffff)>>>0;}
function chunk(tag,data){
 const b=Buffer.alloc(12+data.length);b.writeUInt32BE(data.length);b.write(tag,4);data.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,8+data.length)),8+data.length);return b;
}
const sig=Buffer.from([137,80,78,71,13,10,26,10]);
function png(color=6,extra=[],interlace=0){
 const h=Buffer.alloc(13);h.writeUInt32BE(2);h.writeUInt32BE(3,4);h[8]=8;h[9]=color;h[12]=interlace;
 const channels=({0:1,2:3,4:2,6:4})[color]??1;
 return Buffer.concat([sig,chunk('IHDR',h),...extra,chunk('IDAT',deflateSync(Buffer.alloc(3*(1+2*channels)))),chunk('IEND',Buffer.alloc(0))]);
}
function dds(codec='DXT1',count=3){
 const block=codec==='DXT1'?8:16;const sizes=[4,1,1,1].slice(0,count).map(n=>n*block);
 const b=Buffer.alloc(128+sizes.reduce((a,c)=>a+c,0));b.write('DDS ');
 for(const [o,v] of [[4,124],[8,count>1?0xa1007:0x81007],[12,8],[16,8],[20,sizes[0]],[28,count],[76,32],[80,4],[108,count>1?0x401008:0x1000]])b.writeUInt32LE(v,o);
 b.write(codec,84);return b;
}
function bmp(topDown=false){
 const b=Buffer.alloc(78);b.write('BM');b.writeUInt32LE(b.length,2);b.writeUInt32LE(54,10);b.writeUInt32LE(40,14);
 b.writeInt32LE(3,18);b.writeInt32LE(topDown?-2:2,22);b.writeUInt16LE(1,26);b.writeUInt16LE(24,28);b.writeUInt32LE(24,34);return b;
}
test('DDS BC1 BC2 BC3 mip ranges and block sizes',()=>{
 for(const codec of ['DXT1','DXT3','DXT5']){
  const r=inspect(input('dds',dds(codec)));assert.equal(r.compression,codec);assert.equal(r.mipmapCount,3);
  const block=codec==='DXT1'?8:16;
  assert.deepEqual(r.levels.map(x=>[x.width,x.height,x.length]),[[8,8,4*block],[4,4,block],[2,2,block]]);
 }
});
test('DDS invalid header, codec, mip count, flags and trailing bytes refused',()=>{
 for(const [o,v] of [[4,123],[28,10],[80,5],[112,512],[20,1]]){const b=dds();b.writeUInt32LE(v,o);assert.throws(()=>inspect(input('dds',b)),refuse);}
 for(const b of [dds('DX10'),dds().subarray(0,-1),Buffer.concat([dds(),Buffer.alloc(1)])])assert.throws(()=>inspect(input('dds',b)),refuse);
});
test('PNG color types and CRCs validated without decoding pixels',()=>{
 for(const [color,channels] of [[0,1],[2,3],[4,2],[6,4]]){
  const r=inspect(input('png',png(color)));assert.equal(r.channels,channels);assert.equal(r.width,2);assert.equal(r.height,3);assert.equal(r.crcVerified,true);assert.equal(r.chunkCount,3);
  assert.equal(r.alphaMode,[4,6].includes(color)?'alpha-capable':'none-declared');
 }
});
test('PNG CRC, ordering, truncation and unsupported chunks refused',()=>{
 const b=png(),bad=Buffer.from(b);bad[16]^=1;
 for(const x of [bad,b.subarray(0,-1),Buffer.concat([b,Buffer.alloc(1)]),png(3),png(6,[],1),png(6,[chunk('tRNS',Buffer.alloc(2))]),png(6,[chunk('IHDR',Buffer.alloc(13))])])assert.throws(()=>inspect(input('png',x)),refuse);
});
test('PNG missing IDAT or IEND and excessive chunk count refused',()=>{
 const h=png().subarray(0,33),end=chunk('IEND',Buffer.alloc(0));
 for(const b of [Buffer.concat([h,end]),h,Buffer.concat([h,chunk('IDAT',Buffer.alloc(0)),end])])assert.throws(()=>inspect(input('png',b)),refuse);
 assert.throws(()=>inspect(input('png',png(),{maxChunks:2})),refuse);
});
test('PNG structural validation does not claim valid compressed image data',()=>{
 const b=Buffer.concat([png().subarray(0,33),chunk('IDAT',Buffer.from([255])),chunk('IEND',Buffer.alloc(0))]);
 const r=inspect(input('png',b));assert.equal(r.crcVerified,true);assert.equal(r.pixelsDecoded,false);
});
test('BMP 24-bit rows and orientation validated',()=>{
 for(const top of [true,false]){
  const r=inspect(input('bmp',bmp(top)));assert.equal(r.channels,3);
  assert.deepEqual(r.levels[0],{level:0,width:3,height:2,offset:54,length:24,rowStride:12,orientation:top?'top-down':'bottom-up'});
 }
});
test('BMP malformed sizes, compression, palette and offsets refused',()=>{
 for(const [o,v] of [[2,0],[10,55],[14,108],[30,1],[46,1],[34,10]]){const b=bmp();b.writeUInt32LE(v,o);assert.throws(()=>inspect(input('bmp',b)),refuse);}
 for(const b of [bmp().subarray(0,-1),Buffer.concat([bmp(),Buffer.alloc(1)])])assert.throws(()=>inspect(input('bmp',b)),refuse);
});
test('dimension, pixel, byte and mip limits enforced',()=>{
 for(const over of [{maxDimension:7},{maxPixels:63},{maxMipmaps:2},{maxBytes:128},{maxBytes:Infinity}])assert.throws(()=>inspect(input('dds',dds(),over)),refuse);
});
test('source, scope, unsupported formats and extra fields rejected',()=>{
 const x=input('bmp',bmp());
 for(const v of [{...x,path:'../a.bmp'},{...x,scope:'real-mod'},{...x,path:'a.tga'},{...x,extra:1}])assert.throws(()=>inspect(v),refuse);
});
test('results are immutable and never claim actual transparency or real reads',()=>{
 const x=input('dds',dds()),r=inspect(x);assert.deepEqual(r,inspect(x));
 for(const o of [r,r.source,r.levels,r.levels[0]])assert.ok(Object.isFrozen(o));
 for(const k of ['pixelsDecoded','actualTransparencyKnown','fullTextureSupport','realSecurityGateVerified','realReadsPerformed','operationsEnabled'])assert.equal(r[k],false);
 x.bytes.fill(0);assert.equal(r.width,8);
});

test('DDS magic and FourCC, BMP magic and PNG tags reject high-bit aliases',()=>{
 for(const [format,make,offsets] of [['dds',dds,[0,1,2,3,84,85,86,87]],['bmp',bmp,[0,1]]]){
  for(const o of offsets){const b=make();b[o]|=128;assert.throws(()=>inspect(input(format,b)),refuse);}
 }
 const b=png();let p=8;while(p<b.length){
  const len=b.readUInt32BE(p),end=p+8+len,a=Buffer.from(b);a[p+4]|=128;a.writeUInt32BE(crc(a.subarray(p+4,end)),end);
  assert.throws(()=>inspect(input('png',a)),refuse);p=end+4;
 }
});
