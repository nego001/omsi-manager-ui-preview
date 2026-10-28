// CI: genuinely execute OMSI-Manager-Auto without flags under isolated Xvfb.
// Confirm both the forwarded X11 backend and an actual mapped Electron window.
// This is NOT a real GNOME/KWin compositor or native chooser certification.
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,mkdtemp,mkdir,rm,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {findPreviewWindow,verifyMappedWindow,verifyNativeCommandLine,
 verifyNativeDesktopResults} from './auto-real-x11-contract.mjs';
const execAsync=promisify(execFile);
if(process.platform!=='linux'||process.getuid?.()===0||!process.env.DISPLAY||
 process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true')
 throw Error('AUTO_X11_CI_REFUSED');

const binary=resolve('release/OMSI-Manager-Preview-linux-x64/OMSI-Manager-Auto');
await access(binary,constants.X_OK);
// Differential control: when Auto fails, run the SAME packaged Electron
// directly with the same X11 ozone setting and strict sandbox. This does not
// turn a failed Auto test green; it only narrows the CI root cause.
async function probeDirectPackagedElectron(desktop,root){
 const binaryDirect=resolve('release/OMSI-Manager-Preview-linux-x64/OMSI-Manager-Preview');
 await access(binaryDirect,constants.X_OK);
 const seen={nativeProcess:false,windowFound:false,mapped:false};
 const hints=new Set();
 let exited=false,exitCode=null,exitSignal=null,child;
 try{
  child=spawn(binaryDirect,['--ozone-platform=x11'],{
   cwd:dirname(binaryDirect),detached:true,stdio:['ignore','ignore','pipe'],
   shell:false,
   env:{...process.env,
    XDG_CURRENT_DESKTOP:desktop,XDG_SESSION_TYPE:'x11',
    WAYLAND_DISPLAY:'',OMSI_MANAGER_DEV_PREVIEW:'0',
    HOME:root,XDG_RUNTIME_DIR:join(root,'runtime'),
    LIBGL_ALWAYS_SOFTWARE:'1',XDG_CONFIG_HOME:join(root,'config'),
    XDG_CACHE_HOME:join(root,'cache'),XDG_DATA_HOME:join(root,'data')
   }
  });
  child.stderr.on('data',data=>{
   // A fixed boolean hint only. Native stderr may contain private paths.
   const fragment=data.toString('utf8').slice(0,4096);
   if(/sandbox|zygote|setuid/i.test(fragment))hints.add('sandbox');
   if(/x11|xserver|display|ozone/i.test(fragment))hints.add('display');
   if(/gpu|egl|mesa|glx/i.test(fragment))hints.add('gpu');
  });
  child.once('error',()=>{exited=true;hints.add('spawn-error');});
  child.once('exit',(code,signal)=>{
   exited=true;exitCode=code;exitSignal=signal;
  });
  for(let i=0;i<20;i++){
   if(exited||child.exitCode!==null)break;
   try{
    const command=await readFile('/proc/'+child.pid+'/cmdline');
    verifyNativeCommandLine(command,'x11');
    seen.nativeProcess=true;
    const {stdout}=await execAsync('xwininfo',['-root','-tree'],
     {encoding:'utf8',timeout:2000,maxBuffer:65536});
    const id=findPreviewWindow(stdout);
    seen.windowFound=true;
    const detail=await execAsync('xwininfo',['-id',id],
     {encoding:'utf8',timeout:2000,maxBuffer:16384});
    verifyMappedWindow(detail.stdout);
    seen.mapped=true;
    break;
   }catch{
    // A missing window is not evidence that the sandbox is functional.
   }
   await sleep(150);
  }
 }finally{
  if(child?.pid&&!exited){
   try{process.kill(-child.pid,'SIGTERM');}catch{}
   await sleep(200);
   try{process.kill(-child.pid,'SIGKILL');}catch{}
  }
 }
 return {seen,exited,exitCode:Number.isInteger(exitCode)?exitCode:null,
  exitSignal:typeof exitSignal==='string'&&/^[A-Z0-9]{1,12}$/.test(exitSignal)?
   exitSignal:null,hints:[...hints].sort()};
}

const root=await mkdtemp(join(tmpdir(),'omsi-x11-native-auto-'));
await mkdir(join(root,'config'),{mode:0o700});
await mkdir(join(root,'cache'),{mode:0o700});
await mkdir(join(root,'data'),{mode:0o700});
await mkdir(join(root,'runtime'),{mode:0o700});
const outcomes=[];
try{
 for(const desktop of ['GNOME','KDE']){
  let child;
  let failed=false;
  let exitCode=null;
  let exitSignal=null;
  const observed={nativeProcess:false,windowFound:false,mapped:false};
  const startupHints=new Set();
  let checkpoint='startup';
  let found=false;
  try{
   child=spawn(binary,[],{
    cwd:dirname(binary),detached:true,stdio:['ignore','ignore','pipe'],shell:false,
    env:{...process.env,
     XDG_CURRENT_DESKTOP:desktop,XDG_SESSION_TYPE:'x11',
     WAYLAND_DISPLAY:'',OMSI_MANAGER_DEV_PREVIEW:'0',
     HOME:root,XDG_RUNTIME_DIR:join(root,'runtime'),
     LIBGL_ALWAYS_SOFTWARE:'1',XDG_CONFIG_HOME:join(root,'config'),
     XDG_CACHE_HOME:join(root,'cache'),XDG_DATA_HOME:join(root,'data')
    }
   });
   child.stderr.on('data',data=>{
    // Observe only categories, never output raw native stderr, paths or secrets.
    const text=data.toString('utf8').slice(0,4096);
    const patterns=[
     ['sandbox',/sandbox|zygote|setuid/i],
     ['display',/x11|xserver|display|ozone/i],
     ['libraries',/shared object|library|symbol lookup/i],
     ['gpu',/gpu|egl|mesa|glx/i],
     ['filesystem',/permission denied|access denied|read-only/i],
     ['runtime',/xdg_runtime_dir|runtime directory/i]
    ];
    for(const [label,re] of patterns)if(re.test(text))startupHints.add(label);
   });
   child.once('error',()=>{failed=true;startupHints.add('spawn-error');});
   child.once('exit',(code,signal)=>{failed=true;exitCode=code;exitSignal=signal;});
   for(let i=0;i<70;i++){
    if(failed||child.exitCode!==null)break;
    try{
     const command=await readFile('/proc/'+child.pid+'/cmdline');
     verifyNativeCommandLine(command,'x11');
     observed.nativeProcess=true;
     checkpoint='window-search';
     const {stdout}=await execAsync('xwininfo',['-root','-tree'],
      {encoding:'utf8',timeout:2000,maxBuffer:65536});
     const id=findPreviewWindow(stdout);
     observed.windowFound=true;
     checkpoint='map-state';
     const detail=await execAsync('xwininfo',['-id',id],
      {encoding:'utf8',timeout:2000,maxBuffer:16384});
     verifyMappedWindow(detail.stdout);
     observed.mapped=true;
     found=true;
     break;
    }catch{
     // Window rendering may lag behind process startup.
    }
    await sleep(200);
   }
   if(!found)console.error('AUTO_X11_SANITIZED_CHECKPOINT',JSON.stringify({
    desktop,observed,checkpoint,startupHints:[...startupHints].sort(),
    exited:failed,exitCode:Number.isInteger(exitCode)?exitCode:null,
    exitSignal:typeof exitSignal==='string'&&/^[A-Z0-9]{1,12}$/.test(exitSignal)?
     exitSignal:null
   }));
   if(!found){
    // Distinguish an Auto-only launcher failure from a packaged Electron
    // or hosted-kernel failure. Never supply --no-sandbox or other bypasses.
    try{
     const direct=await probeDirectPackagedElectron(desktop,root);
     console.error('AUTO_X11_DIRECT_SANDBOX_CONTROL',
      JSON.stringify({desktop,...direct}));
    }catch{
     console.error('AUTO_X11_DIRECT_SANDBOX_CONTROL',
      JSON.stringify({desktop,probeUnavailable:true}));
    }
   }
   outcomes.push({desktop,mapped:found,failed});
   if(found&&!failed)
    console.log('PASS_NATIVE_AUTO_X11_'+desktop+'_MAPPED_WINDOW_READ_ONLY_BUILD');
  }finally{
   if(child?.pid&&child.exitCode===null){
    try{process.kill(-child.pid,'SIGTERM');}catch{}
    await sleep(400);
    try{process.kill(-child.pid,'SIGKILL');}catch{}
   }
  }
 }
}finally{
 await rm(root,{recursive:true,force:true});
}
// Do not stop after a GNOME failure: collect independent KDE evidence too.
// A failing profile keeps this CI job red, regardless of direct Electron probe.
verifyNativeDesktopResults(outcomes);
