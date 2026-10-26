import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {access, mkdtemp, mkdir, writeFile, readFile, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, dirname} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron} from 'playwright';

// Genuine Wayland socket test using an ephemeral, unprivileged Weston headless
// compositor in CI. This is NOT a Hyprland or GPU-driver qualification.
if(process.platform!=='linux')throw Error('Wayland test requires Linux');
const executable=resolve('release/OMSI-Manager-Preview-linux-x64/OMSI-Manager-Preview');
const launcher=join(dirname(executable),'OMSI-Manager-Preview.sh');
await access(launcher);
const root=await mkdtemp(join(tmpdir(),'omsi-native-wayland-ci-'));
const socketName='omsi-ci-wayland';
const runtime=join(root,'xdg');
const {mkdir}=await import('node:fs/promises');
await mkdir(runtime,{mode:0o700});
const env={
 ...process.env,
 XDG_RUNTIME_DIR:runtime,
 WAYLAND_DISPLAY:socketName,
 XDG_SESSION_TYPE:'wayland',
 DISPLAY:'',
 OMSI_MANAGER_NATIVE_WAYLAND:'1',
 LIBGL_ALWAYS_SOFTWARE:'1',
 OMSI_MANAGER_DEV_PREVIEW:'0'
};
const weston=spawn('weston',[
 '--backend=headless-backend.so',
 '--socket='+socketName,
 '--idle-time=0',
 '--renderer=pixman'
],{stdio:['ignore','pipe','pipe'],env,windowsHide:true});
let stderr='';
let exited=false;
weston.stderr.on('data',data=>{stderr+=data.toString();if(stderr.length>12000)stderr=stderr.slice(-12000);});
weston.on('exit',()=>{exited=true;});
let application;
try{
 let ready=false;
 for(let i=0;i<150;i++){
  if(exited)break;
  try{
   const socket=await stat(join(runtime,socketName));
   if(socket.isSocket()){ready=true;break;}
  }catch{}
  await delay(100);
 }
 assert.equal(ready,true,'Headless Wayland socket did not start: '+stderr.slice(-2500));
 application=await electron.launch({
  executablePath:launcher,args:[],cwd:root,env,timeout:90000
 });
 const info=await application.evaluate(({app})=>({
  packaged:app.isPackaged,
  ozone:app.commandLine.getSwitchValue('ozone-platform')
 }));
 assert.equal(info.packaged,true);
 assert.equal(info.ozone,'wayland');
 const win=await application.firstWindow();
 await win.getByRole('heading',{name:'Seu universo de simulação, organizado.'})
  .waitFor({timeout:25000});
 const safe=await win.evaluate(()=>({
  mode:window.omsiPreview?.mode,
  install:window.omsiPreview?.capabilities?.installMods,
  remove:window.omsiPreview?.capabilities?.uninstallMods,
  command:window.omsiPreview?.capabilities?.executeCommands,
  node:typeof window.require
 }));
 assert.deepEqual(safe,{
  mode:'read-only',install:false,remove:false,command:false,node:'undefined'
 });
 // This proves the existing native-dialog IPC flow works on Wayland, but
 // mocks the native chooser return value. It does NOT attest that a real
 // xdg-desktop-portal file picker was opened.
 const selected=join(root,'SYNTHETIC-OMSI-ONLY');
 const sentinel=join(selected,'Vehicles','Fixture','test.bus');
 await mkdir(join(selected,'Vehicles','Fixture'),{recursive:true});
 await mkdir(join(selected,'maps','Fixture Map'),{recursive:true});
 await writeFile(sentinel,'WAYLAND-SYNTHETIC-DO-NOT-MODIFY\\n');
 await application.evaluate(({dialog})=>{
  dialog.showOpenDialog=async(_win,opts)=>{
   if(!opts.properties.includes('openDirectory')||
      !opts.properties.includes('dontAddToRecent')||
      'defaultPath' in opts)
     throw Error('Unexpected Wayland directory-dialog contract');
   return {canceled:true,filePaths:[]};
  };
 });
 const cancelled=await win.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.equal(cancelled.status,'cancelled');
 await application.evaluate(({dialog},folder)=>{
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});
 },selected);
 const inspected=await win.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.equal(inspected.status,'ok');
 assert.equal(inspected.mode,'read-only');
 assert.equal(inspected.groups[0].count,1);
 assert.equal(inspected.groups[1].count,1);
 assert.ok(!JSON.stringify(inspected).includes(selected));
 assert.equal(await readFile(sentinel,'utf8'),
  'WAYLAND-SYNTHETIC-DO-NOT-MODIFY\\n');
 console.log('PASS_NATIVE_WAYLAND_WESTON_DIALOG_CANCEL_AND_SYNTHETIC_READ_ONLY');
 console.log('PASS_NATIVE_WAYLAND_WESTON_HEADLESS_ELECTRON_READ_ONLY');
} finally {
 await application?.close();
 if(!exited){
  weston.kill('SIGTERM');
  await Promise.race([
   new Promise(resolve=>weston.once('close',resolve)),
   delay(4000)
  ]);
  if(!exited)weston.kill('SIGKILL');
 }
 await rm(root,{recursive:true,force:true});
}
