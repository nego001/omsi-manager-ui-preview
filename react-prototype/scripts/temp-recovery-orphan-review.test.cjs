'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs/promises');
const {spawn,spawnSync}=require('node:child_process');
const {once}=require('node:events');
const {randomBytes}=require('node:crypto');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {PREFIX,MARKER}=require('./temp-recovery-fixture.cjs');
const {CLAIM_NAME,claimTemporaryFixture}=
 require('./temp-recovery-concurrency.cjs');
const {createTemporaryOrphanReview,inspectTemporaryOrphanReview,
 validateHint,classifyHint}=require('./temp-recovery-orphan-review.cjs');
const worker=join(__dirname,'temp-recovery-concurrency-worker.cjs');
const reopened=join(__dirname,'temp-recovery-orphan-review-worker.cjs');
const roots=new Set();
async function fixture(){
 const root=await fsp.mkdtemp(join(tmpdir(),PREFIX));
 roots.add(root);
 const nonce=randomBytes(16).toString('hex');
 await fsp.writeFile(join(root,MARKER),nonce,{flag:'wx',mode:0o600});
 return {root,nonce};
}
const tagA='a'.repeat(32),tagB='b'.repeat(32);
function hint(overrides={}){
 return {claimedPid:1234,observedPid:1234,
  claimedStartTag:tagA,observedStartTag:tagA,
  processObserved:true,...overrides};
}
async function read(f,report=hint()){
 const review=await createTemporaryOrphanReview(f.root,f.nonce);
 return inspectTemporaryOrphanReview(review,report);
}
function otherProcess(f,processHint){
 const args=[reopened,f.root,f.nonce,...(processHint?[JSON.stringify(processHint)]:[])];
 const p=spawnSync(process.execPath,args,{
  encoding:'utf8',timeout:10000,windowsHide:true,
  env:{...process.env,NODE_OPTIONS:''}
 });
 assert.equal(p.error,undefined,String(p.error));
 return {status:p.status,output:p.status===0?JSON.parse(p.stdout):null,stderr:p.stderr};
}
async function holder(f){
 const child=spawn(process.execPath,[worker,'hold',f.root,f.nonce,'session-a'],{
  stdio:['ignore','pipe','pipe'],windowsHide:true,
  env:{...process.env,NODE_OPTIONS:''}
 });
 try{
  const result=await new Promise((resolve,reject)=>{
   let data='',settled=false;
   const timer=setTimeout(()=>finish(Error('Holder timed out')),10000);
   function finish(v){
    if(settled)return;settled=true;clearTimeout(timer);
    child.stdout.off('data',onData);child.off('error',onError);child.off('exit',onExit);
    if(v instanceof Error)reject(v);else resolve(v);
   }
   function onData(chunk){
    data+=chunk;
    const nl=data.indexOf('\n');
    if(nl!==-1){try{finish(JSON.parse(data.slice(0,nl)));}
      catch(e){finish(e);}}
   }
   function onError(e){finish(e);}
   function onExit(code){finish(Error('Holder exited early '+code));}
   child.stdout.on('data',onData);child.on('error',onError);child.on('exit',onExit);
  });
  assert.equal(result.status,'claimed');
  return child;
 }catch(error){child.kill('SIGKILL');throw error;}
}
async function kill(child){
 if(child.exitCode!==null||child.signalCode!==null)return;
 const ended=once(child,'exit');
 assert.equal(child.kill('SIGKILL'),true);
 await ended;
}
test.after(async()=>{for(const root of roots)
 await fsp.rm(root,{force:true,recursive:true});});
test('orphan review has no cleanup or grant method, and rejects copied handle',async()=>{
 const f=await fixture();
 await claimTemporaryFixture(f.root,f.nonce,'session-a');
 const review=await createTemporaryOrphanReview(f.root,f.nonce);
 assert.deepEqual(Object.keys(review),['scope','operationsEnabled']);
 assert.equal(Object.isFrozen(review),true);
 const x=await inspectTemporaryOrphanReview(review,hint());
 assert.equal(x.decision,'manual-review-only');
 assert.equal(x.automaticCleanupAllowed,false);
 assert.equal(x.deleteOrRenameAllowed,false);
 assert.equal(x.operationsEnabled,false);
 await assert.rejects(inspectTemporaryOrphanReview({...review},hint()),/not issued/);
});
test('missing claim does not permit a replacement session or cleanup',async()=>{
 const f=await fixture(),x=await read(f);
 assert.equal(x.decision,'no-claim');
 assert.equal(x.claimUnchanged,true);
 assert.equal(x.reclaimClaimAllowed,false);
});
test('fresh process sees killed owner claim but cannot trust dead-owner hint',async()=>{
 const f=await fixture(),child=await holder(f);
 await kill(child);
 const report=otherProcess(f,hint({processObserved:false}));
 assert.equal(report.status,0,report.stderr);
 assert.equal(report.output.decision,'manual-review-only');
 assert.equal(report.output.processHintStatus,'reported-not-running');
 assert.equal(report.output.processLivenessNativeVerified,false);
 assert.equal(report.output.reclaimClaimAllowed,false);
 assert.equal((await fsp.readFile(join(f.root,CLAIM_NAME),'utf8')).length>0,true);
});
test('owner still alive and matching PID/start hints cannot grant recovery',async()=>{
 const f=await fixture(),child=await holder(f);
 try{
  const x=otherProcess(f,hint({claimedPid:child.pid,observedPid:child.pid}));
  assert.equal(x.status,0,x.stderr);
  assert.equal(x.output.processHintStatus,'same-incarnation-claimed');
  assert.equal(x.output.processIdentityNativeVerified,false);
  assert.equal(x.output.renewClaimAllowed,false);
  assert.equal(x.output.operationsEnabled,false);
 }finally{await kill(child);}
});
test('PID reused with distinct start tag remains blocked',async()=>{
 const f=await fixture();
 await claimTemporaryFixture(f.root,f.nonce,'session-a');
 const x=await read(f,hint({observedStartTag:tagB}));
 assert.equal(x.processHintStatus,'pid-reuse-suspected');
 assert.equal(x.reusedPidCanAuthorize,false);
 assert.equal(x.decision,'manual-review-only');
});
test('different PID hint and no-live-process hint are advisory only',async()=>{
 const f=await fixture();
 await claimTemporaryFixture(f.root,f.nonce,'session-a');
 for(const [report,label] of [[hint({observedPid:5678}),'different-pid-reported'],
  [hint({processObserved:false}),'reported-not-running']]){
  const x=await read(f,report);
  assert.equal(x.processHintStatus,label);
  assert.equal(x.reclaimClaimAllowed,false);
 }
});
test('a same-size modification after review opened invalidates it',async()=>{
 const f=await fixture();
 await claimTemporaryFixture(f.root,f.nonce,'session-a');
 const review=await createTemporaryOrphanReview(f.root,f.nonce);
 const p=join(f.root,CLAIM_NAME);
 const before=await fsp.readFile(p,'utf8');
 const after=before.replace('session-a','session-b');
 assert.equal(after.length,before.length);
 await fsp.writeFile(p,after);
 const x=await inspectTemporaryOrphanReview(review,hint());
 assert.equal(x.decision,'claim-changed');
 assert.equal(x.claimUnchanged,false);
 assert.equal(x.filesDeleted,0);
});
test('a replaced file with identical bytes invalidates review by metadata where exposed',async()=>{
 const f=await fixture();
 await claimTemporaryFixture(f.root,f.nonce,'session-a');
 const review=await createTemporaryOrphanReview(f.root,f.nonce);
 const p=join(f.root,CLAIM_NAME);
 const contents=await fsp.readFile(p);
 const scratch=join(f.root,'replacement.tmp');
 await fsp.writeFile(scratch,contents,{flag:'wx'});
 await fsp.rename(scratch,p);
 const x=await inspectTemporaryOrphanReview(review,hint());
 assert.equal(x.reclaimClaimAllowed,false);
 assert.equal(x.operationsEnabled,false);
 // Filesystem metadata granularity differs between runners. No native identity claim.
 assert.ok(['claim-changed','manual-review-only'].includes(x.decision));
});
test('claim inserted after opening a missing review is a state change',async()=>{
 const f=await fixture(),review=await createTemporaryOrphanReview(f.root,f.nonce);
 await claimTemporaryFixture(f.root,f.nonce,'session-a');
 const x=await inspectTemporaryOrphanReview(review,hint());
 assert.equal(x.decision,'claim-changed');
 assert.equal(x.automaticCleanupAllowed,false);
});
test('claim removed after review is invalidation, not permission',async()=>{
 const f=await fixture();
 await claimTemporaryFixture(f.root,f.nonce,'session-a');
 const review=await createTemporaryOrphanReview(f.root,f.nonce);
 await fsp.rm(join(f.root,CLAIM_NAME));
 const x=await inspectTemporaryOrphanReview(review,hint());
 assert.equal(x.decision,'claim-changed');
 assert.equal(x.deleteOrRenameAllowed,false);
});
test('corrupt or huge claim is never trusted as owner proof',async()=>{
 for(const contents of ['not-json','X'.repeat(800)]){
  const f=await fixture();
  await fsp.writeFile(join(f.root,CLAIM_NAME),contents,{flag:'wx'});
  const x=await read(f);
  assert.ok(['invalid-claim'].includes(x.decision));
  assert.equal(x.processIdentityNativeVerified,false);
  assert.equal(x.filesDeleted,0);
 }
});
test('symlink substitution is rejected when supported by the runner',async(t)=>{
 const f=await fixture(),target=join(f.root,'target.txt');
 await fsp.writeFile(target,'not a claim');
 try{await fsp.symlink(target,join(f.root,CLAIM_NAME),'file');}
 catch(e){
  if(['EPERM','EACCES','ENOSYS'].includes(e.code)){t.skip('symlinks unavailable');return;}
  throw e;
 }
 const x=await read(f);
 assert.equal(x.decision,'invalid-claim');
 assert.equal(x.currentState,'unsafe-file');
});
test('invalid or forged hints with getters are never executed',async()=>{
 const f=await fixture();
 await claimTemporaryFixture(f.root,f.nonce,'session-a');
 let called=0;
 const malicious=Object.defineProperty(hint(),'observedPid',{
  enumerable:true,get(){called++;throw Error('GETTER MUST NOT RUN');}
 });
 const x=await read(f,malicious);
 assert.equal(x.processHintStatus,'unusable-hint');
 assert.equal(called,0);
 assert.equal(x.operationsEnabled,false);
});
test('hint schema disallows extra capabilities, negative PID and fake tags',()=>{
 for(const bad of [{...hint(),operationsEnabled:true},hint({claimedPid:-1}),
  hint({claimedStartTag:'spoof'}),hint({processObserved:'yes'}),
  null,[],Object.assign(Object.create(null),hint())]){
  assert.equal(validateHint(bad),null);
  assert.equal(classifyHint(validateHint(bad)),'unusable-hint');
 }
});
test('read-only rechecks never mutate or delete a valid claim',async()=>{
 const f=await fixture();
 await claimTemporaryFixture(f.root,f.nonce,'session-a');
 const file=join(f.root,CLAIM_NAME),original=await fsp.readFile(file);
 const review=await createTemporaryOrphanReview(f.root,f.nonce);
 for(let i=0;i<5;i++){
  const x=await inspectTemporaryOrphanReview(review,hint());
  assert.equal(x.decision,'manual-review-only');
  assert.equal(x.claimUnchanged,true);
 }
 assert.deepEqual(await fsp.readFile(file),original);
});
test('orphan analysis in one fixture does not affect a second directory',async()=>{
 const a=await fixture(),b=await fixture();
 await claimTemporaryFixture(a.root,a.nonce,'session-a');
 await claimTemporaryFixture(b.root,b.nonce,'session-b');
 const review=await createTemporaryOrphanReview(a.root,a.nonce);
 await fsp.writeFile(join(b.root,CLAIM_NAME),'tampered');
 const x=await inspectTemporaryOrphanReview(review,hint());
 assert.equal(x.decision,'manual-review-only');
 assert.equal(x.claimUnchanged,true);
});
test('marker tamper fails closed before reinspection without leaking paths',async()=>{
 const f=await fixture();
 await claimTemporaryFixture(f.root,f.nonce,'session-a');
 const review=await createTemporaryOrphanReview(f.root,f.nonce);
 await fsp.writeFile(join(f.root,MARKER),'0'.repeat(32));
 await assert.rejects(inspectTemporaryOrphanReview(review,hint()),/marker mismatch/);
});
test('review output does not expose PID, marker, full paths or untrusted claim',async()=>{
 const f=await fixture();
 await claimTemporaryFixture(f.root,f.nonce,'session-a');
 const x=await read(f,hint());
 const exposed=JSON.stringify(x);
 for(const secret of [f.root,f.nonce,'1234','session-a','session-b'])
  assert.equal(exposed.includes(secret),false);
 assert.equal(Object.isFrozen(x),true);
 assert.equal(x.realModsInspected,false);
});
