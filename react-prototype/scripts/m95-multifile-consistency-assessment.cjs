'use strict';
// Test-only independent read-only observation of a private M94 fixture.
// No publication, rollback, journal trust, or production permission.
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const SLOTS=Object.freeze(['definition','model','sound']);
const refuse=()=>{throw Error('M95_FIXTURE_REFUSED');};
const hash=b=>createHash('sha256').update(b).digest('hex');
function identity(s){
 if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1n||s.size<1n||s.size>4096n)return null;
 return [s.dev,s.ino,s.mode,s.size,s.nlink,s.mtimeNs,s.ctimeNs].join(':');
}
async function checkedRoot(root){
 const base=await fs.realpath(os.tmpdir());
 if(typeof root!=='string'||path.dirname(root)!==base||!/^omsi-m94-multifile-[a-zA-Z0-9_-]+$/.test(path.basename(root)))refuse();
 const s=await fs.lstat(root,{bigint:true});
 if(!s.isDirectory()||s.isSymbolicLink()||await fs.realpath(root)!==root)refuse();
 return [s.dev,s.ino].join(':');
}
async function read(file){
 let before;
 try{before=await fs.lstat(file,{bigint:true});}
 catch(e){if(e.code==='ENOENT')return {state:'missing'};throw e;}
 const k=identity(before);if(!k)return {state:'unsafe'};
 let h;
 try{
  h=await fs.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
  if(identity(await h.stat({bigint:true}))!==k)return {state:'unsafe'};
  const bytes=Buffer.alloc(Number(before.size));let offset=0;
  while(offset<bytes.length){
   const {bytesRead}=await h.read(bytes,offset,bytes.length-offset,offset);
   if(!bytesRead)return {state:'unsafe'};offset+=bytesRead;
  }
  if(identity(await h.stat({bigint:true}))!==k||identity(await fs.lstat(file,{bigint:true}))!==k)return {state:'unsafe'};
  return {state:'observed',hash:hash(bytes),bytes};
 }catch{return {state:'unsafe'};}finally{if(h)await h.close();}
}
const matches=(v,b)=>v.state==='observed'&&v.hash===hash(b)&&v.bytes.equals(b);
async function assessPrivateFixture(root,previous){
 const rootBefore=await checkedRoot(root);
 const members=[];
 for(const slot of SLOTS){
  const original=Buffer.from('M94 '+slot+' original fixture\n'),edited=Buffer.from('M94 '+slot+' edited fixture\n');
  const [target,backup,stage]=await Promise.all(['target','backup','stage'].map(role=>read(path.join(root,slot+'.'+role))));
  const state=matches(target,original)?'original-observed':matches(target,edited)?'edited-observed':target.state==='missing'?'missing':'divergent';
  members.push(Object.freeze({slot,state,backupIntact:matches(backup,original),stagePresent:stage.state!=='missing',stageIntact:matches(stage,original)}));
 }
 if(await checkedRoot(root)!==rootBefore)refuse();
 const originalCount=members.filter(m=>m.state==='original-observed').length;
 const editedCount=members.filter(m=>m.state==='edited-observed').length;
 const divergentCount=members.length-originalCount-editedCount;
 const backupsIntact=members.every(m=>m.backupIntact);
 const stagesConsistent=members.every(m=>m.state==='original-observed'?!m.stagePresent:m.state==='edited-observed'&&m.stagePresent&&m.stageIntact);
 const prefixConsistent=members.every((m,i)=>m.state===(i<originalCount?'original-observed':'edited-observed'));
 const observationAgrees=Array.isArray(previous)&&previous.length===SLOTS.length&&members.every((m,i)=>{
  const p=previous[i];return p&&Object.keys(m).every(k=>m[k]===p[k]);
 });
 let disposition='inconsistent-manual-review';
 if(!observationAgrees)disposition='observation-divergence-refused';
 else if(backupsIntact&&stagesConsistent&&prefixConsistent){
  disposition=originalCount===SLOTS.length?'all-original-observed-no-replay':
   originalCount===0?'all-edited-observed-no-publication':'ordered-partial-publication-review';
 }
 return Object.freeze({schema:'omsi-m95-consistency-assessment-v1',scope:'temporary-fixture-only',
  disposition,originalCount,editedCount,divergentCount,backupsIntact,stagesConsistent,prefixConsistent,observationAgrees,
  members:Object.freeze(members),sameProcessObservation:true,independentProcessVerified:false,
  recoveryAttempted:false,automaticReplayAllowed:false,automaticRollbackAllowed:false,
  groupAtomicityProven:false,durabilityProven:false,nativeIdentityProven:false,realFilesInspected:false,
  operationsEnabled:false,filesModifiedInGames:0});
}
module.exports={assessPrivateFixture};
