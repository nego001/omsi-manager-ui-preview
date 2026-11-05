// CI-only privacy-safe native X11 triage. A hint is never a causal proof.
const signal=v=>v==='SIGTRAP'?'SIGTRAP':v==='SIGABRT'?'SIGABRT':v==='SIGSEGV'?'SIGSEGV':typeof v==='string'?'other':'none';
export function classifyNativeX11Startup({desktop,auto,direct,baselineMapped}={}){
 const label=desktop==='GNOME'||desktop==='KDE'?desktop:'unknown';
 const autoObserved=auto?.nativeProcess===true;
 const directObserved=direct?.seen?.nativeProcess===true;
 // A signal without a verified native process cannot establish an Electron
 // startup failure. Never infer AppArmor suspicion from a missing process.
 const a=auto?.mapped===true&&autoObserved;
 const d=direct?.seen?.mapped===true&&directObserved;
 const unavailable=direct?.probeUnavailable===true;
 const aSig=signal(auto?.exitSignal),dSig=signal(direct?.exitSignal);
 const aHint=Array.isArray(auto?.startupHints)&&auto.startupHints.includes('sandbox');
 const dHint=Array.isArray(direct?.hints)&&direct.hints.includes('sandbox');
 let classification='shared-native-electron-startup-undetermined';
 if(baselineMapped!==true)classification='display-baseline-unverified';
 else if(a&&auto?.exited!==true)classification='native-auto-window-mapped';
 else if(a)classification='native-auto-window-exit-observed';
 else if(unavailable)classification='direct-control-unavailable';
 else if(d)classification='auto-launcher-specific-suspected';
 else if(autoObserved&&directObserved&&aSig==='SIGTRAP'&&
  dSig==='SIGTRAP'&&aHint&&dHint)
  classification='shared-electron-sandbox-startup-suspected';
 return Object.freeze({
  schema:'AUTO_X11_NATIVE_TRIAGE_V1',desktop:label,classification,
  x11BaselineMapped:baselineMapped===true,
  autoMapped:a,directMapped:d,directControlUnavailable:unavailable,
  autoSignal:aSig,directSignal:dSig,
  hostPolicyChanged:false,sandboxBypassApplied:false,
  electronSandboxCertified:false,realDesktopCertified:false,
  nativeAutoWindowVerified:baselineMapped===true&&a&&auto?.exited!==true
 });
}
