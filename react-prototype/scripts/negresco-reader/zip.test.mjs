import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {inspectFixtureZip as inspect} from './zip.mjs';
// Independent bit-at-a-time CRC fixture writer.
function crc32(data){let v=0xffffffff;for(const b of data){v^=b;for(let i=0;i<8;i++)v=v&1?(v>>>1)^0xedb88320:v>>>1;}return (v^0xffffffff)>>>0;}
function zip(entries){
 const local=[],central=[];let offset=0;
 for(const e of entries){
  const name=Buffer.from(e.name),data=Buffer.from(e.data??''),method=e.method??0;
  const packed=e.packed??(method===8?deflateRawSync(data):data),crc=e.crc??crc32(data),size=e.size??data.length;
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);
  h.writeUInt16LE(e.flags??0,6);h.writeUInt16LE(method,8);h.writeUInt32LE(crc,14);
  h.writeUInt32LE(packed.length,18);h.writeUInt32LE(size,22);h.writeUInt16LE(name.length,26);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(0x314,4);
  c.writeUInt16LE(20,6);c.writeUInt16LE(e.flags??0,8);c.writeUInt16LE(method,10);
  c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(size,24);c.writeUInt16LE(name.length,28);
  c.writeUInt32LE(e.attrs??(e.name.endsWith('/')?0x41ed0010:0x81a40000),38);c.writeUInt32LE(offset,42);
  local.push(h,name,packed);central.push(c,name);offset+=h.length+name.length+packed.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);
 end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,cd,end]);
}
const limits={maxArchiveBytes:65536,maxEntries:16,maxNodes:32,maxDepth:5,maxBytes:4096,maxEntryBytes:2048,maxRatio:128};
const input=(bytes,over={})=>({scope:'synthetic-fixture',bytes,limits:{...limits,...over}});
const refuse=/READER_FIXTURE_ZIP_REFUSED/;
const central=b=>b.readUInt32LE(b.length-6);
test('stored and Deflate entries are indexed with actual CRC and digest',()=>{
 const b=zip([{name:'Vehicles/'},{name:'Vehicles/a.bus',data:'abc'},{name:'Vehicles/model.cfg',data:'fixture data',method:8}]);
 const s=inspect(input(b));assert.equal(s.index.entryCount,3);assert.equal(s.index.totalBytes,15);
 assert.equal(s.index.entries.find(e=>e.path==='Vehicles/a.bus').contentDigest,createHash('sha256').update('abc').digest('hex'));
 assert.equal(s.crcVerified,true);assert.equal(s.fullZipSupport,false);assert.equal(s.diskExtractionPerformed,false);
 assert.equal(s.operationsEnabled,false);assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.index));
});
test('empty archive and empty Deflate file are supported',()=>{
 assert.equal(inspect(input(zip([]))).index.entryCount,0);
 assert.equal(inspect(input(zip([{name:'empty',method:8}]))).index.totalBytes,0);
});
test('reject incorrect CRC, damaged compressed data and output length mismatch',()=>{
 for(const e of [{name:'a',data:'abc',crc:0},{name:'a',data:'abc',method:8,packed:Buffer.from([0xff])},
 {name:'a',data:'abcdef',method:8,size:2},{name:'a',data:'abc',method:8,size:4}]){
  assert.throws(()=>inspect(input(zip([e]))),refuse);
 }
});
test('reject compressed trailing bytes even with correct uncompressed content',()=>{
 const packed=Buffer.concat([deflateRawSync(Buffer.from('abc')),Buffer.from([0,1,2])]);
 assert.throws(()=>inspect(input(zip([{name:'a',data:'abc',method:8,packed}]))),refuse);
});
test('reject forbidden types, flags, method and directory payload',()=>{
 for(const e of [{name:'a',attrs:0xa1ff0000},{name:'a',attrs:0x81a40400},{name:'a',flags:1},
 {name:'a',flags:8},{name:'a',method:99},{name:'a/',data:'x'},{name:'a',attrs:0x41ed0010}]){
  assert.throws(()=>inspect(input(zip([e]))),refuse);
 }
});
test('reject unsafe paths, collisions and directory/file conflicts before decoding',()=>{
 for(const entries of [[{name:'../a'}],[{name:'/a'}],[{name:'C:/a'}],[{name:'a\\b'}],[{name:'NUL.txt'}],
 [{name:'é'}],[{name:'A'},{name:'a'}],[{name:'a'},{name:'a/b'}],[{name:'a'},{name:'a'}]]){
  assert.throws(()=>inspect(input(zip(entries))),refuse);
 }
});
test('central and local names, CRC, flags, sizes and extra length must match',()=>{
 for(const mutate of [b=>b[30]=98,b=>b.writeUInt32LE(0,14),b=>b.writeUInt16LE(8,6),
 b=>b.writeUInt32LE(20,18),b=>b.writeUInt16LE(1,28),b=>b.writeUInt16LE(1,central(b)+30)]){
  const b=zip([{name:'a',data:'abc'}]);mutate(b);assert.throws(()=>inspect(input(b)),refuse);
 }
});
test('reject invalid central offsets, overlapping local records, gaps and hidden prefixes',()=>{
 const b=zip([{name:'a',data:'abc'},{name:'b',data:'def'}]),c=central(b);
 const duplicate=Buffer.from(b);duplicate.writeUInt32LE(0,c+47+42);
 const gap=Buffer.from(b);gap.writeUInt32LE(1,c+42);
 const badCentral=Buffer.from(b);badCentral.writeUInt32LE(c+1,b.length-6);
 for(const x of [duplicate,gap,badCentral,Buffer.concat([Buffer.from('hidden'),b]),Buffer.concat([b,Buffer.from('trailing')])]){
  assert.throws(()=>inspect(input(x)),refuse);
 }
});
test('reject multidisk, ZIP64 sentinel, central comments and truncated EOCD',()=>{
 for(const mutate of [b=>b.writeUInt16LE(1,b.length-18),b=>b.writeUInt16LE(65535,b.length-12),
 b=>b.writeUInt16LE(1,b.length-2),b=>b.writeUInt16LE(1,central(b)+32)]){
  const b=zip([{name:'a'}]);mutate(b);assert.throws(()=>inspect(input(b)),refuse);
 }
 const b=zip([{name:'a'}]);assert.throws(()=>inspect(input(b.subarray(0,-1))),refuse);
});
test('all declared resource caps checked before inflation',()=>{
 const b=zip([{name:'a/b',data:'x'.repeat(100),method:8},{name:'c',data:'abc'}]);
 for(const over of [{maxArchiveBytes:b.length-1},{maxEntries:1},{maxNodes:2},{maxDepth:1},
 {maxBytes:102,maxEntryBytes:102},{maxEntryBytes:99},{maxRatio:1}]){
  assert.throws(()=>inspect(input(b,over)),refuse);
 }
});
test('malformed input and unknown limits fail with fixed sanitized reason',()=>{
 const b=zip([]);let invoked=false;const x=input(b);
 Object.defineProperty(x,'bytes',{get(){invoked=true;return b;},enumerable:true});
 assert.throws(()=>inspect(x),refuse);assert.equal(invoked,false);
 for(const v of [{...input(b),scope:'real-mod'},input('bytes'),input(b,{maxRatio:Infinity}),{...input(b),path:'/secret'}]){
  assert.throws(()=>inspect(v),e=>e.message==='READER_FIXTURE_ZIP_REFUSED');
 }
});
