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
import {classifyNativeX11Startup} from './auto-x11-native-triage.mjs';
import {assessApparmorAdminReview} from './ubuntu24-app-profile-review.mjs';
import {categorizeUnshareFailure,categorizeApparmorModule} from './auto-x11-host-policy-contract.mjs';
import {findPreviewWindow,verifyMappedWindow,verifyNativeCommandLine,
 verifyNativeWindowOwner,verifyNativeDesktopResults,
 findCiX11DisplayControlWindow,verifyCiX11DisplayControlMapped}
 from './auto-real-x11-contract.mjs';
const execAsync=promisify(execFile);
if(process.platform!=='linux'||process.getuid?.()===0||!process.env.DISPLAY||
 process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true')
 throw Error('AUTO_X11_CI_REFUSED');

async function probeCiUserNamespaceCategory(){
 // Non-root disposable user namespace check, same class as the existing host
 // probe. It never writes policy, mounts filesystems or logs stderr.
 try{
  await execAsync('unshare',['--user','--map-root-user','true'],{
   encoding:'utf8',timeout:2500,maxBuffer:2048,cwd:'/',
   env:{PATH:'/usr/bin:/bin',LANG:'C'}
  });
  return 'allowed';
 }catch(error){
  const category=categorizeUnshareFailure(error);
  return category==='permission-denied'?'permission-denied':
   category==='tool-unavailable'?'unavailable':'unknown';
 }
}
async function readApparmorModuleCategory(){
 try{
  // This fixed sysfs file reveals only whether the LSM module is enabled.
  const value=await readFile('/sys/module/apparmor/parameters/enabled','utf8');
  return categorizeApparmorModule(value);
 }catch{return 'unavailable';}
}
async function readApparmorNamespacePolicyCategory(){
 try{
  // Read only an exact kernel switch; never log the raw value.
  const value=(await readFile('/proc/sys/kernel/apparmor_restrict_unprivileged_userns','utf8')).trim();
  return value==='1'?'enabled':value==='0'?'disabled':'unknown';
 }catch{return 'unavailable';}
}

const binary=resolve('release/OMSI-Manager-Preview-linux-x64/OMSI-Manager-Auto');
await access(binary,constants.X_OK);
// Differential control: when Auto fails, run the SAME packaged Electron
// directly with the same X11 ozone setting and strict sandbox. This does not
// turn a failed Auto test green; it only narrows the CI root cause.
async function probeDirectPackagedElectron(desktop,root){
 const binaryDirect=resolve('release/OMSI-Manager-Preview-linux-x64/OMSI-Manager-Preview');
 await access(binaryDirect,constants.X_OK);
 // Use a separate disposable HOME so an unfinished Auto instance cannot
 // lock the direct-control Electron profile and produce a false diagnosis.
 const directRoot=join(root,'direct');
 await mkdir(directRoot,{mode:0o700});
 for(const part of ['config','cache','data','runtime'])
  await mkdir(join(directRoot,part),{mode:0o700});
 const seen={nativeProcess:false,windowFound:false,windowOwned:false,mapped:false};
 const hints=new Set();
 let exited=false,exitCode=null,exitSignal=null,child;
 try{
  child=spawn(binaryDirect,['--ozone-platform=x11'],{
   cwd:dirname(binaryDirect),detached:true,stdio:['ignore','ignore','pipe'],
   shell:false,
   env:{...process.env,
    XDG_CURRENT_DESKTOP:desktop,XDG_SESSION_TYPE:'x11',
    WAYLAND_DISPLAY:'',OMSI_MANAGER_DEV_PREVIEW:'0',
    HOME:directRoot,XDG_RUNTIME_DIR:join(directRoot,'runtime'),
    LIBGL_ALWAYS_SOFTWARE:'1',XDG_CONFIG_HOME:join(directRoot,'config'),
    XDG_CACHE_HOME:join(directRoot,'cache'),XDG_DATA_HOME:join(directRoot,'data')
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
    const ownership=await execAsync('xprop',['-id',id,'_NET_WM_PID'],
     {encoding:'utf8',timeout:2000,maxBuffer:1024});
    verifyNativeWindowOwner(ownership.stdout,child.pid);
    seen.windowOwned=true;
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

// Baseline: establish that this SAME Xvfb display can map a benign native
// X11 dialog. No Electron/Chromium process or sandbox switches are involved.
// Never mistake success here for Electron sandbox or GNOME/KWin approval.
async function probePlainX11Display(root){
 const controlRoot=join(root,'display-control');
 await mkdir(controlRoot,{mode:0o700});
 let child,ended=false,mapped=false;
 try{
  child=spawn('xmessage',[
   '-title','OMSI CI X11 Display Control',
   '-buttons','OK:0','Synthetic CI X11 baseline'
  ],{
   cwd:controlRoot,detached:true,shell:false,
   stdio:['ignore','ignore','ignore'],
   env:{...process.env,HOME:controlRoot}
  });
  child.once('error',()=>{ended=true;});
  child.once('exit',()=>{ended=true;});
  for(let i=0;i<25;i++){
   if(ended||child.exitCode!==null)break;
   try{
    const {stdout}=await execAsync('xwininfo',['-root','-tree'],
     {encoding:'utf8',timeout:2000,maxBuffer:65536});
    const id=findCiX11DisplayControlWindow(stdout);
    const detail=await execAsync('xwininfo',['-id',id],
     {encoding:'utf8',timeout:2000,maxBuffer:16384});
    verifyCiX11DisplayControlMapped(detail.stdout);
    mapped=true;
    break;
   }catch{
    // Only a CI-owned display control is inspected; no raw output is logged.
   }
   await sleep(120);
  }
 }finally{
  if(child?.pid&&!ended){
   try{process.kill(-child.pid,'SIGTERM');}catch{}
   await sleep(100);
   try{process.kill(-child.pid,'SIGKILL');}catch{}
  }
 }
 console.log('AUTO_X11_DISPLAY_BASELINE',JSON.stringify({
  client:'xmessage',mapped,provesXvfbWindowOnly:true,
  provesElectronSandbox:false,provesRealDesktop:false
 }));
 if(!mapped)throw Error('AUTO_X11_DISPLAY_BASELINE_NOT_VERIFIED');
}

const root=await mkdtemp(join(tmpdir(),'omsi-x11-native-auto-'));
const outcomes=[];
try{
 await probePlainX11Display(root);
 for(const desktop of ['GNOME','KDE']){
  // GNOME and KDE use independent disposable roots under this CI-only
  // directory. This is a profile-state separation, not an OS sandbox.
  const desktopRoot=join(root,desktop.toLowerCase());
  await mkdir(desktopRoot,{mode:0o700});
  for(const part of ['config','cache','data','runtime'])
   await mkdir(join(desktopRoot,part),{mode:0o700});
  let child;
  let failed=false;
  let exitCode=null;
  let exitSignal=null;
  const observed={nativeProcess:false,windowFound:false,windowOwned:false,mapped:false};
  const startupHints=new Set();
  let checkpoint='startup';
  let found=false;
  try{
   child=spawn(binary,[],{
    cwd:dirname(binary),detached:true,stdio:['ignore','ignore','pipe'],shell:false,
    env:{...process.env,
     XDG_CURRENT_DESKTOP:desktop,XDG_SESSION_TYPE:'x11',
     WAYLAND_DISPLAY:'',OMSI_MANAGER_DEV_PREVIEW:'0',
     HOME:desktopRoot,XDG_RUNTIME_DIR:join(desktopRoot,'runtime'),
     LIBGL_ALWAYS_SOFTWARE:'1',XDG_CONFIG_HOME:join(desktopRoot,'config'),
     XDG_CACHE_HOME:join(desktopRoot,'cache'),XDG_DATA_HOME:join(desktopRoot,'data')
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
     checkpoint='owner-check';
     const ownership=await execAsync('xprop',['-id',id,'_NET_WM_PID'],
      {encoding:'utf8',timeout:2000,maxBuffer:1024});
     verifyNativeWindowOwner(ownership.stdout,child.pid);
     observed.windowOwned=true;
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
    // No host policy changes or sandbox bypass; classify only fixed categories.
    let direct={probeUnavailable:true};
    try{
     direct=await probeDirectPackagedElectron(desktop,desktopRoot);
     console.error('AUTO_X11_DIRECT_SANDBOX_CONTROL',
      JSON.stringify({desktop,...direct}));
    }catch{
     console.error('AUTO_X11_DIRECT_SANDBOX_CONTROL',
      JSON.stringify({desktop,probeUnavailable:true}));
    }
    const triage=classifyNativeX11Startup({
     desktop,baselineMapped:true,
     auto:{mapped:found,exited:failed,exitSignal,startupHints:[...startupHints]},
     direct
    });
    console.error('AUTO_X11_NATIVE_TRIAGE',JSON.stringify(triage));
    console.error('AUTO_X11_APPARMOR_ADMIN_REVIEW',JSON.stringify(
     assessApparmorAdminReview({
      apparmorRestriction:await readApparmorNamespacePolicyCategory(),
      apparmorModuleState:await readApparmorModuleCategory(),
      namespaceProbe:await probeCiUserNamespaceCategory(),triage
     })
    ));
   }
   outcomes.push({desktop,mapped:found,failed,
    windowOwned:observed.windowOwned,nativeProcess:observed.nativeProcess});
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
