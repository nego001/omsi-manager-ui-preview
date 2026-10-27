// Human-observed, real-desktop trial for the unmodified Linux ELF auto-launcher.
// No subprocess in CI, no root, no shell, no game folder access or network.
import {gate,requestedDesktop} from './manual-wayland-portal-contract.mjs';

export function autoPilotGate(info){
 return gate(info);
}
export function autoPilotDesktop(args){
 return requestedDesktop(args);
}
export function validateAutoExecutable({regular,symlink,executable,header}={}){
 if(regular!==true||symlink!==false||executable!==true||
  !Array.isArray(header)||header.length!==4||
  header.some((n,i)=>n!==[0x7f,0x45,0x4c,0x46][i]))
  throw Error('AUTO_PILOT_EXECUTABLE_REFUSED');
}
export function verifiedOperatorAnswer(value){
 if(value!=='SIM')throw Error('AUTO_PILOT_OPERATOR_NOT_CONFIRMED');
 return true;
}
export function observedOutcome({desktop,session,visible,keyboardNavigation,scaleReadable,processAlive}={}){
 if(!['kde','gnome','hyprland'].includes(desktop)||
  !['wayland','x11'].includes(session)||
  (desktop==='hyprland'&&session!=='wayland')||
  visible!==true||keyboardNavigation!==true||scaleReadable!==true||
  processAlive!==true)throw Error('AUTO_PILOT_NOT_VERIFIED');
 return Object.freeze({
  result:'PASS_MANUAL_VISUAL_ONLY',
  desktopFamily:desktop,session,
  nativeAutoLauncherObserved:true,
  visualScaleManuallyConfirmed:true,
  keyboardNavigationManuallyConfirmed:true,
  compositorMechanicsVerified:false,
  nativeFileChooserVerified:false,
  gameFilesTouched:false
 });
}
