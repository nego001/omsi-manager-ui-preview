'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs/promises');
const {spawnSync}=require('node:child_process');
const {join,dirname}=require('node:path');
const {tmpdir}=require('node:os');
const {randomBytes}=require('node:crypto');
const {PREFIX,MARKER}=require('./temp-recovery-fixture.cjs');
const {
 openTemporaryEvidenceSession,observeTemporaryEvidence,
 inspectTemporaryEvidenceReceipt,releaseTemporaryEvidenceSession
}=require('./temp-evidence-lifecycle.cjs');
const roots=new Set(),sessions=new Set();
async function fixture(bytes='TEST-DATA-ONE'){
 const root=await fsp.mkdtemp(join(tmpdir(),PREFIX));
 roots.add(root);
 const nonce=randomBytes(16).toString('hex');
 await fsp.writeFile(join(root,MARKER),nonce,{flag:'wx',mode:0o600});
 if(bytes!==null)await fsp.writeFile(join(root,'identity-target.bin'),bytes,
  {flag:'wx',mode:0o600});
 return {root,nonce,file:join(root,'identity-target.bin')};
}
async function open(f){
 const session=await openTemporaryEvidenceSession(f.root,f.nonce);
 sessions.add(session);
 return session;
}
function deny(r){
 assert.equal(r.observationIsAuthorization,false);
 assert.equal(r.continuityAcrossReleaseProven,false);
 assert.equal(r.abaRuledOut,false);
 assert.equal(r.nativeLockOwnershipVerified,false);
 assert.equal(r.sessionCanBeReusedForRealMods,false);
 assert.equal(r.canRecover,false);
 assert.equal(r.canInstall,false);
 assert.equal(r.canDelete,false);
 assert.equal(r.operationsEnabled,false);
 assert.equal(r.filesModifiedInGames,0);
 assert.equal(Object.isFrozen(r),true);
}
test.after(async()=>{
 for(const s of sessions)await releaseTemporaryEvidenceSession(s);
 for(const root of roots)await fsp.rm(root,{recursive:true,force:true});
});
test('a live read-only session produces an untrusted receipt without permission',async()=>{
 const f=await fixture(),s=await open(f);
 const x=await observeTemporaryEvidence(s);
 assert.equal(x.outcome,'observed-stable-untrusted');
 assert.equal(x.sessionState,'open');
 assert.equal(Object.isFrozen(x.receipt),true);
 deny(x);
 const r=inspectTemporaryEvidenceReceipt(s,x.receipt);
 assert.equal(r.outcome,'latest-observation-untrusted');
 deny(r);
});
test('closing revokes the last observation before close resolves',async()=>{
 const s=await open(await fixture()),x=await observeTemporaryEvidence(s);
 const closing=releaseTemporaryEvidenceSession(s);
 assert.equal(inspectTemporaryEvidenceReceipt(s,x.receipt).outcome,'revoked-receipt');
 const last=await closing;
 assert.equal(last.sessionState,'released');
 assert.equal((await observeTemporaryEvidence(s)).outcome,'not-observable');
 deny(last);
});
test('releasing an observation twice never reopens its native file handle',async()=>{
 const s=await open(await fixture());
 await observeTemporaryEvidence(s);
 const a=await releaseTemporaryEvidenceSession(s);
 const b=await releaseTemporaryEvidenceSession(s);
 assert.equal(a.sessionState,'released');
 assert.equal(b.sessionState,'released');
 assert.equal((await observeTemporaryEvidence(s)).receipt,null);
});
test('a new read-only observation supersedes the previous receipt',async()=>{
 const s=await open(await fixture());
 const a=(await observeTemporaryEvidence(s)).receipt;
 const b=(await observeTemporaryEvidence(s)).receipt;
 assert.notEqual(a,b);
 assert.equal(inspectTemporaryEvidenceReceipt(s,a).outcome,'superseded-receipt');
 assert.equal(inspectTemporaryEvidenceReceipt(s,b).outcome,'latest-observation-untrusted');
});
test('changing fixture bytes revokes session and both old and future receipts',async()=>{
 const f=await fixture('AAAA'),s=await open(f);
 const initial=(await observeTemporaryEvidence(s)).receipt;
 await fsp.writeFile(f.file,'BBBB');
 const next=await observeTemporaryEvidence(s);
 assert.equal(next.outcome,'changed-or-unavailable');
 assert.equal(next.sessionState,'revoked');
 assert.equal(next.receipt,null);
 assert.equal(inspectTemporaryEvidenceReceipt(s,initial).outcome,'revoked-receipt');
 assert.equal((await observeTemporaryEvidence(s)).outcome,'not-observable');
 deny(next);
});
test('changing the fixture marker revokes without returning any private paths',async()=>{
 const f=await fixture(),s=await open(f);
 await observeTemporaryEvidence(s);
 await fsp.writeFile(join(f.root,MARKER),'f'.repeat(32));
 const r=await observeTemporaryEvidence(s);
 assert.equal(r.outcome,'fixture-validation-failed');
 assert.equal(r.sessionState,'revoked');
 assert.equal(JSON.stringify(r).includes(f.root),false);
 assert.equal(JSON.stringify(r).includes(f.nonce),false);
 deny(r);
});
test('an ABA return after release never resurrects an old receipt',async()=>{
 const f=await fixture('IDENTICAL'),s=await open(f);
 const old=(await observeTemporaryEvidence(s)).receipt;
 await releaseTemporaryEvidenceSession(s);
 const backup=join(f.root,'parked.tmp');
 const standin=join(f.root,'standin.tmp');
 await fsp.writeFile(standin,'IDENTICAL',{flag:'wx'});
 await fsp.rename(f.file,backup);
 await fsp.rename(standin,f.file);
 await fsp.rm(f.file);
 await fsp.rename(backup,f.file);
 const fresh=await open(f);
 const evidence=await observeTemporaryEvidence(fresh);
 assert.equal(evidence.outcome,'observed-stable-untrusted');
 assert.equal(inspectTemporaryEvidenceReceipt(s,old).outcome,'revoked-receipt');
 assert.equal(inspectTemporaryEvidenceReceipt(fresh,old).outcome,'different-session');
 assert.equal(inspectTemporaryEvidenceReceipt(fresh,evidence.receipt).outcome,
  'latest-observation-untrusted');
 deny(evidence);
});
test('a freshly reopened session cannot inherit any previous release ticket',async()=>{
 const f=await fixture(),one=await open(f);
 const a=(await observeTemporaryEvidence(one)).receipt;
 await releaseTemporaryEvidenceSession(one);
 const two=await open(f);
 const b=(await observeTemporaryEvidence(two)).receipt;
 assert.notEqual(a,b);
 assert.equal(inspectTemporaryEvidenceReceipt(two,a).outcome,'different-session');
 assert.equal(inspectTemporaryEvidenceReceipt(one,b).outcome,'different-session');
});
test('receipts from independent fixture directories never cross session boundaries',async()=>{
 const a=await open(await fixture('AAA'));
 const b=await open(await fixture('BBB'));
 const ar=(await observeTemporaryEvidence(a)).receipt;
 const br=(await observeTemporaryEvidence(b)).receipt;
 assert.equal(inspectTemporaryEvidenceReceipt(a,br).outcome,'different-session');
 assert.equal(inspectTemporaryEvidenceReceipt(b,ar).outcome,'different-session');
 assert.equal(inspectTemporaryEvidenceReceipt(a,ar).outcome,'latest-observation-untrusted');
});
test('forged, cloned, parsed, null and accessor tickets do not authenticate',async()=>{
 const s=await open(await fixture()),r=(await observeTemporaryEvidence(s)).receipt;
 const malicious=Object.defineProperty({},'scope',{
  enumerable:true,get(){throw Error('must never run');}
 });
 for(const candidate of [{...r},JSON.parse(JSON.stringify(r)),null,malicious]){
  const x=inspectTemporaryEvidenceReceipt(s,candidate);
  assert.equal(x.outcome,'unissued-receipt');
  deny(x);
 }
});
test('cloning or serializing a session object cannot obtain the live OS handle',async()=>{
 const f=await fixture(),s=await open(f);
 const copy=JSON.parse(JSON.stringify(s));
 await assert.rejects(observeTemporaryEvidence(copy),/unissued reference/);
 await assert.rejects(releaseTemporaryEvidenceSession({...s}),/unissued reference/);
 assert.throws(()=>inspectTemporaryEvidenceReceipt(copy,null),/unissued reference/);
});
test('serialized tokens cannot be used in another Node process',async()=>{
 const f=await fixture(),s=await open(f);
 const r=(await observeTemporaryEvidence(s)).receipt;
 const modulePath=join(__dirname,'temp-evidence-lifecycle.cjs');
 const expression='const x=require(process.argv[1]);'
  +'const s=JSON.parse(process.argv[2]);const r=JSON.parse(process.argv[3]);'
  +'try{x.inspectTemporaryEvidenceReceipt(s,r);process.exit(19)}'
  +'catch(e){process.exit(/unissued reference/.test(e.message)?0:20)}';
 const p=spawnSync(process.execPath,['-e',expression,modulePath,
  JSON.stringify(s),JSON.stringify(r)],{
  encoding:'utf8',timeout:10000,windowsHide:true,
  env:{...process.env,NODE_OPTIONS:''}
 });
 assert.equal(p.error,undefined,String(p.error));
 assert.equal(p.status,0,p.stderr);
});
test('concurrent observation requests issue only one most-recent receipt',async()=>{
 const s=await open(await fixture());
 const [a,b,c]=await Promise.all([
  observeTemporaryEvidence(s),observeTemporaryEvidence(s),observeTemporaryEvidence(s)
 ]);
 assert.equal(a.outcome,'observed-stable-untrusted');
 assert.equal(b.outcome,'observed-stable-untrusted');
 assert.equal(c.outcome,'observed-stable-untrusted');
 assert.equal(inspectTemporaryEvidenceReceipt(s,a.receipt).outcome,'superseded-receipt');
 assert.equal(inspectTemporaryEvidenceReceipt(s,b.receipt).outcome,'superseded-receipt');
 assert.equal(inspectTemporaryEvidenceReceipt(s,c.receipt).outcome,'latest-observation-untrusted');
});
test('a release requested amid pending observations denies reuse immediately',async()=>{
 const s=await open(await fixture());
 const first=observeTemporaryEvidence(s),next=observeTemporaryEvidence(s);
 const closing=releaseTemporaryEvidenceSession(s);
 const [a,b,c]=await Promise.all([first,next,closing]);
 assert.equal(c.sessionState,'released');
 for(const x of [a,b]){
  assert.equal(x.outcome,'not-observable');
  assert.equal(x.receipt,null);
  deny(x);
 }
});
test('failed observation cannot be retried within the same session after restoration',async()=>{
 const f=await fixture('FIRST'),s=await open(f);
 const receipt=(await observeTemporaryEvidence(s)).receipt;
 await fsp.writeFile(f.file,'OTHER');
 assert.equal((await observeTemporaryEvidence(s)).sessionState,'revoked');
 await fsp.writeFile(f.file,'FIRST');
 assert.equal((await observeTemporaryEvidence(s)).outcome,'not-observable');
 assert.equal(inspectTemporaryEvidenceReceipt(s,receipt).outcome,'revoked-receipt');
});
test('closing one session does not revoke a different session on the same fixture',async()=>{
 const f=await fixture(),a=await open(f),b=await open(f);
 const ar=(await observeTemporaryEvidence(a)).receipt;
 const br=(await observeTemporaryEvidence(b)).receipt;
 await releaseTemporaryEvidenceSession(a);
 assert.equal(inspectTemporaryEvidenceReceipt(a,ar).outcome,'revoked-receipt');
 assert.equal(inspectTemporaryEvidenceReceipt(b,br).outcome,'latest-observation-untrusted');
});
test('unsafe parent path cannot create a session or a fixture target',async()=>{
 const f=await fixture();
 await assert.rejects(openTemporaryEvidenceSession(dirname(f.root),f.nonce),
  /not a direct temporary-fixture directory/);
});
test('absent target cannot create evidence by silently creating a file',async()=>{
 const f=await fixture(null);
 await assert.rejects(openTemporaryEvidenceSession(f.root,f.nonce),
  /missing or unsafe fixture target/);
 await assert.rejects(fsp.stat(f.file),{code:'ENOENT'});
});
test('reports never leak bytes, nonce or full path even while session is active',async()=>{
 const f=await fixture('SENSITIVE-SYNTHETIC-CANARY'),s=await open(f);
 const x=await observeTemporaryEvidence(s);
 const visible=JSON.stringify({x,report:inspectTemporaryEvidenceReceipt(s,x.receipt)});
 for(const secret of [f.root,f.nonce,'SENSITIVE-SYNTHETIC-CANARY','identity-target.bin'])
  assert.equal(visible.includes(secret),false);
 deny(x);
});
