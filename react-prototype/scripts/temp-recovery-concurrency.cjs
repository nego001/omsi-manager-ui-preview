'use strict';
// Test harness only. Exclusive creation is a file CLAIM, NOT a native OS lock.
// Never imported by Electron, Vite, IPC, or the portable application.
const fsp=require('node:fs/promises');
const path=require('node:path');
const {checkedRoot}=require('./temp-recovery-fixture.cjs');
const CLAIM_NAME='session.claim.json';
const MAX_CLAIM_BYTES=512;
const actors=Object.freeze(['session-a','session-b']);
function fail(message){throw Error('Temporary concurrency fixture refused: '+message);}
function validActor(actor){return actors.includes(actor);}
function validClaim(raw,nonce){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
   Object.getPrototypeOf(raw)!==Object.prototype)return false;
 const keys=['schemaVersion','scope','nonce','actor','operationsEnabled'];
 return Reflect.ownKeys(raw).length===keys.length &&
  keys.every(k=>Object.hasOwn(raw,k)) &&
  raw.schemaVersion===1&&raw.scope==='temporary-claim-only'&&
  raw.nonce===nonce&&validActor(raw.actor)&&raw.operationsEnabled===false;
}
async function claimTemporaryFixture(root,nonce,actor){
 if(!validActor(actor))fail('unrecognized session actor');
 const dir=await checkedRoot(root,nonce);
 const file=path.join(dir,CLAIM_NAME);
 let handle;
 try{handle=await fsp.open(file,'wx',0o600);}
 catch(error){
  if(error&&error.code==='EEXIST')
   return Object.freeze({status:'busy',exclusiveCreateObserved:false,
    ownerTrusted:false,realProcessLockHeld:false,operationsEnabled:false});
  throw error;
 }
 try{
  await handle.writeFile(JSON.stringify({schemaVersion:1,
   scope:'temporary-claim-only',nonce,actor,operationsEnabled:false}));
  await handle.sync();
 }finally{await handle.close();}
 return Object.freeze({status:'claimed',exclusiveCreateObserved:true,
  ownerTrusted:false,realProcessLockHeld:false,operationsEnabled:false});
}
// Read-only interpretation: file existence cannot prove owner is alive;
// a corrupt/stale claim is never deleted or silently reclaimed.
async function inspectTemporaryClaim(root,nonce){
 const dir=await checkedRoot(root,nonce);
 let stat;
 try{stat=await fsp.lstat(path.join(dir,CLAIM_NAME));}
 catch(error){
  if(error&&error.code==='ENOENT')
   return Object.freeze({status:'absent',ownerTrusted:false,
    ownerLivenessVerified:false,claimIsNativeLock:false,
    operationsEnabled:false});
  throw error;
 }
 let valid=false;
 if(stat.isFile()&&!stat.isSymbolicLink()&&
    stat.size>1&&stat.size<=MAX_CLAIM_BYTES){
  try{
   const payload=await fsp.readFile(path.join(dir,CLAIM_NAME),'utf8');
   valid=validClaim(JSON.parse(payload),nonce);
  }catch{valid=false;}
 }
 return Object.freeze({status:valid?'present-untrusted':'corrupt-untrusted',
  ownerTrusted:false,ownerLivenessVerified:false,
  claimIsNativeLock:false,operationsEnabled:false});
}
module.exports={CLAIM_NAME,MAX_CLAIM_BYTES,claimTemporaryFixture,
 inspectTemporaryClaim,validClaim};
