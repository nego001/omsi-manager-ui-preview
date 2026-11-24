'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createOmsiSteamLocator,locateOmsiSteam}=require('./omsi-steam-locator.cjs');
async function fixture(t){
 const home=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-m69-'));
 t.after(()=>fs.rm(home,{recursive:true,force:true}));
 return home;
}
async function candidate(home,parts){
 const root=path.join(home,...parts,'steamapps','common','OMSI 2');
 await fs.mkdir(path.join(root,'Vehicles'),{recursive:true});
 await fs.mkdir(path.join(root,'maps'),{recursive:true});
 await fs.writeFile(path.join(root,'Omsi.exe'),'synthetic marker; do not read or execute');
 return root;
}
const normal=['.local','share','Steam'];
const flatpak=['.var','app','com.valvesoftware.Steam','data','Steam'];
test('locates standard Linux Steam candidate using only fixed lstat metadata',async t=>{
 const home=await fixture(t),root=await candidate(home,normal);
 let calls=0;
 const locate=createOmsiSteamLocator({lstat:async p=>{calls++;return fs.lstat(p);}});
 assert.equal(await locate(home),root);
 assert.ok(calls<=36);
 assert.equal(await fs.readFile(path.join(root,'Omsi.exe'),'utf8'),'synthetic marker; do not read or execute');
});
test('Flatpak Steam path works; incomplete folder and unrelated custom location do not',async t=>{
 const home=await fixture(t),root=await candidate(home,flatpak);
 await fs.mkdir(path.join(home,...normal,'steamapps','common','OMSI 2'),{recursive:true});
 await candidate(home,['unrelated']);
 assert.equal(await locateOmsiSteam(home),root);
});
test('ambiguous known locations and missing candidates return no automatic hint',async t=>{
 const home=await fixture(t);
 assert.equal(await locateOmsiSteam(home),null);
 await candidate(home,normal);await candidate(home,flatpak);
 assert.equal(await locateOmsiSteam(home),null);
});
test('symlinked known root is not followed',async t=>{
 const home=await fixture(t),other=await fixture(t);
 const root=await candidate(other,normal);
 await fs.mkdir(path.join(home,'.local','share'),{recursive:true});
 try{await fs.symlink(path.join(other,...normal),path.join(home,...normal),'junction');}
 catch(e){if(['EPERM','EACCES','ENOSYS'].includes(e.code)){t.skip('symlink unsupported');return;}throw e;}
 assert.equal(await locateOmsiSteam(home),null);
 assert.ok((await fs.lstat(root)).isDirectory());
});
test('permission denied and cancellation are not treated as a clean search',async t=>{
 const home=await fixture(t);
 const locate=createOmsiSteamLocator({lstat:async()=>{throw Object.assign(Error('private'),{code:'EACCES'});}});
 await assert.rejects(locate(home),e=>e.code==='EACCES');
 const ctl=new AbortController();ctl.abort();
 await assert.rejects(locateOmsiSteam(home,ctl.signal),/cancelada/);
});
