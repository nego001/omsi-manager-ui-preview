'use strict';
// Adversarial laboratory fixtures ONLY. No real game, mod or private file reads.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {randomBytes,createHmac}=require('node:crypto');
const {createSyntheticOperationLedger,readSyntheticOperationLedger,
 FILE:WITNESS_FILE}=require('./synthetic-operation-ledger.cjs');
const {createSyntheticAuthenticatedReceipt,reviewSyntheticAuthenticatedReceipt,
 KEY_FILE,RECEIPT_FILE,SCHEMA:RECEIPT_SCHEMA}=
 require('./synthetic-evidence-authenticator.cjs');

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
async function receipt(f){
 const locations=await createSyntheticAuthenticatedReceipt(f.root,f.nonce);
 cleanup.add(locations.keyDirectory);
 cleanup.add(locations.receiptDirectory);
 return locations;
}
async function review(f,locations){
 return reviewSyntheticAuthenticatedReceipt(
  f.root,f.nonce,locations.keyDirectory,locations.receiptDirectory);
}
test.after(async()=>{
 for(const root of cleanup)
  await fs.rm(root,{recursive:true,force:true});
});

test('valid synthetic HMAC uses separate directories and never publishes the key',async()=>{
 const f=await fixture(['started','intermediate_observed','interrupted']);
 const r=await receipt(f);
 assert.notEqual(f.root,r.keyDirectory);
 assert.notEqual(f.root,r.receiptDirectory);
 assert.notEqual(r.keyDirectory,r.receiptDirectory);
 const result=await review(f,r);
 assert.equal(result.authenticated,true);
 assert.equal(result.status,'interrupted_intermediate');
 assert.deepEqual(result.events,
  ['started','intermediate_observed','interrupted']);
 const bytes=await fs.readFile(join(r.keyDirectory,KEY_FILE));
 assert.equal(bytes.length,32);
 const publicData=await fs.readFile(join(r.receiptDirectory,RECEIPT_FILE),'utf8');
 assert.equal(publicData.includes(bytes.toString('hex')),false);
 assert.equal(publicData.includes(f.nonce),false);
 assert.equal(publicData.includes(f.root),false);
});

test('rewritten public witness chain and matching public checkpoint do not pass HMAC',async()=>{
 const f=await fixture(['started','intermediate_observed','interrupted']);
 const r=await receipt(f);
 const fake=await fixture(['started','completed_observed']);
 await fs.copyFile(join(fake.root,WITNESS_FILE),join(f.root,WITNESS_FILE));
 const report=await review(f,r);
 assert.equal(report.authenticated,false);
 assert.equal(report.status,'unverifiable_incomplete');
 assert.equal((await readSyntheticOperationLedger(f.root,f.nonce)).status,
  'completion_observed_not_durable');
});

test('public receipt MAC tampering is detected, not silently repaired',async()=>{
 const f=await fixture(['started','completed_observed']);
 const r=await receipt(f);
 const path=join(r.receiptDirectory,RECEIPT_FILE);
 const original=JSON.parse(await fs.readFile(path,'utf8'));
 original.mac='0'.repeat(64);
 await fs.writeFile(path,JSON.stringify(original)+'\n');
 const report=await review(f,r);
 assert.equal(report.authenticated,false);
 assert.equal(report.status,'unverifiable_incomplete');
});

test('replaying a receipt across independent nonce-marked fixtures is rejected',async()=>{
 const f1=await fixture(['started','completed_observed']);
 const f2=await fixture(['started','completed_observed']);
 const r=await receipt(f1);
 assert.equal((await review(f1,r)).authenticated,true);
 const copied=await review(f2,r);
 assert.equal(copied.authenticated,false);
 assert.equal(copied.status,'unverifiable_incomplete');
});

test('missing verifier key is inconclusive and cannot be regenerated as an approval',async()=>{
 const f=await fixture(['started','completed_observed']);
 const r=await receipt(f);
 await fs.rm(join(r.keyDirectory,KEY_FILE));
 const result=await review(f,r);
 assert.equal(result.authenticated,false);
 assert.equal(result.status,'unverifiable_incomplete');
 // New verifier keys produce new receipts, not proof about the lost old key.
 await assert.rejects(fs.stat(join(r.keyDirectory,KEY_FILE)),{code:'ENOENT'});
});

test('altered and invalid-length verifier keys fail closed',async()=>{
 for(const damage of ['truncate','replace']){
  const f=await fixture(['started','interrupted']);
  const r=await receipt(f);
  const file=join(r.keyDirectory,KEY_FILE);
  if(damage==='truncate')await fs.writeFile(file,Buffer.alloc(4));
  else await fs.writeFile(file,Buffer.alloc(32,0x44));
  const result=await review(f,r);
  assert.equal(result.authenticated,false);
  assert.equal(result.status,'unverifiable_incomplete');
 }
});

test('hardlinking the key violates the single-link constraint',async()=>{
 const f=await fixture(['started','interrupted']);
 const r=await receipt(f);
 const name=join(r.keyDirectory,KEY_FILE);
 const alias=join(r.keyDirectory,'disposable-key-hardlink');
 await fs.link(name,alias);
 assert.equal((await review(f,r)).authenticated,false);
 await fs.unlink(alias);
 assert.equal((await review(f,r)).authenticated,true);
});

test('verifier refuses wrong marker nonce even with intact key and receipt',async()=>{
 const f=await fixture(['started','completed_observed']);
 const r=await receipt(f);
 await assert.rejects(
  reviewSyntheticAuthenticatedReceipt(
   f.root,'f'.repeat(32),r.keyDirectory,r.receiptDirectory),
  /Synthetic operation witness refused/);
});

test('key AND receipt compromise can authenticate a forged synthetic history',async()=>{
 const f=await fixture(['started','intermediate_observed','interrupted']);
 const r=await receipt(f);
 const forgery=await fixture(['started','completed_observed']);
 await fs.copyFile(join(forgery.root,WITNESS_FILE),join(f.root,WITNESS_FILE));
 const fake=await readSyntheticOperationLedger(f.root,f.nonce);
 // Deliberate adversarial test: same-user access to private key and receipt.
 // HMAC only has meaning if an attacker CANNOT read/replace this key.
 const stolen=await fs.readFile(join(r.keyDirectory,KEY_FILE));
 const mac=createHmac('sha256',stolen).update(JSON.stringify({
  domain:'OMSI-SYNTHETIC-HMAC-RECEIPT-V1',
  head:fake.chainHead,count:fake.events.length,nonce:f.nonce
 })).digest('hex');
 await fs.writeFile(join(r.receiptDirectory,RECEIPT_FILE),
  JSON.stringify({schema:RECEIPT_SCHEMA,head:fake.chainHead,
   count:fake.events.length,mac})+'\n');
 stolen.fill(0);
 const report=await review(f,r);
 assert.equal(report.authenticated,true);
 assert.equal(report.status,'completion_observed_not_durable');
 // No mod, game file, or even synthetic target was restored.
 await assert.rejects(fs.stat(join(f.root,'metadata-probe.scs')),
  {code:'ENOENT'});
});

test('receipt substitution and missing key directory never authenticate',async()=>{
 const f=await fixture(['started','completed_observed']);
 const r=await receipt(f);
 const receiptFile=join(r.receiptDirectory,RECEIPT_FILE);
 await fs.rm(receiptFile);
 assert.equal((await review(f,r)).authenticated,false);
 await fs.rm(r.keyDirectory,{recursive:true,force:true});
 assert.equal((await review(f,r)).status,'unverifiable_incomplete');
});

test('symlinked verifier key is rejected if supported',async(t)=>{
 const f=await fixture(['started','completed_observed']);
 const r=await receipt(f);
 const key=join(r.keyDirectory,KEY_FILE);
 const backup=join(r.keyDirectory,'key-copy');
 await fs.rename(key,backup);
 try{await fs.symlink(backup,key,'file');}
 catch(err){
  if(['EPERM','EACCES','ENOSYS','EINVAL'].includes(err.code)){
   t.skip('File symlink creation unavailable on runner');return;
  }
  throw err;
 }
 const report=await review(f,r);
 assert.equal(report.status,'unverifiable_incomplete');
 assert.equal(report.authenticated,false);
});
