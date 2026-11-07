'use strict';
// Node-only tests for a synthetic witness outside the Electron package.
// A killed observer is not a disk power-loss simulation.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {PREFIX,MARKER}=require('../scripts/temp-recovery-fixture.cjs');
const {
 createSyntheticOperationLedger,readSyntheticOperationLedger,
 reviewSyntheticOperationLedger,FILE,SCHEMA
}=require('./synthetic-operation-ledger.cjs');

const roots=new Set();
test.after(async()=>{
 for(const root of roots)await fs.rm(root,{recursive:true,force:true});
});
async function fixture(){
 const root=await fs.mkdtemp(join(tmpdir(),PREFIX));
 roots.add(root);
 const nonce=randomBytes(16).toString('hex');
 await fs.writeFile(join(root,MARKER),nonce,{flag:'wx'});
 await fs.mkdir(join(root,'native-enum'));
 return {root,nonce};
}
async function killWitnessAfterCheckpoint(f,events,{truncated=false}={}){
 // All file writes in this child are restricted by createSyntheticOperationLedger
 // to a disposable nonce-marked direct child of the Node system TEMP.
 const program=[
  "const fs=require('node:fs/promises');",
  "const {join}=require('node:path');",
  "const m=require(process.argv[1]);",
  "(async()=>{",
  "const ledger=await m.createSyntheticOperationLedger(process.argv[2],process.argv[3]);",
  "for(const event of process.argv[4].split(','))await ledger.append(event);",
  "if(process.argv[5]==='fragment'){",
  "await ledger.close();",
  "const fragment=JSON.stringify({schema:m.SCHEMA,sequence:99,event:'completed_observed'}).slice(0,32);",
  "await fs.appendFile(join(process.argv[2],m.FILE),fragment);",
  "}",
  "process.stdout.write('WITNESS_SYNCED\\n');",
  "process.stdin.resume();",
  "})().catch(()=>{process.stderr.write('SYNTHETIC_WITNESS_ERROR\\n');process.exit(3);});"
 ].join('');
 const child=spawn(process.execPath,[
  '-e',program,require.resolve('./synthetic-operation-ledger.cjs'),
  f.root,f.nonce,events.join(','),truncated?'fragment':'normal'
 ],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
 let output='',errors='',closed=false;
 child.stdout.on('data',chunk=>{output+=chunk.toString();});
 child.stderr.on('data',chunk=>{errors+=chunk.toString();});
 const exited=new Promise((resolve,reject)=>{
  child.once('error',reject);
  child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});
 });
 async function checkpoint(){
  const deadline=Date.now()+15000;
  while(!output.includes('WITNESS_SYNCED\n')){
   if(closed)throw Error('synthetic observer exited early: '+errors);
   if(Date.now()>deadline)throw Error('synthetic observer checkpoint timed out');
   await new Promise(resolve=>setTimeout(resolve,25));
  }
 }
 try{
  await checkpoint();
  assert.equal(errors,'');
  assert.equal(child.kill(),true,'disposable observer must be terminable');
  let timer;
  const exit=await Promise.race([
   exited,
   new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Error('observer kill timed out')),10000);
   })
  ]).finally(()=>clearTimeout(timer));
  assert.notEqual(exit.code,0);
  assert.equal(output.includes('RESTORATION_PERFORMED'),false);
 }finally{
  if(!closed)child.kill();
  child.stdin.destroy();
 }
}

test('killed external observer after start remains incomplete, never completed',
 {timeout:45000},async()=>{
 const f=await fixture();
 await killWitnessAfterCheckpoint(f,['started']);
 const result=await readSyntheticOperationLedger(f.root,f.nonce);
 assert.equal(result.status,'incomplete_unconfirmed');
 assert.deepEqual(result.events,['started']);
});

test('killed observer with intermediate evidence remains unconfirmed without terminal event',
 {timeout:45000},async()=>{
 const f=await fixture();
 await killWitnessAfterCheckpoint(f,['started','intermediate_observed']);
 const result=await readSyntheticOperationLedger(f.root,f.nonce);
 assert.equal(result.status,'incomplete_unconfirmed');
 assert.deepEqual(result.events,['started','intermediate_observed']);
});

test('killed observer after byte-restoration observation cannot infer timestamps',
 {timeout:45000},async()=>{
 const f=await fixture();
 await killWitnessAfterCheckpoint(f,['started','bytes_restored_unconfirmed']);
 const result=await readSyntheticOperationLedger(f.root,f.nonce);
 assert.equal(result.status,'incomplete_unconfirmed');
 assert.deepEqual(result.events,['started','bytes_restored_unconfirmed']);
});

test('killed observer after completion acknowledgement still reports non-durability',
 {timeout:45000},async()=>{
 const f=await fixture();
 await killWitnessAfterCheckpoint(f,['started','completed_observed']);
 const result=await readSyntheticOperationLedger(f.root,f.nonce);
 assert.equal(result.status,'completion_observed_not_durable');
 assert.deepEqual(result.events,['started','completed_observed']);
 assert.equal(result.status==='completed',false);
});

test('deliberate torn JSONL fragment from killed observer has only inconclusive review',
 {timeout:45000},async()=>{
 const f=await fixture();
 await killWitnessAfterCheckpoint(f,['started'],{truncated:true});
 await assert.rejects(readSyntheticOperationLedger(f.root,f.nonce),
  /Synthetic operation witness refused/);
 const result=await reviewSyntheticOperationLedger(f.root,f.nonce);
 assert.deepEqual(result,{schema:SCHEMA,status:'unverifiable_incomplete',events:[]});
 assert.equal((await fs.readFile(join(f.root,MARKER),'utf8')),f.nonce);
});

test('missing witness is inconclusive and never synthesized as completion',async()=>{
 const f=await fixture();
 const result=await reviewSyntheticOperationLedger(f.root,f.nonce);
 assert.deepEqual(result,{schema:SCHEMA,status:'unverifiable_incomplete',events:[]});
 await assert.rejects(reviewSyntheticOperationLedger(f.root,'a'.repeat(32)),
  /Synthetic operation witness refused/);
});

test('witness replay, invalid state and trailing content cannot become valid success',async()=>{
 const f=await fixture();
 const ledger=await createSyntheticOperationLedger(f.root,f.nonce);
 try{
  await ledger.append('started');
  await assert.rejects(ledger.append('completed'),
   /Synthetic operation witness refused/);
  await ledger.append('interrupted');
  await assert.rejects(ledger.append('completed_observed'),
   /Synthetic operation witness refused/);
 }finally{await ledger.close();}
 const file=join(f.root,FILE);
 const raw=await fs.readFile(file,'utf8');
 await fs.appendFile(file,raw);
 assert.equal((await reviewSyntheticOperationLedger(f.root,f.nonce)).status,
  'unverifiable_incomplete');
});
