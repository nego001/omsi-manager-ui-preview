'use strict';
// Test only. Fixed synthetic bytes; never called by app. Reuses existing
// marker-checked temporary-root convention. This is not a production sandbox.
const fs=require('node:fs/promises');
const constants=require('node:fs').constants;
const path=require('node:path');
const {createHash}=require('node:crypto');
const {checkedRoot}=require('./temp-recovery-fixture.cjs');
const ORIGINAL=Buffer.from('M90 fixture: original configuration\n');
const EDITED=Buffer.from('M90 fixture: edited configuration\n');
const NAMES=Object.freeze(['m90-target.bin','m90-backup.bin','m90-intent.json','m90-stage.bin']);
const POINTS=Object.freeze(['after-target','after-backup','after-intent','after-stage','after-publish','complete']);
const CRASH_EXIT=92;
const refuse=()=>{throw Error('M90_FIXTURE_REFUSED');};
const hash=b=>createHash('sha256').update(b).digest('hex');
function intent(nonce){
 return Buffer.from(JSON.stringify({schema:'m90-fixture-intent-v1',nonce,fromRevision:2,toRevision:1,
  originalHash:hash(ORIGINAL),editedHash:hash(EDITED),operationsEnabled:false})+'\n');
}
async function exclusive(root,name,bytes){
 const h=await fs.open(path.join(root,name),'wx',0o600);
 try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}
}
function key(s){
 if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1n||s.size<1n||s.size>4096n)return null;
 return [s.dev,s.ino,s.mode,s.size,s.nlink,s.mtimeNs,s.ctimeNs].join(':');
}
async function observe(root,name){
 const file=path.join(root,name);
 let before;
 try{before=await fs.lstat(file,{bigint:true});}catch(e){if(e.code==='ENOENT')return {kind:'missing'};throw e;}
 const expected=key(before);if(!expected)return {kind:'unsafe'};
 let h;
 try{
  h=await fs.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
  if(key(await h.stat({bigint:true}))!==expected)return {kind:'unsafe'};
  const bytes=Buffer.alloc(Number(before.size));
  let offset=0;
  while(offset<bytes.length){
   const {bytesRead}=await h.read(bytes,offset,bytes.length-offset,offset);
   if(!bytesRead)return {kind:'unsafe'};offset+=bytesRead;
  }
  if(key(await h.stat({bigint:true}))!==expected||key(await fs.lstat(file,{bigint:true}))!==expected)
   return {kind:'unsafe'};
  return {kind:'observed',bytes};
 }catch{return {kind:'unsafe'};}finally{if(h)await h.close();}
}
async function interrupt(root,nonce,point){
 if(!POINTS.includes(point))refuse();
 root=await checkedRoot(root,nonce);
 for(const name of NAMES)if((await observe(root,name)).kind!=='missing')refuse();
 const stop=stage=>{if(point===stage)process.exit(CRASH_EXIT);};
 await exclusive(root,NAMES[0],EDITED);stop('after-target');
 await exclusive(root,NAMES[1],ORIGINAL);stop('after-backup');
 await exclusive(root,NAMES[2],intent(nonce));stop('after-intent');
 await exclusive(root,NAMES[3],ORIGINAL);stop('after-stage');
 // Same-directory publication in this private fixture only. No directory fsync
 // or guarantee of filesystem atomicity, crash consistency or durable metadata.
 await fs.rename(path.join(root,NAMES[3]),path.join(root,NAMES[0]));stop('after-publish');
 return {scope:'synthetic-fixture-only',operationsEnabled:false};
}
async function inspectAfterRestart(root,nonce){
 root=await checkedRoot(root,nonce);
 const [target,backup,journal,stage]=await Promise.all(NAMES.map(n=>observe(root,n)));
 const matches=(v,b)=>v.kind==='observed'&&v.bytes.equals(b);
 const absent=v=>v.kind==='missing';
 const targetEdited=matches(target,EDITED),targetOriginal=matches(target,ORIGINAL);
 const backupMatches=matches(backup,ORIGINAL),intentMatches=matches(journal,intent(nonce)),stageMatches=matches(stage,ORIGINAL);
 let outcome='inconsistent-untrusted';
 if(targetEdited&&absent(backup)&&absent(journal)&&absent(stage))outcome='target-only-untrusted';
 else if(targetEdited&&backupMatches&&absent(journal)&&absent(stage))outcome='backup-only-untrusted';
 else if(targetEdited&&backupMatches&&intentMatches&&absent(stage))outcome='intent-untrusted';
 else if(targetEdited&&backupMatches&&intentMatches&&stageMatches)outcome='staged-untrusted';
 else if(targetOriginal&&backupMatches&&intentMatches&&absent(stage))outcome='published-untrusted';
 return Object.freeze({scope:'synthetic-fixture-only',outcome,targetEdited,targetOriginal,
  backupMatches,intentMatches,stageMatches,automaticRecoveryAttempted:false,
  oldEvidenceReusable:false,crossRestartTrustProven:false,durabilityProven:false,
  atomicRestoreProven:false,realFilesInspected:false,operationsEnabled:false,filesModifiedInGames:0});
}
module.exports={interrupt,inspectAfterRestart,CRASH_EXIT,NAMES};
