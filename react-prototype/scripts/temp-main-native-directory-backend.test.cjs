'use strict';
// Disposable cross-platform boundary tests + real Win32 native integration.
// Neither renderer, Electron production nor real mods can invoke this module.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {join,dirname}=require('node:path');
const {tmpdir}=require('node:os');
const {randomBytes}=require('node:crypto');
const {PREFIX,MARKER}=require('./temp-recovery-fixture.cjs');
const {createTemporaryNativeDirectoryBackend,checkResult,
 NATIVE_KEYS,MAX_STDOUT,TIMEOUT_MS}=require('./temp-main-native-directory-backend.cjs');
const {createInspectionExecutor,NATIVE_AUXILIARY}=require('../electron/inspection-executor.cjs');
const {createInspectionGrantGate}=require('../electron/inspection-grant.cjs');
const windows=process.platform==='win32';
const roots=new Set();
async function fixture(){
 const root=await fs.mkdtemp(join(tmpdir(),PREFIX));
 roots.add(root);
 const nonce=randomBytes(16).toString('hex');
 await fs.writeFile(join(root,MARKER),nonce,{flag:'wx',mode:0o600});
 await fs.mkdir(join(root,'native-enum'));
 return {root,nonce,game:'omsi'};
}
function valid(){
 return {
  source:'temporary-native-windows-directory-fixture',
  outcome:'observed-bounded-untrusted',
  nativeDirectoryHandleUsed:true,nativeDirectoryEnumerationByHandle:true,
  nativeFileIdChecked:true,targetIsSynthetic:true,entries:1,directories:0,
  files:1,linksSkipped:0,packageCandidates:0,completedWithinBudget:true,
  nativeIdentityAuthorizedForGameFolders:false,guaranteesNoABA:false,
  atomicPathContainmentProven:false,supportsRealGameInspection:false,
  canRecover:false,canInstall:false,canDelete:false,operationsEnabled:false,
  bytesReadFromMods:0
 };
}
function fakeRunner(response=valid()){
 let calls=0;
 return {get calls(){return calls;},
  run:async()=>{calls++;return {stdout:JSON.stringify(response)+'\n',stderr:''};}
 };
}
function mustDeny(action){
 return assert.rejects(action,/Temporary native backend refused/);
}
function safe(x){
 assert.deepEqual(Object.keys(x).sort(),['nativeHandleUsed','operationsEnabled',
  'outcome','source'].sort());
 assert.equal(x.source,'main-process-native-directory-test');
 assert.equal(x.outcome,'observed-bounded-untrusted');
 assert.equal(x.nativeHandleUsed,true);
 assert.equal(x.operationsEnabled,false);
 assert.equal(Object.isFrozen(x),true);
}
test.after(async()=>{
 for(const root of roots)await fs.rm(root,{recursive:true,force:true});
});
test('an isolated disposable test folder yields a single fixed-shape observation',async()=>{
 const f=await fixture(),spy=fakeRunner();
 const probe=createTemporaryNativeDirectoryBackend({...f,platform:'win32',runner:spy.run});
 const x=await probe(f.root,'omsi');
 safe(x);assert.equal(spy.calls,1);
 assert.equal(JSON.stringify(x).includes(f.root),false);
 assert.equal(JSON.stringify(x).includes(f.nonce),false);
});
test('backend is single use even after successful native observation',async()=>{
 const f=await fixture(),spy=fakeRunner();
 const probe=createTemporaryNativeDirectoryBackend({...f,platform:'win32',runner:spy.run});
 safe(await probe(f.root,'omsi'));
 await mustDeny(probe(f.root,'omsi'));
 assert.equal(spy.calls,1);
});
test('concurrent calls cannot launch two subprocess observations',async()=>{
 const f=await fixture(),spy=fakeRunner();
 const probe=createTemporaryNativeDirectoryBackend({...f,platform:'win32',runner:spy.run});
 const result=await Promise.allSettled([probe(f.root,'omsi'),probe(f.root,'omsi')]);
 assert.deepEqual(result.map(x=>x.status).sort(),['fulfilled','rejected']);
 assert.equal(spy.calls,1);
});
test('another selected folder is refused and consumes the single-use backend',async()=>{
 const f=await fixture(),another=await fixture(),spy=fakeRunner();
 const probe=createTemporaryNativeDirectoryBackend({...f,platform:'win32',runner:spy.run});
 await mustDeny(probe(another.root,'omsi'));
 await mustDeny(probe(f.root,'omsi'));
 assert.equal(spy.calls,0);
});
test('wrong game cannot borrow the marker and consumes the backend',async()=>{
 const f=await fixture(),spy=fakeRunner();
 const probe=createTemporaryNativeDirectoryBackend({...f,platform:'win32',runner:spy.run});
 await mustDeny(probe(f.root,'ats'));
 await mustDeny(probe(f.root,'omsi'));
 assert.equal(spy.calls,0);
});
test('Linux refuses native backend without touching filesystem or runner',async()=>{
 const f=await fixture(),spy=fakeRunner();
 const probe=createTemporaryNativeDirectoryBackend({...f,platform:'linux',runner:spy.run});
 await mustDeny(probe(f.root,'omsi'));
 assert.equal(spy.calls,0);
});
test('an absent or corrupted fixture marker blocks even an injected runner',async()=>{
 const f=await fixture(),spy=fakeRunner();
 await fs.writeFile(join(f.root,MARKER),'0'.repeat(32));
 const probe=createTemporaryNativeDirectoryBackend({...f,platform:'win32',runner:spy.run});
 await mustDeny(probe(f.root,'omsi'));
 assert.equal(spy.calls,0);
});
test('a fixture root outside the direct temporary child scope is denied',async()=>{
 const f=await fixture(),spy=fakeRunner();
 const probe=createTemporaryNativeDirectoryBackend({
  ...f,root:dirname(f.root),platform:'win32',runner:spy.run
 });
 await mustDeny(probe(dirname(f.root),'omsi'));
 assert.equal(spy.calls,0);
});
test('missing native-enum child cannot trigger native execution',async()=>{
 const f=await fixture(),spy=fakeRunner();
 await fs.rmdir(join(f.root,'native-enum'));
 const probe=createTemporaryNativeDirectoryBackend({...f,platform:'win32',runner:spy.run});
 await mustDeny(probe(f.root,'omsi'));
 assert.equal(spy.calls,0);
});
test('native target replaced by ordinary file is refused before runner',async()=>{
 const f=await fixture(),spy=fakeRunner();
 await fs.rmdir(join(f.root,'native-enum'));
 await fs.writeFile(join(f.root,'native-enum'),'NOT A FOLDER');
 const probe=createTemporaryNativeDirectoryBackend({...f,platform:'win32',runner:spy.run});
 await mustDeny(probe(f.root,'omsi'));
 assert.equal(spy.calls,0);
});
test('native-enum symlink or junction is refused before subprocess',{skip:!windows},async(t)=>{
 const f=await fixture(),spy=fakeRunner(),outside=join(f.root,'other');
 await fs.mkdir(outside);
 await fs.rmdir(join(f.root,'native-enum'));
 try{await fs.symlink(outside,join(f.root,'native-enum'),'junction');}
 catch(e){if(['EPERM','EACCES','ENOSYS'].includes(e.code)){
  t.skip('Windows runner cannot create junction');return;
 }throw e;}
 const probe=createTemporaryNativeDirectoryBackend({...f,platform:'win32',runner:spy.run});
 await mustDeny(probe(f.root,'omsi'));
 assert.equal(spy.calls,0);
});
test('native failure and command stderr are sanitized without leaking path',async()=>{
 const f=await fixture(),probe=createTemporaryNativeDirectoryBackend({
  ...f,platform:'win32',runner:async()=>{throw Error('SECRET '+f.root);}
 });
 await assert.rejects(probe(f.root,'omsi'),e=>{
  assert.equal(e.message,'Temporary native backend refused.');
  return true;
 });
});
test('native output containing stderr is refused',async()=>{
 const f=await fixture(),probe=createTemporaryNativeDirectoryBackend({
  ...f,platform:'win32',runner:async()=>({
   stdout:JSON.stringify(valid()),stderr:'PRIVATE '+f.root
  })
 });
 await mustDeny(probe(f.root,'omsi'));
});
test('malformed or oversized stdout is refused with no valid fallback',async()=>{
 for(const output of ['{not json','x'.repeat(MAX_STDOUT+1)]){
  const f=await fixture(),probe=createTemporaryNativeDirectoryBackend({
   ...f,platform:'win32',runner:async()=>({stdout:output,stderr:''})
  });
  await mustDeny(probe(f.root,'omsi'));
 }
});
test('unsafe booleans, extra fields and forged source fail strict result contract',()=>{
 const wrong=[
  {...valid(),canInstall:true},{...valid(),operationsEnabled:true},
  {...valid(),nativeFileIdChecked:false},{...valid(),source:'real-mod-folder'},
  {...valid(),path:'C:\\private\\mods'},{...valid(),guaranteesNoABA:true},
  {...valid(),entries:128},{...valid(),entries:-1},
  {...valid(),files:2},{...valid(),packageCandidates:2},
  {...valid(),entries:1.5},{...valid(),bytesReadFromMods:1},
  Object.assign(Object.create(null),valid()),null,[valid()]
 ];
 for(const x of wrong)assert.throws(()=>checkResult(x),/Temporary native backend refused/);
});
test('native results with accessor fields are denied without invoking getter',()=>{
 const x=valid();let calls=0;
 Object.defineProperty(x,'outcome',{enumerable:true,get(){calls++;throw Error('GETTER');}});
 assert.throws(()=>checkResult(x),/Temporary native backend refused/);
 assert.equal(calls,0);
});
test('expected native schema is explicit and contains no path or file names',()=>{
 assert.equal(NATIVE_KEYS.length,21);
 assert.equal(TIMEOUT_MS,15000);
 assert.equal(MAX_STDOUT,4096);
 assert.equal(NATIVE_KEYS.includes('path'),false);
 assert.equal(NATIVE_KEYS.includes('nonce'),false);
 safe(checkResult(valid()));
});
test('a valid injected native witness traverses main executor only as auxiliary',async()=>{
 const f=await fixture(),spy=fakeRunner();
 const native=createTemporaryNativeDirectoryBackend({...f,platform:'win32',runner:spy.run});
 const executor=createInspectionExecutor({
  platform:'win32',requireNative:true,nativeProbe:native,
  inspect:async(_root,game)=>({
   status:'ok',game,mode:'read-only',groups:[],
   assessment:{compatibilityVerified:false,installationVerified:false}
  })
 });
 const r=await executor.inspectSelectedDirectory(f.root,'omsi');
 assert.equal(r.provenance.nativeDirectoryEnumeration,'auxiliary-untrusted-observation');
 assert.equal(r.provenance.nativeIdentityAuthorizesOperations,false);
 assert.equal(r.provenance.abaRuledOut,false);
 assert.equal(r.provenance.canInstall,false);
 assert.equal(spy.calls,1);
});
test('main grant rejects wrong webContents before launching a native subprocess',async()=>{
 const f=await fixture(),spy=fakeRunner();
 const native=createTemporaryNativeDirectoryBackend({...f,platform:'win32',runner:spy.run});
 const executor=createInspectionExecutor({
  platform:'win32',requireNative:true,nativeProbe:native,
  inspect:async(_root,game)=>({
   status:'ok',game,mode:'read-only',groups:[],
   assessment:{compatibilityVerified:false,installationVerified:false}
  })
 });
 const gate=createInspectionGrantGate({inspect:executor.inspectSelectedDirectory});
 const grant=gate.issue(f.root,'omsi',77);
 await assert.rejects(gate.inspectOnce(grant,78,'omsi'),/Autorização/);
 assert.equal(spy.calls,0);
 await assert.rejects(gate.inspectOnce(grant,77,'omsi'),/Autorização/);
 assert.equal(spy.calls,0);
});
test('actual Win32 child process executes once and returns only an untrusted witness',
 {skip:!windows},async()=>{
 const f=await fixture();
 await fs.writeFile(join(f.root,'native-enum','test.scs'),'DO NOT READ THIS');
 const probe=createTemporaryNativeDirectoryBackend(f);
 const result=await probe(f.root,'omsi');
 safe(result);
 await mustDeny(probe(f.root,'omsi'));
 assert.equal(await fs.readFile(join(f.root,'native-enum','test.scs'),'utf8'),
  'DO NOT READ THIS');
});
test('actual Win32 main executor and one-shot grant preserve read-only restrictions',
 {skip:!windows},async()=>{
 const f=await fixture();
 await fs.mkdir(join(f.root,'Vehicles'));
 await fs.writeFile(join(f.root,'Vehicles','bus.bus'),'CANARY NO OPEN');
 await fs.writeFile(join(f.root,'native-enum','sample.zip'),'DO NOT OPEN');
 const native=createTemporaryNativeDirectoryBackend(f);
 const exec=createInspectionExecutor({platform:'win32',requireNative:true,
  nativeProbe:native});
 const gate=createInspectionGrantGate({inspect:exec.inspectSelectedDirectory});
 const ticket=gate.issue(f.root,'omsi',51);
 const report=await gate.inspectOnce(ticket,51,'omsi');
 assert.equal(report.status,'ok');
 assert.equal(report.groups[0].files,1);
 assert.equal(report.provenance.nativeDirectoryEnumeration,NATIVE_AUXILIARY);
 assert.equal(report.provenance.canInstall,false);
 assert.equal(report.provenance.canRecover,false);
 await assert.rejects(gate.inspectOnce(ticket,51,'omsi'),/Autorização/);
 assert.equal(await fs.readFile(join(f.root,'Vehicles','bus.bus'),'utf8'),'CANARY NO OPEN');
});
test('actual native invocation refuses missing fixture directory without real scan',
 {skip:!windows},async()=>{
 const f=await fixture();
 await fs.rmdir(join(f.root,'native-enum'));
 const probe=createTemporaryNativeDirectoryBackend(f);
 await mustDeny(probe(f.root,'omsi'));
});
