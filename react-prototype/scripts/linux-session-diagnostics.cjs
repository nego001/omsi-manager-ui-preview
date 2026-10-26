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

function parseFileChooserVersion(output){
 if(typeof output!=='string'||output.length>4096)return null;
 // dbus-send Properties.Get returns one variant containing an unsigned
 // 32-bit version. Reject absent, ambiguous or implausible values.
 const matches=[...output.matchAll(/\bvariant\s+uint32\s+([0-9]{1,3})\b/gu)];
 if(matches.length!==1)return null;
 const number=Number(matches[0][1]);
 return Number.isInteger(number)&&number>=1&&number<=999?number:null;
}
function probeFileChooserVersion(run=spawnSync){
 // Called only after NameHasOwner returned true. Properties.Get inspects a
 // passive interface property; it does not invoke OpenFile/SaveFile.
 try{
  const cmd=run('dbus-send',[
   '--session','--type=method_call','--print-reply',
   '--dest=org.freedesktop.portal.Desktop','/org/freedesktop/portal/desktop',
   'org.freedesktop.DBus.Properties.Get',
   'string:org.freedesktop.portal.FileChooser','string:version'
  ],{encoding:'utf8',timeout:2000,maxBuffer:4096,windowsHide:true});
  if(cmd.status!==0||typeof cmd.stdout!=='string')return null;
  return parseFileChooserVersion(cmd.stdout);
 }catch{return null;}
}
async function diagnose(env=process.env,{platform=process.platform,portalProbe=probePortalName,inspect=inspectSocket,fileChooserProbe=probeFileChooserVersion}={}){
 if(platform!=='linux')return {name:NAME,scope:'read-only',supported:false};
 const kind=String(env.XDG_SESSION_TYPE||'').toLowerCase();
 const session=['wayland','x11','tty'].includes(kind)?kind:'unknown';
 const desktop=String(env.XDG_CURRENT_DESKTOP||'').split(':').some(x=>x.toLowerCase()==='hyprland');
 const portal=portalProbe();
 const portalState=['registered','not-running','unknown'].includes(portal)?portal:'unknown';
 // Do not make a Properties.Get call if no portal service owns the name.
 const reportedVersion=portalState==='registered'?fileChooserProbe():null;
 const chooserVersion=Number.isInteger(reportedVersion)&&reportedVersion>=1&&reportedVersion<=999
  ?reportedVersion:null;
 const socketState=await inspect(env);
 return {
  name:NAME,scope:'read-only',supported:true,
  session,hyprlandReported:desktop,
  nativeWaylandRequested:env.OMSI_MANAGER_NATIVE_WAYLAND==='1',
  waylandSocket:statuses.includes(socketState)?socketState:'inaccessible',
  portalService:portalState,
  portalFileChooserInterface:chooserVersion===null?'unknown':'advertised',
  portalFileChooserVersion:chooserVersion,
  portalPickerVerified:false,
  hyprlandCompatibilityVerified:false,
  note:'An advertised FileChooser interface is not proof that the graphical picker or Hyprland works.'
 };
}
async function main(argv=process.argv.slice(2)){
 if(argv.length!==0){process.stderr.write('Usage: node OMSI-Manager-Linux-Diagnostics.cjs\n');process.exitCode=2;return;}
 const info=await diagnose();
 process.stdout.write(JSON.stringify(info,null,2)+'\n');
}
if(require.main===module)main().catch(()=>{process.stderr.write('Linux session diagnostics unavailable\n');process.exitCode=3;});
module.exports={diagnose,inspectSocket,chooseSocket,probePortalName,parseFileChooserVersion,probeFileChooserVersion,safeSocketName};
