'use strict';
// Windows-specific native file-ID fixture tests, not bundled with Electron.
// Linux skips these intentionally; other 68 cross-platform Node tests still run.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs/promises');
const {spawnSync}=require('node:child_process');
const {join,dirname}=require('node:path');
const {tmpdir}=require('node:os');
const {randomBytes}=require('node:crypto');
const {PREFIX,MARKER}=require('./temp-recovery-fixture.cjs');
const probe=join(__dirname,'temp-native-file-id.ps1');
const windows=process.platform==='win32';
const roots=new Set();
async function fixture(contents='SYNTHETIC-BYTES'){
 const root=await fsp.mkdtemp(join(tmpdir(),PREFIX));
 roots.add(root);
 const nonce=randomBytes(16).toString('hex');
 await fsp.writeFile(join(root,MARKER),nonce,{flag:'wx',mode:0o600});
 if(contents!==null)
  await fsp.writeFile(join(root,'identity-target.bin'),contents,
   {flag:'wx',mode:0o600});
 return {root,nonce,target:join(root,'identity-target.bin')};
}
function execute(f,more=[]){
 const p=spawnSync('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',probe,'-Root',f.root,'-Nonce',f.nonce,...more
 ],{
  encoding:'utf8',timeout:45000,windowsHide:true,
  env:{...process.env,POWERSHELL_TELEMETRY_OPTOUT:'1'}
 });
 assert.equal(p.error,undefined,JSON.stringify(p.error));
 return {status:p.status,stdout:p.stdout,stderr:p.stderr,
  observation:p.status===0?JSON.parse(p.stdout.trim()):null};
}
function assertDenied(p){
 assert.equal(p.status,3,JSON.stringify(p));
 assert.match(p.stderr,/Temporary native file identity fixture refused/);
 assert.equal(p.stdout.trim(),'');
}
function assertNeverGrants(x){
 assert.equal(x.status,'observed-stable-untrusted');
 assert.equal(x.source,'temporary-windows-native-fixture');
 assert.equal(x.nativeFileIdObserved,true);
 assert.equal(x.nativeHandlesOpened,2);
 assert.equal(x.reparseHandleCheckPerformed,true);
 assert.match(x.fixtureBoundFingerprint,/^[0-9a-f]{64}$/);
 for(const flag of ['identityAuthorizedForRealMods','atomicPathIdentityProven',
  'processIdentityNativeVerified','directoryDurabilityProven',
  'canRecover','canInstall','canDelete','operationsEnabled'])
  assert.equal(x[flag],false,flag);
 assert.equal(x.filesModifiedInGames,0);
}
test.after(async()=>{for(const root of roots)
 await fsp.rm(root,{recursive:true,force:true});});
test('Windows FileIdInfo from two read-only handles is observable but untrusted',
 {skip:!windows},async()=>{
 const f=await fixture();
 const r=execute(f);
 assert.equal(r.status,0,r.stderr);
 assertNeverGrants(r.observation);
});
test('repeating the native probe for the same file retains test-only fingerprint',
 {skip:!windows},async()=>{
 const f=await fixture();
 const a=execute(f),b=execute(f);
 assert.equal(a.status,0,a.stderr);
 assert.equal(b.status,0,b.stderr);
 assert.equal(a.observation.fixtureBoundFingerprint,
  b.observation.fixtureBoundFingerprint);
 assertNeverGrants(b.observation);
});
test('content changed between probes changes native binding despite same filename',
 {skip:!windows},async()=>{
 const f=await fixture('AAAA');
 const a=execute(f);assert.equal(a.status,0,a.stderr);
 await fsp.writeFile(f.target,'BBBB');
 const b=execute(f);assert.equal(b.status,0,b.stderr);
 assert.notEqual(a.observation.fixtureBoundFingerprint,
  b.observation.fixtureBoundFingerprint);
 assertNeverGrants(b.observation);
});
test('identical fixture bytes at a different file identity cannot reuse fingerprint',
 {skip:!windows},async()=>{
 const f=await fixture('BYTE-COPY');
 const a=execute(f);assert.equal(a.status,0,a.stderr);
 const old=join(f.root,'old-target.bin');
 await fsp.rename(f.target,old);
 await fsp.writeFile(f.target,'BYTE-COPY',{flag:'wx'});
 const b=execute(f);assert.equal(b.status,0,b.stderr);
 assert.notEqual(a.observation.fixtureBoundFingerprint,
  b.observation.fixtureBoundFingerprint);
});
test('native probe refuses missing file without creating it',
 {skip:!windows},async()=>{
 const f=await fixture(null);
 assertDenied(execute(f));
 await assert.rejects(fsp.stat(f.target),{code:'ENOENT'});
});
test('native probe refuses directories and oversized or empty files',
 {skip:!windows},async()=>{
 const missing=await fixture(null);
 await fsp.mkdir(missing.target);
 assertDenied(execute(missing));
 for(const txt of ['', 'X'.repeat(4097)]){
  const f=await fixture(txt);
  assertDenied(execute(f));
 }
});
test('root not a direct child of temp folder cannot be passed to PowerShell probe',
 {skip:!windows},async()=>{
 const f=await fixture();
 assertDenied(execute({...f,root:dirname(f.root)}));
});
test('wrong marker or wrong nonce is refused before native open',
 {skip:!windows},async()=>{
 const f=await fixture();
 assertDenied(execute({...f,nonce:'f'.repeat(32)}));
 await fsp.writeFile(join(f.root,MARKER),'0'.repeat(32));
 assertDenied(execute(f));
});
test('symlink to a fixture file cannot be accepted as target',
 {skip:!windows},async(t)=>{
 const f=await fixture(null);
 const destination=join(f.root,'destination.txt');
 await fsp.writeFile(destination,'link-data');
 try{await fsp.symlink(destination,f.target,'file');}
 catch(e){
  if(['EPERM','EACCES','ENOSYS'].includes(e.code)){
   t.skip('Windows runner cannot create symbolic links');return;
  }
  throw e;
 }
 assertDenied(execute(f));
});
test('a separate temporary sentinel remains unchanged by native observation',
 {skip:!windows},async()=>{
 const f=await fixture();
 const sentinel=join(tmpdir(),'omsi-native-id-sentinel-'
  +randomBytes(8).toString('hex'));
 const contents='MUST-NOT-CHANGE:'+randomBytes(16).toString('hex');
 try{
  await fsp.writeFile(sentinel,contents,{flag:'wx'});
  const a=execute(f);
  assert.equal(a.status,0,a.stderr);
  assertNeverGrants(a.observation);
  assert.equal(await fsp.readFile(sentinel,'utf8'),contents);
  for(const privateData of [f.root,f.nonce,contents,'SYNTHETIC-BYTES']){
   assert.equal(JSON.stringify(a.observation).includes(privateData),false);
  }
 }finally{await fsp.rm(sentinel,{force:true});}
});
