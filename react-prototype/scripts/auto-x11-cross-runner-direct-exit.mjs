// M40 — launch the SAME CI-packaged Electron (never OMSI mods) directly
// without ptrace on two disposable Ubuntu images. Classifications are
// observations, NOT an AppArmor cause, native X11 window or sandbox proof.
import {spawn} from 'node:child_process';
import {accessSync,constants,mkdirSync,mkdtempSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {classifyM41OwnedX11Window,observeM41OwnedX11Window}
 from './auto-x11-cross-runner-owned-window.mjs';

const REFUSE='M40_DIRECT_RUNNER_OBSERVATION_REFUSED';
const reject=()=>{throw Error(REFUSE);};
const RUNNERS=Object.freeze(['ubuntu-22.04','ubuntu-24.04']);
const SIGNALS=new Set(['SIGTRAP','SIGKILL','SIGTERM','SIGSYS','SIGSEGV','SIGABRT','SIGILL','SIGBUS']);
const PLAIN=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const FIELDS=(v,arr)=>PLAIN(v)&&Object.keys(v).length===arr.length&&arr.every(k=>Object.hasOwn(v,k));

export function classifyM40DirectExit(input){
 if(!FIELDS(input,['runner','exitCode','exitSignal','timedOut'])||
    !RUNNERS.includes(input.runner)||
    typeof input.timedOut!=='boolean'||
    !(input.exitCode===null||(Number.isSafeInteger(input.exitCode)&&
      input.exitCode>=0&&input.exitCode<=255))||
    !(input.exitSignal===null||SIGNALS.has(input.exitSignal))||
    (!input.timedOut&&((input.exitCode===null)===(input.exitSignal===null))))
  reject();

 const category=input.timedOut?'timedOutNotWindowOrSandboxProof':
  input.exitSignal==='SIGTRAP'?'directSIGTRAPSignal':
  input.exitSignal!==null?'directOtherSignal':
  input.exitCode===133?'exitCode133NotSignalProof':
  'directOtherExitCode';
 return Object.freeze({
  schema:'M40_CI_LINUX_DIRECT_EXIT_OBSERVATION_V1',
  source:'ci-packaged-electron-direct-xvfb-without-ptrace',
  runner:input.runner,
  category,
  exitCode:input.exitCode,
  exitSignal:input.exitSignal,
  timedOut:input.timedOut,
  executedWithoutPtrace:true,
  sameBuildArtifactNameRequiredByCI:true,
  archiveChecksumCheckedInPriorCIStep:true,
  independentArtifactOriginCertified:false,
  actualX11WindowMappedMeasured:false,
  rendererSandboxIndependentlyVerified:false,
  signalReproducesCausalAppArmorDenial:false,
  kernelCapabilityQueryCausesCrashProven:false,
  nativeUbuntu24StrictGatePassed:false,
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

async function launch(binary,work,runner){
 const root=join(work,'home');
 for(const child of ['','config','cache','data','runtime'])
  mkdirSync(child?join(root,child):root,{recursive:true,mode:0o700});
 const env={
  PATH:'/usr/bin:/bin',LANG:'C',CI:'true',
  DISPLAY:process.env.DISPLAY,XAUTHORITY:process.env.XAUTHORITY||'',
  HOME:root,XDG_CONFIG_HOME:join(root,'config'),
  XDG_CACHE_HOME:join(root,'cache'),XDG_DATA_HOME:join(root,'data'),
  XDG_RUNTIME_DIR:join(root,'runtime'),
  XDG_SESSION_TYPE:'x11',XDG_CURRENT_DESKTOP:'GNOME',
  WAYLAND_DISPLAY:'',LIBGL_ALWAYS_SOFTWARE:'1',
  OMSI_MANAGER_DEV_PREVIEW:'0'
 };
 return await new Promise((done,fail)=>{
  let child,finished=false,timedOut=false,timeout;
  const killGroup=()=>{
   if(Number.isSafeInteger(child?.pid)&&child.pid>0){
    try{process.kill(-child.pid,'SIGKILL');}catch{}
   }
  };
  try{child=spawn(binary,['--ozone-platform=x11'],{
   cwd:dirname(binary),detached:true,env,
   stdio:['ignore','ignore','ignore'],shell:false
  });}
  catch{fail(Error(REFUSE));return;}
  timeout=setTimeout(()=>{timedOut=true;killGroup();},7500);
  // Observe ONLY the exact child started for M40, never any other X11
  // window. Failure to obtain evidence becomes an unverified witness.
  const flags=observeM41OwnedX11Window(child.pid,()=>!finished&&!timedOut)
   .catch(()=>({
    processImageObserved:false,windowTitleObserved:false,
    pidAttributed:false,mappedUsableWindowObserved:false
   }));
  child.once('error',()=>{
   if(finished)return;
   finished=true;clearTimeout(timeout);killGroup();fail(Error(REFUSE));
  });
  child.once('close',(exitCode,exitSignal)=>{
   if(finished)return;
   finished=true;clearTimeout(timeout);killGroup();
   flags.then(witness=>done({
    exit:{runner,exitCode,exitSignal,timedOut},witness
   }),()=>fail(Error(REFUSE)));
  });
 });
}

async function main(){
 const runner=process.env.M40_RUNNER;
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true'||
    process.env.RUNNER_OS!=='Linux'||!RUNNERS.includes(runner)||
    typeof process.env.DISPLAY!=='string'||
    !/^:\d{1,4}(?:\.\d{1,2})?$/.test(process.env.DISPLAY))reject();
 const folder=realpathSync(resolve('release/OMSI-Manager-Preview-linux-x64'));
 const bin=realpathSync(resolve(folder,'OMSI-Manager-Preview'));
 if(!bin.startsWith(folder+sep))reject();
 accessSync(bin,constants.X_OK);
 const temp=mkdtempSync(join(tmpdir(),'omsi-m40-control-'));
 try{
  const observed=await launch(bin,temp,runner);
  const result=classifyM40DirectExit(observed.exit);
  const witness=classifyM41OwnedX11Window({
   runner,flags:observed.witness,
   exit:{
    exitCode:observed.exit.exitCode,
    exitSignal:observed.exit.exitSignal,
    timedOut:observed.exit.timedOut
   }
  });
  // Two fixed sanitized artifacts from the SAME child execution.
  // No raw logs, PIDs, filenames, X11 arguments or private data leak.
  const dest=resolve('test-results');
  mkdirSync(dest,{recursive:true,mode:0o700});
  for(const [filename,content] of [
   ['m40-direct-'+runner+'.json',result],
   ['m41-window-'+runner+'.json',witness]
  ]){
   const output=resolve(dest,filename);
   if(!output.startsWith(dest+sep))reject();
   writeFileSync(output,JSON.stringify(content)+'\n',{
    mode:0o600,flag:'wx'
   });
  }
  console.log('M40_DIRECT_EXIT_CATEGORY',JSON.stringify(result));
  console.log('M41_DIRECT_OWNED_X11_WINDOW',JSON.stringify(witness));
 }finally{
  rmSync(temp,{recursive:true,force:true,maxRetries:2});
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{await main();}catch{
  console.error(REFUSE);process.exitCode=1;
 }
}
