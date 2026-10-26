'use strict';
// Portable Windows/Linux kill tests, limited to nonce-marked disposable TEMP.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {randomBytes}=require('node:crypto');
const {createSyntheticOperationLedger,FILE:WITNESS_FILE}=
 require('./synthetic-operation-ledger.cjs');

const cleanup=new Set();
const WORKER=join(__dirname,'synthetic-memory-verifier.worker.cjs');
async function fixture(events){
 const root=await fs.mkdtemp(join(tmpdir(),'omsi-manager-recovery-fixture-'));
 cleanup.add(root);
 const nonce=randomBytes(16).toString('hex');
 await fs.writeFile(join(root,'.omsi-test-fixture-marker'),nonce,{flag:'wx'});
 const writer=await createSyntheticOperationLedger(root,nonce);
 try{for(const event of events)await writer.append(event);}
 finally{await writer.close();}
 return {root,nonce};
}
test.after(async()=>{
 for(const root of cleanup)await fs.rm(root,{recursive:true,force:true});
});
function verifier(f,nonce=f.nonce){
 const child=spawn(process.execPath,[WORKER,f.root,nonce],
  {stdio:['pipe','pipe','pipe'],shell:false,windowsHide:true});
 let output='',stderr='',closed=false,error=null,cursor=0;
 child.stdout.on('data',part=>{output+=part.toString();});
 child.stderr.on('data',part=>{stderr+=part.toString();});
 child.on('error',e=>{error=e;});
 const done=new Promise(resolve=>{
  child.once('close',(code,signal)=>{
   closed=true;resolve({code,signal});
  });
 });
 async function next(){
  const deadline=Date.now()+12000;
  while(true){
   if(error)throw error;
   const end=output.indexOf('\n',cursor);
   if(end>=0){
    const text=output.slice(cursor,end).replace(/\r$/,'');
    cursor=end+1;
    return JSON.parse(text);
   }
   if(closed)throw Error('Synthetic verifier exited: '+stderr);
   if(Date.now()>deadline)throw Error('Synthetic verifier timed out');
   await new Promise(resolve=>setTimeout(resolve,20));
  }
 }
 return {
  child,done,
  async ready(){assert.deepEqual(await next(),{result:'ready'});},
  async send(value){
   child.stdin.write(
    typeof value==='string'?value+'\n':JSON.stringify(value)+'\n'
   );
   return next();
  },
  async shutdown(){
   const result=await this.send({id:9999,op:'shutdown'});
   assert.deepEqual(result,{id:9999,result:'closed'});
   const exit=await done;
   assert.equal(exit.code,0);
   assert.equal(stderr,'');
  },
  async kill(){
   if(!closed)child.kill();
   let timeout;
   const exit=await Promise.race([done,new Promise((_,reject)=>{
    timeout=setTimeout(()=>reject(Error('Verifier kill timeout')),10000);
   })]).finally(()=>clearTimeout(timeout));
   assert.notEqual(exit.code,0,'Killed verifier must not exit successfully');
  },
  stop(){if(!closed)child.kill();child.stdin.destroy();},
  transcript(){return output+'\n'+stderr;}
 };
}
async function withVerifier(f,run){
 const proc=verifier(f);
 try{await proc.ready();await run(proc);}
 finally{proc.stop();await proc.done;}
}

test('ephemeral verifier seals only a pinned synthetic history and returns no key',async()=>{
 const f=await fixture(['started','intermediate_observed','interrupted']);
 await withVerifier(f,async v=>{
  assert.deepEqual(await v.send({id:1,op:'arm'}),{id:1,result:'armed'});
  const result=await v.send({id:2,op:'verify'});
  assert.deepEqual(result,{id:2,result:'matched',status:'interrupted_intermediate'});
  assert.equal(/key|secret|mac|digest|chainHead|nonce/i.test(v.transcript()),false);
  assert.deepEqual((await fs.readdir(f.root)).sort(),
   ['.omsi-test-fixture-marker',WITNESS_FILE].sort());
  await v.shutdown();
 });
});

test('verification before arming and a second arm never grant new authority',async()=>{
 const f=await fixture(['started','completed_observed']);
 await withVerifier(f,async v=>{
  assert.deepEqual(await v.send({id:1,op:'verify'}),
   {id:1,result:'unverifiable_incomplete'});
  assert.deepEqual(await v.send({id:2,op:'arm'}),{id:2,result:'armed'});
  assert.deepEqual(await v.send({id:3,op:'arm'}),{id:3,result:'refused'});
  assert.deepEqual(await v.send({id:4,op:'verify'}),{
   id:4,result:'matched',status:'completion_observed_not_durable'
  });
  await v.shutdown();
 });
});

test('arbitrary signing, new paths, nonce injection and unknown protocol fields are refused',async()=>{
 const f=await fixture(['started','interrupted']);
 await withVerifier(f,async v=>{
  for(const packet of [
   {id:1,op:'sign',hash:'f'.repeat(64)},
   {id:2,op:'arm',head:'0'.repeat(64)},
   {id:3,op:'verify',path:'C:\\OMSI 2'},
   {id:4,op:'arm',nonce:'f'.repeat(32)},
   '{"id":5,"op":"arm","op":"verify"}',
   '{incomplete-json',
   {id:6,op:'delete'},
   {id:7,op:'arm',key:'fake-secret'}
  ]){
   assert.deepEqual(await v.send(packet),{id:null,result:'refused'});
  }
  assert.deepEqual(await v.send({id:8,op:'arm'}),{id:8,result:'armed'});
  assert.deepEqual(await v.send({id:9,op:'verify'}),{
   id:9,result:'matched',status:'interrupted_before_write'
  });
  await v.shutdown();
 });
});

test('rewriting the complete valid public chain after arm is detected',async()=>{
 const f=await fixture(['started','intermediate_observed','interrupted']);
 const forged=await fixture(['started','completed_observed']);
 await withVerifier(f,async v=>{
  assert.deepEqual(await v.send({id:1,op:'arm'}),{id:1,result:'armed'});
  await fs.copyFile(join(forged.root,WITNESS_FILE),
   join(f.root,WITNESS_FILE));
  assert.deepEqual(await v.send({id:2,op:'verify'}),{
   id:2,result:'unverifiable_incomplete',status:'unverifiable_incomplete'
  });
  assert.deepEqual(await v.send({id:3,op:'arm'}),{id:3,result:'refused'});
  await v.shutdown();
 });
});

test('truncated evidence cannot be promoted to success by an armed verifier',async()=>{
 const f=await fixture(['started','completed_observed']);
 await withVerifier(f,async v=>{
  await v.send({id:1,op:'arm'});
  await fs.appendFile(join(f.root,WITNESS_FILE),'{incomplete');
  assert.deepEqual(await v.send({id:2,op:'verify'}),{
   id:2,result:'unverifiable_incomplete',status:'unverifiable_incomplete'
  });
  await v.shutdown();
 });
});

test('abrupt verifier death loses volatile key: a fresh process cannot verify old seal',async()=>{
 const f=await fixture(['started','completed_observed']);
 const first=verifier(f);
 try{
  await first.ready();
  await first.send({id:1,op:'arm'});
  await first.kill();
 }finally{first.stop();}
 await withVerifier(f,async second=>{
  assert.deepEqual(await second.send({id:1,op:'verify'}),{
   id:1,result:'unverifiable_incomplete'
  });
  await second.shutdown();
 });
});

test('new verifier can arm already-forged evidence: same-user process is NOT a trust root',async()=>{
 const f=await fixture(['started','intermediate_observed','interrupted']);
 const forged=await fixture(['started','completed_observed']);
 await fs.copyFile(join(forged.root,WITNESS_FILE),
  join(f.root,WITNESS_FILE));
 await withVerifier(f,async v=>{
  assert.deepEqual(await v.send({id:1,op:'arm'}),{id:1,result:'armed'});
  assert.deepEqual(await v.send({id:2,op:'verify'}),{
   id:2,result:'matched',status:'completion_observed_not_durable'
  });
  // Matched does NOT imply a real mod, or even synthetic target, was restored.
  await assert.rejects(fs.stat(join(f.root,'metadata-probe.scs')),
   {code:'ENOENT'});
  await v.shutdown();
 });
});

test('incorrect marker nonce fails to launch verifier without writing a new key',async()=>{
 const f=await fixture(['started']);
 const v=verifier(f,'f'.repeat(32));
 try{
  const exit=await v.done;
  assert.equal(exit.code,3);
  await assert.rejects(fs.stat(join(f.root,'memory-verifier-key')),
   {code:'ENOENT'});
  assert.deepEqual((await fs.readdir(f.root)).sort(),
   ['.omsi-test-fixture-marker',WITNESS_FILE].sort());
 }finally{v.stop();}
});

test('memory worker source has no key persistence or arbitrary signing interface',async()=>{
 const source=await fs.readFile(WORKER,'utf8');
 assert.match(source,/secret=randomBytes\(32\)/);
 assert.match(source,/timingSafeEqual\(seal,fresh\)/);
 assert.match(source,/\['arm','verify','shutdown'\]/);
 assert.doesNotMatch(source,/writeFile|writeSync|createWriteStream|\.env\b/);
 assert.doesNotMatch(source,/function signArbitrary|privateKey|JSON\.stringify\(secret\)/);
});

test('worker IPC rejects replay, out-of-order IDs and fake OS principal claims',async()=>{
 const f=await fixture(['started','interrupted']);
 await withVerifier(f,async v=>{
  assert.deepEqual(await v.send({id:10,op:'arm'}),{id:10,result:'armed'});
  assert.deepEqual(await v.send({id:10,op:'verify'}),{id:null,result:'refused'});
  assert.deepEqual(await v.send({id:9,op:'verify'}),{id:null,result:'refused'});
  assert.deepEqual(await v.send({
   id:11,op:'verify',peerCredentialsVerified:true
  }),{id:null,result:'refused'});
  assert.deepEqual(await v.send({id:11,op:'verify'}),{
   id:11,result:'matched',status:'interrupted_before_write'
  });
  await v.shutdown();
 });
});

test('worker rejects overlong input even without an earlier newline',async()=>{
 const f=await fixture(['started','interrupted']);
 await withVerifier(f,async v=>{
  const oversized='X'.repeat(20000);
  assert.deepEqual(await v.send(oversized),{id:null,result:'refused'});
  assert.deepEqual(await v.send({id:1,op:'arm'}),{id:1,result:'armed'});
  assert.deepEqual(await v.send({id:2,op:'verify'}),{
   id:2,result:'matched',status:'interrupted_before_write'
  });
  await v.shutdown();
 });
});
