'use strict';
// Test-only native OS observation contract. Not an application recovery adapter.
// Never linked to the renderer, preload, production IPC or real game paths.
const fsp=require('node:fs/promises');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {ChildProcess}=require('node:child_process');
const {checkedRoot}=require('./temp-recovery-fixture.cjs');

const TARGET='identity-target.bin';
const MAX_BYTES=4096;
const fileRefs=new WeakMap();
const processRefs=new WeakMap();

function reject(reason){throw Error('Temporary identity fixture refused: '+reason);}
function plainReport(raw){
 try{
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    Object.getPrototypeOf(raw)!==Object.prototype)return null;
  const expected=['pid','generationTag','claimsAlive'];
  const keys=Reflect.ownKeys(raw);
  if(keys.length!==expected.length||
    keys.some(k=>typeof k!=='string'||!expected.includes(k)))return null;
  const descriptors=Object.getOwnPropertyDescriptors(raw);
  if(expected.some(k=>!Object.hasOwn(descriptors,k)||
      !Object.hasOwn(descriptors[k],'value')||!descriptors[k].enumerable))return null;
  const get=k=>descriptors[k].value;
  if(!Number.isSafeInteger(get('pid'))||get('pid')<=0||
     get('pid')>0x7fffffff||typeof get('generationTag')!=='string'||
     !/^[0-9a-f]{32}$/.test(get('generationTag'))||
     typeof get('claimsAlive')!=='boolean')return null;
  return Object.freeze({
   pid:get('pid'),generationTag:get('generationTag'),
   claimsAlive:get('claimsAlive')
  });
 }catch{return null;}
}
function metadata(s){
 if(!s||!s.isFile()||s.isSymbolicLink()||
   s.size<1n||s.size>BigInt(MAX_BYTES))return null;
 return [s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':');
}
async function safeLstat(file){
 try{return await fsp.lstat(file,{bigint:true});}
 catch(error){if(error.code==='ENOENT'||error.code==='ELOOP')return null;throw error;}
}
async function sample(file,handle){
 const [before,held]=await Promise.all([
  safeLstat(file),handle.stat({bigint:true})
 ]);
 const pathKey=metadata(before),handleKey=metadata(held);
 if(!pathKey||!handleKey||pathKey!==handleKey)return null;
 const length=Number(held.size),buffer=Buffer.alloc(length);
 let offset=0;
 while(offset<length){
  const read=await handle.read(buffer,offset,length-offset,offset);
  if(!read.bytesRead)return null;
  offset+=read.bytesRead;
 }
 const [after,pathAfter]=await Promise.all([
  handle.stat({bigint:true}),safeLstat(file)
 ]);
 if(metadata(after)!==handleKey||metadata(pathAfter)!==handleKey)
  return null;
 return {key:handleKey,digest:createHash('sha256').update(buffer).digest('hex')};
}
function fileState(handle){
 const value=handle&&typeof handle==='object'?fileRefs.get(handle):null;
 if(!value)reject('unissued file reference');
 return value;
}
async function openTemporaryFileReference(root,nonce){
 const directory=await checkedRoot(root,nonce);
 const file=path.join(directory,TARGET);
 const first=await safeLstat(file);
 if(!metadata(first))reject('missing or unsafe fixture target');
 // Use O_NOFOLLOW where available; Windows reparse/TOCTOU protection is NOT certified.
 const native=await fsp.open(file,fs.constants.O_RDONLY|
  (fs.constants.O_NOFOLLOW||0));
 try{
  const initial=await sample(file,native);
  if(!initial)reject('file changed while opening');
  const token=Object.freeze({
   scope:'temporary-file-handle-observation',
   operationsEnabled:false,nativeIdentityProven:false
  });
  fileRefs.set(token,{native,root:directory,nonce,file,initial,closed:false});
  return token;
 }catch(error){await native.close();throw error;}
}
async function inspectTemporaryFileReference(token){
 const s=fileState(token);
 if(s.closed)return Object.freeze({
  source:'temporary-fixture-only',status:'closed',readOnly:true,
  nativeIdentityProven:false,operationsEnabled:false,
  canRecover:false,canInstall:false
 });
 await checkedRoot(s.root,s.nonce);
 let current;
 try{current=await sample(s.file,s.native);}
 catch(error){
  // A detached or changed target has no authority. Do not leak path/errors.
  if(['ENOENT','EACCES','EPERM','ELOOP','EBADF'].includes(error.code))
   current=null;
  else throw error;
 }
 return Object.freeze({
  source:'temporary-fixture-only',
  status:current&&current.key===s.initial.key&&
   current.digest===s.initial.digest?'observed-stable-untrusted':'changed-or-unavailable',
  readOnly:true,nativeHandleOpened:true,pathnameObservationMade:true,
  contentDigestCompared:true,
  nativeIdentityProven:false,atomicPathIdentityProven:false,
  durableDataProven:false,operationsEnabled:false,
  canRecover:false,canInstall:false,bytesFromGames:0,
  notice:'OS metadata and test bytes are observations, not production attestation.'
 });
}
async function closeTemporaryFileReference(token){
 const s=fileState(token);
 if(!s.closed){s.closed=true;await s.native.close();}
 return Object.freeze({closed:true,operationsEnabled:false});
}
// Only a real Node ChildProcess object created by the test may be bound.
// The PID is not exported: PID and forged start labels never authorize reuse.
function captureTemporaryProcessReference(child){
 if(!(child instanceof ChildProcess)||
    !Number.isSafeInteger(child.pid)||child.pid<=0)
  reject('not a child process handle');
 const token=Object.freeze({
  scope:'temporary-child-process-observation',operationsEnabled:false
 });
 processRefs.set(token,{child});
 return token;
}
function inspectTemporaryProcessReference(token,untrustedReport){
 const s=token&&typeof token==='object'?processRefs.get(token):null;
 if(!s)reject('unissued process reference');
 const report=plainReport(untrustedReport);
 const exited=s.child.exitCode!==null||s.child.signalCode!==null;
 return Object.freeze({
  source:'temporary-fixture-only',
  status:exited?'owned-child-exit-observed':'owned-child-not-yet-exited',
  reportedPidMatchesOwnedChild:report===null?null:report.pid===s.child.pid,
  reportShapeAccepted:report!==null,
  processIdentityVerifiedForRecovery:false,
  ownerLivenessVerifiedForRecovery:false,
  reusedPidCanAuthorize:false,automaticCleanupAllowed:false,
  claimReclaimAllowed:false,operationsEnabled:false,
  actualProcessTerminatedByThisFunction:false,
  notice:'An owned child handle and untrusted PID claims never authorize mod operations.'
 });
}
module.exports={TARGET,MAX_BYTES,plainReport,openTemporaryFileReference,
 inspectTemporaryFileReference,closeTemporaryFileReference,
 captureTemporaryProcessReference,inspectTemporaryProcessReference};
