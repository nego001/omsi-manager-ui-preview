'use strict';
// TEST-ONLY HMAC verifier for disposable, nonce-marked temporary fixtures.
// Both the key and the receipt live outside the witness fixture, in
// DIFFERENT temporary siblings. This is a laboratory capability boundary,
// NOT isolation from a same-user attacker, vault, TPM or trusted service.
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const {join,resolve,dirname,basename}=require('node:path');
const {tmpdir}=require('node:os');
const {randomBytes,createHmac,timingSafeEqual}=require('node:crypto');
const {readSyntheticOperationLedger,reviewSyntheticOperationLedger}=
 require('./synthetic-operation-ledger.cjs');

const SCHEMA='omsi-synthetic-hmac-receipt-v1';
const KEY_PREFIX='omsi-manager-hmac-verifier-';
const RECEIPT_PREFIX='omsi-manager-hmac-receipt-';
const KEY_FILE='.omsi-test-verifier-key';
const RECEIPT_FILE='.omsi-test-hmac-receipt.json';
const MAX_RECEIPT_BYTES=512;
const deny=()=>{throw Error('Synthetic HMAC verification refused');};

function same(a,b){
 return a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&
  a.nlink===b.nlink&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
}
async function folderPath(directory,prefix){
 if(typeof directory!=='string'||directory.length===0)deny();
 const full=resolve(directory);
 if(dirname(full)!==resolve(tmpdir())||
    !new RegExp('^'+prefix+'[A-Za-z0-9]+$').test(basename(full)))deny();
 let stat;
 try{stat=await fs.lstat(full);}catch{deny();}
 if(!stat.isDirectory()||stat.isSymbolicLink())deny();
 return full;
}
// One bounded, pinned read-only handle with conservative before/after checks.
// This narrows substitution races but does NOT exclude ABA or privileged races.
async function readPinned(directory,prefix,filename,maxBytes,exactBytes=null){
 const full=await folderPath(directory,prefix);
 const path=join(full,filename);
 let handle;
 try{
  const before=await fs.lstat(path);
  const regular=s=>s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&
   s.size>0&&s.size<=maxBytes&&
   (exactBytes===null||s.size===exactBytes);
  if(!regular(before))deny();
  const flags=constants.O_RDONLY |
   (process.platform==='win32'?0:constants.O_NOFOLLOW);
  handle=await fs.open(path,flags);
  const opened=await handle.stat();
  if(!regular(opened)||!same(before,opened))deny();
  const buffer=Buffer.alloc(maxBytes+1);
  let offset=0;
  while(offset<buffer.length){
   const {bytesRead}=await handle.read(buffer,offset,buffer.length-offset,offset);
   if(bytesRead===0)break;
   offset+=bytesRead;
  }
  const after=await handle.stat(),pathAfter=await fs.lstat(path);
  if(offset!==opened.size||offset>maxBytes||
     !regular(pathAfter)||!same(opened,after)||!same(opened,pathAfter))deny();
  return buffer.subarray(0,offset);
 }catch{deny();}
 finally{if(handle)await handle.close();}
}
function canonical(witness,nonce){
 if(!witness||!Array.isArray(witness.events)||
    !/^[0-9a-f]{64}$/.test(witness.chainHead)||
    witness.events.length<1||witness.events.length>12||
    !/^[0-9a-f]{32}$/.test(nonce))deny();
 return JSON.stringify({
  domain:'OMSI-SYNTHETIC-HMAC-RECEIPT-V1',
  head:witness.chainHead,
  count:witness.events.length,
  nonce
 });
}
function sign(key,witness,nonce){
 if(!Buffer.isBuffer(key)||key.length!==32)deny();
 return createHmac('sha256',key)
  .update(canonical(witness,nonce),'utf8').digest('hex');
}
async function writeNew(path,data){
 let handle;
 try{
  handle=await fs.open(path,'wx',0o600);
  const bytes=Buffer.isBuffer(data)?data:Buffer.from(data,'utf8');
  const {bytesWritten}=await handle.write(bytes,0,bytes.length,0);
  if(bytesWritten!==bytes.length)deny();
  await handle.sync();
 }finally{if(handle)await handle.close();}
}
async function createSyntheticAuthenticatedReceipt(root,nonce){
 // Authenticate and validate the witness BEFORE creating any keys.
 const witness=await readSyntheticOperationLedger(root,nonce);
 canonical(witness,nonce);
 let keyDirectory,receiptDirectory;
 try{
  keyDirectory=await fs.mkdtemp(join(tmpdir(),KEY_PREFIX));
  receiptDirectory=await fs.mkdtemp(join(tmpdir(),RECEIPT_PREFIX));
  const key=randomBytes(32);
  try{
   await writeNew(join(keyDirectory,KEY_FILE),key);
   const receipt={
    schema:SCHEMA,head:witness.chainHead,count:witness.events.length,
    mac:sign(key,witness,nonce)
   };
   await writeNew(join(receiptDirectory,RECEIPT_FILE),
    JSON.stringify(receipt)+'\n');
  }finally{
   key.fill(0); // best effort, not a secure memory-erasure guarantee
  }
  return {keyDirectory,receiptDirectory};
 }catch{
  if(keyDirectory)await fs.rm(keyDirectory,{recursive:true,force:true});
  if(receiptDirectory)await fs.rm(receiptDirectory,{recursive:true,force:true});
  deny();
 }
}
async function parseReceipt(directory){
 const bytes=await readPinned(directory,RECEIPT_PREFIX,RECEIPT_FILE,
  MAX_RECEIPT_BYTES);
 const raw=bytes.toString('utf8');
 if(!raw.endsWith('\n'))deny();
 let record;
 try{record=JSON.parse(raw.slice(0,-1));}catch{deny();}
 if(!record||Array.isArray(record)||
    Object.keys(record).sort().join(',')!=='count,head,mac,schema'||
    record.schema!==SCHEMA||
    !Number.isSafeInteger(record.count)||
    record.count<1||record.count>12||
    typeof record.head!=='string'||!/^[0-9a-f]{64}$/.test(record.head)||
    typeof record.mac!=='string'||!/^[0-9a-f]{64}$/.test(record.mac)||
    JSON.stringify(record)+'\n'!==raw)deny();
 return record;
}
async function reviewSyntheticAuthenticatedReceipt(root,nonce,
 keyDirectory,receiptDirectory){
 // Wrong fixture nonce is a mandatory *refusal*, not an inconclusive
 // witness. The conservative reader authenticates the marker first.
 const witness=await reviewSyntheticOperationLedger(root,nonce);
 if(witness.status==='unverifiable_incomplete'||!witness.chainHead)
  return {status:'unverifiable_incomplete',authenticated:false,events:[]};
 try{
  if(keyDirectory===receiptDirectory)deny();
  const [key,receipt]=await Promise.all([
   readPinned(keyDirectory,KEY_PREFIX,KEY_FILE,32,32),
   parseReceipt(receiptDirectory)
  ]);
  try{
   if(receipt.head!==witness.chainHead||
      receipt.count!==witness.events.length)deny();
   const expected=Buffer.from(sign(key,witness,nonce),'hex');
   const actual=Buffer.from(receipt.mac,'hex');
   if(!timingSafeEqual(expected,actual))deny();
   // The MAC verifies this narrow lab observation, not a mod operation.
   return {status:witness.status,authenticated:true,events:witness.events};
  }finally{key.fill(0);}
 }catch{
  return {status:'unverifiable_incomplete',authenticated:false,events:[]};
 }
}
module.exports={
 createSyntheticAuthenticatedReceipt,reviewSyntheticAuthenticatedReceipt,
 KEY_FILE,RECEIPT_FILE,SCHEMA
};
