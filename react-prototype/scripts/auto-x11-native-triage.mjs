// CI-only privacy-safe native X11 triage. A hint is never a causal proof.
const signal=v=>v==='SIGTRAP'?'SIGTRAP':v==='SIGABRT'?'SIGABRT':v==='SIGSEGV'?'SIGSEGV':typeof v==='string'?'other':'none';
export function classifyNativeX11Startup({desktop,auto,direct,baselineMapped}={}){
 const label=desktop==='GNOME'||desktop==='KDE'?desktop:'unknown';
 const autoObserved=auto?.nativeProcess===true;
 const directObserved=direct?.seen?.nativeProcess===true;
 // A successful Node spawn event only proves the child was started;
 // it does NOT prove which executable image ran, or a Chromium renderer.
 const autoSpawnEvent=auto?.spawnEventObserved===true;
 const directSpawnEvent=direct?.seen?.spawnEventObserved===true;
 const startupWitness=(identity,spawned)=>identity?
  'proc-command-line-observed':spawned?'spawn-event-only':'not-observed';
 // A window must be owned by the verified native process before we claim a
 // mapped Electron window. A title or mapped flag alone is insufficient.
 const a=auto?.mapped===true&&autoObserved&&auto?.windowOwned===true;
 const d=direct?.seen?.mapped===true&&directObserved&&
  direct?.seen?.windowOwned===true;
 // A signal without a verified native process cannot establish an Electron
 // startup failure. Never infer AppArmor suspicion from a missing process.
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
 else if(autoObserved&&directObserved&&auto?.exited===true&&
  direct?.exited===true&&aSig==='SIGTRAP'&&dSig==='SIGTRAP'&&aHint&&dHint)
  classification='shared-electron-sandbox-startup-suspected';
 return Object.freeze({
  schema:'AUTO_X11_NATIVE_TRIAGE_V1',desktop:label,classification,
  x11BaselineMapped:baselineMapped===true,
  autoMapped:a,directMapped:d,directControlUnavailable:unavailable,
  autoStartupWitness:startupWitness(autoObserved,autoSpawnEvent),
  directStartupWitness:startupWitness(directObserved,directSpawnEvent),
  spawnEventProvesExecutedImage:false,
  autoSignal:aSig,directSignal:dSig,
  hostPolicyChanged:false,sandboxBypassApplied:false,
  electronSandboxCertified:false,realDesktopCertified:false,
  nativeAutoWindowVerified:baselineMapped===true&&a&&auto?.exited!==true
 });
}
