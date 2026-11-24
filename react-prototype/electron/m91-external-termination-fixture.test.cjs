'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {randomBytes}=require('node:crypto');
const {fork,spawnSync}=require('node:child_process');
const {PREFIX,MARKER}=require('../scripts/temp-recovery-fixture.cjs');
const {NAMES}=require('../scripts/m90-interrupted-restore-fixture.cjs');
const worker=path.join(__dirname,'../scripts/m91-external-termination-worker.cjs');
const inspector=path.join(__dirname,'../scripts/m90-interrupted-restore-worker.cjs');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),PREFIX));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const nonce=randomBytes(16).toString('hex');
 await fs.writeFile(path.join(root,MARKER),nonce,{flag:'wx',mode:0o600});
 return {root,nonce};
}
function terminateAt(f,point){
 return new Promise((resolve,reject)=>{
  const child=fork(worker,[f.root,f.nonce,point],{execArgv:[],stdio:['ignore','ignore','ignore','ipc'],
   windowsHide:true,env:{...process.env,NODE_OPTIONS:''}});
  let reached=false,killRequested=false,failure=null;
  const timer=setTimeout(()=>{
   failure=Error('M91_CHECKPOINT_TIMEOUT');
   child.kill('SIGKILL');
  },15000);
  child.on('message',msg=>{
   if(reached||!msg||msg.kind!=='fixture-checkpoint'||msg.stage!==point){
    failure=Error('M91_UNEXPECTED_CHECKPOINT');child.kill('SIGKILL');return;
   }
   reached=true;killRequested=child.kill('SIGKILL');
   if(!killRequested)failure=Error('M91_KILL_REFUSED');
  });
  child.once('error',err=>{failure=err;clearTimeout(timer);child.kill('SIGKILL');reject(err);});
  child.once('close',(code,signal)=>{
   clearTimeout(timer);
   if(failure)return reject(failure);
   try{
    assert.equal(reached,true);assert.equal(killRequested,true);
    assert.equal(code,null);assert.equal(signal,'SIGKILL');
    resolve();
   }catch(err){reject(err);}
  });
 });
}
function inspect(f){
 const p=spawnSync(process.execPath,[inspector,'inspect',f.root,f.nonce],
  {encoding:'utf8',timeout:15000,windowsHide:true,env:{...process.env,NODE_OPTIONS:''}});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);
 const r=JSON.parse(p.stdout);
 for(const k of ['automaticRecoveryAttempted','oldEvidenceReusable','crossRestartTrustProven','durabilityProven','atomicRestoreProven','realFilesInspected','operationsEnabled'])assert.equal(r[k],false);
 assert.equal(r.filesModifiedInGames,0);return r;
}
test('parent terminates its owned child after each synced checkpoint; fresh process observes state',async t=>{
 for(const [point,outcome] of [['after-target','target-only-untrusted'],['after-backup','backup-only-untrusted'],['after-intent','intent-untrusted'],['after-stage','staged-untrusted'],['after-publish','published-untrusted']]){
  const f=await fixture(t);
  await terminateAt(f,point);
  const r=inspect(f);
  assert.equal(r.outcome,outcome,point);
  assert.equal(r.targetOriginal,point==='after-publish');
  assert.equal(r.targetEdited,point!=='after-publish');
 }
});
test('external termination after staging does not publish on repeated restart',async t=>{
 const f=await fixture(t);
 await terminateAt(f,'after-stage');
 const before=await Promise.all(NAMES.map(n=>fs.readFile(path.join(f.root,n))));
 assert.deepEqual(inspect(f),inspect(f));
 assert.deepEqual(await Promise.all(NAMES.map(n=>fs.readFile(path.join(f.root,n)))),before);
});
test('external worker without owned IPC channel refuses before writing',async t=>{
 const f=await fixture(t);
 const p=spawnSync(process.execPath,[worker,f.root,f.nonce,'after-stage'],{encoding:'utf8',timeout:15000,windowsHide:true,env:{...process.env,NODE_OPTIONS:''}});
 assert.equal(p.error,undefined);assert.equal(p.status,3);
 assert.deepEqual(await fs.readdir(f.root),[MARKER]);
});
test('unrelated sentinel outside fixture remains unchanged',async t=>{
 const f=await fixture(t);
 const separate=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-m91-sentinel-'));
 t.after(()=>fs.rm(separate,{recursive:true,force:true}));
 const sentinel=path.join(separate,'sentinel.txt'),bytes=Buffer.from('DO NOT MODIFY');
 await fs.writeFile(sentinel,bytes,{flag:'wx'});
 await terminateAt(f,'after-publish');
 assert.equal(inspect(f).outcome,'published-untrusted');
 assert.deepEqual(await fs.readFile(sentinel),bytes);
});
