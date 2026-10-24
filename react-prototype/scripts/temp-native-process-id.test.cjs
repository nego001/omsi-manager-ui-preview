'use strict';
// Native Windows process handle checks only: no connection to user PIDs or games.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs/promises');
const {spawnSync}=require('node:child_process');
const {join,dirname}=require('node:path');
const {tmpdir}=require('node:os');
const {randomBytes}=require('node:crypto');
const {PREFIX,MARKER}=require('./temp-recovery-fixture.cjs');
const nativeScript=join(__dirname,'temp-native-process-id.ps1');
const windows=process.platform==='win32';
const tempRoots=new Set();
async function fixture(){
 const root=await fsp.mkdtemp(join(tmpdir(),PREFIX));
 tempRoots.add(root);
 const nonce=randomBytes(16).toString('hex');
 await fsp.writeFile(join(root,MARKER),nonce,{flag:'wx',mode:0o600});
 return {root,nonce};
}
function execute(f,scenario){
 const p=spawnSync('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',nativeScript,'-Root',f.root,'-Nonce',f.nonce,
  '-Scenario',scenario
 ],{encoding:'utf8',timeout:45000,windowsHide:true,
  env:{...process.env,POWERSHELL_TELEMETRY_OPTOUT:'1'}});
 assert.equal(p.error,undefined,String(p.error));
 return {status:p.status,stderr:p.stderr,stdout:p.stdout,
  result:p.status===0?JSON.parse(p.stdout.trim()):null};
}
function expectDenied(x){
 assert.equal(x.status,3,JSON.stringify(x));
 assert.equal(x.stdout.trim(),'');
 assert.match(x.stderr,/Temporary native process identity fixture refused/);
}
function noAuthority(x){
 assert.equal(x.source,'temporary-windows-native-process-fixture');
 assert.equal(x.nativeProcessHandleObserved,true);
 assert.equal(x.nativeCreationTimeObserved,true);
 assert.equal(x.nativeSameHandleRechecked,true);
 assert.equal(x.nativeChildAliveInitially,true);
 assert.equal(x.pidReuseActuallySimulated,false);
 for(const field of ['externalProcessOwnershipVerified','nativeLockOwnershipVerified',
  'processIdentityAuthorizedForRecovery','automaticCleanupAllowed',
  'canInstall','canRecover','canDelete','operationsEnabled'])
  assert.equal(x[field],false,field);
 assert.equal(x.filesModifiedInGames,0);
}
test.after(async()=>{for(const root of tempRoots)
 await fsp.rm(root,{force:true,recursive:true});});
test('Win32 OpenProcess witness observes only its own sleeping subprocess',
 {skip:!windows},async()=>{
 const f=await fixture(),x=execute(f,'alive');
 assert.equal(x.status,0,x.stderr);
 assert.equal(x.result.scenario,'alive');
 assert.equal(x.result.status,'owned-child-alive-observed-untrusted');
 assert.equal(x.result.matchingTestClaimObserved,true);
 assert.equal(x.result.nativeChildExitObserved,false);
 noAuthority(x.result);
});
test('same Win32 handle rechecks PID and process creation timestamp',
 {skip:!windows},async()=>{
 const f=await fixture(),x=execute(f,'repeated');
 assert.equal(x.status,0,x.stderr);
 assert.equal(x.result.matchingTestClaimObserved,true);
 assert.equal(x.result.nativeSameHandleRechecked,true);
 noAuthority(x.result);
});
test('Win32 process handle observes actual termination of owned child',
 {skip:!windows},async()=>{
 const f=await fixture(),x=execute(f,'terminated');
 assert.equal(x.status,0,x.stderr);
 assert.equal(x.result.status,'owned-child-exit-observed-untrusted');
 assert.equal(x.result.nativeChildExitObserved,true);
 assert.equal(x.result.matchingTestClaimObserved,true);
 assert.equal(x.result.automaticCleanupAllowed,false);
 noAuthority(x.result);
});
test('false PID of another incarnation never matches the native child handle',
 {skip:!windows},async()=>{
 const f=await fixture(),x=execute(f,'forged-pid');
 assert.equal(x.status,0,x.stderr);
 assert.equal(x.result.forgedTestClaimRejected,true);
 assert.equal(x.result.matchingTestClaimObserved,false);
 noAuthority(x.result);
});
test('false creation timestamp is refused even with correct child PID',
 {skip:!windows},async()=>{
 const f=await fixture(),x=execute(f,'forged-creation');
 assert.equal(x.status,0,x.stderr);
 assert.equal(x.result.forgedTestClaimRejected,true);
 assert.equal(x.result.matchingTestClaimObserved,false);
 noAuthority(x.result);
});
test('wrong fixture nonce is rejected before spawning the test child',
 {skip:!windows},async()=>{
 const f=await fixture();
 expectDenied(execute({...f,nonce:'f'.repeat(32)},'alive'));
});
test('marker corruption prevents process observation',
 {skip:!windows},async()=>{
 const f=await fixture();
 await fsp.writeFile(join(f.root,MARKER),'0'.repeat(32));
 expectDenied(execute(f,'alive'));
});
test('parent folder and arbitrary target paths are outside test scope',
 {skip:!windows},async()=>{
 const f=await fixture();
 expectDenied(execute({...f,root:dirname(f.root)},'alive'));
});
test('unsupported scenario cannot be used to supply arbitrary PID',
 {skip:!windows},async()=>{
 const f=await fixture();
 expectDenied(execute(f,'inspect-any-pid'));
});
test('native process output never exposes PID, nonce or filesystem path',
 {skip:!windows},async()=>{
 const f=await fixture();
 const x=execute(f,'alive');
 assert.equal(x.status,0,x.stderr);
 const text=JSON.stringify(x.result);
 assert.equal(text.includes(f.root),false);
 assert.equal(text.includes(f.nonce),false);
 assert.equal(Object.hasOwn(x.result,'pid'),false);
 assert.equal(Object.hasOwn(x.result,'creationTime'),false);
 noAuthority(x.result);
});
test('standalone sentinel outside temporary fixture is unchanged',
 {skip:!windows},async()=>{
 const f=await fixture(),sentinel=join(tmpdir(),
  'omsi-process-sentinel-'+randomBytes(8).toString('hex'));
 const value='untouched:'+randomBytes(16).toString('hex');
 try{
  await fsp.writeFile(sentinel,value,{flag:'wx'});
  const x=execute(f,'terminated');
  assert.equal(x.status,0,x.stderr);
  noAuthority(x.result);
  assert.equal(await fsp.readFile(sentinel,'utf8'),value);
 }finally{await fsp.rm(sentinel,{force:true});}
});
