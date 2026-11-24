'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {fork,spawnSync}=require('node:child_process');
const {PREFIX,MARKER}=require('../scripts/temp-recovery-fixture.cjs');
const worker=path.join(__dirname,'../scripts/m97-interrupted-multifile-worker.cjs');
const env={...process.env,NODE_OPTIONS:''};
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),PREFIX));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const nonce=randomBytes(16).toString('hex');
 await fs.writeFile(path.join(root,MARKER),nonce,{flag:'wx',mode:0o600});
 return {root,nonce};
}
function killAt(f,n){
 return new Promise((resolve,reject)=>{
  const child=fork(worker,['publish',f.root,f.nonce,String(n)],{execArgv:[],stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,env});
  let reached=false,requested=false,error=null;
  const timeout=setTimeout(()=>{error=Error('M97_TIMEOUT');child.kill('SIGKILL');},15000);
  child.on('message',m=>{
   if(reached||m?.kind!=='m97-checkpoint'||m.published!==n){error=Error('M97_CHECKPOINT_MISMATCH');child.kill('SIGKILL');return;}
   reached=true;requested=child.kill('SIGKILL');
   if(!requested)error=Error('M97_KILL_REFUSED');
  });
  child.once('error',e=>{error=e;clearTimeout(timeout);child.kill('SIGKILL');reject(e);});
  child.once('close',(code,signal)=>{
   clearTimeout(timeout);
   if(error)return reject(error);
   try{assert.equal(reached,true);assert.equal(requested,true);assert.equal(code,null);assert.equal(signal,'SIGKILL');resolve();}
   catch(e){reject(e);}
  });
 });
}
function inspect(f){
 const p=spawnSync(process.execPath,[worker,'inspect',f.root,f.nonce],{encoding:'utf8',timeout:15000,windowsHide:true,env});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);
 const r=JSON.parse(p.stdout);
 for(const k of ['automaticRecoveryAttempted','automaticReplayAllowed','oldEvidenceReusable','groupAtomicityProven','durabilityProven','realFilesInspected','operationsEnabled'])assert.equal(r[k],false);
 assert.equal(r.filesModifiedInGames,0);return r;
}
test('external termination before publication and after each of three renames',async t=>{
 for(let n=0;n<=3;n++){
  const f=await fixture(t);await killAt(f,n);
  const r=inspect(f);
  assert.equal(r.originalCount,n);
  assert.equal(r.outcome,n===0?'prepared-untrusted':n===3?'published-untrusted':'partial-untrusted');
  assert.ok(r.prefixConsistent&&r.backupsIntact&&r.stagesConsistent);
 }
});
test('repeat restart observation does not change files or publish remaining stages',async t=>{
 const f=await fixture(t);await killAt(f,1);
 const files=(await fs.readdir(f.root)).sort();
 const before=await Promise.all(files.map(n=>fs.readFile(path.join(f.root,n))));
 assert.deepEqual(inspect(f),inspect(f));
 assert.deepEqual((await fs.readdir(f.root)).sort(),files);
 assert.deepEqual(await Promise.all(files.map(n=>fs.readFile(path.join(f.root,n)))),before);
});
test('corruption and out-of-order target state are inconsistent',async t=>{
 const f=await fixture(t);await killAt(f,1);
 await fs.writeFile(path.join(f.root,'m97-sound.backup'),'tampered');
 assert.equal(inspect(f).outcome,'inconsistent-untrusted');
 const g=await fixture(t);await killAt(g,0);
 await fs.rename(path.join(g.root,'m97-sound.stage'),path.join(g.root,'m97-sound.target'));
 const r=inspect(g);
 assert.equal(r.originalCount,1);assert.equal(r.prefixConsistent,false);assert.equal(r.outcome,'inconsistent-untrusted');
});
test('worker without IPC and foreign nonce refuse; unrelated sentinel unchanged',async t=>{
 const f=await fixture(t);
 const p=spawnSync(process.execPath,[worker,'publish',f.root,f.nonce,'1'],{encoding:'utf8',timeout:15000,windowsHide:true,env});
 assert.equal(p.error,undefined);assert.equal(p.status,3);assert.deepEqual(await fs.readdir(f.root),[MARKER]);
 const separate=await fs.mkdtemp(path.join(os.tmpdir(),'omsi-m97-sentinel-'));
 t.after(()=>fs.rm(separate,{recursive:true,force:true}));
 const sentinel=path.join(separate,'untouched'),bytes=Buffer.from('DO NOT MODIFY');
 await fs.writeFile(sentinel,bytes,{flag:'wx'});
 await killAt(f,2);
 const wrong=(f.nonce[0]==='0'?'1':'0')+f.nonce.slice(1);
 const q=spawnSync(process.execPath,[worker,'inspect',f.root,wrong],{encoding:'utf8',timeout:15000,windowsHide:true,env});
 assert.equal(q.error,undefined);assert.equal(q.status,3);
 assert.deepEqual(await fs.readFile(sentinel),bytes);
});
