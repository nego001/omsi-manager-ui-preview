'use strict';
// TEST-ONLY orphan triage. Read-only and fail-closed; no automatic cleanup.
// Not imported by the application, its preload, IPC or native packaging.
const fsp=require('node:fs/promises');
const {constants}=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {checkedRoot}=require('./temp-recovery-fixture.cjs');
const {CLAIM_NAME,MAX_CLAIM_BYTES,validClaim}=require('./temp-recovery-concurrency.cjs');
const reviews=new WeakMap();
const statuses=Object.freeze(['absent','present-untrusted','corrupt-untrusted','unsafe-file']);
async function observation(root,nonce){
 const file=path.join(root,CLAIM_NAME);
 let before;
 try{before=await fsp.lstat(file,{bigint:true});}
 catch(error){
  if(error.code==='ENOENT')return {status:'absent',fingerprint:'absent'};
  throw error;
 }
 if(!before.isFile()||before.isSymbolicLink()||
    before.size<2n||before.size>BigInt(MAX_CLAIM_BYTES))
  return {status:'unsafe-file',fingerprint:'unsafe'};
 let handle;
 try{
  // O_NOFOLLOW is used when supported. Windows reparse/TOCTOU guarantees
  // require a future reviewed native handle-based implementation.
  handle=await fsp.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
  const held=await handle.stat({bigint:true});
  const bytes=await handle.readFile();
  const after=await fsp.lstat(file,{bigint:true});
  const sig=s=>[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':');
  if(!held.isFile()||held.isSymbolicLink()||
    bytes.length>MAX_CLAIM_BYTES||bytes.length<2||
    sig(before)!==sig(held)||sig(after)!==sig(held))
   return {status:'unsafe-file',fingerprint:'unsafe'};
  const hash=createHash('sha256').update(bytes).digest('hex');
  let parsed;
  try{parsed=JSON.parse(bytes.toString('utf8'));}
  catch{parsed=null;}
  return {status:validClaim(parsed,nonce)?'present-untrusted':'corrupt-untrusted',
   // This fingerprint is only a test-local change detector, not identity proof.
   fingerprint:[sig(held),hash].join(':')};
 }catch(error){
  if(error.code==='ENOENT'||error.code==='ELOOP')
   return {status:'unsafe-file',fingerprint:'unsafe'};
  throw error;
 }finally{if(handle)await handle.close();}
}
function validateHint(raw){
 try{
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
     Object.getPrototypeOf(raw)!==Object.prototype)return null;
  const names=['claimedPid','observedPid','claimedStartTag','observedStartTag','processObserved'];
  const descriptors=Object.getOwnPropertyDescriptors(raw);
  if(Reflect.ownKeys(raw).length!==names.length||
    names.some(k=>!descriptors[k]||!Object.hasOwn(descriptors[k],'value')||
      !descriptors[k].enumerable))return null;
  const v=k=>descriptors[k].value;
  const pid=p=>Number.isSafeInteger(p)&&p>0&&p<=0x7fffffff;
  const tag=t=>typeof t==='string'&&/^[0-9a-f]{32}$/.test(t);
  if(!pid(v('claimedPid'))||!pid(v('observedPid'))||
     !tag(v('claimedStartTag'))||!tag(v('observedStartTag'))||
     typeof v('processObserved')!=='boolean')return null;
  return Object.freeze(Object.fromEntries(names.map(k=>[k,v(k)])));
 }catch{return null;}
}
function classifyHint(hint){
 if(!hint)return 'unusable-hint';
 if(!hint.processObserved)return 'reported-not-running';
 if(hint.claimedPid!==hint.observedPid)return 'different-pid-reported';
 if(hint.claimedStartTag!==hint.observedStartTag)return 'pid-reuse-suspected';
 return 'same-incarnation-claimed';
}
function lookup(review){
 const item=review&&typeof review==='object'?reviews.get(review):null;
 if(!item)throw Error('Orphan review fixture was not issued.');
 return item;
}
async function createTemporaryOrphanReview(root,nonce){
 const base=await checkedRoot(root,nonce);
 const initial=await observation(base,nonce);
 const review=Object.freeze({scope:'temporary-orphan-review',operationsEnabled:false});
 reviews.set(review,{root:base,nonce,initial});
 return review;
}
async function inspectTemporaryOrphanReview(review,processHint){
 const s=lookup(review);
 // Revalidate parent and marker on every invocation, not only on open.
 await checkedRoot(s.root,s.nonce);
 const current=await observation(s.root,s.nonce);
 const unchanged=current.status===s.initial.status&&
  current.fingerprint===s.initial.fingerprint;
 const hint=validateHint(processHint);
 const hintStatus=classifyHint(hint);
 const decision=!unchanged?'claim-changed':
  current.status==='absent'?'no-claim':
  current.status==='unsafe-file'||current.status==='corrupt-untrusted'?
   'invalid-claim':'manual-review-only';
 return Object.freeze({
  source:'temporary-fixture-only',decision,
  initialState:s.initial.status,currentState:current.status,
  claimUnchanged:unchanged,
  processHintStatus:hintStatus,processIdentityNativeVerified:false,
  processLivenessNativeVerified:false,claimOwnershipVerified:false,
  nativeLockVerified:false,automaticCleanupAllowed:false,
  deleteOrRenameAllowed:false,renewClaimAllowed:false,
  reclaimClaimAllowed:false,reusedPidCanAuthorize:false,
  operationsEnabled:false,filesDeleted:0,realModsInspected:false,
  notice:'Test-only observations are not native process identity; never clear or reuse a claim automatically.'
 });
}
module.exports={createTemporaryOrphanReview,inspectTemporaryOrphanReview,
 validateHint,classifyHint,statuses};
