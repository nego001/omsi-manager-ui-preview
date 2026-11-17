// M41 — read-only window witness for the SAME direct M40 child process.
// Uses existing strict X11 contracts for native command line, title,
// _NET_WM_PID ownership and mapped, usable geometry; never screenshots.
// A timeout or a title alone can NEVER verify a window or renderer sandbox.
import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {promisify} from 'node:util';
import {
 findPreviewWindow,verifyNativeCommandLine,verifyNativeWindowOwner,
 verifyMappedWindow
} from './auto-real-x11-contract.mjs';

const execute=promisify(execFile);
const ERROR='M41_OWNED_X11_WINDOW_WITNESS_REFUSED';
const refuse=()=>{throw Error(ERROR);};
const RUNNERS=['ubuntu-22.04','ubuntu-24.04'];
const SIGNALS=new Set(['SIGTRAP','SIGKILL','SIGTERM','SIGSYS',
 'SIGSEGV','SIGABRT','SIGILL','SIGBUS']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(x,ks)=>plain(x)&&Object.keys(x).length===ks.length&&
 ks.every(k=>Object.hasOwn(x,k));
const empty=()=>({processImageObserved:false,windowTitleObserved:false,
 pidAttributed:false,mappedUsableWindowObserved:false});
export const M41_FLAGS=Object.freeze(Object.keys(empty()));

export function classifyM41OwnedX11Window(input){
 if(!exact(input,['runner','flags','exit'])||!RUNNERS.includes(input.runner)||
    !exact(input.flags,M41_FLAGS)||
    !M41_FLAGS.every(k=>typeof input.flags[k]==='boolean')||
    !exact(input.exit,['exitCode','exitSignal','timedOut'])||
    typeof input.exit.timedOut!=='boolean'||
    !(input.exit.exitCode===null||
      (Number.isSafeInteger(input.exit.exitCode)&&
       input.exit.exitCode>=0&&input.exit.exitCode<=255))||
    !(input.exit.exitSignal===null||SIGNALS.has(input.exit.exitSignal))||
    (!input.exit.timedOut&&
     (input.exit.exitCode===null)===(input.exit.exitSignal===null))||
    (input.flags.mappedUsableWindowObserved&&!input.flags.pidAttributed)||
    (input.flags.pidAttributed&&!input.flags.windowTitleObserved)||
    (input.flags.windowTitleObserved&&!input.flags.processImageObserved))
  refuse();
 const f=input.flags;
 const category=f.mappedUsableWindowObserved?
  'directOwnedMappedUsableX11WindowObserved':
  input.exit.timedOut?'directTimeoutWindowUnverified':
  input.exit.exitSignal==='SIGTRAP'?'directSIGTRAPWithoutVerifiedWindow':
  f.windowTitleObserved?'candidateTitleWithoutOwnedMappedWindow':
  f.processImageObserved?'processImageButNoVerifiedWindow':
  'noDirectProcessImageOrWindowVerified';
 return Object.freeze({
  schema:'M41_CI_DIRECT_NATIVE_X11_WINDOW_WITNESS_V1',
  source:'same-direct-ci-electron-child-as-m40',
  runner:input.runner,category,
  nativeCommandLineObserved:f.processImageObserved,
  candidateWindowTitleObserved:f.windowTitleObserved,
  exactNETWMPIDAttributed:f.pidAttributed,
  mappedUsableWindowObserved:f.mappedUsableWindowObserved,
  observedChildExitSignal:input.exit.exitSignal,
  observedChildTimedOut:input.exit.timedOut,
  x11TitleAloneIsNotProof:true,
  pidPropertyNotCryptographicallyAuthenticated:true,
  x11MappingWitnessIsNotRendererSandboxProof:true,
  independentRendererSandboxVerified:false,
  fullNativeX11AutoGateCertifiedByThisWitness:false,
  strictUbuntu24NativeGatePassed:false,
  strictNativeGateWaived:false,
  apparmorCausalityProven:false,
  hostPolicyChanged:false,
  sandboxBypassApplied:false,
  realModRead:false,
  mergeAuthorized:false,
  releaseAuthorized:false,
  installationAuthorized:false
 });
}

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function observeM41OwnedX11Window(childPid,isAlive){
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    !RUNNERS.includes(process.env.M40_RUNNER)||
    typeof process.env.DISPLAY!=='string'||
    !/^:\d{1,4}(?:\.\d{1,2})?$/.test(process.env.DISPLAY)||
    !Number.isSafeInteger(childPid)||childPid<=1||childPid>2147483647||
    typeof isAlive!=='function')refuse();
 const seen=empty();
 // At most 30*140ms between attempts; per-command time is bounded.
 // Never read any file except /proc/<this spawned PID>/cmdline.
 for(let i=0;i<30;i++){
  if(!isAlive())break;
  try{
   const cmd=await readFile('/proc/'+childPid+'/cmdline');
   verifyNativeCommandLine(cmd,'x11');
   seen.processImageObserved=true;
   const tree=await execute('xwininfo',['-root','-tree'],{
    encoding:'utf8',timeout:900,maxBuffer:65536
   });
   const id=findPreviewWindow(tree.stdout);
   seen.windowTitleObserved=true;
   const owner=await execute('xprop',['-id',id,'_NET_WM_PID'],{
    encoding:'utf8',timeout:900,maxBuffer:1024
   });
   verifyNativeWindowOwner(owner.stdout,childPid);
   seen.pidAttributed=true;
   const view=await execute('xwininfo',['-id',id],{
    encoding:'utf8',timeout:900,maxBuffer:16384
   });
   verifyMappedWindow(view.stdout);
   if(!isAlive())break;
   seen.mappedUsableWindowObserved=true;
   break;
  }catch{
   // Raw X11 output and /proc values remain private, never logged.
  }
  await pause(140);
 }
 return seen;
}
