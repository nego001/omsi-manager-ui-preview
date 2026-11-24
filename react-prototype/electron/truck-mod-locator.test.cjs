'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {locateTruckMod,createTruckModLocator}=require('./truck-mod-locator.cjs');
async function fixture(t){
 const p=await fs.mkdtemp(path.join(os.tmpdir(),'m76-mod-location-'));
 t.after(()=>fs.rm(p,{recursive:true,force:true}));
 return fs.realpath(p);
}
test('native Linux profile locations remain separate for ETS2 and ATS',async t=>{
 const home=await fixture(t),base=path.join(home,'.local','share');
 const ets=path.join(base,'Euro Truck Simulator 2','mod'),ats=path.join(base,'American Truck Simulator','mod');
 await fs.mkdir(ets,{recursive:true});await fs.mkdir(ats,{recursive:true});
 await fs.writeFile(path.join(ets,'test.scs'),'SYNTHETIC');
 assert.equal(await locateTruckMod('ets2',{platform:'linux',home}),ets);
 assert.equal(await locateTruckMod('ats',{platform:'linux',home}),ats);
 assert.equal(await fs.readFile(path.join(ets,'test.scs'),'utf8'),'SYNTHETIC');
});
test('Windows documents path is supplied by the host, not by a hardcoded user name',async t=>{
 const documents=await fixture(t),mod=path.join(documents,'Euro Truck Simulator 2','mod');
 await fs.mkdir(mod,{recursive:true});
 assert.equal(await locateTruckMod('ets2',{platform:'win32',documents}),mod);
 assert.equal(await locateTruckMod('ats',{platform:'win32',documents}),null);
});
test('a game executable or installation without profile mod folder is not a mod location',async t=>{
 const home=await fixture(t);
 await fs.mkdir(path.join(home,'Euro Truck Simulator 2','bin'),{recursive:true});
 assert.equal(await locateTruckMod('ets2',{platform:'linux',home}),null);
});
test('linked directories are not intentionally traversed',async t=>{
 const home=await fixture(t),outside=await fixture(t);
 const base=path.join(home,'.local','share');
 await fs.mkdir(base,{recursive:true});await fs.mkdir(path.join(outside,'mod'));
 try{await fs.symlink(outside,path.join(base,'American Truck Simulator'),'junction');}
 catch(e){if(['EPERM','EACCES','ENOSYS'].includes(e.code)){t.skip('links unavailable');return;}throw e;}
 assert.equal(await locateTruckMod('ats',{platform:'linux',home}),null);
});
test('invalid game, denial and cancellation fail closed',async t=>{
 const home=await fixture(t),ctl=new AbortController();ctl.abort();
 await assert.rejects(locateTruckMod('omsi',{platform:'linux',home}),/inválido/);
 await assert.rejects(locateTruckMod('ats',{platform:'linux',home},ctl.signal),/cancelada/);
 const locate=createTruckModLocator({lstat:async()=>{throw Object.assign(Error('PRIVATE'),{code:'EACCES'});}});
 await assert.rejects(locate('ats',{platform:'linux',home}),e=>e.code==='EACCES');
});
