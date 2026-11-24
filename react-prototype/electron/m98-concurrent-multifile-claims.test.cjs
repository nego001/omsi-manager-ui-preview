'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {fork}=require('node:child_process');
const {PREFIX,MARKER}=require('../scripts/temp-recovery-fixture.cjs');
const {CLAIM_NAME,inspectTemporaryClaim}=require('../scripts/temp-recovery-concurrency.cjs');
const {inspect}=require('../scripts/m97-interrupted-multifile-transaction.cjs');
const worker=path.join(__dirname,'../scripts/m98-concurrent-multifile-worker.cjs');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),PREFIX));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const nonce=randomBytes(16).toString('hex');
 await fs.writeFile(path.join(root,MARKER),nonce,{flag:'wx',mode:0o600});
 return {root,nonce};
}
function launch(f,actor,point){
 const child=fork(worker,[f.root,f.nonce,actor,String(point)],{execArgv:[],stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,env:{...process.env,NODE_OPTIONS:''}});
 let settled=false;
 let timer;
 let resolveMessage,rejectMessage;
 const message=new Promise((resolve,reject)=>{resolveMessage=resolve;rejectMessage=reject;});
 const close=new Promise(resolve=>{
  child.once('close',(code,signal)=>{
   clearTimeout(timer);
   if(!settled){settled=true;rejectMessage(Error('M98_EXIT_BEFORE_MESSAGE'));}
   resolve({code,signal});
  });
  child.once('error',e=>{if(!settled){settled=true;rejectMessage(e);}});
 });
 child.once('message',m=>{if(!settled){settled=true;resolveMessage(m);}});
 // Keep the watchdog active even after the checkpoint until the child exits.
 timer=setTimeout(()=>{if(!settled){settled=true;rejectMessage(Error('M98_TIMEOUT'));}child.kill('SIGKILL');},15000);
 return {child,actor,message,close};
}
async function dispose(workers){
 for(const w of workers)if(w.child.exitCode===null&&w.child.signalCode===null)w.child.kill('SIGKILL');
 await Promise.all(workers.map(w=>w.close));
}
async function snapshot(f){
 const entries=(await fs.readdir(f.root)).sort();
 return Promise.all(entries.map(async n=>[n,(await fs.readFile(path.join(f.root,n))).toString('hex')]));
}
async function assertBusy(w){
 assert.deepEqual(await w.message,{kind:'m98-busy'});
 assert.deepEqual(await w.close,{code:0,signal:null});
}
test('two concurrent cooperating processes produce one reservation winner and one refusal',async t=>{
 const f=await fixture(t),workers=[launch(f,'session-a',1),launch(f,'session-b',1)];
 try{
  const messages=await Promise.all(workers.map(w=>w.message));
  const index=messages.findIndex(m=>m.kind==='m97-checkpoint');
  assert.ok(index>=0);assert.equal(messages.filter(m=>m.kind==='m97-checkpoint').length,1);
  assert.deepEqual(messages[index],{kind:'m97-checkpoint',published:1});
  await assertBusy(workers[1-index]);
  const record=JSON.parse(await fs.readFile(path.join(f.root,CLAIM_NAME),'utf8'));
  assert.equal(record.actor,workers[index].actor);
  const report=await inspect(f.root,f.nonce);
  assert.equal(report.outcome,'partial-untrusted');assert.equal(report.originalCount,1);
  assert.equal(report.backupsIntact,true);assert.equal(report.operationsEnabled,false);
  // A new contender while the owner is paused must leave every byte unchanged.
  const before=await snapshot(f),third=launch(f,workers[1-index].actor,3);
  workers.push(third);await assertBusy(third);assert.deepEqual(await snapshot(f),before);
  assert.equal(workers[index].child.kill('SIGKILL'),true);
  assert.deepEqual(await workers[index].close,{code:null,signal:'SIGKILL'});
  const retained=await snapshot(f);
  const retry=launch(f,workers[1-index].actor,3);workers.push(retry);
  await assertBusy(retry);assert.deepEqual(await snapshot(f),retained);
  assert.equal((await inspectTemporaryClaim(f.root,f.nonce)).status,'present-untrusted');
 }finally{await dispose(workers);}
});
test('even malformed preexisting reservation blocks every contender without modification',async t=>{
 const f=await fixture(t);
 await fs.writeFile(path.join(f.root,CLAIM_NAME),'corrupt',{flag:'wx'});
 const before=await snapshot(f),workers=[launch(f,'session-a',2),launch(f,'session-b',3)];
 try{
  await Promise.all(workers.map(assertBusy));
  assert.deepEqual(await snapshot(f),before);
  const status=await inspectTemporaryClaim(f.root,f.nonce);
  assert.equal(status.status,'corrupt-untrusted');assert.equal(status.claimIsNativeLock,false);
 }finally{await dispose(workers);}
});
test('independent roots do not unnecessarily serialize cooperating processes',async t=>{
 const a=await fixture(t),b=await fixture(t),workers=[launch(a,'session-a',0),launch(b,'session-b',2)];
 try{
  assert.deepEqual(await Promise.all(workers.map(w=>w.message)),[{kind:'m97-checkpoint',published:0},{kind:'m97-checkpoint',published:2}]);
  assert.equal((await inspect(a.root,a.nonce)).originalCount,0);
  assert.equal((await inspect(b.root,b.nonce)).originalCount,2);
 }finally{await dispose(workers);}
});
