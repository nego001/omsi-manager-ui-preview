// Only manual, opt-in native Wayland experiments may use this contract.
export function gate({platform,uid,args,env,stdinTTY,stdoutTTY}){
 if(platform!=='linux'||uid===0||env.CI||env.GITHUB_ACTIONS)return false;
 if(!stdinTTY||!stdoutTTY||args.length!==1||args[0]!=='--confirm-interactive')return false;
 return env.XDG_SESSION_TYPE==='wayland' &&
  String(env.XDG_CURRENT_DESKTOP||'').toLowerCase().split(':').includes('hyprland');
}
export function validateSecurity(info){
 if(!info||info.packaged!==true||info.ozone!=='wayland'||
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
