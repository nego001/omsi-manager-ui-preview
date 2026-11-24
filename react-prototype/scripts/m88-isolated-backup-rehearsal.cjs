'use strict';
// Test-only, self-owned disposable files. No caller paths, arbitrary bytes,
// runtime imports, IPC or production recovery permission.
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createHash,randomBytes}=require('node:crypto');
const PREFIX='omsi-m88-backup-fixture-';
const MAX_BYTES=4096;
const original=Buffer.from('M88 synthetic configuration: original\n');
const modified=Buffer.from('M88 synthetic configuration: edited\n');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const refuse=()=>{throw Error('M88_FIXTURE_REFUSED');};
async function read(handle){
 const before=await handle.stat({bigint:true});
 if(!before.isFile()||before.nlink!==1n||before.size<1n||before.size>BigInt(MAX_BYTES))refuse();
 const size=Number(before.size),out=Buffer.alloc(size);
 let offset=0;
 while(offset<size){
  const {bytesRead}=await handle.read(out,offset,size-offset,offset);
  if(!Number.isSafeInteger(bytesRead)||bytesRead<1||bytesRead>size-offset)refuse();
  offset+=bytesRead;
 }
 const after=await handle.stat({bigint:true});
 for(const key of ['dev','ino','mode','size','nlink','mtimeNs','ctimeNs'])
  if(before[key]!==after[key])refuse();
 return out;
}
async function write(handle,bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_BYTES)refuse();
 await handle.truncate(0);
 let offset=0;
 while(offset<bytes.length){
  const {bytesWritten}=await handle.write(bytes,offset,bytes.length-offset,offset);
  if(!Number.isSafeInteger(bytesWritten)||bytesWritten<1||bytesWritten>bytes.length-offset)refuse();
  offset+=bytesWritten;
 }
 await handle.sync();
}
async function runSyntheticBackupRehearsal(scenario='normal'){
 if(!['normal','corrupt-backup','changed-target'].includes(scenario))refuse();
 // Only a fresh, private, self-created directory and exclusively created
 // fixed files. No arbitrary file descriptors or paths accepted.
 const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),PREFIX));
 let target,backup;
 try{
  target=await fs.open(path.join(root,'target.fixture'),'wx+',0o600);
  backup=await fs.open(path.join(root,'backup.fixture'),'wx+',0o600);
  await write(target,original);
  const captured=await read(target);
  const expected=digest(captured);
  if(!captured.equals(original))refuse();
  await write(backup,captured);
  const initialBackup=await read(backup);
  if(digest(initialBackup)!==expected||!initialBackup.equals(captured))refuse();
  await write(target,modified);
  if(!(await read(target)).equals(modified))refuse();
  // Controlled lab mutations only. Corrupt the backup without changing its
  // size, or introduce a different target generation before restoration.
  if(scenario==='corrupt-backup'){
   const corrupt=Buffer.from(captured);corrupt[0]^=1;await write(backup,corrupt);
  }
  if(scenario==='changed-target')await write(target,Buffer.from('M88 unrelated synthetic revision\n'));
  const current=await read(target);
  const candidate=await read(backup);
  const backupMatches=digest(candidate)===expected&&candidate.equals(captured);
  const targetMatches=current.equals(modified);
  let restorationAttempted=false,restoredBytesMatch=false;
  if(backupMatches&&targetMatches){
   restorationAttempted=true;
   await write(target,candidate);
   const restored=await read(target);
   restoredBytesMatch=restored.equals(captured)&&digest(restored)===expected;
   if(!restoredBytesMatch)refuse();
  }
  const final=await read(target);
  return Object.freeze({schema:'omsi-manager-synthetic-backup-rehearsal-v1',
   scope:'self-created-temporary-fixture-only',scenario,
   outcome:restoredBytesMatch?'fixture-restored':!backupMatches?'backup-mismatch-refused':'target-changed-refused',
   initialBackupMatched:true,backupMatchedBeforeRestore:backupMatches,
   targetGenerationMatched:targetMatches,restorationAttempted,restoredBytesMatch,
   refusedTargetUnchanged:!restorationAttempted&&final.equals(current),
   fileSyncRequested:true,atomicRestoreProven:false,durabilityProven:false,
   realFilesInspected:false,realBackupVerified:false,realRollbackVerified:false,
   operationsEnabled:false,filesModifiedInGames:0});
 }finally{
  // Close both even if one close fails; cleanup is only for our own fixture.
  const closed=await Promise.allSettled([target?.close(),backup?.close()]);
  await fs.rm(root,{recursive:true,force:true});
  if(closed.some(x=>x.status==='rejected'))refuse();
 }
}
// M89: manifest bytes must match a trusted in-memory expectation from the
// same rehearsal. A hash stored next to a backup is not authentication.
const manifestScenarios=Object.freeze(['normal','corrupt-backup','changed-target',
 'manifest-revision','manifest-session','manifest-rehash','manifest-malformed','manifest-target']);
const manifestBytes=record=>Buffer.from(JSON.stringify(record)+'\n','utf8');
async function runSyntheticManifestRehearsal(scenario='normal'){
 if(!manifestScenarios.includes(scenario))refuse();
 const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'omsi-m89-manifest-fixture-'));
 let target,backup,manifest;
 try{
  target=await fs.open(path.join(root,'target.fixture'),'wx+',0o600);
  backup=await fs.open(path.join(root,'backup.fixture'),'wx+',0o600);
  manifest=await fs.open(path.join(root,'manifest.fixture'),'wx+',0o600);
  await write(target,original);
  const captured=await read(target);
  if(!captured.equals(original))refuse();
  const expected=Object.freeze({schema:'omsi-m89-synthetic-manifest-v1',
   scope:'self-created-fixture-only',session:randomBytes(16).toString('hex'),
   originalRevision:1,expectedTargetRevision:2,backupRole:'original-fixture',
   targetRole:'edited-fixture',backupSize:captured.length,backupSha256:digest(captured),
   targetSize:modified.length,targetSha256:digest(modified)});
  const trustedManifest=manifestBytes(expected);
  await write(backup,captured);
  await write(manifest,trustedManifest);
  if(!(await read(backup)).equals(captured)||!(await read(manifest)).equals(trustedManifest))refuse();
  await write(target,modified);
  if(!(await read(target)).equals(modified))refuse();
  // These intentionally controlled mutations affect only laboratory files.
  if(scenario==='corrupt-backup'||scenario==='manifest-rehash'){
   const corrupt=Buffer.from(captured);corrupt[0]^=1;await write(backup,corrupt);
   if(scenario==='manifest-rehash')await write(manifest,manifestBytes({...expected,backupSha256:digest(corrupt)}));
  }
  if(scenario==='changed-target')await write(target,Buffer.from('M89 unrelated synthetic revision\n'));
  if(scenario==='manifest-revision')await write(manifest,manifestBytes({...expected,expectedTargetRevision:3}));
  if(scenario==='manifest-session'){
   // Guarantee a different session value, without a probabilistic assertion.
   const other=(expected.session[0]==='0'?'1':'0')+expected.session.slice(1);
   await write(manifest,manifestBytes({...expected,session:other}));
  }
  if(scenario==='manifest-malformed')await write(manifest,Buffer.from('{"schema":'));
  if(scenario==='manifest-target')await write(manifest,manifestBytes({...expected,targetRole:'other-fixture'}));
  const current=await read(target),candidate=await read(backup),storedManifest=await read(manifest);
  // Strict canonical byte comparison also rejects malformed, duplicate,
  // extra or reordered fields. No untrusted JSON or path is interpreted.
  const manifestMatches=storedManifest.equals(trustedManifest);
  const backupMatches=candidate.length===expected.backupSize&&digest(candidate)===expected.backupSha256&&candidate.equals(captured);
  const targetMatches=current.length===expected.targetSize&&digest(current)===expected.targetSha256&&current.equals(modified);
  let restorationAttempted=false,restoredBytesMatch=false;
  if(manifestMatches&&backupMatches&&targetMatches){
   restorationAttempted=true;
   await write(target,candidate);
   const restored=await read(target);
   restoredBytesMatch=restored.equals(captured)&&digest(restored)===expected.backupSha256;
   if(!restoredBytesMatch)refuse();
  }
  const final=await read(target);
  return Object.freeze({schema:'omsi-manager-synthetic-manifest-rehearsal-v1',
   scope:'self-created-temporary-fixture-only',scenario,
   outcome:restoredBytesMatch?'fixture-restored':!manifestMatches?'manifest-mismatch-refused':!backupMatches?'backup-mismatch-refused':'target-changed-refused',
   initialManifestMatched:true,manifestMatches,backupMatches,targetMatches,
   restorationAttempted,restoredBytesMatch,refusedTargetUnchanged:!restorationAttempted&&final.equals(current),
   manifestAuthenticated:false,crossRestartTrustProven:false,atomicRestoreProven:false,durabilityProven:false,
   realFilesInspected:false,realBackupVerified:false,realRollbackVerified:false,operationsEnabled:false,filesModifiedInGames:0});
 }finally{
  const closed=await Promise.allSettled([target?.close(),backup?.close(),manifest?.close()]);
  await fs.rm(root,{recursive:true,force:true});
  if(closed.some(x=>x.status==='rejected'))refuse();
 }
}
module.exports={runSyntheticBackupRehearsal,runSyntheticManifestRehearsal};
