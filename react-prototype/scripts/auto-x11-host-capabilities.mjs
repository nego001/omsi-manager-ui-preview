// Strict-sandbox X11 CI: characterize host prerequisites without revealing
// proc paths, kernel configuration values, arbitrary stderr or private data.
// This does NOT certify sandbox compatibility or launch the application.
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

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
  return 'allowed';
 }catch{return 'blocked-or-unavailable';}
}
console.log('AUTO_X11_HOST_CAPABILITY_CATEGORIES',JSON.stringify({
 unprivilegedUsernsSwitch:await readSwitch('/proc/sys/kernel/unprivileged_userns_clone'),
 usernsCapacity:await namespaceCapacity(),
 apparmorUsernsRestriction:await readSwitch('/proc/sys/kernel/apparmor_restrict_unprivileged_userns'),
 currentProcess:await currentSecurityState(),
 unshareUserNamespace:await unprivilegedUserNamespace(),
 evidenceOnly:true,provesElectronSandbox:false,provesX11Window:false
}));
