// M44: bounded transient stderr categorization in one extra strict Electron launch.
// Only fixed enums are logged; no raw stderr or user paths are persisted.
import {spawn} from 'node:child_process';
import {accessSync,constants,realpathSync,mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const BAD='M44_STDERR_REFUSED',deny=()=>{throw Error(BAD);};
const HOSTS=['ubuntu-22.04','ubuntu-24.04'];
const SIGNALS=['SIGTRAP','SIGKILL','SIGTERM','SIGSYS','SIGSEGV','SIGABRT','SIGILL','SIGBUS'];
const TYPES=['namespace-denial-message','sandbox-unavailable-message',
 'seccomp-failure-message','zygote-failure-message','generic-fatal-message',
 'no-recognized-diagnostic'];
const FLAGS={stderrRawPersisted:false,apparmorCauseProven:false,
 rendererSandboxCertified:false,ubuntu24StrictGatePassed:false,
 ubuntu24StrictGateWaived:false,hostPolicyChanged:false,
 sandboxBypassApplied:false,installationAuthorized:false,
 mergeAuthorized:false,releaseAuthorized:false};
export const M44_KEYS=['schema','source','runner','exitCategory','stderrCategory',
 'stderrPresent','stderrTruncated','nonPtraceObservation',...Object.keys(FLAGS)];
const exact=(x,ks)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&
 Object.keys(x).length===ks.length&&ks.every(k=>Object.hasOwn(x,k));
export function classifyM44(input){
 if(!exact(input,['runner','exitCode','exitSignal','timedOut','stderr','truncated'])||
    !HOSTS.includes(input.runner)||!SIGNALS.includes(input.exitSignal)&&
     input.exitSignal!==null||typeof input.timedOut!=='boolean'||
    typeof input.stderr!=='string'||Buffer.byteLength(input.stderr,'utf8')>8192||
    typeof input.truncated!=='boolean'||
    !(input.exitCode===null||(Number.isInteger(input.exitCode)&&input.exitCode>=0&&input.exitCode<=255))||
    (!input.timedOut&&((input.exitCode===null)===(input.exitSignal===null))))deny();
 const s=input.stderr;
 const kind=/(?:failed to move to new namespace|(?:namespace|unshare|clone3).{0,120}(?:eperm|operation not permitted|permission denied))/i.test(s)?TYPES[0]:
  /no usable sandbox|sandbox.{0,120}(?:unavailable|failed|unsupported)/i.test(s)?TYPES[1]:
  /seccomp.{0,120}(?:eperm|failed|operation not permitted)/i.test(s)?TYPES[2]:
  /zygote.{0,120}(?:error|failed|fatal)/i.test(s)?TYPES[3]:
  /\bFATAL\b/i.test(s)?TYPES[4]:TYPES[5];
 const exit=input.timedOut?'timeout':input.exitSignal==='SIGTRAP'?'sigtrap':
  input.exitSignal!==null?'other-signal':input.exitCode===133?'code133-not-signal':'other-exit';
 return Object.freeze({schema:'M44_DIRECT_STDERR_CATEGORIES_V1',
  source:'one-extra-unprivileged-direct-ci-launch-with-bounded-transient-stderr',
  runner:input.runner,exitCategory:exit,stderrCategory:kind,
  stderrPresent:s.length>0,stderrTruncated:input.truncated,
  nonPtraceObservation:true,...FLAGS});
}
export function verifyM44(x){
 if(!exact(x,M44_KEYS)||x.schema!=='M44_DIRECT_STDERR_CATEGORIES_V1'||
    x.source!=='one-extra-unprivileged-direct-ci-launch-with-bounded-transient-stderr'||
    !HOSTS.includes(x.runner)||!TYPES.includes(x.stderrCategory)||
    !['timeout','sigtrap','other-signal','code133-not-signal','other-exit'].includes(x.exitCategory)||
    typeof x.stderrPresent!=='boolean'||typeof x.stderrTruncated!=='boolean'||
    x.nonPtraceObservation!==true||
    (x.stderrCategory!=='no-recognized-diagnostic'&&!x.stderrPresent)||
    Object.keys(FLAGS).some(k=>x[k]!==false))deny();
 return x;
}
function launch(bin,home,runner){
 for(const dir of ['','config','cache','data','runtime'])
  mkdirSync(dir?join(home,dir):home,{recursive:true,mode:0o700});
 const env={PATH:'/usr/bin:/bin',LANG:'C',CI:'true',DISPLAY:process.env.DISPLAY,
  XAUTHORITY:process.env.XAUTHORITY||'',HOME:home,
  XDG_CONFIG_HOME:join(home,'config'),XDG_CACHE_HOME:join(home,'cache'),
  XDG_DATA_HOME:join(home,'data'),XDG_RUNTIME_DIR:join(home,'runtime'),
  XDG_SESSION_TYPE:'x11',XDG_CURRENT_DESKTOP:'GNOME',WAYLAND_DISPLAY:'',
  LIBGL_ALWAYS_SOFTWARE:'1',OMSI_MANAGER_DEV_PREVIEW:'0'};
 return new Promise((good,bad)=>{
  let child,done=false,timedOut=false,truncated=false,n=0;
  const buffers=[];
  const kill=()=>{if(Number.isInteger(child?.pid)&&child.pid>0){
   try{process.kill(-child.pid,'SIGKILL');}catch{}
  }};
  try{child=spawn(bin,['--ozone-platform=x11'],{
    cwd:dirname(bin),detached:true,env,stdio:['ignore','ignore','pipe'],shell:false
  });}catch{bad(Error(BAD));return;}
  const timer=setTimeout(()=>{timedOut=true;kill();},7500);
  child.stderr.on('data',chunk=>{
   if(!Buffer.isBuffer(chunk))return;
   const remain=Math.max(0,4096-n);
   if(chunk.length>remain)truncated=true;
   if(remain>0){const keep=chunk.subarray(0,remain);buffers.push(keep);n+=keep.length;}
  });
  child.once('error',()=>{if(done)return;done=true;clearTimeout(timer);kill();bad(Error(BAD));});
  child.once('close',(exitCode,exitSignal)=>{
   if(done)return;done=true;clearTimeout(timer);kill();
   try{good(classifyM44({runner,exitCode,exitSignal,timedOut,
    stderr:Buffer.concat(buffers).toString('utf8'),truncated}));}
   catch{bad(Error(BAD));}
  });
 });
}
async function main(){
 const runner=process.env.M40_RUNNER;
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.RUNNER_OS!=='Linux'||!HOSTS.includes(runner)||
    !/^:\d{1,4}(?:\.\d{1,2})?$/.test(process.env.DISPLAY||''))deny();
 const folder=realpathSync(resolve('release/OMSI-Manager-Preview-linux-x64'));
 const bin=realpathSync(resolve(folder,'OMSI-Manager-Preview'));
 if(!bin.startsWith(folder+sep))deny();
 accessSync(bin,constants.X_OK);
 const temp=mkdtempSync(join(tmpdir(),'omsi-m44-'));
 let report;
 try{report=await launch(bin,join(temp,'home'),runner);}
 finally{rmSync(temp,{recursive:true,force:true,maxRetries:2});}
 verifyM44(report);
 const dir=resolve('test-results');
 mkdirSync(dir,{recursive:true,mode:0o700});
 const dest=resolve(dir,'m44-stderr-'+runner+'.json');
 if(!dest.startsWith(dir+sep))deny();
 writeFileSync(dest,JSON.stringify(report)+'\n',{mode:0o600,flag:'wx'});
 console.log('M44_STDERR_CATEGORY',JSON.stringify(report));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{await main();}catch{console.error(BAD);process.exitCode=1;}
}