'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {discoverCustomOmsi,createCustomOmsiDiscovery}=require('./custom-omsi-discovery.cjs');
async function temp(t){
 const p=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-m70-'));
 t.after(()=>fs.rm(p,{recursive:true,force:true}));
 return fs.realpath(p);
}
async function game(p){
 await fs.mkdir(path.join(p,'Vehicles'),{recursive:true});
 await fs.mkdir(path.join(p,'maps'));
 await fs.writeFile(path.join(p,'Omsi.exe'),'M70_MARKER_DO_NOT_EXECUTE');
}
test('finds a renamed OMSI installation in a selected custom folder, not by its name',async t=>{
 const root=await temp(t),candidate=path.join(root,'Jogos','My Bus Game');
 await game(candidate);
 assert.deepEqual(await discoverCustomOmsi(root),{matches:[candidate],limited:false});
 assert.equal(await fs.readFile(path.join(candidate,'Omsi.exe'),'utf8'),'M70_MARKER_DO_NOT_EXECUTE');
});
test('selected game root works and two valid candidates are not collapsed',async t=>{
 const root=await temp(t),a=path.join(root,'one'),b=path.join(root,'two');
 await game(a);await game(b);
 assert.deepEqual(await discoverCustomOmsi(a),{matches:[a],limited:false});
 const r=await discoverCustomOmsi(root);
 assert.deepEqual(r.matches.sort(),[a,b].sort());assert.equal(r.limited,false);
});
test('does not search through directory links or hidden folders',async t=>{
 const root=await temp(t),outside=await temp(t);
 await game(outside);await game(path.join(root,'.private'));
 try{await fs.symlink(outside,path.join(root,'link'),'junction');}
 catch(e){if(['EPERM','EACCES','ENOSYS'].includes(e.code)){t.skip('link unavailable');return;}throw e;}
 assert.deepEqual(await discoverCustomOmsi(root),{matches:[],limited:false});
 await assert.rejects(discoverCustomOmsi(path.join(root,'link')),/INCONCLUSIVE/);
});
test('depth limit is explicit and does not silently report a complete search',async t=>{
 const root=await temp(t);
 await game(path.join(root,'a','b','c','d'));
 assert.deepEqual(await discoverCustomOmsi(root),{matches:[],limited:true});
});
test('refuses canceled search, denied metadata and unscoped filesystem root',async t=>{
 const root=await temp(t),ctl=new AbortController();ctl.abort();
 await assert.rejects(discoverCustomOmsi(root,ctl.signal),/cancelada/);
 await assert.rejects(discoverCustomOmsi(path.parse(root).root),/INCONCLUSIVE/);
 const discover=createCustomOmsiDiscovery({lstat:async()=>{throw Object.assign(Error('PRIVATE'),{code:'EACCES'});}});
 await assert.rejects(discover(root),e=>e.code==='EACCES');
});
