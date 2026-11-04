// Privacy-safe CI-only evidence record for the exact disposable Ubuntu runner.
// Callers may supply untrusted values, but output is only fixed categories and flags.
const refusal=()=>{throw Error('AUTO_X11_EVIDENCE_REFUSED');};
const runners=new Set(['ubuntu-22.04','ubuntu-24.04']);
const policies=new Set(['enabled','disabled','unknown','unavailable']);
const namespaceProbes=new Set(['allowed','permission-denied','unavailable','unknown']);
const classifications=new Set([
 'native-auto-window-mapped','native-auto-window-exit-observed',
 'direct-control-unavailable','auto-launcher-specific-suspected',
 'shared-electron-sandbox-startup-suspected',
 'shared-native-electron-startup-undetermined','display-baseline-unverified'
]);
const desktops=['GNOME','KDE'];
export function createSanitizedX11Evidence(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
    !runners.has(input.runner)||input.baselineMapped!==true||
    typeof input.archiveSha256!=='string'||
    !/^[a-f0-9]{64}$/.test(input.archiveSha256))refusal();
 const host=input.host;
 if(!host||typeof host!=='object'||Array.isArray(host)||
    !policies.has(host.apparmorRestriction)||
    !policies.has(host.apparmorModuleState)||
    !namespaceProbes.has(host.userNamespaceProbe))refusal();
 if(!Array.isArray(input.outcomes)||input.outcomes.length!==2)refusal();
 const windows=input.outcomes.map((entry,index)=>{
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||
     entry.desktop!==desktops[index]||
     typeof entry.mapped!=='boolean'||typeof entry.failed!=='boolean'||
     typeof entry.windowOwned!=='boolean'||typeof entry.nativeProcess!=='boolean'||
     !classifications.has(entry.triageClassification))refusal();
  const verified=entry.mapped&&!entry.failed&&entry.windowOwned&&entry.nativeProcess;
  if(entry.triageClassification==='native-auto-window-mapped'&&!verified)refusal();
  if(entry.triageClassification!=='native-auto-window-mapped'&&verified)refusal();
  // Owning an X11 window without a mapped state is a legitimate failure
  // checkpoint. Keep that evidence instead of rejecting the whole report.
  // In this probe, map-state is checked only after exact X11 PID ownership.
  if(entry.mapped&&!entry.windowOwned)refusal();
  if(entry.mapped&&!entry.nativeProcess)refusal();
  return Object.freeze({
   desktop:entry.desktop,nativeProcessObserved:entry.nativeProcess,
   windowOwned:entry.windowOwned,windowMapped:entry.mapped,
   startupClassification:entry.triageClassification,
   nativeWindowVerified:verified
  });
 });
 return Object.freeze({
  schema:'AUTO_X11_HOST_EVIDENCE_V2',runner:input.runner,
  archiveSha256:input.archiveSha256,
  host:Object.freeze({
   apparmorRestriction:host.apparmorRestriction,
   apparmorModuleState:host.apparmorModuleState,
   userNamespaceProbe:host.userNamespaceProbe
  }),
  windows:Object.freeze(windows),
  allNativeWindowsVerified:windows.every(w=>w.nativeWindowVerified),
  electronSandboxCertified:false,realDesktopCertified:false,
  apparmorCausalityProven:false,hostPolicyChanged:false,
  sandboxBypassApplied:false,readOnlyEvidence:true
 });
}
