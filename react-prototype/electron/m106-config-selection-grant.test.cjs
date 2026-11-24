'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createConfigSelectionGate,MAX_AGE}=require('../scripts/m106-config-selection-grant.cjs');
const {createDocumentEpochGate}=require('./document-epoch-gate.cjs');
const {observeDependencies}=require('../scripts/m104-bounded-local-dependency-observation.cjs');
async function setup(t,overrides={}){
 const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'omsi-m106-grant-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const file=path.join(root,'Test.bus');
 await fs.writeFile(file,'[model]\nprivate.cfg\n',{flag:'wx'});
 await fs.writeFile(path.join(root,'private.cfg'),'fixture',{flag:'wx'});
 const owner={},epoch=createDocumentEpochGate(),proof=epoch.snapshot();
 const gate=createConfigSelectionGate({picker:async()=>({canceled:false,filePaths:[file]}),...overrides});
 const select=()=>gate.select(owner,epoch,proof,'vehicle-definition','utf-8');
 const inspect=ticket=>gate.inspectOnce(ticket,owner,epoch,proof);
 return {root,file,owner,epoch,proof,gate,select,inspect};
}
test('one exact selected file produces a sanitized M104 report once',async t=>{
 const f=await setup(t);const {ticket}=await f.select();
 assert.equal(Object.hasOwn(ticket,'file'),false);
 const r=await f.inspect(ticket);
 assert.equal(r.counts['exact-observed'],1);assert.equal(r.operationsEnabled,false);
 assert.doesNotMatch(JSON.stringify(r),/Test\.bus|private\.cfg/);
 await assert.rejects(f.inspect(ticket),/M106_CONFIG_GRANT_REFUSED/);
});
test('forged ticket and wrong owner refuse; wrong owner consumes original',async t=>{
 const f=await setup(t);const {ticket}=await f.select();
 await assert.rejects(f.inspect({...ticket}),/M106_CONFIG_GRANT_REFUSED/);
 await assert.rejects(f.gate.inspectOnce(ticket,{},f.epoch,f.proof),/M106_CONFIG_GRANT_REFUSED/);
 await assert.rejects(f.inspect(ticket),/M106_CONFIG_GRANT_REFUSED/);
});
test('expiry, changed file, superseded and revoked tickets refuse',async t=>{
 let n=100;const f=await setup(t,{now:()=>n});
 let {ticket}=await f.select();n+=MAX_AGE+1;
 await assert.rejects(f.inspect(ticket),/M106_CONFIG_GRANT_REFUSED/);
 ticket=(await f.select()).ticket;await fs.writeFile(f.file,'changed longer fixture');
 await assert.rejects(f.inspect(ticket),/M106_CONFIG_GRANT_REFUSED/);
 const first=(await f.select()).ticket,second=(await f.select()).ticket;
 await assert.rejects(f.inspect(first),/M106_CONFIG_GRANT_REFUSED/);
 assert.equal(f.gate.revoke(second),true);
 await assert.rejects(f.inspect(second),/M106_CONFIG_GRANT_REFUSED/);
});
test('navigation while picker or observer awaits prevents old document result',async t=>{
 let finish;
 const f=await setup(t,{picker:()=>new Promise(res=>{finish=res;})});
 const pending=f.select();f.epoch.invalidate();finish({canceled:false,filePaths:[f.file]});
 await assert.rejects(pending,/M106_CONFIG_GRANT_REFUSED/);
 let resolveObservation,started;
 const entered=new Promise(res=>{started=res;});
 const g=await setup(t,{observe:async(...args)=>{
  const r=await observeDependencies(...args);started();return new Promise(res=>{resolveObservation=()=>res(r);});
 }});
 const {ticket}=await g.select();const result=g.inspect(ticket);
 await entered;g.epoch.invalidate();resolveObservation();
 await assert.rejects(result,/M106_CONFIG_GRANT_REFUSED/);
});
test('cancelled, malformed and mismatched file choices never reach observer',async t=>{
 let choice={canceled:true,filePaths:[]},calls=0;
 const f=await setup(t,{picker:async()=>choice,observe:async()=>{calls++;}});
 assert.deepEqual(await f.select(),{status:'cancelled'});
 for(const invalid of [{canceled:false,filePaths:[]},{canceled:true,filePaths:[f.file]},
  {canceled:false,filePaths:[f.file,f.file]},{canceled:false,filePaths:['relative.bus']},
  {canceled:false,filePaths:[path.join(f.root,'private.cfg')]}]){
  choice=invalid;await assert.rejects(f.select(),/M106_CONFIG_GRANT_REFUSED/);
 }
 assert.equal(calls,0);
});
test('extra fields and forged permissions in backend reports are refused',async t=>{
 let variant='extra';
 const f=await setup(t,{observe:async(...args)=>{
  const r=await observeDependencies(...args);
  return variant==='extra'?{...r,privatePath:'/private'}:{...r,operationsEnabled:true};
 }});
 for(const mode of ['extra','flag']){
  variant=mode;const {ticket}=await f.select();
  await assert.rejects(f.inspect(ticket),/M106_CONFIG_GRANT_REFUSED/);
 }
});
test('one active picker per owner; cancellation does not issue a reusable ticket',async t=>{
 let finish;
 const f=await setup(t,{picker:()=>new Promise(res=>{finish=res;})});
 const pending=f.select();await assert.rejects(f.select(),/M106_CONFIG_GRANT_REFUSED/);
 finish({canceled:true,filePaths:[]});
 assert.deepEqual(await pending,{status:'cancelled'});
});
