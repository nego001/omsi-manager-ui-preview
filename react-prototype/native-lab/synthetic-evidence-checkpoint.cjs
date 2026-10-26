'use strict';
// Synthetic CI-only reference stored in an INDEPENDENT disposable TEMP
// directory, not in the witness fixture. This is not a trusted hardware
// anchor, MAC, signature, transaction journal or permission to mutate files.
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const {join,resolve,dirname,basename}=require('node:path');
const {tmpdir}=require('node:os');
const {readSyntheticOperationLedger}=require('./synthetic-operation-ledger.cjs');

const PREFIX='omsi-manager-evidence-checkpoint-';
const FILE='.omsi-test-checkpoint.json';
const SCHEMA='omsi-synthetic-independent-checkpoint-v1';
const MAX_BYTES=512;
const refuse=()=>{throw Error('Synthetic evidence checkpoint refused');};

function same(a,b){
 return a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&
  a.nlink===b.nlink&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
}
function regular(s){
 return s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&
  s.size>0&&s.size<=MAX_BYTES;
}
async function validateCheckpointRoot(directory){
 if(typeof directory!=='string'||!directory)refuse();
 const full=resolve(directory);
 if(dirname(full)!==resolve(tmpdir())||
    !new RegExp('^'+PREFIX+'[A-Za-z0-9]+$').test(basename(full)))refuse();
 let stat;
 try{stat=await fs.lstat(full);}catch{refuse();}
 if(!stat.isDirectory()||stat.isSymbolicLink())refuse();
 return full;
}

// Created by a separate harness *after* a successfully parsed witness;
// the reference is immutable to THIS API and never written into the fixture.
// Holding or choosing this path is the independent reviewer's responsibility.
async function createSyntheticEvidenceCheckpoint(root,nonce){
 const witness=await readSyntheticOperationLedger(root,nonce);
 if(!/^[0-9a-f]{64}$/.test(witness.chainHead)||
    witness.events.length<1||witness.events.length>12)refuse();
 const folder=await fs.mkdtemp(join(tmpdir(),PREFIX));
 const payload=JSON.stringify({
  schema:SCHEMA,head:witness.chainHead,count:witness.events.length
 })+'\n';
 let handle;
 try{
  handle=await fs.open(join(folder,FILE),'wx',0o600);
  const buf=Buffer.from(payload,'utf8');
  const {bytesWritten}=await handle.write(buf,0,buf.length,0);
  if(bytesWritten!==buf.length)refuse();
  await handle.sync();
  await handle.close();
  handle=null;
  return {directory:folder};
 }catch{
  if(handle)await handle.close();
  await fs.rm(folder,{recursive:true,force:true});
  refuse();
 }
}

async function loadCheckpoint(directory){
 const full=await validateCheckpointRoot(directory);
 const name=join(full,FILE);
 let handle;
 try{
  const before=await fs.lstat(name);
  if(!regular(before))refuse();
  const flags=constants.O_RDONLY |
   (process.platform==='win32'?0:constants.O_NOFOLLOW);
  handle=await fs.open(name,flags);
  const opened=await handle.stat();
  if(!regular(opened)||!same(before,opened))refuse();
  const buffer=Buffer.alloc(MAX_BYTES+1);
  let count=0;
  while(count<buffer.length){
   const {bytesRead}=await handle.read(buffer,count,buffer.length-count,count);
   if(bytesRead===0)break;
   count+=bytesRead;
  }
  if(count!==opened.size||count>MAX_BYTES)refuse();
  const [after,afterPath]=await Promise.all([
   handle.stat(),fs.lstat(name)
  ]);
  if(!regular(afterPath)||!same(opened,after)||!same(opened,afterPath))
   refuse();
  const raw=buffer.subarray(0,count).toString('utf8');
  if(!raw.endsWith('\n'))refuse();
  let record;
  try{record=JSON.parse(raw.slice(0,-1));}catch{refuse();}
  if(!record||Array.isArray(record)||
     Object.keys(record).sort().join(',')!=='count,head,schema'||
     record.schema!==SCHEMA||
     !Number.isSafeInteger(record.count)||
     record.count<1||record.count>12||
     typeof record.head!=='string'||
     !/^[0-9a-f]{64}$/.test(record.head)||
     JSON.stringify(record)+'\n'!==raw)refuse();
  return record;
 }catch{refuse();}
 finally{if(handle)await handle.close();}
}

// Requires explicit checkpoint location from the caller; never obtain it
// from the potentially forged witness. Mismatch is *inconclusive*, even
// when the witness claims it finished successfully.
async function reviewSyntheticEvidenceCheckpoint(root,nonce,anchorDirectory){
 let witness;
 try{witness=await readSyntheticOperationLedger(root,nonce);}
 catch{
  return {status:'unverifiable_incomplete',events:[],
   checkpointMatch:false};
 }
 try{
  const checkpoint=await loadCheckpoint(anchorDirectory);
  if(checkpoint.head!==witness.chainHead||
     checkpoint.count!==witness.events.length)refuse();
  return {status:witness.status,events:witness.events,
   checkpointMatch:true};
 }catch{
  return {status:'unverifiable_incomplete',events:[],
   checkpointMatch:false};
 }
}
module.exports={
 createSyntheticEvidenceCheckpoint,reviewSyntheticEvidenceCheckpoint,
 FILE,SCHEMA
};
