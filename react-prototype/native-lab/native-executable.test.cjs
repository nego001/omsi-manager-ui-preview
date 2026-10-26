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
async function race(f,mutate=async()=>{},reply='CONTINUE',tempParent=null,flags=[],testArgs=null){
 const child=spawn(exe,testArgs??['--root',f.root,'--nonce',f.nonce,'--race-barrier',...flags],{
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

test('a junction posing as fixture root is denied even with matching nonce',
 {skip:!ready},async(t)=>{
 const f=await fixture();
 const alternate=await fixture();
 const parked=f.root+'.parked';
 roots.add(parked);
 // Ensure this checks native path traversal, not merely a nonce mismatch.
 await fs.writeFile(join(alternate.root,MARKER),f.nonce);
 await fs.writeFile(join(alternate.dir,'private.scs'),'UNREAD');
 await fs.rename(f.root,parked);
 try{await fs.symlink(alternate.root,f.root,'junction');}
 catch(e){
  if(['EPERM','EACCES','ENOSYS','ENOTSUP'].includes(e.code)){
   t.skip('Windows junction creation unavailable');
   return;
  }
  throw e;
 }
 await denied(f);
 assert.equal(await fs.readFile(join(alternate.dir,'private.scs'),'utf8'),'UNREAD');
 assert.equal(await fs.readFile(join(alternate.root,MARKER),'utf8'),f.nonce);
});

test('native helper source never reads marker bytes from an absolute pathname',
 async()=>{
 const source=await fs.readFile(join(__dirname,'Program.cs'),'utf8');
 assert.doesNotMatch(source,/File\.ReadAll(Text|Bytes)\s*\(/);
 assert.doesNotMatch(source,/new\s+(?:FileInfo|DirectoryInfo)\s*\(/);
 assert.match(source,/OpenChildMarker\(heldRoot, "\.omsi-test-fixture-marker"\)/);
 assert.match(source,/VerifyMarkerBytes\(heldMarker, args\[3\]\)/);
});

test('Win32 change fence rejects transient nonce rewrite even if bytes are restored',
 {skip:!ready},async()=>{
 const f=await fixture();
 const marker=join(f.root,MARKER);
 const r=await race(f,async()=>{
  await fs.writeFile(marker,'0'.repeat(32));
  await fs.writeFile(marker,f.nonce);
 });
 assert.equal(await fs.readFile(marker,'utf8'),f.nonce);
 raceRejected(r);
});

test('Win32 change fence refuses create/remove ABA despite identical final entries',
 {skip:!ready},async()=>{
 const f=await fixture();
 const transient=join(f.dir,'appeared-then-removed.scs');
 const r=await race(f,async()=>{
  await fs.writeFile(transient,'UNTRUSTED');
  await fs.rm(transient);
 });
 await assert.rejects(fs.stat(transient),{code:'ENOENT'});
 raceRejected(r);
});

test('Win32 change fence refuses transient create/remove in synthetic fixture root',
 {skip:!ready},async()=>{
 const f=await fixture();
 const temporary=join(f.root,'transient-subdirectory');
 const r=await race(f,async()=>{
  await fs.mkdir(temporary);
  await fs.rmdir(temporary);
 });
 await assert.rejects(fs.stat(temporary),{code:'ENOENT'});
 raceRejected(r);
});

test('Win32 change fence does not expose changed file names in errors',
 {skip:!ready},async()=>{
 const f=await fixture();
 const name='sensitive-synthetic-opaque-file.scs';
 const r=await race(f,async()=>fs.writeFile(join(f.dir,name),'PRIVATE'));
 raceRejected(r);
 assert.equal(r.stderr.includes(name),false);
 assert.equal(r.stdout.includes(name),false);
 assert.equal(r.stderr.includes(f.root),false);
});

test('opt-in ReadDirectoryChangesW probe observes a quiet fixture without enabling operations',
 {skip:!ready},async()=>{
 const f=await fixture();
 await fs.writeFile(join(f.dir,'already-there.scs'),'NEVER-READ');
 const observed=validate(await invoke(f,['--rdcw-probe']));
 assert.equal(observed.entries,1);
 assert.equal(observed.packageCandidates,1);
 assert.equal(observed.atomicPathContainmentProven,false);
 assert.equal(observed.operationsEnabled,false);
});
test('opt-in overlapped directory watcher denies create/delete ABA',
 {skip:!ready},async()=>{
 const f=await fixture();
 const r=await race(f,async()=>{
  const path=join(f.dir,'transient-test.scs');
  await fs.writeFile(path,'SYNTHETIC');
  await fs.rm(path);
 },'CONTINUE',null,['--rdcw-probe']);
 raceRejected(r);
});
test('opt-in overlapped watcher denies rename restoring original directory contents',
 {skip:!ready},async()=>{
 const f=await fixture();
 await fs.writeFile(join(f.dir,'one.scs'),'SYNTHETIC');
 const r=await race(f,async()=>{
  await fs.rename(join(f.dir,'one.scs'),join(f.dir,'two.scs'));
  await fs.rename(join(f.dir,'two.scs'),join(f.dir,'one.scs'));
 },'CONTINUE',null,['--rdcw-probe']);
 raceRejected(r);
});
test('opt-in watcher denies create/delete ABA in the synthetic root',
 {skip:!ready},async()=>{
 const f=await fixture();
 const r=await race(f,async()=>{
  const path=join(f.root,'changed-then-gone');
  await fs.mkdir(path);
  await fs.rmdir(path);
 },'CONTINUE',null,['--rdcw-probe']);
 raceRejected(r);
});
test('opt-in watcher refuses bounded event burst without leaking synthetic names',
 {skip:!ready},async()=>{
 const f=await fixture();
 const name='opaque-burst-';
 const r=await race(f,async()=>{
  // Deliberately exceed the one-shot 4 KiB native notification buffer
  // workload. We do NOT claim the driver actually emitted an overflow.
  for(let i=0;i<96;i++){
   const p=join(f.dir,name+i+'.scs');
   await fs.writeFile(p,'TEST');
   await fs.rm(p);
  }
 },'CONTINUE',null,['--rdcw-probe']);
 raceRejected(r);
 assert.equal(r.stderr.includes(name),false);
 assert.equal(r.stdout.includes(name),false);
});
test('opt-in watcher refuses extra CLI commands rather than accepting new capabilities',
 {skip:!ready},async()=>{
 const f=await fixture();
 await denied(f,['--rdcw-probe','--install']);
});

test('opt-in overlapped watcher keeps the 21-key untrusted contract after quiet barrier',
 {skip:!ready},async()=>{
 const f=await fixture();
 const result=await race(f,async()=>{},'CONTINUE',null,['--rdcw-probe']);
 assert.equal(result.code,0,result.stderr);
 const parsed=validate({stdout:result.stdout.replace(/^READY\r?\n/,''),stderr:result.stderr});
 assert.equal(parsed.entries,0);
 assert.equal(parsed.guaranteesNoABA,false);
 assert.equal(parsed.operationsEnabled,false);
});

test('opt-in overlapped watcher refuses EOF and cleans up pending I/O',
 {skip:!ready},async()=>{
 const f=await fixture();
 raceRejected(await race(f,async()=>{},null,null,['--rdcw-probe']));
});

test('opt-in overlapped watcher cannot reinterpret invalid continuation as a command',
 {skip:!ready},async()=>{
 const f=await fixture();
 raceRejected(await race(f,async()=>{},'INSTALL',null,['--rdcw-probe']));
});

test('real CancelIoEx on a pending synthetic directory watch refuses generically',
 {skip:!ready},async()=>{
 const f=await fixture();
 await denied(f,['--rdcw-probe','--test-cancel-pending-io']);
 assert.equal(await fs.readFile(join(f.root,MARKER),'utf8'),f.nonce);
});

test('pending-I/O cancellation does not reveal synthetic filenames or grant operations',
 {skip:!ready},async()=>{
 const f=await fixture();
 const secret='this-is-a-synthetic-private-package.scs';
 await fs.writeFile(join(f.dir,secret),'NEVER-READ');
 await assert.rejects(invoke(f,['--rdcw-probe','--test-cancel-pending-io']),error=>{
  assert.equal(error.code,3);
  assert.match(error.stderr,/Temporary standalone native directory lab refused/);
  assert.equal(error.stdout,'');
  assert.doesNotMatch(error.stderr,/this-is-a-synthetic-private-package|GetOverlappedResult|CancelIoEx/i);
  assert.equal(error.stderr.includes(f.root),false);
  return true;
 });
 assert.equal(await fs.readFile(join(f.dir,secret),'utf8'),'NEVER-READ');
});

test('native cancellation command is not accepted without the opt-in watcher',
 {skip:!ready},async()=>{
 const f=await fixture();
 await denied(f,['--test-cancel-pending-io']);
});

test('kernel cancellation attestation requires actual ERROR_OPERATION_ABORTED 995',
 {skip:!ready},async()=>{
 const f=await fixture();
 await assert.rejects(invoke(f,['--rdcw-probe','--test-attest-cancel-995']),error=>{
  // Exit 4 is only emitted after GetOverlappedResult confirms 995.
  // The refusal text itself remains the same generic denial.
  assert.equal(error.code,4);
  assert.equal(error.stdout,'');
  assert.equal(error.stderr.trim(),'Temporary standalone native directory lab refused.');
  assert.equal(error.stderr.includes(f.root),false);
  assert.equal(error.stderr.includes(f.nonce),false);
  return true;
 });
});

test('cancel status attestation is repeatable and changes no synthetic data',
 {skip:!ready},async()=>{
 const f=await fixture();
 const pkg=join(f.dir,'synthetic-sensitive.scs');
 await fs.writeFile(pkg,'UNTOUCHED');
 // Separate short-lived native child processes: no global persistent watcher.
 for(let i=0;i<5;i++){
  await assert.rejects(invoke(f,['--rdcw-probe','--test-attest-cancel-995']),
   error=>{
    assert.equal(error.code,4);
    assert.equal(error.stdout,'');
    assert.equal(error.stderr.trim(),'Temporary standalone native directory lab refused.');
    return true;
   });
 }
 assert.equal(await fs.readFile(pkg,'utf8'),'UNTOUCHED');
 assert.equal(await fs.readFile(join(f.root,MARKER),'utf8'),f.nonce);
});

test('attestation cannot be requested without opt-in watcher or extra commands',
 {skip:!ready},async()=>{
 const f=await fixture();
 await denied(f,['--test-attest-cancel-995']);
 await denied(f,['--rdcw-probe','--test-attest-cancel-995','--install']);
});

test('native Win32 small notification buffer must prove a kernel loss-of-detail signal',
 {skip:!ready},async(t)=>{
 const f=await fixture();
 // Long but legal synthetic Windows file name exceeds the native 64-byte
 // FILE_NOTIFY_INFORMATION buffer without creating any real mod content.
 const name='synthetic-'+('b'.repeat(166))+'.scs';
 const r=await race(f,async()=>{
  await fs.writeFile(join(f.dir,name),'SYNTHETIC ONLY');
 },'CONTINUE',null,[],
 ['--root',f.root,'--nonce',f.nonce,'--rdcw-probe','--test-small-buffer-loss']);
 assert.ok([5,6].includes(r.code),'kernel did not attest 1022 or zero bytes: '+JSON.stringify(r));
 // No filenames, root paths or nonces in CI; only the exact class of OS
 // result is exposed so we can distinguish confirmed loss from ambiguity.
 t.diagnostic('native small-buffer signal: '+(r.code===5
  ? 'ERROR_NOTIFY_ENUM_DIR (1022)'
  : 'completed successfully with ZERO event-detail bytes'));
 assert.equal(r.stdout.trim(),'READY');
 assert.equal(r.stderr.trim(),'Temporary standalone native directory lab refused.');
 assert.equal(r.stdout.includes(name),false);
 assert.equal(r.stderr.includes(name),false);
 assert.equal(r.stderr.includes(f.root),false);
 assert.equal(await fs.readFile(join(f.dir,name),'utf8'),'SYNTHETIC ONLY');
});

test('small-buffer evidence mode forbids unapproved arguments and empty target',
 {skip:!ready},async()=>{
 const f=await fixture();
 await denied(f,['--test-small-buffer-loss']);
 await denied(f,['--rdcw-probe','--test-small-buffer-loss','--install']);
});

test('normal Win32 watcher still returns only untrusted 21-key receipt after synthetic small-buffer test',
 {skip:!ready},async()=>{
 const f=await fixture();
 const result=validate(await invoke(f,['--rdcw-probe']));
 assert.equal(result.entries,0);
 assert.equal(result.guaranteesNoABA,false);
 assert.equal(result.operationsEnabled,false);
});

test('Win32 queued rename storm must attest actual loss of event details, not just event count',
 {skip:!ready,timeout:90000},async(t)=>{
 const f=await fixture();
 const original=join(f.dir,'loop-'+('q'.repeat(110))+'.scs');
 const renamed=join(f.dir,'loop-'+('r'.repeat(110))+'.scs');
 await fs.writeFile(original,'SYNTHETIC ONLY');
 const child=spawn(exe,['--root',f.root,'--nonce',f.nonce,
  '--rdcw-probe','--test-queued-overflow'],{
  shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']
 });
 let stdout='',stderr='';
 let readyResolve,stormResolve;
 const ready=new Promise(resolve=>{readyResolve=resolve;});
 const stormReady=new Promise(resolve=>{stormResolve=resolve;});
 child.stdout.on('data',part=>{
  stdout+=part.toString();
  if(stdout.includes('READY\n')||stdout.includes('READY\r\n'))readyResolve();
  if(stdout.includes('STORM_READY\n')||stdout.includes('STORM_READY\r\n'))stormResolve();
 });
 child.stderr.on('data',part=>{stderr+=part.toString();});
 const finished=new Promise((resolve,reject)=>{
  child.once('error',reject);
  child.once('close',code=>resolve(code));
 });
 async function step(action,limit=30000){
  let handle;
  try{
   return await Promise.race([action,new Promise((_,reject)=>{
    handle=setTimeout(()=>reject(Error('bounded native overflow stage timeout')),limit);
   })]);
  }finally{clearTimeout(handle);}
 }
 try{
  await step(Promise.race([ready,finished.then(code=>{
   throw Error('exited before READY: '+code+' '+stderr);
  })]));
  await fs.writeFile(join(f.dir,'single-trigger.txt'),'SYNTHETIC');
  child.stdin.write('TRIGGER_DONE\n');
  await step(Promise.race([stormReady,finished.then(code=>{
   throw Error('exited before STORM_READY: '+code+' '+stderr);
  })]));
  // This time the native watcher has FINISHED its first delivery.
  // Leave the SAME handle without a pending read and accumulate a backlog.
  for(let i=0;i<900;i++){
   await fs.rename(original,renamed);
   await fs.rename(renamed,original);
  }
  child.stdin.end('STORM_DONE\n');
  const code=await step(finished,15000);
  assert.ok([7,8].includes(code),
   'no OS-backed accumulated loss evidence, exit '+code+
   ', generic error: '+stderr.trim());
  assert.match(stdout,/^READY\r?\nVOLUME_KIND=(NTFS|ReFS|Other|Unavailable)\r?\nSTORM_READY\r?\nSCAN_ONLY\r?\n$/);
  const family=stdout.match(/^VOLUME_KIND=(NTFS|ReFS|Other|Unavailable)$/m)?.[1];
  assert.ok(family);
  t.diagnostic('native queued-change filesystem family: '+family);
  assert.equal(stderr.trim(),'Temporary standalone native directory lab refused.');
  t.diagnostic('native queued-change signal: '+(code===7
   ? 'ERROR_NOTIFY_ENUM_DIR (1022)'
   : 'completed successfully with ZERO event-detail bytes'));
  assert.equal(stdout.includes(f.root),false);
  assert.equal(stderr.includes(f.root),false);
  assert.equal(stderr.includes(f.nonce),false);
  assert.equal(await fs.readFile(original,'utf8'),'SYNTHETIC ONLY');
  await assert.rejects(fs.stat(renamed),{code:'ENOENT'});
 }finally{
  if(child.exitCode===null)child.kill();
 }
});

test('Win32 queued-overflow diagnostic cannot be invoked outside synthetic opt-in mode',
 {skip:!ready},async()=>{
 const f=await fixture();
 await denied(f,['--test-queued-overflow']);
 await denied(f,['--rdcw-probe','--test-queued-overflow','--install']);
});

test('ordinary 4 KiB watcher retains the untrusted contract after queue-overflow experiment',
 {skip:!ready},async()=>{
 const f=await fixture();
 const result=validate(await invoke(f,['--rdcw-probe']));
 assert.equal(result.entries,0);
 assert.equal(result.operationsEnabled,false);
 assert.equal(result.guaranteesNoABA,false);
 assert.equal(result.supportsRealGameInspection,false);
});

test('small queued rename sequence must NOT masquerade as overflow evidence',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture();
 const original=join(f.dir,'quiet-'+('v'.repeat(70))+'.scs');
 const other=join(f.dir,'quiet-'+('w'.repeat(70))+'.scs');
 await fs.writeFile(original,'SYNTHETIC CONTROL');
 const child=spawn(exe,['--root',f.root,'--nonce',f.nonce,
  '--rdcw-probe','--test-queued-overflow'],{
  shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']
 });
 let stdout='',stderr='';
 let readyResolve,stormResolve;
 const ready=new Promise(resolve=>{readyResolve=resolve;});
 const stormReady=new Promise(resolve=>{stormResolve=resolve;});
 child.stdout.on('data',part=>{
  stdout+=part.toString();
  if(/(?:^|\n)READY\r?\n/.test(stdout))readyResolve();
  if(/(?:^|\n)STORM_READY\r?\n/.test(stdout))stormResolve();
 });
 child.stderr.on('data',part=>{stderr+=part.toString();});
 const finished=new Promise((resolve,reject)=>{
  child.once('error',reject);
  child.once('close',code=>resolve(code));
 });
 async function bounded(promise){
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(Error('small-queue test timeout')),30000);
  })]);}
  finally{clearTimeout(timer);}
 }
 try{
  await bounded(Promise.race([ready,finished.then(code=>{
   throw Error('exited before READY: '+code);
  })]));
  await fs.writeFile(join(f.dir,'single-trigger.txt'),'SYNTHETIC');
  child.stdin.write('TRIGGER_DONE\n');
  await bounded(Promise.race([stormReady,finished.then(code=>{
   throw Error('exited before STORM_READY: '+code);
  })]));
  await fs.rename(original,other);
  await fs.rename(other,original);
  child.stdin.end('STORM_DONE\n');
  const code=await bounded(finished);
  assert.equal(code,3,'small queue falsely produced overflow witness '+code);
  assert.match(stdout,/^READY\r?\nVOLUME_KIND=(NTFS|ReFS|Other|Unavailable)\r?\nSTORM_READY\r?\n$/);
  assert.doesNotMatch(stdout,/SCAN_ONLY/);
  assert.equal(stderr.trim(),'Temporary standalone native directory lab refused.');
  assert.equal(await fs.readFile(original,'utf8'),'SYNTHETIC CONTROL');
 }finally{
  if(child.exitCode===null)child.kill();
 }
});

test('filesystem classification uses pinned Win32 handle and has no sensitive volume identifiers',
 {skip:!ready},async()=>{
 const source=await fs.readFile(join(__dirname,'Program.cs'),'utf8');
 assert.match(source,/GetVolumeInformationByHandleW/);
 assert.match(source,/SafeVolumeFamily\(directory\)/);
 assert.match(source,/fileSystemName, uint fileSystemNameLength/);
 assert.doesNotMatch(source,/Console\.Out\.WriteLine\(.*(?:VolumeSerialNumber|serialNumber|volumeName)/i);
});

test('post-overflow bounded scan is read-only and never returns the 21-key success receipt',
 {skip:!ready},async()=>{
 const source=await fs.readFile(join(__dirname,'Program.cs'),'utf8');
 assert.match(source,/AttestQueuedOverflowForSyntheticTest\(afterLoss\s*=>/);
 assert.match(source,/int\[\] current = Inspect\(heldRoot, target,/);
 assert.match(source,/currentNames\.Sort\(StringComparer\.Ordinal\)/);
 assert.match(source,/String\.Equals\(name, baselineNames\[i\],/);
 assert.match(source,/VerifyHeldMarker\(markerPath, args\[3\], heldMarker/);
 assert.match(source,/Console\.Out\.WriteLine\("SCAN_ONLY"\)/);
 assert.match(source,/throw new SyntheticNotificationLossWitness/);
});


async function assertQueuedSnapshotDivergence(mutate, expectedCode=3){
 const f=await fixture();
 const original=join(f.dir,'loop-'+('q'.repeat(110))+'.scs');
 const renamed=join(f.dir,'loop-'+('r'.repeat(110))+'.scs');
 await fs.writeFile(original,'ORIGINAL SYNTHETIC PACKAGE');
 const child=spawn(exe,['--root',f.root,'--nonce',f.nonce,
  '--rdcw-probe','--test-queued-overflow'],{
  shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']
 });
 let stdout='',stderr='';
 let readyResolve,stormResolve;
 const ready=new Promise(resolve=>{readyResolve=resolve;});
 const stormReady=new Promise(resolve=>{stormResolve=resolve;});
 child.stdout.on('data',chunk=>{
  stdout+=chunk.toString();
  if(/^READY\r?\n/.test(stdout))readyResolve();
  if(stdout.includes('STORM_READY\n')||
     stdout.includes('STORM_READY\r\n'))stormResolve();
 });
 child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
 const finished=new Promise((resolve,reject)=>{
  child.once('error',reject);
  child.once('close',code=>resolve(code));
 });
 async function bounded(promise,limit=30000){
  let handle;
  try{
   return await Promise.race([promise,new Promise((_,reject)=>{
    handle=setTimeout(()=>reject(Error('snapshot divergence stage timed out')),limit);
   })]);
  }finally{clearTimeout(handle);}
 }
 try{
  await bounded(Promise.race([ready,finished.then(code=>{
   throw Error('child exited before READY: '+code+' '+stderr);
  })]));
  await fs.writeFile(join(f.dir,'single-trigger.txt'),'SYNTHETIC TRIGGER');
  child.stdin.write('TRIGGER_DONE\n');
  await bounded(Promise.race([stormReady,finished.then(code=>{
   throw Error('child exited before STORM_READY: '+code+' '+stderr);
  })]));
  // First native read completed and baseline was captured by the child.
  // While unarmed, 900 rename pairs overwhelm the 4096-byte buffer.
  for(let i=0;i<900;i++){
   await fs.rename(original,renamed);
   await fs.rename(renamed,original);
  }
  await mutate({f,original,renamed});
  child.stdin.end('STORM_DONE\n');
  const code=await bounded(finished,15000);
  assert.equal(code,expectedCode,
   'divergent snapshot MUST refuse with the specific native witness');
  assert.match(stdout,
   /^READY\r?\nVOLUME_KIND=(NTFS|ReFS|Other|Unavailable)\r?\nSTORM_READY\r?\n$/);
  assert.doesNotMatch(stdout,/SCAN_ONLY|observed-bounded-untrusted|packageCandidates/);
  assert.equal(stderr.trim(),'Temporary standalone native directory lab refused.');
  assert.equal(stdout.includes(f.root),false);
  assert.equal(stderr.includes(f.root),false);
  assert.equal(stdout.includes(f.nonce),false);
  assert.equal(stderr.includes(f.nonce),false);
 }finally{
  if(child.exitCode===null)child.kill();
 }
}

for(const scenario of [
 {title:'extra package',mutate:async({f})=>{
  await fs.writeFile(join(f.dir,'unexpected.zip'),'EXTRA FAKE PACKAGE');
 }},
 {title:'missing original package',mutate:async({original})=>{
  await fs.rm(original);
 }},
 {title:'same-count name substitution',mutate:async({f,original})=>{
  await fs.rename(original,join(f.dir,'different-package.scs'));
 }},
 {title:'same-name same-bytes different FileId',expectedCode:9,mutate:async({original,renamed})=>{
  // The original inode remains alive at its temporary renamed pathname
  // while a NEW file is created at the exact original name and length.
  // This avoids comparing two snapshots of the same still-existing file.
  await fs.rename(original,renamed);
  await fs.writeFile(original,'ORIGINAL SYNTHETIC PACKAGE');
  await fs.rm(renamed);
 }},
 {title:'altered marker bytes',mutate:async({f})=>{
  await fs.writeFile(join(f.root,MARKER),'0'.repeat(32));
 }}
]){
 test('Win32 post-loss reconciliation refuses '+scenario.title+' without SCAN_ONLY',
  {skip:!ready,timeout:90000},async()=>{
   await assertQueuedSnapshotDivergence(scenario.mutate,scenario.expectedCode??3);
  });
}

test('native post-loss snapshot checks each child FileId without reading bytes',
 {skip:!ready},async()=>{
 const source=await fs.readFile(join(__dirname,'Program.cs'),'utf8');
 assert.match(source,/OpenRelative\(parent, name, false, attributesOnly: true\)/);
 assert.match(source,/attributesOnly \? 0U : 0x0001U/);
 assert.match(source,/syntheticIdentity\.TryAdd\(name, Identity\(child\)\)/);
 assert.match(source,/baselineIds\.TryGetValue\(name,/);
 assert.match(source,/currentIds\.TryGetValue\(name,/);
 assert.match(source,/!Same\(beforeId, afterId\)/);
 assert.match(source,/throw new SyntheticChildIdentityMismatch\(\)/);
 assert.match(source,/catch \(SyntheticChildIdentityMismatch\)/);
 assert.match(source,/guaranteesNoABA\x22\] = false/);
 assert.match(source,/operationsEnabled\x22\] = false/);
});


test('Windows in-place ABA: restored bytes, unchanged child name and FileId still produce metadata refusal 10',
 {skip:!ready},async()=>{
 const f=await fixture();
 const p=join(f.dir,'metadata-probe.scs');
 const pristine='SYNTHETIC METADATA FIXTURE';
 await fs.writeFile(p,pristine);
 const before=await fs.stat(p);
 const r=await race(f,async()=>{
  await fs.writeFile(p,'TEMPORARY MODIFIED DATA, NEVER A GAME MOD');
  await fs.writeFile(p,pristine);
 },'CONTINUE',null,[],
 ['--root',f.root,'--nonce',f.nonce,'--rdcw-probe','--test-inplace-aba']);
 assert.equal(r.code,10,'native code must prove SAME FileId but changed metadata');
 assert.equal(r.stdout.trim(),'READY');
 assert.equal(r.stderr.trim(),'Temporary standalone native directory lab refused.');
 assert.equal(r.stdout.includes(p),false);
 assert.equal(r.stderr.includes(p),false);
 assert.equal(r.stderr.includes(f.nonce),false);
 assert.equal(await fs.readFile(p,'utf8'),pristine);
 const after=await fs.stat(p);
 assert.equal(after.size,before.size);
});

test('Windows in-place ABA quiet control never fabricates metadata mutation evidence',
 {skip:!ready},async()=>{
 const f=await fixture();
 await fs.writeFile(join(f.dir,'metadata-probe.scs'),'SYNTHETIC QUIET CONTROL');
 const r=await race(f,async()=>{},'CONTINUE',null,[],
 ['--root',f.root,'--nonce',f.nonce,'--rdcw-probe','--test-inplace-aba']);
 raceRejected(r);
});

test('Windows in-place ABA same-name replacement witnesses FileId mismatch, not metadata mismatch',
 {skip:!ready},async()=>{
 const f=await fixture();
 const p=join(f.dir,'metadata-probe.scs');
 const other=join(f.dir,'older-metadata-probe.scs');
 await fs.writeFile(p,'SYNTHETIC ONLY');
 const r=await race(f,async()=>{
  await fs.rename(p,other);
  await fs.writeFile(p,'SYNTHETIC ONLY');
  await fs.rm(other);
 },'CONTINUE',null,[],
 ['--root',f.root,'--nonce',f.nonce,'--rdcw-probe','--test-inplace-aba']);
 assert.equal(r.code,9,'different FileId must not produce a metadata witness');
 assert.equal(r.stdout.trim(),'READY');
 assert.equal(r.stderr.trim(),'Temporary standalone native directory lab refused.');
});

test('Windows in-place ABA diagnostic is rejected without explicit test-only flags',
 {skip:!ready},async()=>{
 const f=await fixture();
 await denied(f,['--test-inplace-aba']);
 await denied(f,['--rdcw-probe','--test-inplace-aba','--install']);
});

test('metadata ABA witness uses native Basic() and does not grant operations',
 {skip:!ready},async()=>{
 const source=await fs.readFile(join(__dirname,'Program.cs'),'utf8');
 assert.match(source,/private static bool SameStableMetadata\(FileBasicInfo before/);
 assert.match(source,/!SameStableMetadata\(baseline, afterPinned\)/);
 assert.match(source,/throw new SyntheticChildMetadataMismatch\(\)/);
 assert.match(source,/catch \(SyntheticChildMetadataMismatch\)/);
 assert.match(source,/OpenChildFileIdentity\(heldTarget, testName\)/);
 assert.match(source,/const string testName = "metadata-probe.scs"/);
 assert.match(source,/guaranteesNoABA"\] = false/);
 assert.match(source,/operationsEnabled"\] = false/);
});


test('Windows in-place ABA: restoring LastWriteTime still leaves an NTFS ChangeTime-only witness',
 {skip:!ready},async()=>{
 const f=await fixture();
 const p=join(f.dir,'metadata-probe.scs');
 const pristine='FIXTURE RESTORED WITH ORIGINAL TIMESTAMPS';
 const stableTime=new Date('2024-05-12T12:00:00.000Z');
 await fs.writeFile(p,pristine);
 await fs.utimes(p,stableTime,stableTime);
 const baseline=await fs.stat(p);
 const r=await race(f,async()=>{
  await fs.writeFile(p,'DIFFERENT CONTENT DURING SYNTHETIC ABA');
  await fs.writeFile(p,pristine);
  await fs.utimes(p,stableTime,stableTime);
 },'CONTINUE',null,[],
 ['--root',f.root,'--nonce',f.nonce,'--rdcw-probe','--test-inplace-aba']);
 assert.equal(r.code,11,
  'native kernel must show ONLY ChangeTime changed, while FileId and LastWriteTime match');
 assert.equal(r.stdout.trim(),'READY');
 assert.equal(r.stderr.trim(),'Temporary standalone native directory lab refused.');
 assert.equal(r.stdout.includes(p),false);
 assert.equal(r.stderr.includes(f.root),false);
 assert.equal(await fs.readFile(p,'utf8'),pristine);
 const after=await fs.stat(p);
 assert.equal(after.mtimeMs,baseline.mtimeMs);
 assert.equal(after.size,baseline.size);
});

test('ChangeTime-only witness is exclusively a refusal with unchanged untrusted contract',
 {skip:!ready},async()=>{
 const source=await fs.readFile(join(__dirname,'Program.cs'),'utf8');
 assert.match(source,/baseline\.ChangeTime != afterPinned\.ChangeTime/);
 assert.match(source,/baseline\.LastWriteTime == afterPinned\.LastWriteTime/);
 assert.match(source,/throw new SyntheticChangeTimeOnlyMismatch\(\)/);
 assert.match(source,/catch \(SyntheticChangeTimeOnlyMismatch\)/);
 assert.match(source,/return 11;/);
 assert.match(source,/guaranteesNoABA"\] = false/);
 assert.match(source,/operationsEnabled"\] = false/);
});


test('NTFS per-file USN advances after synthetic bytes and LastWriteTime are restored',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture();
 const p=join(f.dir,'metadata-probe.scs');
 const original='SYNTHETIC USN CHECKPOINT; NO REAL OMSI DATA';
 const oldTime=new Date('2024-03-11T00:00:00.000Z');
 await fs.writeFile(p,original);
 await fs.utimes(p,oldTime,oldTime);
 const before=await fs.stat(p);
 const r=await race(f,async()=>{
  await fs.writeFile(p,'SYNTHETIC TEMPORARY CHANGED CONTENT');
  await fs.writeFile(p,original);
  await fs.utimes(p,oldTime,oldTime);
 },'CONTINUE',null,[],
 ['--root',f.root,'--nonce',f.nonce,'--rdcw-probe','--test-usn-checkpoint']);
 assert.equal(r.code,12,'require ACTUAL NTFS USN advance on the same FileId: '+r.stderr);
 assert.equal(r.stdout.trim(),'READY');
 assert.equal(r.stderr.trim(),'Temporary standalone native directory lab refused.');
 assert.equal(r.stdout.includes(f.root),false);
 assert.equal(r.stderr.includes(f.root),false);
 assert.equal(r.stderr.includes(f.nonce),false);
 assert.equal(await fs.readFile(p,'utf8'),original);
 const after=await fs.stat(p);
 assert.equal(after.size,before.size);
 assert.equal(after.mtimeMs,before.mtimeMs);
});

test('NTFS USN quiet control cannot fabricate a change-journal event',
 {skip:!ready},async()=>{
 const f=await fixture();
 await fs.writeFile(join(f.dir,'metadata-probe.scs'),'SYNTHETIC QUIET JOURNAL CHECK');
 const r=await race(f,async()=>{},'CONTINUE',null,[],
 ['--root',f.root,'--nonce',f.nonce,'--rdcw-probe','--test-usn-checkpoint']);
 raceRejected(r);
});

test('NTFS USN checkpoint rejects same-name replacement with changed FileId',
 {skip:!ready},async()=>{
 const f=await fixture();
 const p=join(f.dir,'metadata-probe.scs');
 const old=join(f.dir,'held-original.scs');
 await fs.writeFile(p,'SYNTHETIC');
 const r=await race(f,async()=>{
  await fs.rename(p,old);
  await fs.writeFile(p,'SYNTHETIC');
  await fs.rm(old);
 },'CONTINUE',null,[],
 ['--root',f.root,'--nonce',f.nonce,'--rdcw-probe','--test-usn-checkpoint']);
 assert.equal(r.code,9,'changing FileId must refuse before USN comparison');
 assert.equal(r.stdout.trim(),'READY');
 assert.equal(r.stderr.trim(),'Temporary standalone native directory lab refused.');
});

test('NTFS USN mode requires correct opt-in command and has no real operations',
 {skip:!ready},async()=>{
 const f=await fixture();
 await denied(f,['--test-usn-checkpoint']);
 await denied(f,['--rdcw-probe','--test-usn-checkpoint','--install']);
});

test('USN sample reads one file only, with no volume journal traversal or names',
 {skip:!ready},async()=>{
 const source=await fs.readFile(join(__dirname,'Program.cs'),'utf8');
 assert.match(source,/FSCTL_READ_FILE_USN_DATA reads the CURRENT record/);
 assert.match(source,/0x000900EB/);
 assert.match(source,/OpenChildFileIdentity\(heldTarget, testName\)/);
 assert.match(source,/CurrentFileUsn\(child\)/);
 assert.match(source,/if \(afterUsn > beforeUsn\) throw new SyntheticUsnChanged/);
 assert.match(source,/catch \(SyntheticUsnChanged\)/);
 assert.doesNotMatch(source,/FSCTL_ENUM_USN_DATA|FSCTL_READ_USN_JOURNAL|FSCTL_CREATE_USN_JOURNAL/);
 assert.match(source,/guaranteesNoABA"\] = false/);
 assert.match(source,/operationsEnabled"\] = false/);
});


test('USN still advances after all four FILE_BASIC_INFO timestamps are restored on synthetic NTFS file',
 {skip:!ready,timeout:90000},async()=>{
 const f=await fixture();
 const original='SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS';
 const p=join(f.dir,'metadata-probe.scs');
 await fs.writeFile(p,original);
 const script=join(__dirname,'restore-basic-times.synthetic.ps1');
 const r=await race(f,async()=>{
  const restored=await execAsync('powershell.exe',[
   '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
   '-File',script,'-Root',f.root,'-Nonce',f.nonce
  ],{windowsHide:true,timeout:30000,maxBuffer:2048});
  assert.equal(restored.stdout.trim(),'RESTORATION_PERFORMED');
  assert.equal(restored.stderr,'');
 },'CONTINUE',null,[],
 ['--root',f.root,'--nonce',f.nonce,'--rdcw-probe','--test-usn-checkpoint']);
 assert.equal(r.code,12,'the real per-file USN must advance even after basic timestamps restored');
 assert.equal(r.stdout.trim(),'READY');
 assert.equal(r.stderr.trim(),'Temporary standalone native directory lab refused.');
 assert.equal(await fs.readFile(p,'utf8'),original);
 assert.equal(r.stderr.includes(f.root),false);
 assert.equal(r.stderr.includes(f.nonce),false);
});

test('standalone synthetic timestamp mutator refuses wrong nonce without modifying bytes',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture();
 const p=join(f.dir,'metadata-probe.scs');
 await fs.writeFile(p,'DO NOT MODIFY');
 const script=join(__dirname,'restore-basic-times.synthetic.ps1');
 await assert.rejects(execAsync('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',script,'-Root',f.root,'-Nonce','0'.repeat(32)
 ],{windowsHide:true,timeout:30000,maxBuffer:2048}));
 assert.equal(await fs.readFile(p,'utf8'),'DO NOT MODIFY');
});

test('timestamp mutator fixture is separate from read-only native helper and excludes real folders',
 {skip:!ready},async()=>{
 const source=await fs.readFile(join(__dirname,'restore-basic-times.synthetic.ps1'),'utf8');
 const observer=await fs.readFile(join(__dirname,'Program.cs'),'utf8');
 assert.match(source,/GetDirectoryName\(\$path\) -ine \$temp/);
 assert.match(source,/omsi-manager-recovery-fixture-/);
 assert.match(source,/\.omsi-test-fixture-marker/);
 assert.match(source,/NumberOfLinks != 1/);
 assert.match(source,/SetFileInformationByHandle/);
 assert.match(source,/Same\(before,\s*current\)/);
 assert.doesNotMatch(observer,/SetFileInformationByHandle|File\.WriteAllBytes/);
 assert.match(observer,/guaranteesNoABA"\] = false/);
 assert.match(observer,/operationsEnabled"\] = false/);
});


test('USN parser rejects 26 malformed v2/v3 records and attests only refusal 13',
 {skip:!ready},async()=>{
 const f=await fixture();
 await assert.rejects(invoke(f,['--rdcw-probe','--test-usn-record-guards']),error=>{
  assert.equal(error.code,13);
  assert.equal(error.stdout,'');
  assert.equal(error.stderr.trim(),'Temporary standalone native directory lab refused.');
  assert.equal(error.stderr.includes(f.root),false);
  assert.equal(error.stderr.includes(f.nonce),false);
  return true;
 });
});

test('USN malformed-record guard refuses missing opt-in and extra operation flags',
 {skip:!ready},async()=>{
 const f=await fixture();
 await denied(f,['--test-usn-record-guards']);
 await denied(f,['--rdcw-probe','--test-usn-record-guards','--install']);
});

test('USN malformed-record guard requires an intact synthetic nonce',
 {skip:!ready},async()=>{
 const f=await fixture();
 await denied({...f,nonce:'0'.repeat(32)},
  ['--rdcw-probe','--test-usn-record-guards']);
});

test('USN parser uses strict bounds, versions and positive values without decoding names',
 {skip:!ready},async()=>{
 const source=await fs.readFile(join(__dirname,'Program.cs'),'utf8');
 assert.match(source,/ValidateSingleUsnRecord\(byte\[\] record, uint returned\)/);
 assert.match(source,/declaredLength != returned/);
 assert.match(source,/minor != 0/);
 assert.match(source,/nameLength > declaredLength - nameStart/);
 assert.match(source,/usn <= 0/);
 assert.match(source,/return ValidateSingleUsnRecord\(record, returned\)/);
 assert.match(source,/catch \(SyntheticUsnParserValidated\)/);
 assert.doesNotMatch(source,/FSCTL_ENUM_USN_DATA|FSCTL_READ_USN_JOURNAL|FSCTL_CREATE_USN_JOURNAL/);
 assert.match(source,/guaranteesNoABA"\] = false/);
 assert.match(source,/operationsEnabled"\] = false/);
});


test('synthetic timestamp mutator refuses a marked grandchild, even with matching nonce',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture();
 const nested=join(f.root,'omsi-manager-recovery-fixture-nested');
 const target=join(nested,'native-enum','metadata-probe.scs');
 await fs.mkdir(join(nested,'native-enum'),{recursive:true});
 await fs.writeFile(join(nested,MARKER),f.nonce);
 await fs.writeFile(target,'SYNTHETIC NESTED - MUST STAY');
 const script=join(__dirname,'restore-basic-times.synthetic.ps1');
 await assert.rejects(execAsync('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',script,'-Root',nested,'-Nonce',f.nonce
 ],{windowsHide:true,timeout:30000,maxBuffer:2048}));
 assert.equal(await fs.readFile(target,'utf8'),'SYNTHETIC NESTED - MUST STAY');
});

test('synthetic timestamp mutator rejects an unmarked sibling prefix lookalike',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture();
 const sibling=join(dirname(f.root),'omsi-manager-recovery-fixture-INVALID_name');
 roots.add(sibling);
 await fs.mkdir(join(sibling,'native-enum'),{recursive:true});
 const target=join(sibling,'native-enum','metadata-probe.scs');
 await fs.writeFile(join(sibling,MARKER),f.nonce);
 await fs.writeFile(target,'SYNTHETIC INVALID-NAME');
 const script=join(__dirname,'restore-basic-times.synthetic.ps1');
 await assert.rejects(execAsync('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',script,'-Root',sibling,'-Nonce',f.nonce
 ],{windowsHide:true,timeout:30000,maxBuffer:2048}));
 assert.equal(await fs.readFile(target,'utf8'),'SYNTHETIC INVALID-NAME');
});

test('synthetic timestamp mutator refuses junction target without modifying other fixture',
 {skip:!ready,timeout:60000},async(t)=>{
 const f=await fixture();
 const target=join(f.dir,'metadata-probe.scs');
 await fs.writeFile(target,'SYNTHETIC ORIGINAL');
 const alternate=join(f.root,'alternate-file.scs');
 await fs.writeFile(alternate,'SYNTHETIC ALTERNATE');
 await fs.rm(target);
 try{await fs.symlink(alternate,target,'file');}
 catch(error){
  if(['EPERM','EACCES','ENOSYS'].includes(error.code)){
   t.skip('Windows test runner cannot create file symlink');return;
  }
  throw error;
 }
 const script=join(__dirname,'restore-basic-times.synthetic.ps1');
 await assert.rejects(execAsync('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',script,'-Root',f.root,'-Nonce',f.nonce
 ],{windowsHide:true,timeout:30000,maxBuffer:2048}));
 assert.equal(await fs.readFile(alternate,'utf8'),'SYNTHETIC ALTERNATE');
});


test('synthetic timestamp restoration refuses missing marker and preserves the fake package',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture(), p=join(f.dir,'metadata-probe.scs');
 await fs.writeFile(p,'PRESERVE FAKE FILE');
 await fs.rm(join(f.root,MARKER));
 const script=join(__dirname,'restore-basic-times.synthetic.ps1');
 await assert.rejects(execAsync('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',script,'-Root',f.root,'-Nonce',f.nonce
 ],{windowsHide:true,timeout:30000,maxBuffer:2048}));
 assert.equal(await fs.readFile(p,'utf8'),'PRESERVE FAKE FILE');
});

test('synthetic timestamp restoration refuses absent expected file without creating it',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture(),p=join(f.dir,'metadata-probe.scs');
 const script=join(__dirname,'restore-basic-times.synthetic.ps1');
 await assert.rejects(execAsync('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',script,'-Root',f.root,'-Nonce',f.nonce
 ],{windowsHide:true,timeout:30000,maxBuffer:2048}));
 await assert.rejects(fs.stat(p),{code:'ENOENT'});
});

test('synthetic timestamp restoration rejects an unmarked TEMP sibling',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture(),p=join(f.dir,'metadata-probe.scs');
 await fs.writeFile(p,'UNTOUCHED');
 const script=join(__dirname,'restore-basic-times.synthetic.ps1');
 await assert.rejects(execAsync('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',script,'-Root',join(f.root,'native-enum'),'-Nonce',f.nonce
 ],{windowsHide:true,timeout:30000,maxBuffer:2048}));
 assert.equal(await fs.readFile(p,'utf8'),'UNTOUCHED');
});

test('timestamp restoration mutator is never included in shipped Electron package',
 {skip:!ready},async()=>{
 const source=await fs.readFile(join(__dirname,'restore-basic-times.synthetic.ps1'),'utf8');
 assert.match(source,/Standalone, test-only mutator/);
 const electron=await fs.readFile(join(__dirname,'../package.json'),'utf8');
 assert.doesNotMatch(electron,/restore-basic-times\.synthetic\.ps1/);
});

 
// Adversarial inputs for the only temporary test mutator. A successful
// positive fixture is covered above; every negative attempt below must
// exit without success output and must preserve any fake neighboring bytes.
// No game folders, real mods or external files are ever used.
async function timestampMutationRefused(root,nonce,tempParent=null){
 const script=join(__dirname,'restore-basic-times.synthetic.ps1');
 await assert.rejects(execAsync('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',script,'-Root',root,'-Nonce',nonce
 ],{windowsHide:true,timeout:30000,maxBuffer:2048,
  ...(tempParent===null?{}:{env:tempEnv(tempParent)})}),error=>{
  assert.equal(error.code,3,'all rejected inputs use a single denial status');
  assert.equal(error.stdout,'','no false RESTORATION_PERFORMED token');
  assert.equal(error.stderr.trim(),'Synthetic timestamp restoration refused');
  assert.equal(error.stderr.includes(root),false,'no fixture path in error');
  assert.equal(error.stderr.includes(nonce),false,'no nonce in error');
  return true;
 });
}
test('timestamp mutator refuses valid name and nonce when fake bytes are changed',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture(),p=join(f.dir,'metadata-probe.scs');
 const forged='SYNTHETIC ONLY RESTORE ALL F0UR TIMESTAMPS';
 await fs.writeFile(p,forged);
 await timestampMutationRefused(f.root,f.nonce);
 assert.equal(await fs.readFile(p,'utf8'),forged);
});

test('timestamp mutator rejects a missing native-enum directory without recreating it',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture(),sentinel=join(f.root,'outside-sentinel.txt');
 await fs.writeFile(sentinel,'UNCHANGED OUTSIDE TARGET');
 await fs.rmdir(f.dir);
 await timestampMutationRefused(f.root,f.nonce);
 await assert.rejects(fs.stat(f.dir),{code:'ENOENT'});
 assert.equal(await fs.readFile(sentinel,'utf8'),'UNCHANGED OUTSIDE TARGET');
});
test('timestamp mutator refuses wrong-case synthetic filename on Windows',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture(),wrong=join(f.dir,'METADATA-PROBE.SCS');
 await fs.writeFile(wrong,'UPPERCASE NAME MUST STAY');
 await timestampMutationRefused(f.root,f.nonce);
 assert.equal(await fs.readFile(wrong,'utf8'),'UPPERCASE NAME MUST STAY');
 await assert.rejects(fs.stat(join(f.dir,'metadata-probe.scs.nonexistent')),
  {code:'ENOENT'});
});
test('timestamp mutator refuses wrong extension and preserves original fake bytes',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture(),wrong=join(f.dir,'metadata-probe.zip');
 await fs.writeFile(wrong,'WRONG EXTENSION STAYS');
 await timestampMutationRefused(f.root,f.nonce);
 assert.equal(await fs.readFile(wrong,'utf8'),'WRONG EXTENSION STAYS');
 await assert.rejects(fs.stat(join(f.dir,'metadata-probe.scs')),{code:'ENOENT'});
});
test('timestamp mutator refuses unexpected sibling even if expected filename exists',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture(),expected=join(f.dir,'metadata-probe.scs');
 const sibling=join(f.dir,'unapproved-sibling.scs');
 await fs.writeFile(expected,'EXPECTED FILE PRESERVED');
 await fs.writeFile(sibling,'SIBLING PRESERVED');
 await timestampMutationRefused(f.root,f.nonce);
 assert.equal(await fs.readFile(expected,'utf8'),'EXPECTED FILE PRESERVED');
 assert.equal(await fs.readFile(sibling,'utf8'),'SIBLING PRESERVED');
});
test('timestamp mutator refuses a marker stored under the wrong filename',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture(),p=join(f.dir,'metadata-probe.scs');
 await fs.writeFile(p,'FAKE PACKAGE STAYS');
 await fs.rename(join(f.root,MARKER),join(f.root,MARKER+'.bak'));
 await timestampMutationRefused(f.root,f.nonce);
 assert.equal(await fs.readFile(p,'utf8'),'FAKE PACKAGE STAYS');
 assert.equal(await fs.readFile(join(f.root,MARKER+'.bak'),'utf8'),f.nonce);
});
test('timestamp mutator cannot use fixture A nonce to modify fixture B',
 {skip:!ready,timeout:60000},async()=>{
 const a=await fixture(),b=await fixture();
 const p=join(b.dir,'metadata-probe.scs');
 await fs.writeFile(p,'DIFFERENT MARKED FIXTURE MUST STAY');
 await timestampMutationRefused(b.root,a.nonce);
 assert.equal(await fs.readFile(p,'utf8'),'DIFFERENT MARKED FIXTURE MUST STAY');
});
test('timestamp mutator refuses direct-child scope escape despite copied marker',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture(),nested=join(f.root,'omsi-manager-recovery-fixture-copy');
 const p=join(nested,'native-enum','metadata-probe.scs');
 await fs.mkdir(join(nested,'native-enum'),{recursive:true});
 await fs.writeFile(join(nested,MARKER),f.nonce);
 await fs.writeFile(p,'COPIED NONCE DOES NOT ALLOW NESTED MUTATION');
 await timestampMutationRefused(nested,f.nonce);
 assert.equal(await fs.readFile(p,'utf8'),'COPIED NONCE DOES NOT ALLOW NESTED MUTATION');
});


// Deterministic two-process barrier AFTER the fixture-only writer has pinned
// root, child directory, marker and the exact expected .scs file handles.
async function runPinnedTimestampBarrier(f, mutate, reply='CONTINUE',tempParent=null){
 const script=join(__dirname,'restore-basic-times.synthetic.ps1');
 const child=spawn('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',script,'-Root',f.root,'-Nonce',f.nonce,'-HoldAfterPin'
 ],{windowsHide:true,shell:false,stdio:['pipe','pipe','pipe'],
  ...(tempParent===null?{}:{env:tempEnv(tempParent)})});
 let stdout='',stderr='';
 let readyResolve;
 const held=new Promise(resolve=>{readyResolve=resolve;});
 const finished=new Promise((resolve,reject)=>{
  child.once('error',reject);
  child.once('close',code=>resolve(code));
 });
 child.stdout.on('data',data=>{
  stdout+=data.toString();
  if(/^HANDLE_HELD\r?\n/.test(stdout))readyResolve();
 });
 child.stderr.on('data',data=>{stderr+=data.toString();});
 async function bounded(p){
  let timer;
  try{return await Promise.race([p,new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(Error('pinned test writer timed out')),30000);
  })]);}
  finally{clearTimeout(timer);}
 }
 try{
  await bounded(Promise.race([held,finished.then(code=>{
   throw Error('writer did not pin fixture: '+code+' '+stderr);
  })]));
  await mutate(f);
  child.stdin.end(reply+'\n');
  const code=await bounded(finished);
  return {code,stdout:stdout.replace(/\r\n/g,'\n'),stderr};
 }finally{
  if(child.exitCode===null)child.kill();
 }
}

test('pinned mutator blocks concurrent fake-file rewrite and rename before writing',
 {skip:!ready,timeout:90000},async()=>{
 const f=await fixture();
 const p=join(f.dir,'metadata-probe.scs');
 const original='SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS';
 await fs.writeFile(p,original);
 const result=await runPinnedTimestampBarrier(f,async()=>{
  await assert.rejects(fs.writeFile(p,'OUTSIDE WRITER ATTEMPT'));
  await assert.rejects(fs.rename(p,join(f.dir,'moved-probe.scs')));
  assert.equal(await fs.readFile(p,'utf8'),original);
 });
 assert.equal(result.code,0,result.stderr);
 assert.equal(result.stdout,'HANDLE_HELD\nRESTORATION_PERFORMED\n');
 assert.equal(result.stderr,'');
 assert.equal(await fs.readFile(p,'utf8'),original);
 await assert.rejects(fs.stat(join(f.dir,'moved-probe.scs')),{code:'ENOENT'});
});

test('pinned mutator blocks root/child directory and marker replacement',
 {skip:!ready,timeout:90000},async()=>{
 const f=await fixture();
 const p=join(f.dir,'metadata-probe.scs');
 const original='SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS';
 const safe=join(f.root,'outside-sentinel.txt');
 await fs.writeFile(p,original);
 await fs.writeFile(safe,'SENTINEL UNTOUCHED');
 const result=await runPinnedTimestampBarrier(f,async()=>{
  await assert.rejects(fs.rename(f.dir,f.dir+'.renamed'));
  await assert.rejects(fs.rename(f.root,f.root+'.renamed'));
  await assert.rejects(fs.rename(join(f.root,MARKER),join(f.root,MARKER+'.renamed')));
  await assert.rejects(fs.writeFile(join(f.root,MARKER),'0'.repeat(32)));
  assert.equal(await fs.readFile(safe,'utf8'),'SENTINEL UNTOUCHED');
 });
 assert.equal(result.code,0,result.stderr);
 assert.equal(result.stdout,'HANDLE_HELD\nRESTORATION_PERFORMED\n');
 assert.equal(result.stderr,'');
 assert.equal(await fs.readFile(p,'utf8'),original);
 assert.equal(await fs.readFile(safe,'utf8'),'SENTINEL UNTOUCHED');
});

test('pinned mutator refuses invalid continuation before any fake-file write',
 {skip:!ready,timeout:90000},async()=>{
 const f=await fixture(),p=join(f.dir,'metadata-probe.scs');
 const original='SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS';
 await fs.writeFile(p,original);
 const result=await runPinnedTimestampBarrier(f,async()=>{},'INSTALL');
 assert.equal(result.code,3);
 assert.equal(result.stdout,'HANDLE_HELD\n');
 assert.equal(result.stderr.trim(),'Synthetic timestamp restoration refused');
 assert.equal(result.stderr.includes(f.root),false);
 assert.equal(result.stderr.includes(f.nonce),false);
 assert.equal(await fs.readFile(p,'utf8'),original);
});

test('test-only mutator writes through one fixed native handle, never by pathname',
 {skip:!ready},async()=>{
 const src=await fs.readFile(join(__dirname,'restore-basic-times.synthetic.ps1'),'utf8');
 assert.match(src,/new FileStream\(fileHandle, FileAccess.ReadWrite/);
 assert.match(src,/verifier \? shareReadWrite : shareRead/);
 assert.match(src,/SameId\(initialIdentity, reopened\)/);
 assert.match(src,/CheckNonce\(markerStream, nonce\)/);
 assert.match(src,/WriteExact\(stream, intermediate\)/);
 assert.match(src,/WriteExact\(stream, original\)/);
 assert.doesNotMatch(src,/File\.WriteAllBytes|File\.ReadAllBytes|File\.Delete|File\.Move/);
});


test('pinned marker gate rejects oversized fake nonce without reading or changing target',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture();
 const target=join(f.dir,'metadata-probe.scs');
 const pristine='SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS';
 await fs.writeFile(target,pristine);
 await fs.writeFile(join(f.root,MARKER),f.nonce+'X'.repeat(8192));
 await timestampMutationRefused(f.root,f.nonce);
 assert.equal(await fs.readFile(target,'utf8'),pristine);
});

test('relative-handle mutator rejects wrong-case child directory despite Windows lookup',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture();
 await fs.rmdir(f.dir);
 const wrong=join(f.root,'NATIVE-ENUM');
 await fs.mkdir(wrong);
 const target=join(wrong,'metadata-probe.scs');
 const original='SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS';
 await fs.writeFile(target,original);
 await timestampMutationRefused(f.root,f.nonce);
 assert.equal(await fs.readFile(target,'utf8'),original);
});

test('relative-handle mutator rejects wrong-case fixture marker despite valid nonce',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture();
 const oldMarker=join(f.root,MARKER);
 const wrongMarker=join(f.root,MARKER.toUpperCase());
 await fs.rm(oldMarker);
 await fs.writeFile(wrongMarker,f.nonce);
 const target=join(f.dir,'metadata-probe.scs');
 const original='SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS';
 await fs.writeFile(target,original);
 await timestampMutationRefused(f.root,f.nonce);
 assert.equal(await fs.readFile(target,'utf8'),original);
 assert.equal(await fs.readFile(wrongMarker,'utf8'),f.nonce);
});

test('relative-handle mutator refuses hardlinked source even with exact fake bytes',
 {skip:!ready,timeout:60000},async()=>{
 const f=await fixture();
 const target=join(f.dir,'metadata-probe.scs');
 const alias=join(f.root,'synthetic-hardlink-alias.txt');
 const original='SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS';
 await fs.writeFile(target,original);
 await fs.link(target,alias);
 await timestampMutationRefused(f.root,f.nonce);
 assert.equal(await fs.readFile(target,'utf8'),original);
 assert.equal(await fs.readFile(alias,'utf8'),original);
});

test('relative-handle writer never reopens the child with a full pathname',
 {skip:!ready},async()=>{
 const source=await fs.readFile(join(__dirname,'restore-basic-times.synthetic.ps1'),'utf8');
 assert.match(source,/NtOpenFile\(out child, access, ref attributes/);
 assert.match(source,/RootDirectory = parent\.DangerousGetHandle\(\)/);
 assert.match(source,/OpenChild\(rootHandle,\s*"native-enum"/);
 assert.match(source,/OpenChild\(rootHandle,\s*"\.omsi-test-fixture-marker"/);
 assert.match(source,/OpenChild\(directoryHandle,\s*"metadata-probe.scs"/);
 assert.match(source,/AssertExactRootNames\(root\)/);
 assert.doesNotMatch(source,/OpenFile\(file,|OpenFile\(marker,|OpenFile\(directory,/);
 assert.match(source,/This narrows TOCTOU/);
});

test('TEMP ancestor remains pinned during the synthetic write barrier',
 {skip:!ready,timeout:90000},async()=>{
 // Override TMP/TEMP only inside the child test process and only with an
 // independently generated directory under the actual system temporary area.
 const parent=await syntheticTemp();
 const f=await fixtureAt(parent);
 const p=join(f.dir,'metadata-probe.scs');
 const pristine='SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS';
 await fs.writeFile(p,pristine);
 const renamed=parent+'.relocated';
 roots.add(renamed);
 const r=await runPinnedTimestampBarrier(f,async()=>{
  await assert.rejects(fs.rename(parent,renamed),
   'pinned temporary parent must not be renamed during write');
  assert.equal(await fs.readFile(p,'utf8'),pristine);
 },'CONTINUE',parent);
 assert.equal(r.code,0,r.stderr);
 assert.equal(r.stdout,'HANDLE_HELD\nRESTORATION_PERFORMED\n');
 assert.equal(r.stderr,'');
 assert.equal(await fs.readFile(p,'utf8'),pristine);
});

test('TEMP ancestor junction is refused rather than used as a mutation root',
 {skip:!ready,timeout:90000},async(t)=>{
 const parent=await syntheticTemp();
 const real=join(parent,'real-temp');
 const junction=join(parent,'redirected-temp');
 await fs.mkdir(real);
 try{await fs.symlink(real,junction,'junction');}
 catch(err){if(['EPERM','EACCES','ENOSYS'].includes(err.code)){
  t.skip('Windows cannot create a disposable junction in this runner');
  return;
 }throw err;}
 const f=await fixtureAt(junction);
 const p=join(f.dir,'metadata-probe.scs');
 const pristine='SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS';
 await fs.writeFile(p,pristine);
 await timestampMutationRefused(f.root,f.nonce,junction);
 assert.equal(await fs.readFile(p,'utf8'),pristine);
});

test('TEMP parent holds the root open by relative handle and has no write capability',
 {skip:!ready},async()=>{
 const src=await fs.readFile(join(__dirname,'restore-basic-times.synthetic.ps1'),'utf8');
 assert.match(src,/using \(var ancestors = AncestorPins\.Pin\(temp\)\)/);
 assert.match(src,/OpenChild\(ancestors\.TemporaryHandle,\s*Path\.GetFileName\(root\)/);
 assert.match(src,/using \(SafeFileHandle relative = OpenChild\(handles\[i - 1\]/);
 assert.match(src,/if \(!SameId\(NativeInfo\(handles\[i\]\), NativeInfo\(relative\)\)\)/);
 assert.match(src,/SameId\(NativeInfo\(rootHandle\), NativeInfo\(rootPathCheck\)\)/);
 assert.doesNotMatch(src,/OpenFile\(root, readAttributes \| readData/);
 assert.doesNotMatch(src,/File\.WriteAllBytes|File\.ReadAllBytes|File\.Move/);
});


test('grandparent TEMP ancestor cannot be renamed while fake target is pinned',
 {skip:!ready,timeout:90000},async()=>{
 const grandparent=await syntheticTemp();
 const parent=join(grandparent,'nested-temp');
 await fs.mkdir(parent);
 const f=await fixtureAt(parent);
 const file=join(f.dir,'metadata-probe.scs');
 const original='SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS';
 await fs.writeFile(file,original);
 const relocated=grandparent+'.relocated';
 roots.add(relocated);
 const r=await runPinnedTimestampBarrier(f,async()=>{
  await assert.rejects(fs.rename(grandparent,relocated),
   'the test-only TEMP grandparent must be pinned against rename');
  assert.equal(await fs.readFile(file,'utf8'),original);
 },'CONTINUE',parent);
 assert.equal(r.code,0,r.stderr);
 assert.equal(r.stdout,'HANDLE_HELD\nRESTORATION_PERFORMED\n');
 assert.equal(r.stderr,'');
 assert.equal(await fs.readFile(file,'utf8'),original);
});

test('junction in an ancestor ABOVE synthetic TEMP is rejected before fake write',
 {skip:!ready,timeout:90000},async(t)=>{
 const outer=await syntheticTemp();
 const real=join(outer,'real-parent');
 const junction=join(outer,'link-parent');
 await fs.mkdir(real);
 try {await fs.symlink(real,junction,'junction');}
 catch(err){
  if(['EPERM','EACCES','ENOSYS'].includes(err.code)){
   t.skip('Windows cannot create disposable ancestor junction');
   return;
  }
  throw err;
 }
 const inner=join(junction,'nested-temp');
 await fs.mkdir(inner);
 const f=await fixtureAt(inner);
 const file=join(f.dir,'metadata-probe.scs');
 const original='SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS';
 await fs.writeFile(file,original);
 await timestampMutationRefused(f.root,f.nonce,inner);
 assert.equal(await fs.readFile(file,'utf8'),original);
});

test('mutator pins the volume-to-TEMP chain before fake file opens',
 {skip:!ready},async()=>{
 const src=await fs.readFile(join(__dirname,'restore-basic-times.synthetic.ps1'),'utf8');
 assert.match(src,/private sealed class AncestorPins : IDisposable/);
 assert.match(src,/Path\.GetPathRoot\(temp\)/);
 assert.match(src,/volume\.Length != 3/);
 assert.match(src,/pins\.Verify\(\)/);
 assert.match(src,/for \(int i = handles\.Count - 1; i >= 0; i--\)/);
 assert.match(src,/using \(var ancestors = AncestorPins\.Pin\(temp\)\)/);
 assert.doesNotMatch(src,/using \(var tempHandle = OpenFile\(temp,/);
 assert.doesNotMatch(src,/File\.WriteAllBytes|File\.ReadAllBytes/);
});

test('pinned writer rejects a new synthetic sibling created after the race barrier',
 {skip:!ready,timeout:90000},async()=>{
 const f=await fixture();
 const target=join(f.dir,'metadata-probe.scs');
 const sibling=join(f.dir,'unexpected-sibling.scs');
 const pristine='SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS';
 await fs.writeFile(target,pristine);
 let created=false;
 const result=await runPinnedTimestampBarrier(f,async()=>{
  try{
   await fs.writeFile(sibling,'SYNTHETIC SIBLING CREATED DURING BARRIER',{flag:'wx'});
   created=true;
  }catch(err){
   assert.ok(['EPERM','EACCES','EBUSY'].includes(err.code),
    'unexpected sibling creation failure: '+err.code);
  }
 });
 // If Windows prevents the sibling creation itself, the protected target may
 // safely finish. If creation succeeds, the pinned writer must refuse.
 assert.equal(result.code,created?3:0,result.stderr);
 assert.equal(result.stderr.trim(),
   created?'Synthetic timestamp restoration refused':'');
 assert.equal(await fs.readFile(target,'utf8'),pristine);
 if(created)assert.equal(await fs.readFile(sibling,'utf8'),
  'SYNTHETIC SIBLING CREATED DURING BARRIER');
});

test('pinned writer refuses a metadata change attempted after verification',
 {skip:!ready,timeout:90000},async()=>{
 const f=await fixture();
 const target=join(f.dir,'metadata-probe.scs');
 const pristine='SYNTHETIC ONLY RESTORE ALL FOUR TIMESTAMPS';
 await fs.writeFile(target,pristine);
 const before=await fs.stat(target);
 let changed=false;
 const result=await runPinnedTimestampBarrier(f,async()=>{
  try{
   await fs.utimes(target,new Date('2012-01-01T00:00:00Z'),
    new Date('2012-01-01T00:00:00Z'));
   const now=await fs.stat(target);
   changed=Math.abs(now.mtimeMs-before.mtimeMs)>1000;
  }catch(err){
   assert.ok(['EPERM','EACCES','EBUSY'].includes(err.code),
    'unexpected metadata change failure: '+err.code);
  }
 });
 assert.equal(result.code,changed?3:0,result.stderr);
 assert.equal(result.stderr.trim(),
   changed?'Synthetic timestamp restoration refused':'');
 assert.equal(await fs.readFile(target,'utf8'),pristine);
});

test('synthetic writer reattests pinned ancestry and nonce around both data writes',
 {skip:!ready},async()=>{
 const src=await fs.readFile(join(__dirname,'restore-basic-times.synthetic.ps1'),'utf8');
 const check=/CheckPinnedFixture\(ancestors, root, directory,/g;
 assert.equal([...src.matchAll(check)].length,2);
 assert.match(src,/private static void CheckPinnedFixture\(/);
 assert.match(src,/ancestors\.Verify\(\)/);
 assert.match(src,/markerStream\.Position = 0;\s*CheckNonce\(markerStream, nonce\)/);
 assert.match(src,/!Same\(fileBasic, current\)/);
 assert.match(src,/SameId\(fileId, NativeInfo\(fileHandle\)\)/);
 const checks=[...src.matchAll(check)].map(x=>x.index);
 const firstWrite=src.indexOf('WriteExact(stream, intermediate);');
 const restore=src.indexOf('if (!SetBasic(fileHandle, 0, ref restore, 40))');
 assert.ok(checks[0]<firstWrite && firstWrite<restore && restore<checks[1],
  'fixture identities must be checked before writing and after restoring');
});
