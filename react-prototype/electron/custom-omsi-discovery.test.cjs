'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {discoverCustomOmsi,createCustomOmsiDiscovery,discoverCustomGame}=require('./custom-omsi-discovery.cjs');
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

async function truck(p,name,platform){
 const bin=path.join(p,'bin',platform==='linux'?'linux_x64':'win_x64');
 await fs.mkdir(bin,{recursive:true});
 await fs.writeFile(path.join(bin,name+(platform==='linux'?'':'.exe')),'SYNTHETIC_TRUCK_MARKER');
}
test('custom discovery differentiates ETS2 and ATS Linux and Windows executable markers',async t=>{
 const root=await temp(t),ets=path.join(root,'renamed-ets'),ats=path.join(root,'renamed-ats');
 await truck(ets,'eurotrucks2','linux');await truck(ats,'amtrucks','win');
 assert.deepEqual(await discoverCustomGame(root,'ets2'),{matches:[ets],limited:true});
 assert.deepEqual(await discoverCustomGame(root,'ats'),{matches:[ats],limited:true});
 assert.equal(await fs.readFile(path.join(ats,'bin','win_x64','amtrucks.exe'),'utf8'),'SYNTHETIC_TRUCK_MARKER');
});
test('a mod directory and wrong executable name do not establish an installation candidate',async t=>{
 const root=await temp(t);
 await fs.mkdir(path.join(root,'ETS2','mod'),{recursive:true});
 await fs.writeFile(path.join(root,'ETS2','mod','test.scs'),'SYNTHETIC_ONLY');
 await truck(path.join(root,'Wrong'),'unknown','linux');
 const r=await discoverCustomGame(root,'ets2');
 assert.deepEqual(r.matches,[]);
 // Depth may make coverage partial even though no candidate was returned.
 assert.equal(typeof r.limited,'boolean');
});
test('truck executable symlink is never accepted as a regular game marker',async t=>{
 const root=await temp(t),outside=await temp(t),p=path.join(root,'Game','bin','linux_x64');
 await fs.mkdir(p,{recursive:true});
 const target=path.join(outside,'private-synthetic');
 await fs.writeFile(target,'UNCHANGED');
 try{await fs.symlink(target,path.join(p,'amtrucks'),'file');}
 catch(e){if(['EPERM','EACCES','ENOSYS'].includes(e.code)){t.skip('symlink unavailable');return;}throw e;}
 assert.deepEqual((await discoverCustomGame(root,'ats')).matches,[]);
 assert.equal(await fs.readFile(target,'utf8'),'UNCHANGED');
});
test('wrong game ID and pre-aborted custom truck discovery fail closed',async t=>{
 const root=await temp(t),ctl=new AbortController();ctl.abort();
 await assert.rejects(discoverCustomGame(root,'invalid'),/Jogo inválido/);
 await assert.rejects(discoverCustomGame(root,'ats',ctl.signal),/cancelada/);
});
