'use strict';
// Test-only controller. Self-created root, owned child handles, fixed
// checkpoints. Neither a native lock nor a production reclaim protocol.
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {fork}=require('node:child_process');
const {PREFIX,MARKER}=require('./temp-recovery-fixture.cjs');
const {CLAIM_NAME}=require('./temp-recovery-concurrency.cjs');
const {createTemporaryOrphanReview,inspectTemporaryOrphanReview}=require('./temp-recovery-orphan-review.cjs');
const {inspect}=require('./m97-interrupted-multifile-transaction.cjs');
const worker=path.join(__dirname,'m98-concurrent-multifile-worker.cjs');
const scenarios=Object.freeze(['active','terminated','changed-claim','missing-claim','corrupt-initial-claim']);
const refuse=()=>{throw Error('M99_FIXTURE_REFUSED');};
function start(root,nonce,actor){
 const child=fork(worker,[root,nonce,actor,'1'],{execArgv:[],stdio:['ignore','ignore','ignore','ipc'],
  windowsHide:true,env:{...process.env,NODE_OPTIONS:''}});
 let resolveMessage,rejectMessage,received=false;
 const message=new Promise((res,rej)=>{resolveMessage=res;rejectMessage=rej;});
 // Attach a rejection handler immediately, including when startup fails.
 message.catch(()=>{});
 const timer=setTimeout(()=>{if(!received){received=true;rejectMessage(Error('M99_TIMEOUT'));}child.kill('SIGKILL');},15000);
 const close=new Promise(resolve=>{
  child.once('close',(code,signal)=>{
   clearTimeout(timer);
   if(!received){received=true;rejectMessage(Error('M99_EARLY_EXIT'));}
   resolve({code,signal});
  });
  child.once('error',e=>{if(!received){received=true;rejectMessage(e);}});
 });
 child.once('message',m=>{if(!received){received=true;resolveMessage(m);}});
 return {child,message,close};
}
async function terminate(w){
 if(w.child.exitCode===null&&w.child.signalCode===null)w.child.kill('SIGKILL');
 return w.close;
}
async function bytesSnapshot(root){
 const entries=(await fs.readdir(root)).sort();
 const out=[];
 for(const name of entries){
  const p=path.join(root,name),s=await fs.lstat(p);
  if(!s.isFile()||s.isSymbolicLink()||s.size>4096)refuse();
  out.push([name,(await fs.readFile(p)).toString('hex')]);
 }
 return JSON.stringify(out);
}
async function reviewSyntheticReservation(scenario='terminated'){
 if(!scenarios.includes(scenario))refuse();
 const root=await fs.mkdtemp(path.join(os.tmpdir(),PREFIX)),workers=[];
 try{
  const nonce=randomBytes(16).toString('hex');
  await fs.writeFile(path.join(root,MARKER),nonce,{flag:'wx',mode:0o600});
  let owner=null,ownedCheckpointObserved=false,ownedTerminationObserved=false;
  if(scenario==='corrupt-initial-claim')
   await fs.writeFile(path.join(root,CLAIM_NAME),'corrupt',{flag:'wx',mode:0o600});
  else{
   owner=start(root,nonce,'session-a');workers.push(owner);
   const m=await owner.message;
   if(m?.kind!=='m97-checkpoint'||m.published!==1)refuse();
   ownedCheckpointObserved=true;
  }
  const review=await createTemporaryOrphanReview(root,nonce);
  if(owner&&scenario!=='active'){
   const exit=await terminate(owner);
   if(exit.code!==null||exit.signal!=='SIGKILL')refuse();
   ownedTerminationObserved=true;
  }
  // Controlled tampering, never performed as part of the review itself.
  if(scenario==='changed-claim')await fs.writeFile(path.join(root,CLAIM_NAME),'changed reservation');
  if(scenario==='missing-claim')await fs.unlink(path.join(root,CLAIM_NAME));
  const before=await bytesSnapshot(root);
  const claim=await inspectTemporaryOrphanReview(review,null);
  const transaction=await inspect(root,nonce);
  let disposition='reservation-review-required';
  if(!claim.claimUnchanged)disposition='reservation-changed-refused';
  else if(claim.decision==='invalid-claim')disposition='invalid-reservation-refused';
  else if(ownedTerminationObserved)disposition='owned-worker-exit-observed-review-required';
  else if(ownedCheckpointObserved)disposition='owned-worker-paused-reservation-retained';
  // Missing claim is deliberately NOT retried: the older cooperative worker
  // only checks reservation creation and cannot prove a production safe retry.
  let retryRefused=null;
  if(scenario!=='missing-claim'){
   const contender=start(root,nonce,'session-b');workers.push(contender);
   const m=await contender.message,exit=await contender.close;
   retryRefused=m?.kind==='m98-busy'&&exit.code===0&&exit.signal===null;
   if(!retryRefused)refuse();
  }
  const reviewUnchanged=(await bytesSnapshot(root))===before;
  if(!reviewUnchanged)refuse();
  return Object.freeze({schema:'omsi-m99-reservation-review-v1',scope:'self-created-temporary-fixture-only',
   scenario,disposition,ownedCheckpointObserved,ownedTerminationObserved,
   claimUnchanged:claim.claimUnchanged,claimState:claim.currentState,
   transactionState:transaction.outcome,originalCount:transaction.originalCount,
   retryRefused,reviewUnchanged,
   ownerIdentityVerified:false,nativeLockVerified:false,claimReclaimAllowed:false,
   automaticCleanupAllowed:false,automaticReplayAllowed:false,operationsEnabled:false,
   realFilesInspected:false,filesModifiedInGames:0});
 }finally{
  await Promise.all(workers.map(terminate));
  await fs.rm(root,{recursive:true,force:true});
 }
}
module.exports={reviewSyntheticReservation};
