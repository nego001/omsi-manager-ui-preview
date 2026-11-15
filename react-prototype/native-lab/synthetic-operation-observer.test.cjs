'use strict';
// Portable Linux/Windows CI tests. All mutation is confined to new disposable
// nonce-marked TEMP fixtures; no OMSI installations or Electron code involved.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {randomBytes,createHash}=require('node:crypto');
const {
 readSyntheticOperationLedger,reviewSyntheticOperationLedger,
 createSyntheticOperationLedger,SCHEMA,FILE
}=require('./synthetic-operation-ledger.cjs');

const roots=[];
const PREFIX='omsi-manager-recovery-fixture-';
const MARKER='.omsi-test-fixture-marker';
async function fixture(){
 const root=await fs.mkdtemp(join(tmpdir(),PREFIX));
 roots.push(root);
 const nonce=randomBytes(16).toString('hex');
 await fs.writeFile(join(root,MARKER),nonce,{flag:'wx'});
 return {root,nonce};
}
test.after(async()=>{
 for(const root of roots)
  await fs.rm(root,{recursive:true,force:true});
});

async function killObserverAfter(f,events){
 const child=spawn(process.execPath,[
  join(__dirname,'synthetic-operation-observer.worker.cjs'),
  f.root,f.nonce
 ],{windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='',closed=false,childError=null;
 child.stdout.on('data',b=>{stdout+=b.toString();});
 child.stderr.on('data',b=>{stderr+=b.toString();});
 child.on('error',error=>{childError=error;});
 const done=new Promise(resolve=>child.once('close',(code,signal)=>{
  closed=true;
  resolve({code,signal});
 }));
 async function until(text){
  const expires=Date.now()+15000;
  while(!stdout.includes(text)){
   if(childError)throw childError;
   if(closed)throw Error('Observer exited before checkpoint: '+stderr);
   if(Date.now()>expires)throw Error('Observer checkpoint timed out');
   await new Promise(resolve=>setTimeout(resolve,20));
  }
 }
 try{
  await until('OBSERVER_READY\n');
  for(const event of events){
   child.stdin.write(event+'\n');
   await until('SYNCED:'+event+'\n');
  }
  assert.equal(stderr,'');
  assert.ok(!stdout.includes('OBSERVER_CLOSED'),'no orderly shutdown permitted');
  assert.equal(child.kill(),true);
  let timeoutId;
  const exit=await Promise.race([done,new Promise((_,reject)=>{
   timeoutId=setTimeout(()=>reject(Error('Observer kill did not finish')),10000);
  })]).finally(()=>clearTimeout(timeoutId));
  assert.ok(exit.code!==0,'killed observer must not have normal exit');
  return {stdout,stderr};
 }finally{
  if(!closed)child.kill();
  child.stdin.destroy();
 }
}

test('killing only the external observer after started stays incomplete',async()=>{
 const f=await fixture();
 await killObserverAfter(f,['started']);
 const result=await readSyntheticOperationLedger(f.root,f.nonce);
 assert.deepEqual(result.events,['started']);
 assert.equal(result.status,'incomplete_unconfirmed');
 assert.equal((await reviewSyntheticOperationLedger(f.root,f.nonce)).status,
  'incomplete_unconfirmed');
 await assert.rejects(createSyntheticOperationLedger(f.root,f.nonce),
  {code:'EEXIST'});
 assert.equal(await fs.readFile(join(f.root,MARKER),'utf8'),f.nonce);
 await assert.rejects(fs.stat(join(f.root,'metadata-probe.scs')),{code:'ENOENT'});
});

test('observer exit after intermediate event must NOT fabricate interrupted or completed',async()=>{
 const f=await fixture();
 await killObserverAfter(f,['started','intermediate_observed']);
 const result=await readSyntheticOperationLedger(f.root,f.nonce);
 assert.deepEqual(result.events,['started','intermediate_observed']);
 assert.equal(result.status,'incomplete_unconfirmed');
 assert.ok(!result.events.includes('interrupted'));
 assert.ok(!result.events.includes('completed_observed'));
});

test('observer exit after byte-restored event cannot attest metadata or success',async()=>{
 const f=await fixture();
 await killObserverAfter(f,['started','bytes_restored_unconfirmed']);
 const result=await readSyntheticOperationLedger(f.root,f.nonce);
 assert.deepEqual(result.events,['started','bytes_restored_unconfirmed']);
 assert.equal(result.status,'incomplete_unconfirmed');
 assert.ok(!result.events.includes('completed_observed'));
});

test('completed event alone is only a non-durable observer claim, never proof of a restore',async()=>{
 const f=await fixture();
 await killObserverAfter(f,['started','completed_observed']);
 const result=await readSyntheticOperationLedger(f.root,f.nonce);
 assert.equal(result.status,'completion_observed_not_durable');
 assert.deepEqual(result.events,['started','completed_observed']);
 // This witness is NOT an authorization or authenticated commit receipt.
 await assert.rejects(fs.stat(join(f.root,'metadata-probe.scs')),{code:'ENOENT'});
});

test('truncated witness is unverifiable, never treated as completed',async()=>{
 const f=await fixture();
 await killObserverAfter(f,['started','completed_observed']);
 await fs.appendFile(join(f.root,FILE),'{"schema":"untrusted"');
 await assert.rejects(readSyntheticOperationLedger(f.root,f.nonce),
  /Synthetic operation witness refused/);
 const result=await reviewSyntheticOperationLedger(f.root,f.nonce);
 assert.equal(result.status,'unverifiable_incomplete');
 assert.deepEqual(result.events,[]);
});

test('missing observer file and an invalid nonce fail closed without touching fixture',async()=>{
 const f=await fixture();
 const result=await reviewSyntheticOperationLedger(f.root,f.nonce);
 assert.equal(result.status,'unverifiable_incomplete');
 assert.deepEqual(result.events,[]);
 await assert.rejects(reviewSyntheticOperationLedger(f.root,'0'.repeat(32)),
  /Synthetic operation witness refused/);
 assert.equal(await fs.readFile(join(f.root,MARKER),'utf8'),f.nonce);
});

test('noncanonical witness object keys, whitespace and duplicated JSON fields fail closed',async()=>{
 const entries=[
  '{"event":"started","schema":"'+SCHEMA+'","sequence":1}\n',
  '{"schema": "'+SCHEMA+'","sequence":1,"event":"started"}\n',
  '{"schema":"'+SCHEMA+'","sequence":1,"event":"started","event":"completed_observed"}\n',
  '{"schema":"'+SCHEMA+'","sequence":1,"event":"started","extra":false}\n',
  '{"schema":"'+SCHEMA+'","sequence":1,"event":"started"}\r\n'
 ];
 for(const changed of entries){
  const f=await fixture();
  await fs.writeFile(join(f.root,FILE),changed,{flag:'wx'});
  await assert.rejects(readSyntheticOperationLedger(f.root,f.nonce),
   /Synthetic operation witness refused/);
  const review=await reviewSyntheticOperationLedger(f.root,f.nonce);
  assert.equal(review.status,'unverifiable_incomplete');
  assert.deepEqual(review.events,[]);
 }
});

test('tampered sequence, unknown event and impossible state transition are inconclusive',async()=>{
 const records=[
  [{schema:SCHEMA,sequence:2,event:'started'}],
  [{schema:SCHEMA,sequence:1,event:'completed_observed'}],
  [{schema:SCHEMA,sequence:1,event:'started'},
   {schema:SCHEMA,sequence:2,event:'unapproved_write'}],
  [{schema:SCHEMA,sequence:1,event:'started'},
   {schema:SCHEMA,sequence:2,event:'interrupted'},
   {schema:SCHEMA,sequence:3,event:'completed_observed'}],
  [{schema:SCHEMA,sequence:1,event:'started'},
   {schema:SCHEMA,sequence:1,event:'interrupted'}]
 ];
 for(const rows of records){
  const f=await fixture();
  await fs.writeFile(join(f.root,FILE),
   rows.map(x=>JSON.stringify(x)).join('\n')+'\n',{flag:'wx'});
  await assert.rejects(readSyntheticOperationLedger(f.root,f.nonce),
   /Synthetic operation witness refused/);
  assert.equal((await reviewSyntheticOperationLedger(f.root,f.nonce)).status,
   'unverifiable_incomplete');
 }
});

test('oversized and unterminated witness records remain unverified',async()=>{
 const data=[
  '{"schema":"'+SCHEMA+'","sequence":1,"event":"started"}',
  'X'.repeat(4097)+'\n',
  '\n',
  Buffer.from([0xff,0xfe,0x0a])
 ];
 for(const changed of data){
  const f=await fixture();
  await fs.writeFile(join(f.root,FILE),changed,{flag:'wx'});
  await assert.rejects(readSyntheticOperationLedger(f.root,f.nonce),
   /Synthetic operation witness refused/);
  assert.equal((await reviewSyntheticOperationLedger(f.root,f.nonce)).status,
   'unverifiable_incomplete');
 }
});

test('witness hardlink and directory replacement are never accepted',async()=>{
 const f=await fixture();
 const handle=await createSyntheticOperationLedger(f.root,f.nonce);
 try{await handle.append('started');}
 finally{await handle.close();}
 const path=join(f.root,FILE);
 const alias=join(f.root,'synthetic-ledger-hardlink-alias');
 await fs.link(path,alias);
 await assert.rejects(readSyntheticOperationLedger(f.root,f.nonce),
  /Synthetic operation witness refused/);
 assert.equal((await reviewSyntheticOperationLedger(f.root,f.nonce)).status,
  'unverifiable_incomplete');
 await fs.unlink(alias);
 assert.equal((await readSyntheticOperationLedger(f.root,f.nonce)).status,
  'incomplete_unconfirmed');
 await fs.unlink(path);
 await fs.mkdir(path);
 await assert.rejects(readSyntheticOperationLedger(f.root,f.nonce),
  /Synthetic operation witness refused/);
 assert.equal((await reviewSyntheticOperationLedger(f.root,f.nonce)).status,
  'unverifiable_incomplete');
});

test('witness symlink redirect is refused even when pointing at valid fixture bytes',
 async(t)=>{
 const f=await fixture();
 const handle=await createSyntheticOperationLedger(f.root,f.nonce);
 try{await handle.append('started');}
 finally{await handle.close();}
 const oldPath=join(f.root,FILE),other=join(f.root,'synthetic-ledger-data');
 await fs.rename(oldPath,other);
 try{await fs.symlink(other,oldPath,'file');}
 catch(err){
  if(['EPERM','EACCES','ENOSYS','EINVAL'].includes(err.code)){
   t.skip('File symlink creation unavailable on Windows runner');
   return;
  }
  throw err;
 }
 await assert.rejects(readSyntheticOperationLedger(f.root,f.nonce),
  /Synthetic operation witness refused/);
 assert.equal((await reviewSyntheticOperationLedger(f.root,f.nonce)).status,
  'unverifiable_incomplete');
 assert.equal((await fs.readFile(other,'utf8')).includes('"started"'),true);
});

// Independent public, unkeyed hash calculator used to prove that a complete
// malicious rewrite remains forgeable. It is NOT a signature or trusted seal.
function recomputePublicChain(events){
 let previous='0'.repeat(64);
 return events.map((event,i)=>{
  const core={schema:SCHEMA,sequence:i+1,event,previous};
  const digest=createHash('sha256').update(
   'OMSI-SYNTHETIC-WITNESS-CHAIN-V2\\n'+JSON.stringify(core),'utf8'
  ).digest('hex');
  previous=digest;
  return {...core,digest};
 });
}
async function createChainedFixture(events){
 const f=await fixture();
 const ledger=await createSyntheticOperationLedger(f.root,f.nonce);
 try{for(const event of events)await ledger.append(event);}
 finally{await ledger.close();}
 return f;
}

test('v2 hash-chain fields follow independent public SHA-256 derivation',async()=>{
 const events=['started','intermediate_observed','interrupted'];
 const f=await createChainedFixture(events);
 const parsed=(await fs.readFile(join(f.root,FILE),'utf8'))
  .trimEnd().split('\n').map(JSON.parse);
 assert.deepEqual(parsed,recomputePublicChain(events));
 const result=await readSyntheticOperationLedger(f.root,f.nonce);
 assert.equal(result.status,'interrupted_intermediate');
 assert.deepEqual(result.events,events);
});

test('single record mutation without recomputing digest is rejected',async()=>{
 const f=await createChainedFixture(
  ['started','intermediate_observed','interrupted']);
 const file=join(f.root,FILE);
 const rows=(await fs.readFile(file,'utf8'))
  .trimEnd().split('\n').map(JSON.parse);
 rows[1].event='bytes_restored_unconfirmed';
 await fs.writeFile(file,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
 await assert.rejects(readSyntheticOperationLedger(f.root,f.nonce),
  /Synthetic operation witness refused/);
 assert.equal((await reviewSyntheticOperationLedger(f.root,f.nonce)).status,
  'unverifiable_incomplete');
});

test('linkage break, swapped hashes and erased middle event are refused',async()=>{
 const events=['started','intermediate_observed','interrupted'];
 for(const tamper of ['previous','digest','remove']){
  const f=await createChainedFixture(events);
  const file=join(f.root,FILE);
  const rows=(await fs.readFile(file,'utf8'))
   .trimEnd().split('\n').map(JSON.parse);
  if(tamper==='previous')rows[2].previous='a'.repeat(64);
  else if(tamper==='digest')rows[0].digest=rows[1].digest;
  else rows.splice(1,1);
  await fs.writeFile(file,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  await assert.rejects(readSyntheticOperationLedger(f.root,f.nonce),
   /Synthetic operation witness refused/);
  assert.equal((await reviewSyntheticOperationLedger(f.root,f.nonce)).status,
   'unverifiable_incomplete');
 }
});

test('truncated valid event prefix is only incomplete, not completed',async()=>{
 const f=await createChainedFixture(['started','completed_observed']);
 const file=join(f.root,FILE);
 const text=await fs.readFile(file,'utf8');
 await fs.writeFile(file,text.split('\n')[0]+'\n');
 const result=await readSyntheticOperationLedger(f.root,f.nonce);
 assert.equal(result.status,'incomplete_unconfirmed');
 assert.deepEqual(result.events,['started']);
});

test('full unkeyed-chain forgery remains possible and never grants real authority',async()=>{
 const f=await createChainedFixture(['started','intermediate_observed','interrupted']);
 const file=join(f.root,FILE);
 // Someone with write access can forge a different VALID history by
 // recalculating all SHA-256 values. The reader cannot authenticate it.
 const forged=recomputePublicChain(['started','completed_observed']);
 await fs.writeFile(file,forged.map(r=>JSON.stringify(r)).join('\n')+'\n');
 const result=await readSyntheticOperationLedger(f.root,f.nonce);
 assert.equal(result.status,'completion_observed_not_durable');
 assert.deepEqual(result.events,['started','completed_observed']);
 assert.equal(await fs.readFile(join(f.root,MARKER),'utf8'),f.nonce);
 await assert.rejects(fs.stat(join(f.root,'metadata-probe.scs')),{code:'ENOENT'});
});

test('v1 unlinked witness is not accidentally accepted as chained v2',async()=>{
 const f=await fixture();
 const line=JSON.stringify({
  schema:'omsi-synthetic-operation-witness-v1',
  sequence:1,event:'started'
 })+'\n';
 await fs.writeFile(join(f.root,FILE),line,{flag:'wx'});
 await assert.rejects(readSyntheticOperationLedger(f.root,f.nonce),
  /Synthetic operation witness refused/);
 assert.equal((await reviewSyntheticOperationLedger(f.root,f.nonce)).status,
  'unverifiable_incomplete');
});
