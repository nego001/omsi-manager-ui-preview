// Compare CI-owned X11 evidence from two Ubuntu images, not a sandbox proof.
// All input is untrusted. Refuse inconsistent records and never echo raw input.
import {createSanitizedX11Evidence} from './auto-x11-sanitized-evidence.mjs';

const refuse=()=>{throw Error('AUTO_X11_CROSS_RUNNER_REFUSED');};
export function parseSanitizedX11Record(raw,expectedRunner){
 if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>4096||
  raw.length<100||!raw.endsWith('\n')||
  !['ubuntu-22.04','ubuntu-24.04'].includes(expectedRunner))refuse();
 let parsed;
 try{parsed=JSON.parse(raw);}catch{refuse();}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||
    parsed.schema!=='AUTO_X11_HOST_EVIDENCE_V2'||
    parsed.runner!==expectedRunner||!Array.isArray(parsed.windows)||
    parsed.windows.length!==2)refuse();
 let reconstructed;
 try{
  reconstructed=createSanitizedX11Evidence({
   runner:parsed.runner,baselineMapped:true,archiveSha256:parsed.archiveSha256,host:parsed.host,
   outcomes:parsed.windows.map(w=>({
    desktop:w?.desktop,mapped:w?.windowMapped,
    failed:w?.nativeWindowVerified===false,
    windowOwned:w?.windowOwned,nativeProcess:w?.nativeProcessObserved,
    triageClassification:w?.startupClassification
   }))
  });
 }catch{refuse();}
 // Exact canonical form rejects unexpected properties, false certification,
 // inconsistent counts and private paths; never output the untrusted input.
 if(raw!==JSON.stringify(reconstructed)+'\n')refuse();
 return reconstructed;
}

export function compareSanitizedX11Records(older,newer){
 if(!older||!newer||older.runner!=='ubuntu-22.04'||
  newer.runner!=='ubuntu-24.04'||
  older.archiveSha256!==newer.archiveSha256)refuse();
 // Revalidation prevents callers from passing fabricated objects directly.
 const left=parseSanitizedX11Record(JSON.stringify(older)+'\n','ubuntu-22.04');
 const right=parseSanitizedX11Record(JSON.stringify(newer)+'\n','ubuntu-24.04');
 const typical=left.allNativeWindowsVerified&&
  left.host.apparmorRestriction==='disabled'&&
  left.host.userNamespaceProbe==='allowed'&&
  right.host.apparmorRestriction==='enabled'&&
  right.host.apparmorModuleState==='enabled'&&
  right.host.userNamespaceProbe==='permission-denied'&&
  !right.allNativeWindowsVerified&&
  right.windows.every(w=>w.startupClassification===
   'shared-electron-sandbox-startup-suspected');
 const result={
  schema:'AUTO_X11_CROSS_RUNNER_COMPARISON_V2',
  archiveSha256:left.archiveSha256,
  sameArchiveSha256ReportedByBothRunners:true,
  packageSignatureVerified:false,
  ubuntu22NativeWindowsVerified:left.allNativeWindowsVerified,
  ubuntu24NativeWindowsVerified:right.allNativeWindowsVerified,
  ubuntu22NamespaceProbe:left.host.userNamespaceProbe,
  ubuntu24NamespaceProbe:right.host.userNamespaceProbe,
  ubuntu24ApparmorRestriction:right.host.apparmorRestriction,
  classification:typical?'namespace-restriction-correlated-with-startup-failure':
   left.allNativeWindowsVerified&&right.allNativeWindowsVerified?
    'both-x11-window-probes-mapped':'inconclusive',
  apparmorCausalityProven:false,electronSandboxCertified:false,
  realDesktopCertified:false,hostPolicyChanged:false,
  sandboxBypassApplied:false,readOnlyComparison:true
 };
 return Object.freeze(result);
}
