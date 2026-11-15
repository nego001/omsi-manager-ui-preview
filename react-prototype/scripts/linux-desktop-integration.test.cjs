'use strict';
// All XDG mutations live in randomly named test directories under os.tmpdir().
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {spawnSync}=require('node:child_process');
const {
 NAME,MARKER,makeEntry,install,remove,launcherIn
}=require('./linux-desktop-integration.cjs');

const roots=new Set();
test.after(async()=>{
 for(const root of roots)await fs.rm(root,{recursive:true,force:true});
});
async function fixture(){
 const root=await fs.mkdtemp(join(tmpdir(),'omsi-xdg-desktop-fixture-'));
 roots.add(root);
 const packageDir=join(root,'OMSI preview with spaces');
 await fs.mkdir(packageDir);
 await fs.writeFile(join(packageDir,'OMSI-Manager-Preview.sh'),
  '#!/bin/sh\nexit 0\n',{mode:0o755});
 await fs.chmod(join(packageDir,'OMSI-Manager-Preview.sh'),0o755);
 // Tiny synthetic ELF header: helper only checks type, not execution.
 await fs.writeFile(join(packageDir,'OMSI-Manager-Auto'),
  Buffer.from([0x7f,0x45,0x4c,0x46]),{mode:0o755});
 await fs.chmod(join(packageDir,'OMSI-Manager-Auto'),0o755);
 const env={HOME:root,XDG_DATA_HOME:join(root,'test-xdg-data')};
 const target=join(env.XDG_DATA_HOME,'applications',NAME);
 return {root,packageDir,env,target};
}
test('opt-in only: no shortcut is written before explicit install',async()=>{
 const f=await fixture();
 await assert.rejects(fs.stat(f.target),{code:'ENOENT'});
 const result=await install(f);
 assert.equal(result.result,'installed');
 const entry=await fs.readFile(f.target,'utf8');
 assert.equal(entry,makeEntry(join(f.packageDir,'OMSI-Manager-Auto')));
 assert.ok(entry.includes(MARKER));
 assert.match(entry,/^Exec=".*OMSI preview with spaces.*"$/m);
 assert.match(entry,/Terminal=false/);
 assert.doesNotMatch(entry,/--no-sandbox|sudo|pkexec|autostart|\.service/);
 assert.equal((await fs.stat(f.target)).mode&0o777,0o600);
});
test('install is idempotent and remove is explicit and reversible',async()=>{
 const f=await fixture();
 assert.equal((await remove(f)).result,'not-installed');
 assert.equal((await install(f)).result,'installed');
 assert.equal((await install(f)).result,'already-installed');
 assert.equal((await remove(f)).result,'removed');
 assert.equal((await remove(f)).result,'not-installed');
 await assert.rejects(fs.stat(f.target),{code:'ENOENT'});
 assert.equal((await install(f)).result,'installed');
});
test('refuses to overwrite a preexisting unrelated XDG application entry',async()=>{
 const f=await fixture();
 await fs.mkdir(join(f.env.XDG_DATA_HOME,'applications'),{recursive:true});
 await fs.writeFile(f.target,'[Desktop Entry]\nName=An unrelated application\n');
 await assert.rejects(install(f),/Linux desktop integration refused/);
 assert.equal(await fs.readFile(f.target,'utf8'),
  '[Desktop Entry]\nName=An unrelated application\n');
 await assert.rejects(remove(f),/Linux desktop integration refused/);
});
test('refuses a symlinked desktop entry rather than following the target',async(t)=>{
 const f=await fixture();
 await fs.mkdir(join(f.env.XDG_DATA_HOME,'applications'),{recursive:true});
 const external=join(f.root,'independent-sentinel');
 await fs.writeFile(external,'DO NOT TOUCH');
 try{await fs.symlink(external,f.target);}
 catch(e){if(['EPERM','ENOSYS','EACCES'].includes(e.code)){t.skip();return;}throw e;}
 await assert.rejects(install(f),/Linux desktop integration refused/);
 await assert.rejects(remove(f),/Linux desktop integration refused/);
 assert.equal(await fs.readFile(external,'utf8'),'DO NOT TOUCH');
});
test('refuses symlinked applications directory',async(t)=>{
 const f=await fixture();
 const other=join(f.root,'other-applications');
 await fs.mkdir(other);
 await fs.mkdir(f.env.XDG_DATA_HOME,{recursive:true});
 try{await fs.symlink(other,join(f.env.XDG_DATA_HOME,'applications'),'dir');}
 catch(e){if(['EPERM','ENOSYS','EACCES'].includes(e.code)){t.skip();return;}throw e;}
 await assert.rejects(install(f),/Linux desktop integration refused/);
 assert.deepEqual(await fs.readdir(other),[]);
});
test('rejects a relocated launcher symlink and invalid injected path characters',async(t)=>{
 const f=await fixture();
 const launcher=join(f.packageDir,'OMSI-Manager-Auto');
 await fs.rename(launcher,join(f.root,'safe-real-launcher'));
 try{await fs.symlink(join(f.root,'safe-real-launcher'),launcher);}
 catch(e){if(['EPERM','ENOSYS','EACCES'].includes(e.code)){t.skip();return;}throw e;}
 await assert.rejects(install(f),/Linux desktop integration refused/);
 for(const bad of ['bad\nname','bad"quote','bad\\backslash','bad%field','bad$env']){
  assert.throws(()=>launcherIn(join(f.root,bad)),
   /Linux desktop integration refused/);
 }
});
test('preexisting legacy script shortcut requires explicit remove before installing ELF shortcut',async()=>{
 const f=await fixture();
 await fs.mkdir(join(f.env.XDG_DATA_HOME,'applications'),{recursive:true});
 const old=makeEntry(join(f.packageDir,'OMSI-Manager-Preview.sh'));
 await fs.writeFile(f.target,old,{mode:0o600});
 await assert.rejects(install(f),/Linux desktop integration refused/);
 assert.equal(await fs.readFile(f.target,'utf8'),old);
 assert.equal((await remove(f)).result,'removed');
 assert.equal((await install(f)).result,'installed');
 const updated=await fs.readFile(f.target,'utf8');
 assert.equal(updated,makeEntry(join(f.packageDir,'OMSI-Manager-Auto')));
 assert.notEqual(updated,old);
});
test('legacy shortcut from another portable directory is not removed',async()=>{
 const f=await fixture();
 await fs.mkdir(join(f.env.XDG_DATA_HOME,'applications'),{recursive:true});
 const old=makeEntry(join(f.root,'unrelated','OMSI-Manager-Preview.sh'));
 await fs.writeFile(f.target,old);
 await assert.rejects(remove(f),/Linux desktop integration refused/);
 await assert.rejects(install(f),/Linux desktop integration refused/);
 assert.equal(await fs.readFile(f.target,'utf8'),old);
});
test('refuses a shell script in place of the expected native ELF launcher',async()=>{
 const f=await fixture();
 await fs.writeFile(join(f.packageDir,'OMSI-Manager-Auto'),'#!/bin/sh\nexit 0\n',{mode:0o755});
 await assert.rejects(install(f),/Linux desktop integration refused/);
 await assert.rejects(fs.stat(f.target),{code:'ENOENT'});
});
test('standalone helper accepts install/remove only, no arbitrary actions',async()=>{
 const f=await fixture();
 const helper=join(f.packageDir,'OMSI-Manager-Desktop-Integration.cjs');
 await fs.copyFile(join(__dirname,'linux-desktop-integration.cjs'),helper);
 const env={...process.env,...f.env};
 const invoke=(...args)=>spawnSync(process.execPath,[helper,...args],{
  encoding:'utf8',env,timeout:10000
 });
 for(const cmd of [[],['--help'],['install','other'],['write','/tmp/target']]){
  const result=invoke(...cmd);
  assert.equal(result.status,3);
  assert.equal(result.stderr.trim(),'Linux desktop integration refused');
 }
 assert.equal(invoke('install').status,0);
 assert.equal(invoke('remove').status,0);
});
