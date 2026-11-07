'use strict';
// Native race tests operate only on two disposable processes and private fixture files.
// Neither process knows any OMSI/ETS/ATS location. Never shipped with Electron.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs/promises');
const {spawn,spawnSync}=require('node:child_process');
const {once}=require('node:events');
const {join,dirname}=require('node:path');
const {tmpdir}=require('node:os');
const {randomBytes}=require('node:crypto');
const {PREFIX,MARKER}=require('./temp-recovery-fixture.cjs');
const windows=process.platform==='win32';
const script=join(__dirname,'temp-native-file-race.ps1');
const roots=new Set(),children=new Set();
async function fixture(contents='SYNTHETIC-CONTENT'){
 const root=await fsp.mkdtemp(join(tmpdir(),PREFIX));
 roots.add(root);
 const nonce=randomBytes(16).toString('hex');
 await fsp.writeFile(join(root,MARKER),nonce,{flag:'wx',mode:0o600});
 if(contents!==null){
  await fsp.writeFile(join(root,'identity-target.bin'),contents,{flag:'wx',mode:0o600});
 }
 return {root,nonce,target:join(root,'identity-target.bin')};
}
function args(f,mode='held'){
 return ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',
  script,'-Root',f.root,'-Nonce',f.nonce,'-Mode',mode];
}
function refuse(f){
 const p=spawnSync('powershell.exe',args(f),{
  encoding:'utf8',timeout:30000,windowsHide:true
 });
 assert.equal(p.error,undefined,String(p.error));
 assert.equal(p.status,3,p.stderr);
 assert.match(p.stderr,/Temporary native race fixture refused/);
 assert.equal(p.stdout.includes('READY'),false);
}
function noAuthority(x){
 assert.equal(x.source,'temporary-windows-native-race-fixture');
 assert.equal(typeof x.realNativeHandleHeldAcrossBarrier,'boolean');
 assert.equal(typeof x.nativeHandleReleasedBeforeBarrier,'boolean');
 assert.equal(x.realNativeHandleHeldAcrossBarrier,
  !x.nativeHandleReleasedBeforeBarrier);
 assert.equal(x.abaRuledOut,false);
 assert.equal(x.checkedPathThroughSecondHandle,true);
 for(const k of ['nativeIdentityApprovedForRealMods','atomicFilesystemIdentityProven',
  'directoryDurabilityProven','cleanupAllowed','canInstall','canRecover',
  'operationsEnabled'])assert.equal(x[k],false,k);
 assert.equal(x.bytesFromGames,0);
 assert.ok(['changed-or-unavailable','observed-stable-untrusted'].includes(x.outcome));
}
async function launch(f,mode='held'){
 const cp=spawn('powershell.exe',args(f,mode),{
  stdio:['pipe','pipe','pipe'],windowsHide:true
 });
 children.add(cp);
 let stdout='',stderr='';
 cp.stdout.setEncoding('utf8');
 cp.stderr.setEncoding('utf8');
 cp.stdout.on('data',chunk=>{stdout+=chunk;});
 cp.stderr.on('data',chunk=>{stderr+=chunk;});
 await new Promise((resolve,reject)=>{
  let finished=false;
  const timer=setTimeout(()=>finish(Error('native race witness did not reach barrier')),30000);
  const listener=()=>{if(/(?:^|\r?\n)READY\r?\n/.test(stdout))finish();};
  const onExit=(code)=>finish(Error('witness exited before barrier: '+code+' '+stderr.slice(0,200)));
  const onError=e=>finish(e);
  function finish(error){
   if(finished)return;
   finished=true;clearTimeout(timer);
   cp.stdout.off('data',listener);cp.off('exit',onExit);cp.off('error',onError);
   if(error)reject(error);else resolve();
  }
  cp.stdout.on('data',listener);
  cp.on('exit',onExit);cp.on('error',onError);
  listener();
 }).catch(async error=>{
  cp.kill('SIGKILL');
  throw error;
 });
 return {
  child:cp,
  async resume(){
   const end=once(cp,'exit');
   cp.stdin.end('CONTINUE\n');
   const [code]=await end;
   if(code===0){
    const lines=stdout.trim().split(/\r?\n/);
    assert.equal(lines[0],'READY',stdout);
    const report=JSON.parse(lines.at(-1));
    noAuthority(report);
    return {code,report,stderr,stdout};
   }
   return {code,report:null,stderr,stdout};
  },
  getOutput:()=>({stdout,stderr})
 };
}
async function witness(f,mutate=async()=>{},mode='held'){
 const x=await launch(f,mode);
 try{
  const mutation=await mutate(f);
  return {...await x.resume(),mutation};
 }finally{
  if(x.child.exitCode===null&&x.child.signalCode===null){
   x.child.kill('SIGKILL');
   await once(x.child,'exit');
  }
 }
}
function restricted(error){
 return error && ['EPERM','EACCES','EBUSY','EEXIST'].includes(error.code);
}
test.after(async()=>{
 for(const cp of children)if(cp.exitCode===null&&cp.signalCode===null)cp.kill('SIGKILL');
 for(const root of roots)await fsp.rm(root,{force:true,recursive:true});
});
test('unchanged native file remains observable but never trusted across IPC barrier',
 {skip:!windows},async()=>{
 const f=await fixture(),x=await witness(f);
 assert.equal(x.code,0,x.stderr);
 assert.equal(x.report.outcome,'observed-stable-untrusted');
});
test('same-size overwrite in a separate process invalidates native handle witness',
 {skip:!windows},async(t)=>{
 const f=await fixture('AAAA');
 const x=await witness(f,async()=>{
  try{await fsp.writeFile(f.target,'BBBB');return true;}
  catch(e){if(restricted(e))return false;throw e;}
 });
 if(!x.mutation){t.skip('filesystem refused writer while native handle was held');return;}
 assert.equal(x.code,0,x.stderr);
 assert.equal(x.report.outcome,'changed-or-unavailable');
});
test('truncation during the native handle lifetime is detected or reported unavailable',
 {skip:!windows},async(t)=>{
 const f=await fixture('ABCDEFGHIJK');
 const x=await witness(f,async()=>{
  try{await fsp.writeFile(f.target,'ABC');return true;}
  catch(e){if(restricted(e))return false;throw e;}
 });
 if(!x.mutation){t.skip('filesystem refused truncation');return;}
 assert.equal(x.code,0,x.stderr);
 assert.equal(x.report.outcome,'changed-or-unavailable');
});
test('appending to the fixture between two handle samples is not accepted',
 {skip:!windows},async(t)=>{
 const f=await fixture('ABC');
 const x=await witness(f,async()=>{
  try{await fsp.appendFile(f.target,'DEF');return true;}
  catch(e){if(restricted(e))return false;throw e;}
 });
 if(!x.mutation){t.skip('filesystem refused append');return;}
 assert.equal(x.code,0,x.stderr);
 assert.equal(x.report.outcome,'changed-or-unavailable');
});
test('replacement by same bytes but a different native file ID is detected',
 {skip:!windows},async(t)=>{
 const f=await fixture('MATCHING-BYTES');
 const spare=join(f.root,'replacement.tmp');
 await fsp.writeFile(spare,'MATCHING-BYTES',{flag:'wx'});
 const x=await witness(f,async()=>{
  try{await fsp.rename(spare,f.target);return true;}
  catch(e){if(restricted(e))return false;throw e;}
 });
 if(!x.mutation){t.skip('Windows refused rename while native handle open');return;}
 assert.equal(x.code,0,x.stderr);
 assert.equal(x.report.outcome,'changed-or-unavailable');
});
test('unlinking the pathname while its handle is live never leaves a trusted result',
 {skip:!windows},async(t)=>{
 const f=await fixture();
 const x=await witness(f,async()=>{
  try{await fsp.unlink(f.target);return true;}
  catch(e){if(restricted(e))return false;throw e;}
 });
 if(!x.mutation){t.skip('Windows refused removal of opened fixture');return;}
 assert.equal(x.code,0,x.stderr);
 assert.equal(x.report.outcome,'changed-or-unavailable');
});
test('marker tampering after READY aborts instead of returning an observation',
 {skip:!windows},async()=>{
 const f=await fixture(),x=await witness(f,async()=>{
  await fsp.writeFile(join(f.root,MARKER),'0'.repeat(32));
 });
 assert.equal(x.code,3,x.stderr);
 assert.match(x.stderr,/Temporary native race fixture refused/);
 assert.equal(x.report,null);
});
test('invalid nonce is refused before opening or announcing a native handle',
 {skip:!windows},async()=>{
 const f=await fixture();
 refuse({...f,nonce:'f'.repeat(32)});
});
test('arbitrary directory outside the temporary sandbox is refused before READY',
 {skip:!windows},async()=>{
 const f=await fixture();
 refuse({...f,root:dirname(f.root)});
});
test('reparse/symlink target is refused before native barrier',
 {skip:!windows},async(t)=>{
 const f=await fixture(null);
 const other=join(f.root,'other.txt');
 await fsp.writeFile(other,'SYNTHETIC');
 try{await fsp.symlink(other,f.target,'file');}
 catch(e){if(['EPERM','EACCES','ENOSYS'].includes(e.code)){
  t.skip('Windows runner does not permit symlink fixture');return;
 }throw e;}
 refuse(f);
});
test('parent can terminate a waiting witness without mutation of target or sentinel',
 {skip:!windows},async()=>{
 const f=await fixture('ORIGINAL');
 const x=await launch(f);
 const untouched=join(tmpdir(),'omsi-native-race-sentinel-'+randomBytes(8).toString('hex'));
 try{
  await fsp.writeFile(untouched,'DO-NOT-TOUCH',{flag:'wx'});
  const ended=once(x.child,'exit');
  assert.equal(x.child.kill('SIGKILL'),true);
  await ended;
  assert.equal(await fsp.readFile(f.target,'utf8'),'ORIGINAL');
  assert.equal(await fsp.readFile(untouched,'utf8'),'DO-NOT-TOUCH');
 }finally{await fsp.rm(untouched,{force:true});}
});

test('released native handle allows a stable untrusted reinspection',
 {skip:!windows},async()=>{
 const f=await fixture('STATIC'),x=await witness(f,async()=>{},'released');
 assert.equal(x.code,0,x.stderr);
 assert.equal(x.report.nativeHandleReleasedBeforeBarrier,true);
 assert.equal(x.report.realNativeHandleHeldAcrossBarrier,false);
 assert.equal(x.report.abaRuledOut,false);
 assert.equal(x.report.outcome,'observed-stable-untrusted');
});
test('released-handle rename to identical bytes with distinct FileId is caught',
 {skip:!windows},async()=>{
 const f=await fixture('SAME-BYTES'),spare=join(f.root,'replacement.tmp');
 await fsp.writeFile(spare,'SAME-BYTES',{flag:'wx'});
 const x=await witness(f,async()=>{
  const old=join(f.root,'kept-original.tmp');
  await fsp.rename(f.target,old);
  await fsp.rename(spare,f.target);
 },'released');
 assert.equal(x.code,0,x.stderr);
 assert.equal(x.report.outcome,'changed-or-unavailable');
 assert.equal(x.report.abaRuledOut,false);
});
test('released-handle deletion and recreation with new bytes is rejected',
 {skip:!windows},async()=>{
 const f=await fixture('FIRST'),x=await witness(f,async()=>{
  await fsp.rm(f.target);
  await fsp.writeFile(f.target,'SECOND',{flag:'wx'});
 },'released');
 assert.equal(x.code,0,x.stderr);
 assert.equal(x.report.outcome,'changed-or-unavailable');
});
test('released-handle pathname deletion yields unavailable without cleanup',
 {skip:!windows},async()=>{
 const f=await fixture('GONE'),x=await witness(f,async()=>{
  await fsp.rm(f.target);
 },'released');
 assert.equal(x.code,0,x.stderr);
 assert.equal(x.report.outcome,'changed-or-unavailable');
 assert.equal(x.report.cleanupAllowed,false);
});
test('ABA restore after a temporary impostor stays untrusted',
 {skip:!windows},async()=>{
 const f=await fixture('ORIGINAL'),parked=join(f.root,'parked.tmp');
 const impostor=join(f.root,'impostor.tmp');
 await fsp.writeFile(impostor,'ORIGINAL',{flag:'wx'});
 const x=await witness(f,async()=>{
  await fsp.rename(f.target,parked);
  await fsp.rename(impostor,f.target);
  await fsp.rm(f.target);
  await fsp.rename(parked,f.target);
 },'released');
 assert.equal(x.code,0,x.stderr);
 // This is a deliberately demonstrated blind spot, NOT an ABA defense.
 assert.equal(x.report.outcome,'observed-stable-untrusted');
 assert.equal(x.report.abaRuledOut,false);
 assert.equal(x.report.nativeIdentityApprovedForRealMods,false);
});
test('released native witness still rejects marker changes between observations',
 {skip:!windows},async()=>{
 const f=await fixture('MARKER'),x=await witness(f,async()=>{
  await fsp.writeFile(join(f.root,MARKER),'0'.repeat(32));
 },'released');
 assert.equal(x.code,3,x.stderr);
 assert.match(x.stderr,/Temporary native race fixture refused/);
 assert.equal(x.report,null);
});
test('two independent released observers both see a distinct file replacement',
 {skip:!windows},async()=>{
 const f=await fixture('TWO-VIEWERS');
 const [a,b]=await Promise.all([launch(f,'released'),launch(f,'released')]);
 try{
  const backup=join(f.root,'backup.tmp');
  await fsp.rename(f.target,backup);
  await fsp.writeFile(f.target,'TWO-VIEWERS',{flag:'wx'});
  const [one,two]=await Promise.all([a.resume(),b.resume()]);
  for(const x of [one,two]){
   assert.equal(x.code,0,x.stderr);
   assert.equal(x.report.outcome,'changed-or-unavailable');
   assert.equal(x.report.nativeHandleReleasedBeforeBarrier,true);
   assert.equal(x.report.abaRuledOut,false);
  }
 }finally{
  for(const x of [a,b])if(x.child.exitCode===null&&x.child.signalCode===null){
   const end=once(x.child,'exit');
   x.child.kill('SIGKILL');
   await end;
  }
 }
});
