'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {randomBytes}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {PREFIX,MARKER}=require('../scripts/temp-recovery-fixture.cjs');
const {CRASH_EXIT,NAMES}=require('../scripts/m90-interrupted-restore-fixture.cjs');
const worker=path.join(__dirname,'../scripts/m90-interrupted-restore-worker.cjs');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),PREFIX));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const nonce=randomBytes(16).toString('hex');
 await fs.writeFile(path.join(root,MARKER),nonce,{flag:'wx',mode:0o600});
 return {root,nonce};
}
function child(action,f,point){
 const p=spawnSync(process.execPath,[worker,action,f.root,f.nonce,...(point?[point]:[])],
  {encoding:'utf8',timeout:15000,windowsHide:true,env:{...process.env,NODE_OPTIONS:''}});
 assert.equal(p.error,undefined);return p;
}
function inspect(f){
 const p=child('inspect',f);assert.equal(p.status,0,p.stderr);
 const r=JSON.parse(p.stdout);
 for(const k of ['automaticRecoveryAttempted','oldEvidenceReusable','crossRestartTrustProven','durabilityProven','atomicRestoreProven','realFilesInspected','operationsEnabled'])assert.equal(r[k],false);
 assert.equal(r.filesModifiedInGames,0);return r;
}
test('separate processes observe all five intentional exit points',async t=>{
 const cases=[['after-target','target-only-untrusted'],['after-backup','backup-only-untrusted'],['after-intent','intent-untrusted'],['after-stage','staged-untrusted'],['after-publish','published-untrusted']];
 for(const [point,outcome] of cases){
  const f=await fixture(t);
  assert.equal(child('interrupt',f,point).status,CRASH_EXIT,point);
  const r=inspect(f);assert.equal(r.outcome,outcome);
  assert.equal(r.targetOriginal,point==='after-publish');
  assert.equal(r.targetEdited,point!=='after-publish');
 }
});
test('clean exit still yields only untrusted publication observation',async t=>{
 const f=await fixture(t);assert.equal(child('interrupt',f,'complete').status,0);
 assert.equal(inspect(f).outcome,'published-untrusted');
});
test('repeated restart inspection is read-only and does not publish staging',async t=>{
 const f=await fixture(t);assert.equal(child('interrupt',f,'after-stage').status,CRASH_EXIT);
 const before=await Promise.all(NAMES.map(n=>fs.readFile(path.join(f.root,n))));
 assert.deepEqual(inspect(f),inspect(f));
 const after=await Promise.all(NAMES.map(n=>fs.readFile(path.join(f.root,n))));
 assert.deepEqual(after,before);
 assert.equal(child('interrupt',f,'complete').status,3);
});
test('corrupt backup or altered journal produces inconsistent state',async t=>{
 for(const index of [1,2]){
  const f=await fixture(t);assert.equal(child('interrupt',f,'after-stage').status,CRASH_EXIT);
  await fs.writeFile(path.join(f.root,NAMES[index]),'tampered');
  const r=inspect(f);assert.equal(r.outcome,'inconsistent-untrusted');
  assert.equal(r.targetEdited,true);
 }
});
test('foreign session, invalid root and invalid checkpoint are refused',async t=>{
 const f=await fixture(t),other=await fixture(t);
 assert.equal(child('inspect',{...f,nonce:other.nonce}).status,3);
 assert.equal(child('interrupt',{...f,root:path.dirname(f.root)},'complete').status,3);
 assert.equal(child('interrupt',f,'unknown').status,3);
 assert.deepEqual(await fs.readdir(f.root),[MARKER]);
});
