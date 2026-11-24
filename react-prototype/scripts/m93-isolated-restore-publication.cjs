'use strict';
// Test-only, disposable, self-owned directory, fixed synthetic bytes.
// This exercises rename publication, not a production restore algorithm.
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const ORIGINAL=Buffer.alloc(2048,0x41);
const EDITED=Buffer.alloc(3072,0x42);
const DRIFT=Buffer.alloc(3072,0x43);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const refuse=()=>{throw Error('M93_FIXTURE_REFUSED');};
const scenarios=Object.freeze(['normal','partial-stage','changed-target','missing-target','changed-backup']);
function identity(s){
 if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1n||s.size<1n||s.size>4096n)refuse();
 return [s.dev,s.ino,s.mode,s.size,s.nlink,s.mtimeNs,s.ctimeNs].join(':');
}
async function snapshot(file){
 let before;
 try{before=await fs.lstat(file,{bigint:true});}
 catch(e){if(e.code==='ENOENT')return null;throw e;}
 const key=identity(before);
 const h=await fs.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
 try{
  if(identity(await h.stat({bigint:true}))!==key)refuse();
  const bytes=Buffer.alloc(Number(before.size));let offset=0;
  while(offset<bytes.length){
   const {bytesRead}=await h.read(bytes,offset,bytes.length-offset,offset);
   if(!bytesRead)refuse();offset+=bytesRead;
  }
  if(identity(await h.stat({bigint:true}))!==key||identity(await fs.lstat(file,{bigint:true}))!==key)refuse();
  return {bytes,hash:digest(bytes),key};
 }finally{await h.close();}
}
async function create(file,bytes){
 const h=await fs.open(file,'wx',0o600);
 try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}
}
const matches=(s,bytes)=>s!==null&&s.bytes.equals(bytes)&&s.hash===digest(bytes);
async function runSyntheticPublication(scenario='normal'){
 if(!scenarios.includes(scenario))refuse();
 const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'omsi-m93-publication-'));
 const target=path.join(root,'target.fixture'),backup=path.join(root,'backup.fixture'),stage=path.join(root,'stage.fixture');
 try{
  await create(target,EDITED);await create(backup,ORIGINAL);
  const expectedTarget=await snapshot(target),expectedBackup=await snapshot(backup);
  if(!matches(expectedTarget,EDITED)||!matches(expectedBackup,ORIGINAL))refuse();
  await create(stage,scenario==='partial-stage'?ORIGINAL.subarray(0,1024):ORIGINAL);
  if(scenario==='changed-target')await fs.writeFile(target,DRIFT);
  if(scenario==='missing-target')await fs.unlink(target);
  if(scenario==='changed-backup')await fs.writeFile(backup,Buffer.alloc(2048,0x44));
  const observedTarget=await snapshot(target),observedBackup=await snapshot(backup),observedStage=await snapshot(stage);
  const targetMatches=matches(observedTarget,EDITED)&&observedTarget.key===expectedTarget.key;
  const backupMatches=matches(observedBackup,ORIGINAL)&&observedBackup.key===expectedBackup.key;
  const stageMatches=matches(observedStage,ORIGINAL);
  let renameCompleted=false,directorySyncObserved=false,directorySyncStatus='not-attempted';
  if(targetMatches&&backupMatches&&stageMatches){
   // Recheck identities immediately before publication in this private lab.
   // These observations are not race-proof or native path attestation.
   for(const [file,expected] of [[target,observedTarget],[backup,observedBackup],[stage,observedStage]]){
    const current=await snapshot(file);
    if(!current||current.key!==expected.key||!current.bytes.equals(expected.bytes))refuse();
   }
   await fs.rename(stage,target);renameCompleted=true;
   if(process.platform==='linux'){
    const h=await fs.open(root,constants.O_RDONLY|constants.O_DIRECTORY);
    try{await h.sync();directorySyncObserved=true;directorySyncStatus='sync-returned';}
    catch(e){if(!['EINVAL','ENOTSUP','EOPNOTSUPP'].includes(e.code))throw e;directorySyncStatus='unsupported';}
    finally{await h.close();}
   }else directorySyncStatus='not-tested-on-platform';
  }
  const final=await snapshot(target),remainingStage=await snapshot(stage),finalBackup=await snapshot(backup);
  const restoredBytesMatch=renameCompleted&&matches(final,ORIGINAL);
  if(renameCompleted&&(!restoredBytesMatch||remainingStage!==null||!matches(finalBackup,ORIGINAL)))refuse();
  const unchanged=!renameCompleted&&(observedTarget===null?final===null:final!==null&&final.key===observedTarget.key&&final.bytes.equals(observedTarget.bytes));
  if(!renameCompleted&&!unchanged)refuse();
  return Object.freeze({schema:'omsi-m93-publication-rehearsal-v1',scope:'self-created-temporary-fixture-only',scenario,
   outcome:renameCompleted?'fixture-publication-observed':!targetMatches?'target-refused':!backupMatches?'backup-refused':'stage-refused',
   targetMatches,backupMatches,stageMatches,renameCompleted,restoredBytesMatch,
   stageConsumed:remainingStage===null,refusedTargetUnchanged:unchanged,
   directorySyncObserved,directorySyncStatus,
   concurrentVisibilityProven:false,atomicRestoreProven:false,durabilityProven:false,nativeIdentityProven:false,
   realFilesInspected:false,operationsEnabled:false,filesModifiedInGames:0});
 }finally{await fs.rm(root,{recursive:true,force:true});}
}
module.exports={runSyntheticPublication};
