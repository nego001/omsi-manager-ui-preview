'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const {once}=require('node:events');
const fsp=require('node:fs/promises');
const {join,dirname}=require('node:path');
const {tmpdir}=require('node:os');
const {randomBytes}=require('node:crypto');
const {PREFIX,MARKER}=require('./temp-recovery-fixture.cjs');
const {CLAIM_NAME,validClaim}=require('./temp-recovery-concurrency.cjs');
const worker=join(__dirname,'temp-recovery-concurrency-worker.cjs');
const allRoots=new Set();
async function fixture(){
 const root=await fsp.mkdtemp(join(tmpdir(),PREFIX));
 allRoots.add(root);
 const nonce=randomBytes(16).toString('hex');
 await fsp.writeFile(join(root,MARKER),nonce,{flag:'wx',mode:0o600});
 return {root,nonce};
}
function run(action,fixture,actor='session-a'){
 const c=spawnSync(process.execPath,[worker,action,fixture.root,fixture.nonce,actor],
  {encoding:'utf8',timeout:10000,windowsHide:true,env:{...process.env,NODE_OPTIONS:''}});
 assert.equal(c.error,undefined,String(c.error));
 return {status:c.status,stdout:c.stdout,stderr:c.stderr,
  result:c.status===0?JSON.parse(c.stdout.trim()):null};
}
async function launch(action,fixture,actor){
 const child=spawn(process.execPath,[worker,action,fixture.root,fixture.nonce,actor],
  {stdio:['ignore','pipe','pipe'],windowsHide:true,env:{...process.env,NODE_OPTIONS:''}});
 const state=await new Promise((resolve,reject)=>{
  let buffer='',settled=false;
  const timeout=setTimeout(()=>finish(Error('Worker readiness timed out')),10000);
  function finish(value){
   if(settled)return;
   settled=true;clearTimeout(timeout);
   child.stdout.off('data',onData);
   child.off('error',onError);
   child.off('exit',onExit);
   if(value instanceof Error)reject(value);else resolve(value);
  }
  function onData(chunk){
   buffer+=chunk.toString('utf8');
   const line=buffer.indexOf('\n');
   if(line>=0){
    try{finish(JSON.parse(buffer.slice(0,line)));}
    catch(error){finish(error);}
   }
  }
  function onError(err){finish(err);}
  function onExit(code){finish(Error('Worker exited before readiness: '+code));}
  child.stdout.on('data',onData);
  child.on('error',onError);child.on('exit',onExit);
 });
 return {child,state};
}
async function stop(child){
 if(child.exitCode!==null||child.signalCode!==null)return;
 const ended=once(child,'exit');
 assert.equal(child.kill('SIGKILL'),true,'Worker kill failed');
 await ended;
}
test.after(async()=>{for(const root of allRoots)
 await fsp.rm(root,{recursive:true,force:true});});
test('competing process cannot claim fixture while first process holds it',async()=>{
 const f=await fixture();
 const owner=await launch('hold',f,'session-a');
 try{
  assert.equal(owner.state.status,'claimed');
  const contender=run('try',f,'session-b');
  assert.equal(contender.status,0,contender.stderr);
  assert.equal(contender.result.status,'busy');
  assert.equal(contender.result.operationsEnabled,false);
 }finally{await stop(owner.child);}
});
test('force-killed owner does not lead to automatic reuse of old claim',async()=>{
 const f=await fixture();
 const owner=await launch('hold',f,'session-a');
 assert.equal(owner.state.status,'claimed');
 await stop(owner.child);
 const contender=run('try',f,'session-b');
 assert.equal(contender.result.status,'busy');
 const inspection=run('inspect',f);
 assert.equal(inspection.result.status,'present-untrusted');
 assert.equal(inspection.result.ownerLivenessVerified,false);
});
test('even alive owner never becomes verified by inspecting a claim file',async()=>{
 const f=await fixture();
 const owner=await launch('hold',f,'session-a');
 try{
  const seen=run('inspect',f).result;
  assert.equal(seen.status,'present-untrusted');
  assert.equal(seen.ownerTrusted,false);
  assert.equal(seen.claimIsNativeLock,false);
 }finally{await stop(owner.child);}
});
test('two simultaneous processes produce exactly one exclusive file claim',async()=>{
 const f=await fixture();
 const [a,b]=await Promise.all([
  launch('try',f,'session-a'),launch('try',f,'session-b')
 ]);
 assert.deepEqual([a.state.status,b.state.status].sort(),['busy','claimed']);
 assert.equal(run('try',f,'session-a').result.status,'busy');
});
test('same actor cannot take same claim twice',async()=>{
 const f=await fixture();
 assert.equal(run('try',f,'session-a').result.status,'claimed');
 assert.equal(run('try',f,'session-a').result.status,'busy');
});
test('separate temporary fixture roots are independent',async()=>{
 const a=await fixture(),b=await fixture();
 assert.equal(run('try',a,'session-a').result.status,'claimed');
 assert.equal(run('try',b,'session-a').result.status,'claimed');
 assert.equal(run('inspect',a).result.status,'present-untrusted');
 assert.equal(run('inspect',b).result.status,'present-untrusted');
});
test('invented owner, malformed session and no nonce are rejected',async()=>{
 const f=await fixture();
 for(const actor of ['admin','', 'session-c', '../session-a']){
  const r=run('try',f,actor);
  assert.equal(r.status,3);
  assert.match(r.stderr,/unrecognized session actor/);
 }
 const invalid=spawnSync(process.execPath,[worker,'try',f.root,'invalid','session-a'],
  {encoding:'utf8',timeout:10000,windowsHide:true});
 assert.equal(invalid.status,3);
 assert.equal(run('inspect',f).result.status,'absent');
});
test('corrupted file claim is never stolen or overwritten',async()=>{
 const f=await fixture();
 await fsp.writeFile(join(f.root,CLAIM_NAME),'{"operationsEnabled":true}',{flag:'wx'});
 assert.equal(run('inspect',f).result.status,'corrupt-untrusted');
 assert.equal(run('try',f,'session-b').result.status,'busy');
 assert.equal(await fsp.readFile(join(f.root,CLAIM_NAME),'utf8'),'{"operationsEnabled":true}');
});
test('malformed JSON and oversized claim are fail-closed',async()=>{
 for(const text of ['{','X'.repeat(800)]){
  const f=await fixture();
  await fsp.writeFile(join(f.root,CLAIM_NAME),text,{flag:'wx'});
  assert.equal(run('inspect',f).result.status,'corrupt-untrusted');
  assert.equal(run('try',f,'session-a').result.status,'busy');
 }
});
test('claim copied from another fixture is structurally not trusted',async()=>{
 const a=await fixture(),b=await fixture();
 assert.equal(run('try',a).result.status,'claimed');
 const data=await fsp.readFile(join(a.root,CLAIM_NAME));
 await fsp.writeFile(join(b.root,CLAIM_NAME),data,{flag:'wx'});
 assert.equal(run('inspect',b).result.status,'corrupt-untrusted');
 assert.equal(run('try',b,'session-b').result.status,'busy');
});
test('a fake claim that says operations are allowed is invalid',()=>{
 const nonce='0123456789abcdef0123456789abcdef';
 const valid={schemaVersion:1,scope:'temporary-claim-only',nonce,
  actor:'session-a',operationsEnabled:false};
 assert.equal(validClaim(valid,nonce),true);
 assert.equal(validClaim({...valid,operationsEnabled:true},nonce),false);
 assert.equal(validClaim({...valid,extra:true},nonce),false);
 assert.equal(validClaim({...valid,actor:'admin'},nonce),false);
});
test('arbitrary parent directories are refused by the worker',async()=>{
 const f=await fixture();
 const invalid={root:dirname(f.root),nonce:f.nonce};
 const r=run('try',invalid,'session-a');
 assert.equal(r.status,3);
 assert.match(r.stderr,/not a direct temporary-fixture directory/);
});
test('sentinel outside fixture remains untouched after forced process exit',async()=>{
 const f=await fixture();
 const outside=join(tmpdir(),'omsi-sentinel-'+randomBytes(8).toString('hex'));
 const content='NO-CHANGES-'+randomBytes(12).toString('hex');
 await fsp.writeFile(outside,content,{flag:'wx'});
 let owner;
 try{
  owner=await launch('hold',f,'session-a');
  await stop(owner.child);
  assert.equal(run('try',f,'session-b').result.status,'busy');
  assert.equal(await fsp.readFile(outside,'utf8'),content);
 }finally{
  if(owner)await stop(owner.child);
  await fsp.rm(outside,{force:true});
 }
});
