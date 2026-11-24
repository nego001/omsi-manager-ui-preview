'use strict';
// Test only. Fixed synthetic members, existing marker-checked fixture root.
// Sequential publication does not provide group atomicity.
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const path=require('node:path');
const {checkedRoot}=require('./temp-recovery-fixture.cjs');
const SLOTS=Object.freeze(['definition','model','sound']);
const refuse=()=>{throw Error('M97_FIXTURE_REFUSED');};
const original=s=>Buffer.from('M97 '+s+' original fixture\n');
const edited=s=>Buffer.from('M97 '+s+' edited fixture\n');
const names=(root,s)=>['target','backup','stage'].map(role=>path.join(root,'m97-'+s+'.'+role));
function key(s){
 if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1n||s.size<1n||s.size>4096n)return null;
 return [s.dev,s.ino,s.mode,s.size,s.nlink,s.mtimeNs,s.ctimeNs].join(':');
}
async function read(file){
 let before;
 try{before=await fs.lstat(file,{bigint:true});}
 catch(e){if(e.code==='ENOENT')return {kind:'missing'};throw e;}
 const k=key(before);if(!k)return {kind:'unsafe'};
 let h;
 try{
  h=await fs.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
  if(key(await h.stat({bigint:true}))!==k)return {kind:'unsafe'};
  const bytes=Buffer.alloc(Number(before.size));let offset=0;
  while(offset<bytes.length){
   const {bytesRead}=await h.read(bytes,offset,bytes.length-offset,offset);
   if(!bytesRead)return {kind:'unsafe'};offset+=bytesRead;
  }
  if(key(await h.stat({bigint:true}))!==k||key(await fs.lstat(file,{bigint:true}))!==k)return {kind:'unsafe'};
  return {kind:'observed',bytes};
 }catch{return {kind:'unsafe'};}finally{if(h)await h.close();}
}
const matches=(v,b)=>v.kind==='observed'&&v.bytes.equals(b);
async function create(file,bytes){
 const h=await fs.open(file,'wx',0o600);
 try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}
}
async function inspect(root,nonce){
 root=await checkedRoot(root,nonce);
 const members=[];
 for(const slot of SLOTS){
  const [t,b,s]=await Promise.all(names(root,slot).map(read));
  members.push(Object.freeze({slot,state:matches(t,original(slot))?'original-observed':matches(t,edited(slot))?'edited-observed':t.kind==='missing'?'missing':'divergent',
   backupIntact:matches(b,original(slot)),stagePresent:s.kind!=='missing',stageIntact:matches(s,original(slot))}));
 }
 const count=members.filter(m=>m.state==='original-observed').length;
 const prefixConsistent=members.every((m,i)=>m.state===(i<count?'original-observed':'edited-observed'));
 const stagesConsistent=members.every((m,i)=>i<count?!m.stagePresent:m.stagePresent&&m.stageIntact);
 const backupsIntact=members.every(m=>m.backupIntact);
 const coherent=prefixConsistent&&stagesConsistent&&backupsIntact;
 return Object.freeze({scope:'synthetic-fixture-only',outcome:!coherent?'inconsistent-untrusted':
  count===0?'prepared-untrusted':count===3?'published-untrusted':'partial-untrusted',
  originalCount:count,members:Object.freeze(members),prefixConsistent,stagesConsistent,backupsIntact,
  automaticRecoveryAttempted:false,automaticReplayAllowed:false,oldEvidenceReusable:false,
  groupAtomicityProven:false,durabilityProven:false,realFilesInspected:false,operationsEnabled:false,filesModifiedInGames:0});
}
async function publishUntilKilled(root,nonce,stop){
 if(!Number.isInteger(stop)||stop<0||stop>3||typeof process.send!=='function'||!process.connected)refuse();
 root=await checkedRoot(root,nonce);
 for(const slot of SLOTS)for(const file of names(root,slot))if((await read(file)).kind!=='missing')refuse();
 for(const slot of SLOTS){
  const [t,b,s]=names(root,slot);
  await create(t,edited(slot));await create(b,original(slot));await create(s,original(slot));
 }
 async function checkpoint(n){
  if(n!==stop)return;
  // Wait until externally terminated. Disconnection never resumes publication.
  await new Promise((resolve,reject)=>{
   process.once('disconnect',()=>reject(Error('M97_CONTROLLER_DISCONNECTED')));
   process.send({kind:'m97-checkpoint',published:n},error=>{if(error)reject(error);});
  });
 }
 await checkpoint(0);
 for(let i=0;i<SLOTS.length;i++){
  const before=await inspect(root,nonce);
  if(before.originalCount!==i||before.outcome!==(i===0?'prepared-untrusted':'partial-untrusted'))refuse();
  const [target,,stage]=names(root,SLOTS[i]);
  await fs.rename(stage,target);
  const after=await inspect(root,nonce);
  if(after.originalCount!==i+1||after.outcome!==(i===2?'published-untrusted':'partial-untrusted'))refuse();
  await checkpoint(i+1);
 }
 refuse();
}
module.exports={publishUntilKilled,inspect};
