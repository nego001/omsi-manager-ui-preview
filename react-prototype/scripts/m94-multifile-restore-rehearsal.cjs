'use strict';
// Test-only. All paths and bytes are fixed by this disposable rehearsal.
// Sequential rename is deliberately NOT represented as group atomicity.
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const SLOTS=Object.freeze(['definition','model','sound']);
const SCENARIOS=Object.freeze(['normal','partial-stage','changed-backup','changed-target','stop-after-one','stop-after-two','drift-after-one']);
const refuse=()=>{throw Error('M94_FIXTURE_REFUSED');};
const hash=b=>createHash('sha256').update(b).digest('hex');
function key(s){
 if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1n||s.size<1n||s.size>4096n)refuse();
 return [s.dev,s.ino,s.mode,s.size,s.nlink,s.mtimeNs,s.ctimeNs].join(':');
}
async function observe(file){
 let before;
 try{before=await fs.lstat(file,{bigint:true});}
 catch(e){if(e.code==='ENOENT')return null;throw e;}
 const k=key(before),h=await fs.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
 try{
  if(key(await h.stat({bigint:true}))!==k)refuse();
  const bytes=Buffer.alloc(Number(before.size));let offset=0;
  while(offset<bytes.length){
   const {bytesRead}=await h.read(bytes,offset,bytes.length-offset,offset);
   if(!bytesRead)refuse();offset+=bytesRead;
  }
  if(key(await h.stat({bigint:true}))!==k||key(await fs.lstat(file,{bigint:true}))!==k)refuse();
  return {key:k,bytes,hash:hash(bytes)};
 }finally{await h.close();}
}
async function create(file,bytes){
 const h=await fs.open(file,'wx',0o600);
 try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}
}
const matches=(a,b)=>a!==null&&a.bytes.equals(b)&&a.hash===hash(b);
const same=(a,b)=>a!==null&&b!==null&&a.key===b.key&&a.bytes.equals(b.bytes);

// M96: explicit rehearsal only. Retains pre-publication edited bytes in
// controller memory; original backups are not the rollback source.
async function rehearseRollback(slots,published,assessment,mode){
 const refuseReport=(reason,count=0)=>Object.freeze({
  schema:'omsi-m96-rollback-v1',scope:'self-created-temporary-fixture-only',
  outcome:reason,rollbackCount:count,allEditedObserved:false,
  automaticRollbackAttempted:false,groupAtomicityProven:false,durabilityProven:false,
  realFilesInspected:false,operationsEnabled:false,filesModifiedInGames:0});
 if(mode==='lost-anchor')return refuseReport('independent-anchor-unavailable');
 if(!assessment||assessment.disposition!=='ordered-partial-publication-review'||
    published<1||published>=slots.length)return refuseReport('ineligible-state-refused');
 const targets=slots.map((s,i)=>i<published?s.publishedTarget:s.expectedTarget);
 const stages=new Map();
 // All expected target identities and edited bytes were retained before
 // entering this rehearsal. Verify every member before any rollback rename.
 async function verifyAll(){
  for(let i=0;i<slots.length;i++){
   const s=slots[i];
   if(!same(await observe(s.target),targets[i])||!same(await observe(s.backup),s.expectedBackup))
    return false;
   const stage=await observe(s.stage);
   if(i<published?stage!==null:!same(stage,s.expectedStage))return false;
   if(stages.has(i)){
    const stageRecord=stages.get(i);
    if(!same(await observe(stageRecord.file),stageRecord.snapshot)||
       !matches(stageRecord.snapshot,s.edited))return false;
   }
  }
  return true;
 }
 if(mode==='changed-target')await fs.writeFile(slots[0].target,Buffer.from('M96 unrelated synthetic revision\n'));
 if(!await verifyAll())return refuseReport('target-or-backup-divergence-refused');
 for(let i=0;i<published;i++){
  const s=slots[i],file=s.target+'.rollback';
  await create(file,s.expectedTarget.bytes);
  stages.set(i,{file,snapshot:await observe(file)});
 }
 if(mode==='corrupt-rollback-stage'){
  const stage=stages.get(0);
  await fs.writeFile(stage.file,Buffer.from('M96 corrupted stage\n'));
 }
 if(!await verifyAll())return refuseReport('rollback-stage-divergence-refused');
 let count=0;
 // Reversal in reverse publication order. A later refusal does not undo
 // previously completed reversals or claim transaction-level atomicity.
 for(let i=published-1;i>=0;i--){
  if(!await verifyAll())return refuseReport('partial-rollback-refused',count);
  const s=slots[i],stage=stages.get(i);
  await fs.rename(stage.file,s.target);stages.delete(i);
  const restored=await observe(s.target);
  if(!matches(restored,s.edited)||await observe(stage.file)!==null)refuse();
  targets[i]=restored;count++;
  if(mode==='drift-after-first-reversal'&&count===1&&published>1)
   await fs.writeFile(slots[0].target,Buffer.from('M96 intervening rollback drift\n'));
 }
 const allEditedObserved=(await verifyAll())&&targets.every((t,i)=>matches(t,slots[i].edited));
 if(!allEditedObserved)refuse();
 return Object.freeze({schema:'omsi-m96-rollback-v1',scope:'self-created-temporary-fixture-only',
  outcome:'all-edited-observed',rollbackCount:count,allEditedObserved:true,
  automaticRollbackAttempted:false,groupAtomicityProven:false,durabilityProven:false,
  realFilesInspected:false,operationsEnabled:false,filesModifiedInGames:0});
}
async function rehearseMultifileRestore(scenario='normal',assessmentMode='none',rollbackMode='none'){
 if(!['none','explicit','lost-anchor','changed-target','corrupt-rollback-stage','drift-after-first-reversal'].includes(rollbackMode))refuse();
 if(rollbackMode!=='none'&&assessmentMode!=='observe')refuse();
 if(!['none','observe','drift-between-observations','missing-backup-after-publication'].includes(assessmentMode))refuse();
 if(!SCENARIOS.includes(scenario))refuse();
 const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'omsi-m94-multifile-'));
 try{
  const slots=[];
  for(const name of SLOTS){
   const original=Buffer.from('M94 '+name+' original fixture\n');
   const edited=Buffer.from('M94 '+name+' edited fixture\n');
   const target=path.join(root,name+'.target'),backup=path.join(root,name+'.backup'),stage=path.join(root,name+'.stage');
   await create(target,edited);await create(backup,original);await create(stage,original);
   slots.push({name,original,edited,target,backup,stage,expectedTarget:await observe(target),
    expectedBackup:await observe(backup),expectedStage:await observe(stage)});
  }
  // Damage the final member to test whether the entire batch is checked
  // before the first publication rather than discovering it halfway through.
  const last=slots.at(-1);
  if(scenario==='partial-stage')await fs.writeFile(last.stage,last.original.subarray(0,5));
  if(scenario==='changed-backup')await fs.writeFile(last.backup,Buffer.alloc(last.original.length,0x58));
  if(scenario==='changed-target')await fs.writeFile(last.target,Buffer.from('M94 unrelated target revision\n'));
  const preflight=[];
  for(const s of slots){
   const [target,backup,stage]=await Promise.all([observe(s.target),observe(s.backup),observe(s.stage)]);
   preflight.push(same(target,s.expectedTarget)&&matches(target,s.edited)&&
    same(backup,s.expectedBackup)&&matches(backup,s.original)&&
    same(stage,s.expectedStage)&&matches(stage,s.original));
  }
  const allPreflightPassed=preflight.every(Boolean);
  let published=0,reason=allPreflightPassed?'complete':'preflight-refused';
  if(allPreflightPassed){
   for(const s of slots){
    // Recheck remaining members before each publication. Already published
    // targets cannot be rolled back automatically on a later failure.
    let remainingValid=true;
    for(const next of slots.slice(published)){
     const [target,backup,stage]=await Promise.all([observe(next.target),observe(next.backup),observe(next.stage)]);
     if(!same(target,next.expectedTarget)||!same(backup,next.expectedBackup)||!same(stage,next.expectedStage)){
      remainingValid=false;break;
     }
    }
    if(!remainingValid){reason='drift-refused';break;}
    await fs.rename(s.stage,s.target);published++;
    s.publishedTarget=await observe(s.target);
    if(!matches(s.publishedTarget,s.original)||await observe(s.stage)!==null)refuse();
    if(scenario==='drift-after-one'&&published===1)
     await fs.writeFile(last.target,Buffer.from('M94 intervening fixture revision\n'));
    if((scenario==='stop-after-one'&&published===1)||(scenario==='stop-after-two'&&published===2)){
     reason='controlled-stop';break;
    }
   }
  }
  const members=[];
  for(const s of slots){
   const [target,backup,stage]=await Promise.all([observe(s.target),observe(s.backup),observe(s.stage)]);
   const state=matches(target,s.original)?'original-observed':matches(target,s.edited)?'edited-observed':target===null?'missing':'divergent';
   members.push(Object.freeze({slot:s.name,state,backupIntact:matches(backup,s.original),stagePresent:stage!==null,
    stageIntact:matches(stage,s.original)}));
  }
  const originalCount=members.filter(m=>m.state==='original-observed').length;
  const editedCount=members.filter(m=>m.state==='edited-observed').length;
  const divergentCount=members.length-originalCount-editedCount;
  if(originalCount!==published)refuse();
  if(published===SLOTS.length&&!members.every(m=>m.backupIntact&&!m.stagePresent))refuse();
  let assessment;
  if(assessmentMode!=='none'){
   const {assessPrivateFixture}=require('./m95-multifile-consistency-assessment.cjs');
   // Only this self-created fixture is passed; no public root argument.
   if(assessmentMode==='drift-between-observations')
    await fs.writeFile(slots[0].target,Buffer.from('M95 controlled drift\n'));
   if(assessmentMode==='missing-backup-after-publication')
    await fs.unlink(slots[0].backup);
   assessment=await assessPrivateFixture(root,members);
  }
  const rollback=rollbackMode==='none'?null:await rehearseRollback(slots,published,assessment,rollbackMode);
  // M94 fields describe the pre-reversal observation; M96 reports its own result.
  return Object.freeze({schema:'omsi-m94-multifile-rehearsal-v1',scope:'self-created-temporary-fixture-only',scenario,
   outcome:published===SLOTS.length?'all-original-observed':published===0?'no-publication-observed':'mixed-state-observed',
   reason,allPreflightPassed,preflightPassedCount:preflight.filter(Boolean).length,memberCount:SLOTS.length,
   publishedCount:published,originalCount,editedCount,divergentCount,members:Object.freeze(members),
   ...(assessment?{assessment}:{}),...(rollback?{rollback}:{}),
   automaticRollbackAttempted:false,externalTerminationTested:false,groupAtomicityProven:false,durabilityProven:false,
   realFilesInspected:false,operationsEnabled:false,filesModifiedInGames:0});
 }finally{await fs.rm(root,{recursive:true,force:true});}
}
module.exports={rehearseMultifileRestore};
