// Strict-sandbox X11 CI: characterize host prerequisites without revealing
// proc paths, kernel configuration values, arbitrary stderr or private data.
// This does NOT certify sandbox compatibility or launch the application.
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {categorizeApparmorModule,categorizeApparmorProfile,categorizeUnshareFailure}
 from './auto-x11-host-policy-contract.mjs';

const run=promisify(execFile);
if(process.platform!=='linux'||process.getuid?.()===0||
   process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true')
 throw Error('X11_HOST_CAPABILITY_PROBE_REFUSED');

async function readSwitch(path){
 try{
  const value=(await readFile(path,'utf8')).trim();
  return value==='0'?'disabled':value==='1'?'enabled':'unknown';
 }catch{return 'unavailable';}
}
// Fixed, read-only kernel/LSM files. Raw content and profile names are
// discarded before logging. This is Node's own confinement, not Electron's.
async function apparmorLsmHints(){
 async function category(path,parse){
  try{return parse(await readFile(path,'utf8'));}catch{return 'unavailable';}
 }
 const [moduleState,hostProcessProfile]=await Promise.all([
  category('/sys/module/apparmor/parameters/enabled',categorizeApparmorModule),
  category('/proc/self/attr/current',categorizeApparmorProfile)
 ]);
 return {moduleState,hostProcessProfile,
  profileIsElectronProof:false,policyChanged:false};
}
async function namespaceCapacity(){
 try{
  const raw=(await readFile('/proc/sys/user/max_user_namespaces','utf8')).trim();
  if(!/^[0-9]{1,18}$/.test(raw))return 'unknown';
  return BigInt(raw)>0n?'positive':'zero';
 }catch{return 'unavailable';}
}
async function currentSecurityState(){
 try{
  const status=await readFile('/proc/self/status','utf8');
  const seccomp=status.match(/^Seccomp:\s*([0-2])$/m);
  const nnp=status.match(/^NoNewPrivs:\s*([01])$/m);
  return {
   seccomp:seccomp?({0:'off',1:'strict',2:'filter'})[seccomp[1]]:'unknown',
   noNewPrivs:nnp?.[1]==='1'?'enabled':nnp?.[1]==='0'?'disabled':'unknown'
  };
 }catch{return {seccomp:'unavailable',noNewPrivs:'unavailable'};}
}
async function unprivilegedUserNamespace(){
 try{
  // No sudo, privilege escalation, filesystem mounts or network access.
  await run('unshare',['--user','--map-root-user','true'],{
   encoding:'utf8',timeout:2500,maxBuffer:2048,
   env:{PATH:'/usr/bin:/bin',LANG:'C'},cwd:'/'
  });
  return {state:'allowed',failureCategory:'none'};
 }catch(error){
  return {state:'blocked-or-unavailable',
   failureCategory:categorizeUnshareFailure(error)};
 }
}
const unshare=await unprivilegedUserNamespace();
console.log('AUTO_X11_HOST_CAPABILITY_CATEGORIES',JSON.stringify({
 unprivilegedUsernsSwitch:await readSwitch('/proc/sys/kernel/unprivileged_userns_clone'),
 usernsCapacity:await namespaceCapacity(),
 apparmorUsernsRestriction:await readSwitch('/proc/sys/kernel/apparmor_restrict_unprivileged_userns'),
 apparmorLsm:await apparmorLsmHints(),
 currentProcess:await currentSecurityState(),
 unshareUserNamespace:unshare.state,
 unshareFailureCategory:unshare.failureCategory,
 evidenceOnly:true,provesElectronSandbox:false,provesX11Window:false
}));
