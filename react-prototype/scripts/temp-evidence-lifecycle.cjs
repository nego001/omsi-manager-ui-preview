'use strict';
// TEST ONLY. An observation receipt is an untrusted history entry, never an
// authorization. References live only inside this Node process and are revoked
// irreversibly on release, changed bytes, or failed fixture validation.
// Never imported by Electron, preload, renderer, packaging, or production IPC.
const {openTemporaryFileReference,inspectTemporaryFileReference,
 closeTemporaryFileReference}=require('./temp-recovery-identity.cjs');
const sessions=new WeakMap();
const receipts=new WeakMap();
function refuse(){throw Error('Temporary evidence lifecycle refused: unissued reference');}
function stateOf(session){
 const state=session&&typeof session==='object'?sessions.get(session):null;
 if(!state)refuse();
 return state;
}
function enqueue(s,callback){
 const queued=s.tail.then(callback,callback);
 s.tail=queued.then(()=>{},()=>{});
 return queued;
}
function status(s,reason){
 return Object.freeze({
  source:'temporary-evidence-lifecycle-only',
  outcome:reason,sessionState:s.phase,
  observationIsAuthorization:false,
  continuityAcrossReleaseProven:false,abaRuledOut:false,
  nativeLockOwnershipVerified:false,
  sessionCanBeReusedForRealMods:false,
  canRecover:false,canInstall:false,canDelete:false,
  operationsEnabled:false,filesModifiedInGames:0
 });
}
async function openTemporaryEvidenceSession(root,nonce){
 // Opening a NEW file handle is an independent session. An old receipt cannot
 // transfer to this object even if the same underlying FileId returns (ABA).
 const handle=await openTemporaryFileReference(root,nonce);
 const session=Object.freeze({
  scope:'temporary-evidence-observation',
  operationsEnabled:false
 });
 sessions.set(session,{
  handle,phase:'open',sequence:0,latest:null,
  tail:Promise.resolve(),closeStarted:false
 });
 return session;
}
async function closeHandle(s){
 if(s.closeStarted)return;
 s.closeStarted=true;
 try{await closeTemporaryFileReference(s.handle);}
 catch{ /* State already permanently revoked. No cleanup of user paths. */ }
}
async function observeTemporaryEvidence(session){
 const s=stateOf(session);
 return enqueue(s,async()=>{
  if(s.phase!=='open')return Object.freeze({
   ...status(s,'not-observable'),receipt:null
  });
  let observation;
  try{observation=await inspectTemporaryFileReference(s.handle);}
  catch{
   s.phase='revoked';s.latest=null;
   await closeHandle(s);
   return Object.freeze({...status(s,'fixture-validation-failed'),receipt:null});
  }
  if(s.phase!=='open')return Object.freeze({
   ...status(s,'not-observable'),receipt:null
  });
  if(observation.status!=='observed-stable-untrusted'){
   s.phase='revoked';s.latest=null;
   await closeHandle(s);
   return Object.freeze({...status(s,'changed-or-unavailable'),receipt:null});
  }
  const receipt=Object.freeze({
   scope:'temporary-observation-receipt',
   operationsEnabled:false
  });
  s.sequence++;
  s.latest=receipt;
  receipts.set(receipt,{owner:s,sequence:s.sequence});
  return Object.freeze({
   ...status(s,'observed-stable-untrusted'),receipt
  });
 });
}
function inspectTemporaryEvidenceReceipt(session,receipt){
 const s=stateOf(session);
 // WeakMap identity, not copied fields or reported PIDs/FileIds.
 const r=receipt&&typeof receipt==='object'?receipts.get(receipt):null;
 if(!r)return status(s,'unissued-receipt');
 if(r.owner!==s)return status(s,'different-session');
 if(s.phase!=='open')return status(s,'revoked-receipt');
 if(s.latest!==receipt||r.sequence!==s.sequence)
  return status(s,'superseded-receipt');
 // This only indicates which *past observation* was most recent. Changes after
 // that moment are NOT excluded. In particular, ABA is never ruled out.
 return status(s,'latest-observation-untrusted');
}
async function releaseTemporaryEvidenceSession(session){
 const s=stateOf(session);
 // Revoke synchronously before pending reads/closing finish. Ensures a receipt
 // cannot be treated as current after someone requests a release.
 if(s.phase==='open')s.phase='releasing';
 s.latest=null;
 return enqueue(s,async()=>{
  if(s.phase==='releasing'){
   await closeHandle(s);
   s.phase='released';
  }else if(s.phase==='revoked'){
   await closeHandle(s);
  }
  return status(s,'session-not-reusable');
 });
}
module.exports={openTemporaryEvidenceSession,observeTemporaryEvidence,
 inspectTemporaryEvidenceReceipt,releaseTemporaryEvidenceSession};
