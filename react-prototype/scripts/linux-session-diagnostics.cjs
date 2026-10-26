'use strict';
// Opt-in, read-only Linux session diagnostics for the unsigned preview.
// Reports coarse states only: never print paths, PIDs, filenames, usernames,
// environment dumps, or the output of a D-Bus command.
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const NAME='omsi-manager-linux-session-diagnostics';
const statuses=Object.freeze(['available','not-configured','invalid-location','unsafe-runtime','missing','not-a-socket','inaccessible']);
function safeSocketName(value){
 return typeof value==='string'&&value.length>0&&value.length<=108&&
  /^(?!\.\.?$)[A-Za-z0-9_.-]+$/.test(value);
}
function chooseSocket(runtime,display){
 if(typeof runtime!=='string'||!path.isAbsolute(runtime)||runtime===path.parse(runtime).root||
    /[\u0000-\u001f\u007f]/u.test(runtime))return null;
 if(typeof display!=='string'||display==='')return {status:'not-configured'};
 // Wayland permits absolute socket names. Inspect only a direct child of
 // the declared XDG runtime directory, never an arbitrary user path.
 const name=path.isAbsolute(display)
  ? (path.dirname(display)===runtime?path.basename(display):null)
  : display;
 if(!safeSocketName(name))return {status:'invalid-location'};
 return {socket:path.join(runtime,name)};
}
async function inspectSocket(env=process.env,{lstat=fs.lstat,getuid=process.getuid?.bind(process)}={}){
 const runtime=env.XDG_RUNTIME_DIR;
 const choice=chooseSocket(runtime,env.WAYLAND_DISPLAY);
 if(!choice)return 'invalid-location';
 if(choice.status)return choice.status;
 try{
  const stat=await lstat(runtime);
  if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||
    (typeof getuid==='function'&&stat.uid!==getuid()))return 'unsafe-runtime';
 }catch{return 'inaccessible';}
 try{
  const sock=await lstat(choice.socket);
  if(sock.isSymbolicLink()||!sock.isSocket())return 'not-a-socket';
  if(typeof getuid==='function'&&sock.uid!==getuid())return 'inaccessible';
  return 'available';
 }catch(error){return error?.code==='ENOENT'?'missing':'inaccessible';}
}
function probePortalName(){
 // NameHasOwner queries the existing session bus; it does not activate the
 // portal or open a chooser. A registered name is NOT a FileChooser test.
 try{
  const cmd=spawnSync('dbus-send',[
   '--session','--type=method_call','--print-reply',
   '--dest=org.freedesktop.DBus','/org/freedesktop/DBus',
   'org.freedesktop.DBus.NameHasOwner','string:org.freedesktop.portal.Desktop'
  ],{encoding:'utf8',timeout:2000,maxBuffer:4096,windowsHide:true});
  if(cmd.status!==0||typeof cmd.stdout!=='string')return 'unknown';
  if(/\bboolean true\b/u.test(cmd.stdout))return 'registered';
  if(/\bboolean false\b/u.test(cmd.stdout))return 'not-running';
 }catch{}
 return 'unknown';
}
async function diagnose(env=process.env,{platform=process.platform,portalProbe=probePortalName,inspect=inspectSocket}={}){
 if(platform!=='linux')return {name:NAME,scope:'read-only',supported:false};
 const kind=String(env.XDG_SESSION_TYPE||'').toLowerCase();
 const session=['wayland','x11','tty'].includes(kind)?kind:'unknown';
 const desktop=String(env.XDG_CURRENT_DESKTOP||'').split(':').some(x=>x.toLowerCase()==='hyprland');
 const portal=portalProbe();
 const portalState=['registered','not-running','unknown'].includes(portal)?portal:'unknown';
 const socketState=await inspect(env);
 return {
  name:NAME,scope:'read-only',supported:true,
  session,hyprlandReported:desktop,
  nativeWaylandRequested:env.OMSI_MANAGER_NATIVE_WAYLAND==='1',
  waylandSocket:statuses.includes(socketState)?socketState:'inaccessible',
  portalService:portalState,
  portalPickerVerified:false,
  hyprlandCompatibilityVerified:false,
  note:'A socket and a D-Bus name are hints, not proof of a working file picker or Hyprland compatibility.'
 };
}
async function main(argv=process.argv.slice(2)){
 if(argv.length!==0){process.stderr.write('Usage: node OMSI-Manager-Linux-Diagnostics.cjs\n');process.exitCode=2;return;}
 const info=await diagnose();
 process.stdout.write(JSON.stringify(info,null,2)+'\n');
}
if(require.main===module)main().catch(()=>{process.stderr.write('Linux session diagnostics unavailable\n');process.exitCode=3;});
module.exports={diagnose,inspectSocket,chooseSocket,probePortalName,safeSocketName};
