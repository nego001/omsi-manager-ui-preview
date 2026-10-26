'use strict';
// External witness for synthetic CI fixtures ONLY, not a transaction log.
// Never packaged with Electron, never consulted to permit real operations.
const fs=require('node:fs/promises');
const {join,dirname,basename,resolve}=require('node:path');
const {tmpdir}=require('node:os');

const SCHEMA='omsi-synthetic-operation-witness-v1';
const FILE='.omsi-test-operation-witness.jsonl';
const PREFIX='omsi-manager-recovery-fixture-';
const MARKER='.omsi-test-fixture-marker';
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
 let state=null,sequence=0,closed=false;
 return {
   async append(event){
     if(closed)deny();
     const next=advance(state,event);
     const line=Buffer.from(JSON.stringify({
       schema:SCHEMA,sequence:sequence+1,event:next
     })+'\n','utf8');
     const {bytesWritten}=await handle.write(line,0,line.length,null);
     if(bytesWritten!==line.length)deny();
     await handle.sync();
     sequence++;
     state=next;
     return summarize([{event:state}]);
   },
   async close(){
     if(!closed){closed=true;await handle.close();}
   }
 };
}
async function readSyntheticOperationLedger(root,nonce){
 const directory=await authenticate(root,nonce);
 const stat=await fs.lstat(join(directory,FILE));
 if(!stat.isFile()||stat.isSymbolicLink()||
    stat.nlink!==1||stat.size<1||stat.size>4096)deny();
 const bytes=await fs.readFile(join(directory,FILE),'utf8');
 if(!bytes.endsWith('\n'))deny();
 const rows=bytes.trimEnd().split('\n');
 if(rows.length<1||rows.length>12)deny();
 let state=null;
 const records=[];
 for(let i=0;i<rows.length;i++){
   let row;
   try{row=JSON.parse(rows[i]);}catch{deny();}
   if(!row||Array.isArray(row)||typeof row!=='object'||
      Object.keys(row).sort().join(',')!=='event,schema,sequence'||
      row.schema!==SCHEMA||row.sequence!==i+1||
      typeof row.event!=='string')deny();
   state=advance(state,row.event);
   records.push({sequence:row.sequence,event:row.event});
 }
 return {schema:SCHEMA,status:summarize(records),events:records.map(r=>r.event)};
}
// Read-only, fail-closed classification for an external auditor. An invalid
// or absent witness cannot be turned into a completed operation. Authentication
// of the disposable root still MUST succeed; only witness-file failures are
// classified as inconclusive. Never use this result as mutation authority.
async function reviewSyntheticOperationLedger(root,nonce){
 await authenticate(root,nonce);
 try{return await readSyntheticOperationLedger(root,nonce);}
 catch(err){
  if(err?.message!=='Synthetic operation witness refused'&&err?.code!=='ENOENT')
   throw err;
  return {schema:SCHEMA,status:'unverifiable_incomplete',events:[]};
 }
}
module.exports={
 createSyntheticOperationLedger,readSyntheticOperationLedger,
 reviewSyntheticOperationLedger,SCHEMA,FILE
};
