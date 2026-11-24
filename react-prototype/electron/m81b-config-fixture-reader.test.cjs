'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {readSyntheticHandle:read,decodeSyntheticConfig:decode,MAX_BYTES}=require('../scripts/m81b-config-fixture-reader.cjs');
const {inspectSyntheticDependencies:inspect}=require('../scripts/m81-synthetic-dependency-contract.cjs');
async function fixture(t,bytes){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'m81b-synthetic-'));
 const file=path.join(root,'fixture.cfg');
 await fs.writeFile(file,bytes,{flag:'wx'});
 const handle=await fs.open(file,'r');
 t.after(async()=>{try{await handle.close();}finally{await fs.rm(root,{recursive:true,force:true});}});
 return {handle,file,root};
}
test('read only a test-created handle, twice, then decode and feed synthetic graph',async t=>{
 const {handle,file}=await fixture(t,Buffer.from('[model]\r\nmodel.cfg\r\n'));
 const text=decode(await read(handle),'utf-8');
 const r=inspect([{name:'test.bus',text},{name:'model.cfg',text:'[mesh]\nbody.o3d'},{name:'body.o3d',text:''}]);
 assert.equal(r.exactMatches,2);assert.equal(r.realFilesInspected,false);
 assert.equal(await fs.readFile(file,'utf8'),'[model]\r\nmodel.cfg\r\n');
});
test('explicit encoding distinguishes UTF-8, BOM and Windows-1252 fixture text',()=>{
 assert.equal(decode(Buffer.from([0xef,0xbb,0xbf,0x41]),'utf-8'),'A');
 assert.equal(decode(Buffer.from([0x4f,0x6e,0x69,0x62,0x75,0x73,0x20,0xe9]),'windows-1252'),'Onibus é');
 for(const [bytes,encoding] of [[Buffer.from([0xff]),'utf-8'],[Buffer.from([0]),'utf-8'],[Buffer.from('abc'),'auto'],[Buffer.from([0xef,0xbb,0xbf,0x41]),'windows-1252']])
  assert.throws(()=>decode(bytes,encoding),/M81B_FIXTURE_REFUSED/);
});
test('size bounds and zero-byte files refuse before reading',async t=>{
 for(const bytes of [Buffer.alloc(0),Buffer.alloc(MAX_BYTES+1)]){
  const {handle}=await fixture(t,bytes);
  await assert.rejects(read({stat:opts=>handle.stat(opts),read:()=>{throw Error('unexpected read');}}),/M81B_FIXTURE_REFUSED/);
 }
});
test('different second snapshot refuses even with unchanged mocked metadata',async t=>{
 const {handle}=await fixture(t,Buffer.from('aaaa'));
 let reads=0;
 const mock={stat:opts=>handle.stat(opts),read:async(buffer,offset,length,position)=>{
  reads++;
  const result=await handle.read(buffer,offset,length,position);
  if(reads===2)buffer[offset]=0x62;
  return result;
 }};
 await assert.rejects(read(mock),/M81B_FIXTURE_REFUSED/);assert.equal(reads,2);
});
test('metadata drift and unexpected EOF fail closed',async t=>{
 const {handle}=await fixture(t,Buffer.from('fixture'));
 let stats=0;
 const mock={stat:async opts=>{const s=await handle.stat(opts);if(++stats>1)s.mtimeNs+=1n;return s;},read:(...args)=>handle.read(...args)};
 await assert.rejects(read(mock),/M81B_FIXTURE_REFUSED/);
 await assert.rejects(read({stat:opts=>handle.stat(opts),read:async()=>({bytesRead:0})}),/M81B_FIXTURE_REFUSED/);
});
test('hard linked fixture and nonregular stat are refused',async t=>{
 const {handle,file,root}=await fixture(t,Buffer.from('fixture'));
 try{await fs.link(file,path.join(root,'alias.cfg'));}
 catch(e){if(['EPERM','EACCES','ENOTSUP','EXDEV'].includes(e.code)){t.skip('hardlinks unavailable');return;}throw e;}
 await assert.rejects(read(handle),/M81B_FIXTURE_REFUSED/);
});
