'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs/promises');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {join,dirname}=require('node:path');
const {tmpdir}=require('node:os');
const {randomBytes}=require('node:crypto');
const {PREFIX,MARKER}=require('./temp-recovery-fixture.cjs');
const {
 TARGET,MAX_BYTES,plainReport,
 openTemporaryFileReference,inspectTemporaryFileReference,
 closeTemporaryFileReference,captureTemporaryProcessReference,
 inspectTemporaryProcessReference
}=require('./temp-recovery-identity.cjs');
const roots=new Set(),children=new Set();
async function fixture(){
 const root=await fsp.mkdtemp(join(tmpdir(),PREFIX));
 roots.add(root);
 const nonce=randomBytes(16).toString('hex');
 await fsp.writeFile(join(root,MARKER),nonce,{flag:'wx',mode:0o600});
 return {root,nonce,path:join(root,TARGET)};
}
async function withTarget(contents='fixture data only'){
 const f=await fixture();
 await fsp.writeFile(f.path,contents,{flag:'wx',mode:0o600});
 return f;
}
function report(pid){return {pid,generationTag:'a'.repeat(32),claimsAlive:true};}
async function child(){
 const proc=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{
  stdio:'ignore',windowsHide:true,
  env:{...process.env,NODE_OPTIONS:''}
 });
 children.add(proc);
 await once(proc,'spawn');
 return proc;
}
async function stop(proc){
 if(proc.exitCode!==null||proc.signalCode!==null)return;
 const end=once(proc,'exit');
 assert.equal(proc.kill('SIGKILL'),true);
 await end;
}
function blocked(o){
 assert.equal(o.operationsEnabled,false);
 assert.equal(o.nativeIdentityProven,false);
 assert.equal(o.canRecover,false);
 assert.equal(o.canInstall,false);
}
test.after(async()=>{
 for(const proc of children)await stop(proc);
 for(const root of roots)await fsp.rm(root,{force:true,recursive:true});
});
test('stable temporary file is observed through a live OS handle, never trusted',async()=>{
 const f=await withTarget(),token=await openTemporaryFileReference(f.root,f.nonce);
 try{
  const x=await inspectTemporaryFileReference(token);
  assert.equal(x.status,'observed-stable-untrusted');
  assert.equal(x.nativeHandleOpened,true);
  assert.equal(x.pathnameObservationMade,true);
  assert.equal(x.contentDigestCompared,true);
  assert.equal(x.atomicPathIdentityProven,false);
  blocked(x);
 }finally{await closeTemporaryFileReference(token);}
});
test('same-size in-place edit invalidates the handle observation where writes are supported',async(t)=>{
 const f=await withTarget('abcd'),token=await openTemporaryFileReference(f.root,f.nonce);
 try{
  try{await fsp.writeFile(f.path,'wxyz');}
  catch(error){
   if(['EPERM','EACCES','EBUSY'].includes(error.code)){
    t.skip('open read handle blocks overwrite on this filesystem');return;
   }
   throw error;
  }
  const x=await inspectTemporaryFileReference(token);
  assert.equal(x.status,'changed-or-unavailable');
  blocked(x);
 }finally{await closeTemporaryFileReference(token);}
});
test('truncation or expansion cannot be mistaken for unchanged bytes',async(t)=>{
 const f=await withTarget('abcdefghijkl'),token=await openTemporaryFileReference(f.root,f.nonce);
 try{
  try{await fsp.writeFile(f.path,'abc');}
  catch(error){
   if(['EPERM','EACCES','EBUSY'].includes(error.code)){
    t.skip('open read handle blocks truncation on this filesystem');return;
   }
   throw error;
  }
  assert.equal((await inspectTemporaryFileReference(token)).status,'changed-or-unavailable');
 }finally{await closeTemporaryFileReference(token);}
});
test('replacing the pathname after opening cannot approve the old handle',async(t)=>{
 const f=await withTarget('original bytes');
 const replacement=join(f.root,'replacement.tmp');
 await fsp.writeFile(replacement,'another payload');
 const token=await openTemporaryFileReference(f.root,f.nonce);
 try{
  try{await fsp.rename(replacement,f.path);}
  catch(error){
   if(['EPERM','EACCES','EBUSY','EEXIST'].includes(error.code)){
    t.skip('filesystem forbids replacing an open pathname');return;
   }
   throw error;
  }
  const x=await inspectTemporaryFileReference(token);
  assert.equal(x.status,'changed-or-unavailable');
  blocked(x);
 }finally{await closeTemporaryFileReference(token);}
});
test('symlink in place of the allowed file is rejected before opening',async(t)=>{
 const f=await fixture(),destination=join(f.root,'target.data');
 await fsp.writeFile(destination,'link target');
 try{await fsp.symlink(destination,f.path,'file');}
 catch(error){
  if(['EPERM','EACCES','ENOSYS'].includes(error.code)){
   t.skip('symlink creation unavailable');return;
  }
  throw error;
 }
 await assert.rejects(openTemporaryFileReference(f.root,f.nonce),/unsafe fixture target/);
});
test('directory posing as a file is rejected',async()=>{
 const f=await fixture();
 await fsp.mkdir(f.path);
 await assert.rejects(openTemporaryFileReference(f.root,f.nonce),/unsafe fixture target/);
});
test('missing target is denied rather than created',async()=>{
 const f=await fixture();
 await assert.rejects(openTemporaryFileReference(f.root,f.nonce),/missing or unsafe/);
 await assert.rejects(fsp.stat(f.path),{code:'ENOENT'});
});
test('file exceeding bounded observation size is refused without reading it',async()=>{
 const f=await withTarget(Buffer.alloc(MAX_BYTES+1,0x41));
 await assert.rejects(openTemporaryFileReference(f.root,f.nonce),/unsafe fixture target/);
});
test('empty file is not elevated into an identity witness',async()=>{
 const f=await withTarget('');
 await assert.rejects(openTemporaryFileReference(f.root,f.nonce),/unsafe fixture target/);
});
test('a cloned, forged or serialized handle token does not resolve',async()=>{
 const f=await withTarget(),token=await openTemporaryFileReference(f.root,f.nonce);
 try{
  for(const fake of [{...token},JSON.parse(JSON.stringify(token)),null]){
   await assert.rejects(inspectTemporaryFileReference(fake),/unissued file reference/);
  }
 }finally{await closeTemporaryFileReference(token);}
});
test('closing the OS handle is idempotent and prevents further reads',async()=>{
 const f=await withTarget(),token=await openTemporaryFileReference(f.root,f.nonce);
 assert.deepEqual(await closeTemporaryFileReference(token),{closed:true,operationsEnabled:false});
 await closeTemporaryFileReference(token);
 const x=await inspectTemporaryFileReference(token);
 assert.equal(x.status,'closed');
 assert.equal(x.nativeIdentityProven,false);
});
test('marker modification after opening blocks subsequent observation',async()=>{
 const f=await withTarget(),token=await openTemporaryFileReference(f.root,f.nonce);
 try{
  await fsp.writeFile(join(f.root,MARKER),'0'.repeat(32));
  await assert.rejects(inspectTemporaryFileReference(token),/marker mismatch/);
 }finally{await closeTemporaryFileReference(token);}
});
test('parent path outside the temporary-fixture contract is refused',async()=>{
 const f=await withTarget();
 await assert.rejects(openTemporaryFileReference(dirname(f.root),f.nonce),
  /not a direct temporary-fixture directory/);
});
test('two separate fixture files remain independent',async()=>{
 const a=await withTarget('alpha'),b=await withTarget('bravo');
 const ta=await openTemporaryFileReference(a.root,a.nonce);
 const tb=await openTemporaryFileReference(b.root,b.nonce);
 try{
  assert.equal((await inspectTemporaryFileReference(ta)).status,'observed-stable-untrusted');
  assert.equal((await inspectTemporaryFileReference(tb)).status,'observed-stable-untrusted');
  await fsp.writeFile(join(b.root,MARKER),'0'.repeat(32));
  assert.equal((await inspectTemporaryFileReference(ta)).status,'observed-stable-untrusted');
  await assert.rejects(inspectTemporaryFileReference(tb),/marker mismatch/);
 }finally{
  await closeTemporaryFileReference(ta);
  await closeTemporaryFileReference(tb);
 }
});
test('file result exposes no private pathname, byte contents or digest',async()=>{
 const f=await withTarget('SYNTHETIC-CONFIDENTIAL-CANARY'),token=
  await openTemporaryFileReference(f.root,f.nonce);
 try{
  const x=await inspectTemporaryFileReference(token);
  const publicText=JSON.stringify(x);
  for(const privateValue of [f.root,f.nonce,'SYNTHETIC-CONFIDENTIAL-CANARY',
   'identity-target.bin'])
   assert.equal(publicText.includes(privateValue),false);
  assert.equal(Object.isFrozen(x),true);
  blocked(x);
 }finally{await closeTemporaryFileReference(token);}
});
test('real child reference observes exit event without granting recovery',async()=>{
 const proc=await child(),token=captureTemporaryProcessReference(proc);
 let x=inspectTemporaryProcessReference(token,report(proc.pid));
 assert.equal(x.status,'owned-child-not-yet-exited');
 assert.equal(x.reportedPidMatchesOwnedChild,true);
 assert.equal(x.claimReclaimAllowed,false);
 assert.equal(x.processIdentityVerifiedForRecovery,false);
 await stop(proc);
 x=inspectTemporaryProcessReference(token,report(proc.pid));
 assert.equal(x.status,'owned-child-exit-observed');
 assert.equal(x.claimReclaimAllowed,false);
 assert.equal(x.automaticCleanupAllowed,false);
 assert.equal(x.operationsEnabled,false);
});
test('forged report with reused PID and different generation cannot replace handle',async()=>{
 const proc=await child(),token=captureTemporaryProcessReference(proc);
 try{
  const x=inspectTemporaryProcessReference(token,{
   ...report(proc.pid),generationTag:'f'.repeat(32),claimsAlive:false
  });
  assert.equal(x.reportShapeAccepted,true);
  assert.equal(x.reportedPidMatchesOwnedChild,true);
  assert.equal(x.reusedPidCanAuthorize,false);
  assert.equal(x.processIdentityVerifiedForRecovery,false);
 }finally{await stop(proc);}
});
test('different claimed PID never changes the original child reference',async()=>{
 const proc=await child(),token=captureTemporaryProcessReference(proc);
 try{
  const x=inspectTemporaryProcessReference(token,report(proc.pid+1));
  assert.equal(x.reportedPidMatchesOwnedChild,false);
  assert.equal(x.claimReclaimAllowed,false);
 }finally{await stop(proc);}
});
test('untrusted PID report with an accessor is refused without executing getter',async()=>{
 const proc=await child(),token=captureTemporaryProcessReference(proc);
 let calls=0;
 try{
  const forged=Object.defineProperty(report(proc.pid),'pid',{
   enumerable:true,get(){calls++;throw Error('must never run');}
  });
  const x=inspectTemporaryProcessReference(token,forged);
  assert.equal(calls,0);
  assert.equal(x.reportShapeAccepted,false);
  assert.equal(x.reportedPidMatchesOwnedChild,null);
  assert.equal(x.claimReclaimAllowed,false);
 }finally{await stop(proc);}
});
test('invalid PID reports cannot manufacture process identity',async()=>{
 for(const invalid of [
  null,[],{}, {pid:-1,generationTag:'a'.repeat(32),claimsAlive:true},
  {...report(123),operationsEnabled:true},
  {...report(123),claimsAlive:'true'},
  {...report(123),generationTag:'not a generation'},
  Object.assign(Object.create(null),report(123))
 ]){
  assert.equal(plainReport(invalid),null);
 }
});
test('fake process objects, cloned refs and JSON copies do not grant authority',async()=>{
 assert.throws(()=>captureTemporaryProcessReference({pid:1234}),/not a child process handle/);
 const proc=await child(),token=captureTemporaryProcessReference(proc);
 try{
  for(const forged of [{...token},JSON.parse(JSON.stringify(token)),null])
   assert.throws(()=>inspectTemporaryProcessReference(forged,report(proc.pid)),
    /unissued process reference/);
 }finally{await stop(proc);}
});
test('independent real subprocess references cannot be swapped by a report',async()=>{
 const a=await child(),b=await child();
 const first=captureTemporaryProcessReference(a),second=captureTemporaryProcessReference(b);
 try{
  const aStatus=inspectTemporaryProcessReference(first,report(b.pid));
  const bStatus=inspectTemporaryProcessReference(second,report(a.pid));
  assert.equal(aStatus.reportedPidMatchesOwnedChild,false);
  assert.equal(bStatus.reportedPidMatchesOwnedChild,false);
  assert.equal(aStatus.operationsEnabled,false);
  assert.equal(bStatus.operationsEnabled,false);
  await stop(a);
  assert.equal(inspectTemporaryProcessReference(first,null).status,'owned-child-exit-observed');
  assert.equal(inspectTemporaryProcessReference(second,null).status,'owned-child-not-yet-exited');
 }finally{await stop(a);await stop(b);}
});
