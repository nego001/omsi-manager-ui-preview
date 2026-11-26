// F3.03 — conservative ZIP subset on synthetic memory buffers only.
// No disk extraction, no real files, no nested archive recursion.
import {inflateRawSync} from 'node:zlib';
import {buildFixtureIndex} from './index.mjs';
const fail=()=>{throw Error('READER_FIXTURE_ZIP_REFUSED');};
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
const table=Uint32Array.from({length:256},(_,n)=>{
 for(let i=0;i<8;i++)n=n&1?(n>>>1)^0xedb88320:n>>>1;return n>>>0;
});
function crc32(b){let c=0xffffffff;for(const x of b)c=(c>>>8)^table[(c^x)&255];return (c^0xffffffff)>>>0;}
export function inspectFixtureZip(input){
 try{return inspect(input);}catch{fail();}
}
function inspect(input){
 const x=record(input,['scope','bytes','limits']);
 const l=record(x.limits,['maxArchiveBytes','maxEntries','maxNodes','maxDepth','maxBytes','maxEntryBytes','maxRatio']);
 if(x.scope!=='synthetic-fixture'||!Buffer.isBuffer(x.bytes)||
 !int(l.maxArchiveBytes,22,16*1024*1024)||x.bytes.length>l.maxArchiveBytes||x.bytes.length<22||
 !int(l.maxEntries,1,1024)||!int(l.maxNodes,1,4096)||!int(l.maxDepth,1,32)||
 !int(l.maxBytes,0,16*1024*1024)||!int(l.maxEntryBytes,0,l.maxBytes)||!int(l.maxRatio,1,128))fail();
 const b=Buffer.from(x.bytes),end=b.length-22;
 const u16=o=>b.readUInt16LE(o),u32=o=>b.readUInt32LE(o);
 // Exact final EOCD: no comments, trailing data, multi-disk or ZIP64.
 if(u32(end)!==0x06054b50||u16(end+4)!==0||u16(end+6)!==0||u16(end+20)!==0)fail();
 const count=u16(end+10),centralSize=u32(end+12),centralStart=u32(end+16);
 if(count!==u16(end+8)||count>l.maxEntries||centralStart> end||centralSize!==end-centralStart)fail();
 let cursor=centralStart,total=0;
 const rows=[];
 for(let i=0;i<count;i++){
  if(cursor+46>end||u32(cursor)!==0x02014b50)fail();
  const made=u16(cursor+4),needed=u16(cursor+6),flags=u16(cursor+8),method=u16(cursor+10);
  const crc=u32(cursor+16),compressed=u32(cursor+20),size=u32(cursor+24);
  const n=u16(cursor+28),extra=u16(cursor+30),comment=u16(cursor+32),disk=u16(cursor+34);
  const attrs=u32(cursor+38),offset=u32(cursor+42),os=made>>>8;
  if(![0,3].includes(os)||needed<10||needed>20||![0,0x800].includes(flags)||
   ![0,8].includes(method)||n<1||n>241||extra||comment||disk||cursor+46+n>end)fail();
  const name=b.subarray(cursor+46,cursor+46+n);
  if(name.some(c=>c<0x20||c>0x7e))fail();
  const raw=name.toString('ascii'),directory=raw.endsWith('/');
  const mode=(attrs>>>16)&0xf000,dos=attrs&0xffff;
  // Allow only regular files/directories (or unspecified mode), reject
  // symbolic links, special files and reparse/device/volume attributes.
  if(![0,0x4000,0x8000].includes(mode)||(mode===0x4000&&!directory)||(mode===0x8000&&directory)||
   (dos&~0x37)!==0||((dos&0x10)!==0&&!directory))fail();
  if(directory&&(method!==0||size!==0||compressed!==0||crc!==0))fail();
  if(size>l.maxEntryBytes||size>l.maxBytes-total||
   (method===0&&compressed!==size)||(method===8&&(compressed===0||size>compressed*l.maxRatio)))fail();
  total+=size;
  rows.push({name,path:directory?raw.slice(0,-1):raw,directory,needed,flags,method,crc,compressed,size,offset,
   time:u16(cursor+12),date:u16(cursor+14)});
  cursor+=46+n;
 }
 if(cursor!==end)fail();
 // Local records must cover the entire pre-central area exactly once;
 // reject overlap, duplicated offsets, gaps, prepended data and hidden records.
 rows.sort((a,b)=>a.offset-b.offset);
 let local=0;
 for(const r of rows){
  const o=r.offset;
  if(o!==local||o+30>centralStart||u32(o)!==0x04034b50||
   u16(o+4)!==r.needed||u16(o+6)!==r.flags||u16(o+8)!==r.method||
   u16(o+10)!==r.time||u16(o+12)!==r.date||u32(o+14)!==r.crc||
   u32(o+18)!==r.compressed||u32(o+22)!==r.size||u16(o+26)!==r.name.length||u16(o+28)!==0)fail();
  const start=o+30+r.name.length;
  if(start>centralStart||r.compressed>centralStart-start||
   !b.subarray(o+30,start).equals(r.name))fail();
  r.start=start;local=start+r.compressed;
 }
 if(local!==centralStart)fail();
 // Validate names/tree before decompressing. Zero-byte placeholders
 // are bounded by count/depth/node limits; real bytes are checked below.
 const indexLimits={maxEntries:l.maxEntries,maxNodes:l.maxNodes,maxDepth:l.maxDepth,maxBytes:l.maxBytes,maxEntryBytes:l.maxEntryBytes};
 buildFixtureIndex({scope:x.scope,limits:indexLimits,entries:rows.map(r=>({path:r.path,kind:r.directory?'directory':'file',bytes:r.directory?null:Buffer.alloc(0)}))});
 const entries=rows.map(r=>{
  const packed=b.subarray(r.start,r.start+r.compressed);
  let data;
  if(r.method===0)data=packed;
  else{
   const inflated=inflateRawSync(packed,{maxOutputLength:Math.max(1,r.size),info:true});
   if(inflated.engine.bytesWritten!==packed.length)fail();
   data=inflated.buffer;
  }
  if(data.length!==r.size||crc32(data)!==r.crc)fail();
  return {path:r.path,kind:r.directory?'directory':'file',bytes:r.directory?null:data};
 });
 const index=buildFixtureIndex({scope:x.scope,limits:indexLimits,entries});
 return Object.freeze({schemaVersion:1,scope:x.scope,format:'zip',archiveBytes:b.length,
  index,fixtureZipSubsetValidated:true,crcVerified:true,fullZipSupport:false,
  realSecurityGateVerified:false,realReadsPerformed:false,diskExtractionPerformed:false,
  operationsEnabled:false});
}
