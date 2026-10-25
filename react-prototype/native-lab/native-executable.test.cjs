'use strict';
// This suite runs the real standalone .NET 8 Windows native executable.
// Neither the game, mods, personal folders nor the packaged Electron app are used.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {execFileSync,execFile,spawn}=require('node:child_process');
const {promisify}=require('node:util');
const {tmpdir}=require('node:os');
const {join,dirname}=require('node:path');
const {randomBytes}=require('node:crypto');
const {PREFIX,MARKER}=require('../scripts/temp-recovery-fixture.cjs');
const {checkResult,createTemporaryNativeDirectoryBackend}=require('../scripts/temp-main-native-directory-backend.cjs');
const {createInspectionExecutor}=require('../electron/inspection-executor.cjs');
const {createInspectionGrantGate}=require('../electron/inspection-grant.cjs');
const windows=process.platform==='win32';
const exe=process.env.OMSI_NATIVE_LAB_EXE;
const ready=windows&&typeof exe==='string'&&exe.length>0;
const roots=new Set();
const execAsync=promisify(execFile);

async function fixtureAt(parent){
 const root=await fs.mkdtemp(join(parent,PREFIX));
 roots.add(root);
 const nonce=randomBytes(16).toString('hex');
 await fs.writeFile(join(root,MARKER),nonce,{flag:'wx'});
 await fs.mkdir(join(root,'native-enum'));
 return {root,nonce,game:'omsi',dir:join(root,'native-enum')};
}
async function fixture(){return fixtureAt(tmpdir());}
async function syntheticTemp(){
 const base=await fs.mkdtemp(join(tmpdir(),PREFIX));
 roots.add(base);
 return base;
}
function tempEnv(parent){
 return {...process.env,TMP:parent,TEMP:parent};
}
async function invoke(f,extra=[],tempParent=null){
 return execAsync(exe,['--root',f.root,'--nonce',f.nonce,...extra],{
  shell:false,windowsHide:true,timeout:15000,maxBuffer:4096,
  ...(tempParent===null?{}:{env:tempEnv(tempParent)})
 });
}
async function denied(f,extra=[],tempParent=null){
 await assert.rejects(invoke(f,extra,tempParent),err=>{
  assert.equal(err.code,3);
  assert.match(err.stderr,/Temporary standalone native directory lab refused/);
  assert.equal(err.stdout,'');
  assert.equal(err.stderr.includes(f.root),false);
  assert.equal(err.stderr.includes(f.nonce),false);
  return true;
 });
}
function validate(out){
 const parsed=JSON.parse(out.stdout.trim());
 const receipt=checkResult(parsed);
 assert.equal(receipt.source,'main-process-native-directory-test');
 assert.equal(receipt.operationsEnabled,false);
 assert.equal(parsed.operationsEnabled,false);
 assert.equal(parsed.guaranteesNoABA,false);
 assert.equal(parsed.nativeFileIdChecked,true);
 return parsed;
}
test.after(async()=>{
 for(const root of roots)await fs.rm(root,{recursive:true,force:true});
});
test('standalone fixture output is the exact 21-key bounded native contract',
 {skip:!ready},async()=>{
 const f=await fixture();
 const result=validate(await invoke(f));
 assert.equal(result.entries,0);
 assert.equal(result.packageCandidates,0);
 assert.equal(result.nativeDirectoryEnumerationByHandle,true);
});
test('native helper counts direct entries without opening .scs or .zip contents',
 {skip:!ready},async()=>{
 const f=await fixture();
 await fs.mkdir(join(f.dir,'inner'));
 await fs.writeFile(join(f.dir,'sample.SCS'),'CANNOT-READ-BYTES');
 await fs.writeFile(join(f.dir,'sample.ZIP'),'CANNOT-READ-BYTES');
 await fs.writeFile(join(f.dir,'other.txt'),'PRIVATE');
 await fs.writeFile(join(f.dir,'inner','nested.zip'),'NOT-COUNTED');
 const res=validate(await invoke(f));
 assert.equal(res.entries,4);
 assert.equal(res.directories,1);
 assert.equal(res.files,3);
 assert.equal(res.packageCandidates,2);
 assert.equal(JSON.stringify(res).includes('sample.SCS'),false);
 assert.equal(JSON.stringify(res).includes(f.root),false);
 assert.equal(await fs.readFile(join(f.dir,'sample.SCS'),'utf8'),'CANNOT-READ-BYTES');
});
test('longer native buffers and multiple records cannot leak names',
 {skip:!ready},async()=>{
 const f=await fixture();
 for(let i=0;i<42;i++)await fs.writeFile(join(f.dir,'example-'+i+'.scs'),'X');
 const v=validate(await invoke(f));
 assert.equal(v.entries,42);
 assert.equal(v.files,42);
 assert.equal(v.packageCandidates,42);
});
test('127 native entries are valid, below the conservative ceiling',
 {skip:!ready},async()=>{
 const f=await fixture();
 for(let i=0;i<127;i++)await fs.writeFile(join(f.dir,'entry-'+i+'.txt'),'X');
 const v=validate(await invoke(f));
 assert.equal(v.entries,127);
});
test('exactly 128 entries must fail closed',
 {skip:!ready},async()=>{
 const f=await fixture();
 for(let i=0;i<128;i++)await fs.writeFile(join(f.dir,'entry-'+i+'.txt'),'X');
 await denied(f);
});
test('129 entries must not be misreported as 128',
 {skip:!ready},async()=>{
 const f=await fixture();
 for(let i=0;i<129;i++)await fs.writeFile(join(f.dir,'entry-'+i+'.txt'),'X');
 await denied(f);
});
test('marker mismatch rejects native directory observation',
 {skip:!ready},async()=>{
 const f=await fixture();
 await denied({...f,nonce:'0'.repeat(32)});
});
test('tampering marker data prevents observation',
 {skip:!ready},async()=>{
 const f=await fixture();
 await fs.writeFile(join(f.root,MARKER),'0'.repeat(32));
 await denied(f);
});
test('attempt to inspect outside the temp fixture direct-child path is refused',
 {skip:!ready},async()=>{
 const f=await fixture();
 await denied({...f,root:dirname(f.root)});
});
test('renamed or missing native-enum directory is refused rather than created',
 {skip:!ready},async()=>{
 const f=await fixture();
 await fs.rename(f.dir,f.dir+'.kept');
 await denied(f);
 await assert.rejects(fs.stat(f.dir),{code:'ENOENT'});
});
test('file impersonating target directory is refused',
 {skip:!ready},async()=>{
 const f=await fixture();
 await fs.rmdir(f.dir);
 await fs.writeFile(f.dir,'NOT DIRECTORY',{flag:'wx'});
 await denied(f);
});
test('junction/reparse target cannot be enumerated',
 {skip:!ready},async(t)=>{
 const f=await fixture(),alternate=join(f.root,'alternate');
 await fs.mkdir(alternate);
 await fs.rmdir(f.dir);
 try{await fs.symlink(alternate,f.dir,'junction');}
 catch(e){if(['EPERM','EACCES','ENOSYS'].includes(e.code)){
  t.skip('Windows junction creation unavailable');return;
 }throw e;}
 await denied(f);
});
test('junction child is ignored and target contents remain private',
 {skip:!ready},async(t)=>{
 const f=await fixture(),other=join(f.root,'outside');
 await fs.mkdir(other);
 await fs.writeFile(join(other,'private.zip'),'NEVER-OPEN');
 try{await fs.symlink(other,join(f.dir,'shortcut'),'junction');}
 catch(e){if(['EPERM','EACCES','ENOSYS'].includes(e.code)){
  t.skip('Windows junction creation unavailable');return;
 }throw e;}
 const out=validate(await invoke(f));
 assert.equal(out.entries,1);
 assert.equal(out.linksSkipped,1);
 assert.equal(out.packageCandidates,0);
});
test('unexpected CLI parameters cannot authorize a different target',
 {skip:!ready},async()=>{
 const f=await fixture();
 await denied(f,['--operation','install']);
});
test('standalone helper integrates with constrained Node backend without Powershell',
 {skip:!ready},async()=>{
 const f=await fixture();
 await fs.writeFile(join(f.dir,'item.scs'),'SENTINEL');
 const runner=(root,nonce)=>execAsync(exe,['--root',root,'--nonce',nonce],{
  windowsHide:true,shell:false,timeout:15000,maxBuffer:4096
 });
 const native=createTemporaryNativeDirectoryBackend({...f,platform:'win32',runner});
 const result=await native(f.root,'omsi');
 assert.equal(result.source,'main-process-native-directory-test');
 assert.equal(result.operationsEnabled,false);
 await assert.rejects(native(f.root,'omsi'),/Temporary native backend refused/);
});
test('real compiled helper -> Node backend -> executor -> one-time grant stays read-only',
 {skip:!ready},async()=>{
 const f=await fixture();
 await fs.mkdir(join(f.root,'Vehicles'));
 await fs.writeFile(join(f.root,'Vehicles','bus.bus'),'UNCHANGED');
 const runner=(root,nonce)=>execAsync(exe,['--root',root,'--nonce',nonce],{
  windowsHide:true,shell:false,timeout:15000,maxBuffer:4096
 });
 const native=createTemporaryNativeDirectoryBackend({...f,platform:'win32',runner});
 const executor=createInspectionExecutor({requireNative:true,platform:'win32',nativeProbe:native});
 const gate=createInspectionGrantGate({inspect:executor.inspectSelectedDirectory});
 const ticket=gate.issue(f.root,'omsi',5);
 const report=await gate.inspectOnce(ticket,5,'omsi');
 assert.equal(report.status,'ok');
 assert.equal(report.groups[0].files,1);
 assert.equal(report.provenance.nativeDirectoryEnumeration,'auxiliary-untrusted-observation');
 assert.equal(report.provenance.operationsEnabled,false);
 await assert.rejects(gate.inspectOnce(ticket,5,'omsi'),/Autorização/);
 assert.equal(await fs.readFile(join(f.root,'Vehicles','bus.bus'),'utf8'),'UNCHANGED');
});
test('the experimental native assembly is intentionally unavailable on Linux',
 {skip:windows},()=>{
 assert.equal(process.platform==='win32',false);
 assert.equal(typeof exe==='string'&&exe.includes('OmsiNativeDirectoryLab.exe'),false);
});


// Deterministic two-process barrier. The C# process holds Win32 root and
// child directory handles at READY; Node mutates only generated os.tmpdir()
// fixtures. The native executable accepts only an exact CONTINUE line.
async function race(f,mutate=async()=>{},reply='CONTINUE',tempParent=null){
 const child=spawn(exe,['--root',f.root,'--nonce',f.nonce,'--race-barrier'],{
  shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],
  ...(tempParent===null?{}:{env:tempEnv(tempParent)})
 });
 let stdout='',stderr='';
 const finished=new Promise((resolve,reject)=>{
  child.once('error',reject);
  child.once('close',code=>resolve(code));
 });
 const ready=new Promise(resolve=>{
  child.stdout.on('data',chunk=>{
   stdout+=chunk.toString();
   if(/^READY\r?\n/.test(stdout))resolve();
  });
 });
 child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
 async function bounded(action){
  let timer;
  try{
   return await Promise.race([
    action,new Promise((_,reject)=>{timer=setTimeout(
     ()=>reject(Error('native race barrier timeout')),30000);
    })
   ]);
  }finally{clearTimeout(timer);}
 }
 try{
  await bounded(Promise.race([ready,finished.then(code=>{
   throw Error('process exited before READY: '+code+' '+stderr);
  })]));
  await mutate(f);
  if(reply===null)child.stdin.end();
  else child.stdin.end(reply+'\n');
  const code=await bounded(finished);
  return {code,stdout,stderr};
 }finally{
  if(child.exitCode===null)child.kill();
 }
}
function raceRejected(r){
 assert.equal(r.code,3,JSON.stringify(r));
 assert.match(r.stdout,/^READY\r?\n/);
 assert.equal(r.stdout.trim(),'READY','no JSON success after invalidation');
 assert.match(r.stderr,/Temporary standalone native directory lab refused/);
}
test('native root and target handles remain stable across a two-process barrier',
 {skip:!ready},async()=>{
 const f=await fixture();
 await fs.writeFile(join(f.dir,'still.scs'),'UNCHANGED');
 const r=await race(f);
 assert.equal(r.code,0,r.stderr);
 const payload=r.stdout.replace(/^READY\r?\n/,'');
 const x=validate({stdout:payload,stderr:r.stderr});
 assert.equal(x.entries,1);
 assert.equal(x.packageCandidates,1);
});
test('changing the nonce marker during a live native observation fails closed',
 {skip:!ready},async()=>{
 const f=await fixture();
 const r=await race(f,async()=>fs.writeFile(join(f.root,MARKER),'0'.repeat(32)));
 raceRejected(r);
 assert.equal(r.stderr.includes(f.root),false);
 assert.equal(r.stderr.includes(f.nonce),false);
});
test('removing marker while both directory handles are held is denied',
 {skip:!ready},async()=>{
 const f=await fixture();
 const r=await race(f,async()=>fs.rm(join(f.root,MARKER)));
 raceRejected(r);
});
test('creating a new directory entry during held-handle read is detected',
 {skip:!ready},async()=>{
 const f=await fixture();
 const r=await race(f,async()=>fs.writeFile(join(f.dir,'new.scs'),'SENTINEL'));
 raceRejected(r);
 assert.equal(await fs.readFile(join(f.dir,'new.scs'),'utf8'),'SENTINEL');
});
test('invalid continuation is never interpreted as a native operation',
 {skip:!ready},async()=>{
 const f=await fixture();
 raceRejected(await race(f,async()=>{},'INSTALL'));
});
test('EOF while holding native handles refuses rather than approving scan',
 {skip:!ready},async()=>{
 const f=await fixture();
 raceRejected(await race(f,async()=>{},null));
});
test('a pathname replacement while its directory handle is held is refused',
 {skip:!ready},async(t)=>{
 const f=await fixture(),spare=join(f.root,'parked-native-enum');
 let replaced=false;
 const observed=await race(f,async()=>{
  try{await fs.rename(f.dir,spare);}
  catch(e){if(['EPERM','EACCES','EBUSY'].includes(e.code)){
   t.skip('Windows refused directory rename with a held handle');return;
  }throw e;}
  replaced=true;
  await fs.mkdir(f.dir);
 });
 // If Windows declined the mutation, the test is explicitly skipped.
 if(replaced)raceRejected(observed);
});
test('root pathname substitution is refused when allowed by Windows sharing',
 {skip:!ready},async(t)=>{
 const f=await fixture(),parked=f.root+'.parked';
 roots.add(parked);
 let replaced=false;
 const r=await race(f,async()=>{
  try{await fs.rename(f.root,parked);}
  catch(e){if(['EPERM','EACCES','EBUSY'].includes(e.code)){
   t.skip('Windows refused root rename with a held handle');return;
  }throw e;}
  replaced=true;
  await fs.mkdir(f.root);
  await fs.writeFile(join(f.root,MARKER),f.nonce,{flag:'wx'});
  await fs.mkdir(f.dir);
 });
 if(replaced)raceRejected(r);
});


test('appending to the pinned marker during a native read rejects its original prefix',
 {skip:!ready},async()=>{
 const f=await fixture();
 const r=await race(f,async()=>fs.appendFile(join(f.root,MARKER),'x'));
 raceRejected(r);
 assert.equal((await fs.readFile(join(f.root,MARKER),'utf8')).length,33);
});
test('truncating and replacing the pinned marker with a short value fails closed',
 {skip:!ready},async()=>{
 const f=await fixture();
 const r=await race(f,async()=>fs.writeFile(join(f.root,MARKER),'short'));
 raceRejected(r);
 assert.equal(r.stderr.includes(f.root),false);
});
test('a different marker inode with identical 32-byte nonce cannot inherit the held grant',
 {skip:!ready},async(t)=>{
 const f=await fixture(),original=join(f.root,MARKER);
 const parked=join(f.root,'old-marker-file');
 let replaced=false;
 const r=await race(f,async()=>{
  try{await fs.rename(original,parked);}
  catch(e){
   if(['EPERM','EACCES','EBUSY'].includes(e.code)){
    t.skip('Windows refused marker rename with held file handle');
    return;
   }
   throw e;
  }
  replaced=true;
  await fs.writeFile(original,f.nonce,{flag:'wx'});
 });
 if(replaced){
  raceRejected(r);
  assert.equal(await fs.readFile(original,'utf8'),f.nonce);
  assert.equal(await fs.readFile(parked,'utf8'),f.nonce);
 }
});
test('file symlink posing as fixture marker is never granted native identity',
 {skip:!ready},async(t)=>{
 const f=await fixture(),old=join(f.root,MARKER),other=join(f.root,'marker-other');
 await fs.rename(old,other);
 try{await fs.symlink(other,old,'file');}
 catch(e){
  if(['EPERM','EACCES','ENOSYS','ENOTSUP'].includes(e.code)){
   t.skip('Windows file symlink unavailable');
   return;
  }
  throw e;
 }
 await denied(f);
 assert.equal(await fs.readFile(other,'utf8'),f.nonce);
});
test('marker modified during the race can never return an authorized native report',
 {skip:!ready},async()=>{
 const f=await fixture();
 const r=await race(f,async()=>{
  await fs.writeFile(join(f.root,MARKER),'0'.repeat(32));
 });
 raceRejected(r);
 assert.equal(r.stdout.trim(),'READY');
 assert.doesNotMatch(r.stdout,/operationsEnabled|canInstall|nativeFileIdChecked/);
});

test('regular nested TEMP components remain observable in a synthetic sandbox',
 {skip:!ready},async()=>{
 const base=await syntheticTemp();
 const parent=join(base,'ordinary-parent','temp');
 await fs.mkdir(parent,{recursive:true});
 const f=await fixtureAt(parent);
 const result=validate(await invoke(f,[],parent));
 assert.equal(result.entries,0);
 assert.equal(result.operationsEnabled,false);
});
test('junction as configured TEMP is refused before native enumeration',
 {skip:!ready},async(t)=>{
 const base=await syntheticTemp();
 const real=join(base,'real-temp'),alias=join(base,'temp-junction');
 await fs.mkdir(real);
 try{await fs.symlink(real,alias,'junction');}
 catch(e){if(['EPERM','EACCES','ENOSYS','ENOTSUP'].includes(e.code)){
  t.skip('Windows junction creation unavailable');return;
 }throw e;}
 const f=await fixtureAt(alias);
 await denied(f,[],alias);
});
test('junction ABOVE TEMP is refused even when TEMP itself is an ordinary directory',
 {skip:!ready},async(t)=>{
 const base=await syntheticTemp();
 const real=join(base,'real-parent'),alias=join(base,'alias-parent');
 await fs.mkdir(join(real,'temp'),{recursive:true});
 try{await fs.symlink(real,alias,'junction');}
 catch(e){if(['EPERM','EACCES','ENOSYS','ENOTSUP'].includes(e.code)){
  t.skip('Windows junction creation unavailable');return;
 }throw e;}
 const parent=join(alias,'temp');
 const f=await fixtureAt(parent);
 await denied(f,[],parent);
 assert.equal(await fs.readFile(join(real,'temp',f.root.split(/[\\/]/).at(-1),MARKER),'utf8'),f.nonce);
});
test('substitution of configured TEMP parent during held-handle barrier is refused',
 {skip:!ready},async(t)=>{
 const base=await syntheticTemp();
 const parent=join(base,'temp-folder'),parked=join(base,'parked-temp-folder');
 await fs.mkdir(parent);
 roots.add(parked);
 const f=await fixtureAt(parent);
 let swapped=false;
 const r=await race(f,async()=>{
  try{await fs.rename(parent,parked);}
  catch(e){if(['EPERM','EACCES','EBUSY'].includes(e.code)){
   t.skip('Windows prevented TEMP parent rename with handles held');return;
  }throw e;}
  swapped=true;
  await fs.mkdir(parent);
  await fs.mkdir(f.root);
  await fs.writeFile(join(f.root,MARKER),f.nonce,{flag:'wx'});
  await fs.mkdir(f.dir);
 },'CONTINUE',parent);
 if(swapped)raceRejected(r);
});
