// Reuse the same read-only picker contract for Hyprland, KDE Plasma and GNOME.
// This only authorizes an interactive pilot, not an installation or modification.
import {createRequire} from 'node:module';
const {detectDesktop}=createRequire(import.meta.url)('./linux-session-diagnostics.cjs');
const supported=Object.freeze(['hyprland','kde','gnome']);
export function requestedDesktop(args){
 if(!Array.isArray(args)||args.length!==3||
  args[0]!=='--desktop'||args[2]!=='--confirm-interactive'||
  !supported.includes(args[1]))return null;
 return args[1];
}
export function gate({platform,uid,args,env,stdinTTY,stdoutTTY}){
 if(platform!=='linux'||!Number.isSafeInteger(uid)||uid===0||
  env.CI||env.GITHUB_ACTIONS||!stdinTTY||!stdoutTTY)return false;
 const expected=requestedDesktop(args);
 if(!expected||detectDesktop(env.XDG_CURRENT_DESKTOP)!==expected)return false;
 if(env.XDG_SESSION_TYPE==='wayland')return true;
 // Plasma and GNOME have X11 sessions; Hyprland is Wayland-only.
 // Restrict this manual test to local X servers, never forwarded displays.
 return expected!=='hyprland'&&env.XDG_SESSION_TYPE==='x11'&&
  /^:[0-9]{1,4}(?:\.[0-9]{1,3})?$/.test(env.DISPLAY||'');
}
export function validateSecurity(info,session){
 const ozone=session==='wayland'?'wayland':session==='x11'?'x11':null;
 if(!ozone||!info||info.packaged!==true||info.ozone!==ozone||
  info.mode!=='read-only'||info.node!=='undefined'||info.inspect!==true||
  info.install!==false||info.remove!==false||info.execute!==false)
  throw Error('renderer-security-refused');
}
export function validateCancel(result){
 if(!result||result.status!=='cancelled')throw Error('dialog-cancel-not-verified');
}
export function validateSelection(result,expected){
 if(!result||result.status!=='ok'||result.game!=='omsi'||result.mode!=='read-only'||
  result.folderName!==expected||result.recognized!==true||
  result.assessment?.installationVerified!==false||
  result.assessment?.compatibilityVerified!==false||
  result.groups?.find(g=>g.key==='vehicles')?.count!==1||
  result.groups?.find(g=>g.key==='maps')?.count!==1)
  throw Error('synthetic-directory-not-verified');
}
