'use strict';
// External witness for synthetic CI fixtures ONLY, not a transaction log.
// Never packaged with Electron, never consulted to permit real operations.
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const {join,dirname,basename,resolve}=require('node:path');
const {tmpdir}=require('node:os');
const {createHash}=require('node:crypto');

const SCHEMA='omsi-synthetic-operation-witness-v2';
const GENESIS='0'.repeat(64);
const FILE='.omsi-test-operation-witness.jsonl';
const PREFIX='omsi-manager-recovery-fixture-';
const MARKER='.omsi-test-fixture-marker';
const MAX_WITNESS_BYTES=4096;
const MAX_EVENTS=12;
const allowed={
 started:new Set(['intermediate_observed','bytes_restored_unconfirmed',
                  'interrupted','completed_observed']),
 intermediate_observed:new Set(['bytes_restored_unconfirmed','interrupted',
                                'completed_observed']),
 bytes_restored_unconfirmed:new Set(['interrupted','completed_observed']),
 interrupted:new Set(),
 completed_observed:new Set()
};
const deny=()=>{throw Error('Synthetic operation witness refused');};
// No key or signature: this chain only detects edits by parties who do NOT
// recalculate every subsequent digest. It is NEVER authentication.
function linkedRecord(sequence,event,previous){
 const core={schema:SCHEMA,sequence,event,previous};
 const digest=createHash('sha256').update(
  'OMSI-SYNTHETIC-WITNESS-CHAIN-V2\\n'+JSON.stringify(core),'utf8'
 ).digest('hex');
 return {...core,digest};
}

async function authenticate(root,nonce){
 if(typeof root!=='string'||typeof nonce!=='string'||
    !/^[0-9a-f]{32}$/.test(nonce))deny();
 const directory=resolve(root);
 if(dirname(directory)!==resolve(tmpdir())||
    !new RegExp('^'+PREFIX+'[A-Za-z0-9]+$').test(basename(directory)))deny();
 const [stat,markerStat]=await Promise.all([
   fs.lstat(directory),fs.lstat(join(directory,MARKER))
 ]);
 if(!stat.isDirectory()||stat.isSymbolicLink()||
    !markerStat.isFile()||markerStat.isSymbolicLink()||
    markerStat.nlink!==1||markerStat.size!==32)deny();
 if((await fs.readFile(join(directory,MARKER),'utf8'))!==nonce)deny();
 return directory;
}
function advance(state,event){
 if(state===null){
   if(event!=='started')deny();
 }else if(!allowed[state]?.has(event))deny();
 return event;
}
function summarize(records){
 const last=records.at(-1)?.event;
 if(last==='completed_observed')return 'completion_observed_not_durable';
 if(last==='interrupted'){
   const prior=records.at(-2)?.event;
   if(prior==='intermediate_observed')return 'interrupted_intermediate';
   if(prior==='bytes_restored_unconfirmed')return 'interrupted_metadata_pending';
   return 'interrupted_before_write';
 }
 return 'incomplete_unconfirmed';
}
async function createSyntheticOperationLedger(root,nonce){
 const directory=await authenticate(root,nonce);
 // O_EXCL: never overwrite an existing witness, even a suspicious one.
 // Path writes belong to this disposable OUTSIDE observer, not the pinned
 // PowerShell writer. This file is evidence only and never grants authority.
 const handle=await fs.open(join(directory,FILE),'wx',0o600);
 let state=null,sequence=0,closed=false,previous=GENESIS;
 return {
   async append(event){
     if(closed)deny();
     const next=advance(state,event);
     if(sequence>=MAX_EVENTS)deny();
     const record=linkedRecord(sequence+1,next,previous);
     const line=Buffer.from(JSON.stringify(record)+'\n','utf8');
     const info=await handle.stat();
     if(info.size+line.length>MAX_WITNESS_BYTES)deny();
     const {bytesWritten}=await handle.write(line,0,line.length,null);
     if(bytesWritten!==line.length)deny();
     await handle.sync();
     sequence++;
     state=next;
     previous=record.digest;
     return summarize([{event:state}]);
   },
   async close(){
     if(!closed){closed=true;await handle.close();}
   }
 };
}
// Use one opened, read-only descriptor. Reject obvious path substitution,
// links, malformed JSONL and changes observable while reading. This is
// conservative evidence validation, NOT a race-free authority boundary.
function sameWitnessInfo(a,b){
 return a.dev===b.dev && a.ino===b.ino &&
        a.size===b.size && a.nlink===b.nlink &&
        a.mtimeMs===b.mtimeMs && a.ctimeMs===b.ctimeMs;
}
function validWitnessFile(stat){
 return stat.isFile() && !stat.isSymbolicLink() &&
        stat.nlink===1 && stat.size>=1 &&
        stat.size<=MAX_WITNESS_BYTES;
}
async function readSyntheticOperationLedger(root,nonce){
 const directory=await authenticate(root,nonce);
 const name=join(directory,FILE);
 let fd;
 try{
  const before=await fs.lstat(name);
  if(!validWitnessFile(before))deny();
  // O_NOFOLLOW is used where supported. Win32 also gets independent lstat
  // checks; the read-only witness never authorizes an actual modification.
  const flags=constants.O_RDONLY |
   (process.platform==='win32'?0:constants.O_NOFOLLOW);
  fd=await fs.open(name,flags);
  const opened=await fd.stat();
  if(!validWitnessFile(opened)||!sameWitnessInfo(before,opened))deny();
  const data=Buffer.alloc(MAX_WITNESS_BYTES+1);
  let consumed=0;
  while(consumed<data.length){
   const {bytesRead}=await fd.read(data,consumed,data.length-consumed,consumed);
   if(bytesRead===0)break;
   consumed+=bytesRead;
  }
  if(consumed!==opened.size||consumed>MAX_WITNESS_BYTES)deny();
  const afterFd=await fd.stat();
  const afterPath=await fs.lstat(name);
  if(!sameWitnessInfo(opened,afterFd)||
     !sameWitnessInfo(opened,afterPath)||
     !validWitnessFile(afterPath))deny();

  const bytes=data.subarray(0,consumed).toString('utf8');
  if(!bytes.endsWith('\n')||bytes.includes('\r'))deny();
  const rows=bytes.slice(0,-1).split('\n');
  if(rows.length<1||rows.length>MAX_EVENTS)deny();
  let state=null,previous=GENESIS;
  const records=[];
  for(let i=0;i<rows.length;i++){
   let row;
   try{row=JSON.parse(rows[i]);}catch{deny();}
   if(!row||Array.isArray(row)||typeof row!=='object'||
      Object.keys(row).sort().join(',')!=='digest,event,previous,schema,sequence'||
      row.schema!==SCHEMA||row.sequence!==i+1||
      typeof row.event!=='string'||
      typeof row.previous!=='string'||
      typeof row.digest!=='string'||
      !/^[0-9a-f]{64}$/.test(row.previous)||
      !/^[0-9a-f]{64}$/.test(row.digest))deny();
   if(row.previous!==previous)deny();
   const expected=linkedRecord(row.sequence,row.event,previous);
   if(row.digest!==expected.digest)deny();
   // Canonical serialization rejects duplicate keys, shuffled fields,
   // whitespace changes and alternate encodings. A full-chain forgery is
   // still possible because this uses unkeyed hashes, not authentication.
   if(JSON.stringify(expected)!==rows[i])deny();
   state=advance(state,row.event);
   previous=row.digest;
   records.push({sequence:row.sequence,event:row.event});
  }
  // This head is a publicly recomputable digest, not a MAC or signature.
  // A separate test-only sibling checkpoint can snapshot it.
  return {schema:SCHEMA,status:summarize(records),
   events:records.map(r=>r.event),chainHead:previous};
 }catch(error){
  if(error?.code==='ENOENT')throw error;
  deny();
 }finally{
  if(fd)await fd.close();
 }
}
// Read-only, fail-closed classification for an external auditor. An invalid
// or absent witness cannot be turned into a completed operation. Authentication
// of the disposable root still MUST succeed; only witness-file failures are
// classified as inconclusive. Never use this result as mutation authority.
async function reviewSyntheticOperationLedger(root,nonce){
 await authenticate(root,nonce);
 try{return await readSyntheticOperationLedger(root,nonce);}
 catch{
  // A missing, unreadable, replaced, or malformed witness is never success.
  // Authentication above remains mandatory; all witness failures stay
  // inconclusive and do not expose system paths to the caller.
  return {schema:SCHEMA,status:'unverifiable_incomplete',events:[]};
 }
}
module.exports={
 createSyntheticOperationLedger,readSyntheticOperationLedger,
 reviewSyntheticOperationLedger,SCHEMA,FILE
};
