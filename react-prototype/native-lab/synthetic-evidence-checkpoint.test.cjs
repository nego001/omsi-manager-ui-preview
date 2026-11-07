'use strict';
// Portable CI-only experiments. Never read games, home files or real mods.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {join,dirname}=require('node:path');
const {tmpdir}=require('node:os');
const {randomBytes}=require('node:crypto');
const {createSyntheticOperationLedger,readSyntheticOperationLedger,
 FILE:WITNESS_FILE}=require('./synthetic-operation-ledger.cjs');
const {createSyntheticEvidenceCheckpoint,reviewSyntheticEvidenceCheckpoint,
 FILE:ANCHOR_FILE,SCHEMA:ANCHOR_SCHEMA}=
 require('./synthetic-evidence-checkpoint.cjs');

const cleanup=new Set();
async function fixture(events){
 const root=await fs.mkdtemp(join(tmpdir(),'omsi-manager-recovery-fixture-'));
 cleanup.add(root);
 const nonce=randomBytes(16).toString('hex');
 await fs.writeFile(join(root,'.omsi-test-fixture-marker'),nonce,{flag:'wx'});
 const ledger=await createSyntheticOperationLedger(root,nonce);
 try{for(const event of events)await ledger.append(event);}
 finally{await ledger.close();}
 return {root,nonce};
}
async function checkpoint(f){
 const created=await createSyntheticEvidenceCheckpoint(f.root,f.nonce);
 cleanup.add(created.directory);
 return created.directory;
}
test.after(async()=>{
 for(const name of cleanup)await fs.rm(name,{recursive:true,force:true});
});

test('independent sibling checkpoint matches unchanged interrupted evidence',async()=>{
 const f=await fixture(['started','intermediate_observed','interrupted']);
 const anchor=await checkpoint(f);
 assert.notEqual(anchor,f.root);
 assert.equal(dirname(anchor),dirname(f.root));
 const result=await reviewSyntheticEvidenceCheckpoint(f.root,f.nonce,anchor);
 assert.equal(result.status,'interrupted_intermediate');
 assert.equal(result.checkpointMatch,true);
 assert.deepEqual(result.events,
  ['started','intermediate_observed','interrupted']);
 const data=await fs.readFile(join(anchor,ANCHOR_FILE),'utf8');
 assert.equal(data.includes(f.root),false);
 assert.equal(data.includes(f.nonce),false);
});

test('full valid witness rewrite after checkpoint becomes unverifiable',async()=>{
 const before=await fixture(['started','intermediate_observed','interrupted']);
 const anchor=await checkpoint(before);
 const forged=await fixture(['started','completed_observed']);
 await fs.copyFile(join(forged.root,WITNESS_FILE),
  join(before.root,WITNESS_FILE));
 assert.equal((await readSyntheticOperationLedger(before.root,before.nonce)).status,
  'completion_observed_not_durable');
 const audited=await reviewSyntheticEvidenceCheckpoint(
  before.root,before.nonce,anchor);
 assert.equal(audited.status,'unverifiable_incomplete');
 assert.equal(audited.checkpointMatch,false);
 assert.deepEqual(audited.events,[]);
});

test('removing a complete last record leaves valid prefix but breaks external checkpoint',async()=>{
 const f=await fixture(['started','completed_observed']);
 const anchor=await checkpoint(f);
 const file=join(f.root,WITNESS_FILE);
 const text=await fs.readFile(file,'utf8');
 await fs.writeFile(file,text.split('\n')[0]+'\n');
 assert.equal((await readSyntheticOperationLedger(f.root,f.nonce)).status,
  'incomplete_unconfirmed');
 const checked=await reviewSyntheticEvidenceCheckpoint(f.root,f.nonce,anchor);
 assert.equal(checked.status,'unverifiable_incomplete');
 assert.equal(checked.checkpointMatch,false);
});

test('missing, invalid or edited checkpoint never turns success into attested completion',async()=>{
 const f=await fixture(['started','completed_observed']);
 const anchor=await checkpoint(f);
 const file=join(anchor,ANCHOR_FILE);
 await fs.appendFile(file,'unexpected');
 let result=await reviewSyntheticEvidenceCheckpoint(f.root,f.nonce,anchor);
 assert.equal(result.status,'unverifiable_incomplete');
 assert.equal(result.checkpointMatch,false);
 await fs.rm(file);
 result=await reviewSyntheticEvidenceCheckpoint(f.root,f.nonce,anchor);
 assert.equal(result.status,'unverifiable_incomplete');
 result=await reviewSyntheticEvidenceCheckpoint(f.root,f.nonce,f.root);
 assert.equal(result.status,'unverifiable_incomplete');
});

test('hardlinked checkpoint is refused as independent evidence',async()=>{
 const f=await fixture(['started','interrupted']);
 const anchor=await checkpoint(f);
 const file=join(anchor,ANCHOR_FILE),alias=join(anchor,'checkpoint-hardlink-alias');
 await fs.link(file,alias);
 assert.equal((await reviewSyntheticEvidenceCheckpoint(
  f.root,f.nonce,anchor)).status,'unverifiable_incomplete');
 await fs.unlink(alias);
 assert.equal((await reviewSyntheticEvidenceCheckpoint(
  f.root,f.nonce,anchor)).checkpointMatch,true);
});

test('checkpoint symlink substitution is refused when supported',async(t)=>{
 const f=await fixture(['started','interrupted']);
 const anchor=await checkpoint(f);
 const file=join(anchor,ANCHOR_FILE),other=join(anchor,'checkpoint-copy');
 await fs.rename(file,other);
 try{await fs.symlink(other,file,'file');}
 catch(err){
  if(['EPERM','EACCES','ENOSYS','EINVAL'].includes(err.code)){
   t.skip('Symlink creation unavailable in runner');
   return;
  }
  throw err;
 }
 assert.equal((await reviewSyntheticEvidenceCheckpoint(
  f.root,f.nonce,anchor)).status,'unverifiable_incomplete');
});

test('compromising BOTH checkpoint and witness can forge a matching history',async()=>{
 const before=await fixture(['started','intermediate_observed','interrupted']);
 const anchor=await checkpoint(before);
 const forge=await fixture(['started','completed_observed']);
 await fs.copyFile(join(forge.root,WITNESS_FILE),
  join(before.root,WITNESS_FILE));
 const forged=await readSyntheticOperationLedger(before.root,before.nonce);
 const file=join(anchor,ANCHOR_FILE);
 // An attacker who can edit BOTH locations can rewrite the public anchor.
 // This experiment proves the storage separation is not authentication.
 await fs.writeFile(file,JSON.stringify({
  schema:ANCHOR_SCHEMA,head:forged.chainHead,count:forged.events.length
 })+'\n');
 const checked=await reviewSyntheticEvidenceCheckpoint(
  before.root,before.nonce,anchor);
 assert.equal(checked.checkpointMatch,true);
 assert.equal(checked.status,'completion_observed_not_durable');
 // No synthetic target was restored by this "success" witness.
 await assert.rejects(fs.stat(join(before.root,'metadata-probe.scs')),
  {code:'ENOENT'});
});

test('wrong nonce refuses checkpoint review before consulting external evidence',async()=>{
 const f=await fixture(['started','completed_observed']);
 const anchor=await checkpoint(f);
 await assert.rejects(
  reviewSyntheticEvidenceCheckpoint(f.root,'f'.repeat(32),anchor),
  /Synthetic operation witness refused/);
});

test('old witness schema cannot be checkpointed by the v2 verifier',async()=>{
 const f=await fixture(['started']);
 const file=join(f.root,WITNESS_FILE);
 await fs.writeFile(file,JSON.stringify({
  schema:'omsi-synthetic-operation-witness-v1',
  sequence:1,event:'started'
 })+'\n');
 await assert.rejects(createSyntheticEvidenceCheckpoint(f.root,f.nonce),
  /Synthetic operation witness refused/);
});
