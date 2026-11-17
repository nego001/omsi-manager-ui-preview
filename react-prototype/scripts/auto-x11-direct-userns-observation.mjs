// M42: read-only, same direct CI runner user-namespace environment
// observation. No apparmor/sysctl writes, root privileges, private
// profile names, raw stderr or OMSI mods. Not an Electron confinement test.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {
 categorizeApparmorModule,categorizeApparmorProfile,
 categorizeUnshareFailure
} from './auto-x11-host-policy-contract.mjs';

const REFUSE='M42_DIRECT_RUNNER_USERNS_REFUSED';
const refuse=()=>{throw Error(REFUSE);};
const RUNNERS=['ubuntu-22.04','ubuntu-24.04'];
const switches=['enabled','disabled','unknown','unavailable'];
const profiles=['unconfined','confined-enforce','confined-complain','unknown','unavailable'];
const capacity=['positive','zero','unknown','unavailable'];
const failures=['none','permission-denied','unsupported','tool-unavailable','timeout','other-failure'];
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const exact=(v,ks)=>plain(v)&&Object.keys(v).length===ks.length&&
 ks.every(k=>Object.hasOwn(v,k));

export const M42_FIELDS=Object.freeze([
 'schema','source','runner','apparmorModule','apparmorUsernsRestriction',
 'unprivilegedUsernsSwitch','usernsCapacity','nodeProcessApparmorProfile',
 'unshareAttempt','unshareFailureCategory','hostReadOnly',
 'unshareAttemptIsEphemeral','nodeProfileIsNotElectronProfile',
 'hostDifferenceEstablishesApparmorCausality',
 'electronRendererSandboxCertified','nativeX11WindowVerifiedByProbe',
 'strictUbuntu24NativeGatePassed','strictNativeGateWaived',
 'apparmorPolicyChanged','sysctlChanged','sandboxBypassApplied',
 'realOMSIModRead','mergeAuthorized','releaseAuthorized',
 'installationAuthorized'
]);

export function classifyM42UsernsProbe(input){
 if(!exact(input,['runner','apparmorModule','apparmorUsernsRestriction',
     'unprivilegedUsernsSwitch','usernsCapacity','nodeProcessApparmorProfile',
     'unshareAttempt','unshareFailureCategory'])||
    !RUNNERS.includes(input.runner)||
    !switches.includes(input.apparmorModule)||
    !switches.includes(input.apparmorUsernsRestriction)||
    !switches.includes(input.unprivilegedUsernsSwitch)||
    !capacity.includes(input.usernsCapacity)||
    !profiles.includes(input.nodeProcessApparmorProfile)||
    !['allowed','blocked-or-unavailable'].includes(input.unshareAttempt)||
    !failures.includes(input.unshareFailureCategory)||
    ((input.unshareAttempt==='allowed')!==
     (input.unshareFailureCategory==='none')))refuse();
 return Object.freeze({
  schema:'M42_DIRECT_LINUX_RUNNER_USERNS_CATEGORIES_V1',
  source:'read-only-host-switches-and-nonprivileged-unshare-in-direct-ci-runner',
  ...input,
  hostReadOnly:true,
  unshareAttemptIsEphemeral:true,
  nodeProfileIsNotElectronProfile:true,
  hostDifferenceEstablishesApparmorCausality:false,
  electronRendererSandboxCertified:false,
  nativeX11WindowVerifiedByProbe:false,
  strictUbuntu24NativeGatePassed:false,
  strictNativeGateWaived:false,
  apparmorPolicyChanged:false,
  sysctlChanged:false,
  sandboxBypassApplied:false,
  realOMSIModRead:false,
  mergeAuthorized:false,
  releaseAuthorized:false,
  installationAuthorized:false
 });
}

function safeRead(path){
 try{return readFileSync(path,'utf8');}catch{return null;}
}
function switchValue(raw){
 if(raw===null)return 'unavailable';
 const value=raw.trim();
 return value==='1'?'enabled':value==='0'?'disabled':'unknown';
}
function maxUserns(raw){
 if(raw===null)return 'unavailable';
 const value=raw.trim();
 if(!/^[0-9]{1,18}$/.test(value))return 'unknown';
 return BigInt(value)>0n?'positive':'zero';
}
function getUnshare(){
 try{
  execFileSync('unshare',['--user','--map-root-user','true'],{
   encoding:'utf8',timeout:2500,maxBuffer:2048,
   stdio:['ignore','pipe','pipe'],
   cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C'}
  });
  return {unshareAttempt:'allowed',unshareFailureCategory:'none'};
 }catch(err){
  return {
   unshareAttempt:'blocked-or-unavailable',
   unshareFailureCategory:categorizeUnshareFailure(err)
  };
 }
}
function main(){
 const runner=process.env.M40_RUNNER;
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.RUNNER_OS!=='Linux'||!RUNNERS.includes(runner))
  refuse();
 const state=classifyM42UsernsProbe({
  runner,
  apparmorModule:categorizeApparmorModule(
   safeRead('/sys/module/apparmor/parameters/enabled')),
  apparmorUsernsRestriction:switchValue(
   safeRead('/proc/sys/kernel/apparmor_restrict_unprivileged_userns')),
  unprivilegedUsernsSwitch:switchValue(
   safeRead('/proc/sys/kernel/unprivileged_userns_clone')),
  usernsCapacity:maxUserns(safeRead('/proc/sys/user/max_user_namespaces')),
  nodeProcessApparmorProfile:categorizeApparmorProfile(
   safeRead('/proc/self/attr/current')),
  ...getUnshare()
 });
 const folder=resolve('test-results');
 mkdirSync(folder,{recursive:true,mode:0o700});
 const filename=resolve(folder,'m42-userns-'+runner+'.json');
 if(!filename.startsWith(folder+sep))refuse();
 writeFileSync(filename,JSON.stringify(state)+'\n',{flag:'wx',mode:0o600});
 console.log('M42_DIRECT_HOST_USERNS',JSON.stringify(state));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main();}catch{console.error(REFUSE);process.exitCode=1;}
}
