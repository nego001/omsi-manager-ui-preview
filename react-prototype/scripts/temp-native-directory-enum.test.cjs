'use strict';
// Windows only. No user/game folders, mod bytes, installer operations or IPC.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {spawnSync}=require('node:child_process');
const {join,dirname}=require('node:path');
const {tmpdir}=require('node:os');
const {randomBytes}=require('node:crypto');
const {PREFIX,MARKER}=require('./temp-recovery-fixture.cjs');
const probe=join(__dirname,'temp-native-directory-enum.ps1');
const windows=process.platform==='win32';
const roots=new Set();
async function fixture(){
 const root=await fs.mkdtemp(join(tmpdir(),PREFIX));
 roots.add(root);
 const nonce=randomBytes(16).toString('hex');
 await fs.writeFile(join(root,MARKER),nonce,{flag:'wx'});
 const dir=join(root,'native-enum');
 await fs.mkdir(dir);
 return {root,nonce,dir};
}
function run(f){
 const p=spawnSync('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',probe,'-Root',f.root,'-Nonce',f.nonce
 ],{encoding:'utf8',windowsHide:true,timeout:45000,
  env:{...process.env,POWERSHELL_TELEMETRY_OPTOUT:'1'}});
 assert.equal(p.error,undefined,String(p.error));
 return {code:p.status,stdout:p.stdout,stderr:p.stderr,
  result:p.status===0?JSON.parse(p.stdout.trim()):null};
}
function denied(p){
 assert.equal(p.code,3,JSON.stringify(p));
 assert.equal(p.stdout.trim(),'');
 assert.match(p.stderr,/Temporary native directory enumeration refused/);
}
function safe(x){
 assert.equal(x.source,'temporary-native-windows-directory-fixture');
 assert.equal(x.outcome,'observed-bounded-untrusted');
 assert.equal(x.nativeDirectoryHandleUsed,true);
 assert.equal(x.nativeDirectoryEnumerationByHandle,true);
 assert.equal(x.nativeFileIdChecked,true);
 assert.equal(x.targetIsSynthetic,true);
 assert.equal(x.completedWithinBudget,true);
 for(const key of ['nativeIdentityAuthorizedForGameFolders','guaranteesNoABA',
   'atomicPathContainmentProven','supportsRealGameInspection',
   'canRecover','canInstall','canDelete','operationsEnabled'])
  assert.equal(x[key],false,key);
 assert.equal(x.bytesReadFromMods,0);
}
test.after(async()=>{
 for(const root of roots)await fs.rm(root,{recursive:true,force:true});
});
test('native directory handle enumerates an empty synthetic folder',{skip:!windows},async()=>{
 const f=await fixture(),p=run(f);
 assert.equal(p.code,0,p.stderr);
 safe(p.result);
 assert.equal(p.result.entries,0);
});
test('real native directory enumeration counts only immediate entries',{skip:!windows},async()=>{
 const f=await fixture();
 await fs.mkdir(join(f.dir,'nested'));
 await fs.writeFile(join(f.dir,'bus.SCS'),'SENTINEL-DO-NOT-READ');
 await fs.writeFile(join(f.dir,'paint.ZIP'),'SENTINEL-DO-NOT-READ');
 await fs.writeFile(join(f.dir,'note.txt'),'SENTINEL-DO-NOT-READ');
 await fs.writeFile(join(f.dir,'pretend.scs.exe'),'SENTINEL-DO-NOT-READ');
 await fs.writeFile(join(f.dir,'nested','extra.scs'),'SENTINEL-DO-NOT-READ');
 const p=run(f);
 assert.equal(p.code,0,p.stderr);safe(p.result);
 assert.equal(p.result.entries,5);
 assert.equal(p.result.directories,1);
 assert.equal(p.result.files,4);
 assert.equal(p.result.packageCandidates,2);
 assert.equal(await fs.readFile(join(f.dir,'bus.SCS'),'utf8'),'SENTINEL-DO-NOT-READ');
 const publicData=JSON.stringify(p.result);
 for(const privateData of ['bus.SCS','paint.ZIP','note.txt',f.root,f.nonce])
  assert.equal(publicData.includes(privateData),false);
});
test('native handle processes more than one variable-length directory record',{skip:!windows},async()=>{
 const f=await fixture();
 for(let i=0;i<35;i++)await fs.writeFile(join(f.dir,'synthetic-'+i+'.zip'),'X');
 const p=run(f);
 assert.equal(p.code,0,p.stderr);safe(p.result);
 assert.equal(p.result.entries,35);
 assert.equal(p.result.packageCandidates,35);
});
test('native enumeration refuses entry budget rather than claiming partial count',{skip:!windows},async()=>{
 const f=await fixture();
 for(let i=0;i<129;i++)await fs.writeFile(join(f.dir,'entry-'+i+'.txt'),'X');
 denied(run(f));
});
test('a marker mismatch rejects native observation',{skip:!windows},async()=>{
 const f=await fixture();
 denied(run({...f,nonce:'0'.repeat(32)}));
});
test('tampering the original marker rejects observation',{skip:!windows},async()=>{
 const f=await fixture();
 await fs.writeFile(join(f.root,MARKER),'0'.repeat(32));
 denied(run(f));
});
test('arbitrary directory outside fixture direct-child scope is refused',{skip:!windows},async()=>{
 const f=await fixture();
 denied(run({...f,root:dirname(f.root)}));
});
test('missing native enumeration target is refused without creating it',{skip:!windows},async()=>{
 const f=await fixture();
 await fs.rmdir(f.dir);
 denied(run(f));
 await assert.rejects(fs.stat(f.dir),{code:'ENOENT'});
});
test('normal file impersonating the enumeration directory is refused',{skip:!windows},async()=>{
 const f=await fixture();
 await fs.rmdir(f.dir);
 await fs.writeFile(f.dir,'not a directory',{flag:'wx'});
 denied(run(f));
});
test('symlink/reparse target never becomes an enumerable directory',{skip:!windows},async(t)=>{
 const f=await fixture(),outside=join(f.root,'alternative-dir');
 await fs.mkdir(outside);
 await fs.rmdir(f.dir);
 try{await fs.symlink(outside,f.dir,'junction');}
 catch(error){if(['EPERM','EACCES','ENOTSUP','ENOSYS'].includes(error.code)){
  t.skip('runner cannot create Windows junction');return;
 }throw error;}
 denied(run(f));
});
test('symlink child is counted as skipped, without entering its target',{skip:!windows},async(t)=>{
 const f=await fixture(),other=join(f.root,'elsewhere');
 await fs.mkdir(other);
 await fs.writeFile(join(other,'secret.zip'),'KEEP-PRIVATE');
 try{await fs.symlink(other,join(f.dir,'external'),'junction');}
 catch(error){if(['EPERM','EACCES','ENOTSUP','ENOSYS'].includes(error.code)){
  t.skip('runner cannot create Windows junction');return;
 }throw error;}
 const p=run(f);assert.equal(p.code,0,p.stderr);safe(p.result);
 assert.equal(p.result.linksSkipped,1);
 assert.equal(p.result.directories,0);
 assert.equal(p.result.packageCandidates,0);
 assert.equal(p.result.entries,1);
});
test('native probe cannot alter unrelated synthetic sentinel',{skip:!windows},async()=>{
 const f=await fixture();
 const outside=join(tmpdir(),'omsi-directory-sentinel-'+randomBytes(8).toString('hex'));
 try{
  await fs.writeFile(outside,'UNCHANGED',{flag:'wx'});
  const p=run(f);
  assert.equal(p.code,0,p.stderr);safe(p.result);
  assert.equal(await fs.readFile(outside,'utf8'),'UNCHANGED');
 }finally{await fs.rm(outside,{force:true});}
});
