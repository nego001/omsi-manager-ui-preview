'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createConfigMetadataPrecheck,precheckConfigMetadata:precheck}=require('./omsi-config-selection.cjs');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'omsi-m108-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const file=path.join(root,'Private.bus');await fs.writeFile(file,'fixture',{flag:'wx'});return {root,file};
}
const pick=file=>async()=>({canceled:false,filePaths:[file]});
test('native-selected fixture returns metadata only with no content API calls',async t=>{
 const {file}=await fixture(t);
 const api={lstat:fs.lstat,realpath:fs.realpath,open:()=>assert.fail('content open'),readFile:()=>assert.fail('content read')};
 const r=await createConfigMetadataPrecheck(api)(pick(file),()=>true);
 assert.deepEqual(r,{status:'config-metadata-observed',scope:'selected-file-metadata-only',candidateKind:'bus-candidate',byteCount:7,contentOpened:false,dependencyScanPerformed:false,nativeIdentityVerified:false,compatibilityVerified:false,operationsEnabled:false});
 assert.doesNotMatch(JSON.stringify(r),/Private\.bus/);
});
test('picker cancellation, malformed selection and unauthorized origin refuse',async t=>{
 const {file}=await fixture(t);
 assert.deepEqual(await precheck(async()=>({canceled:true,filePaths:[]}),()=>true),{status:'cancelled'});
 for(const response of [{canceled:false,filePaths:[]},{canceled:false,filePaths:[file,file]},{canceled:false,filePaths:['relative.cfg']}])
  assert.equal((await precheck(async()=>response,()=>true)).status,'error');
 assert.equal((await precheck(()=>assert.fail('picker opened'),()=>false)).status,'error');
});
test('epoch invalidation during picker or metadata observation suppresses result',async t=>{
 const {file}=await fixture(t);const c=new AbortController();
 assert.equal((await precheck(async()=>{c.abort();return {canceled:false,filePaths:[file]};},()=>true,c.signal)).status,'error');
 const d=new AbortController(),api={...fs,lstat:async(...args)=>{const s=await fs.lstat(...args);d.abort();return s;}};
 assert.equal((await createConfigMetadataPrecheck(api)(pick(file),()=>true,d.signal)).status,'error');
});
test('empty, oversized, wrong suffix and linked fixtures refuse',async t=>{
 const {root}=await fixture(t);
 for(const [name,bytes] of [['empty.cfg',Buffer.alloc(0)],['big.cfg',Buffer.alloc(65537)],['other.o3d',Buffer.from('x')]]){
  const f=path.join(root,name);await fs.writeFile(f,bytes);assert.equal((await precheck(pick(f),()=>true)).status,'error');
 }
});
