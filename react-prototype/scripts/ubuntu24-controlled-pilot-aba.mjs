// Purely categorical A-B-A comparison for a future approved disposable-host review.
// No OS, AppArmor, executable or filesystem operations are performed here.
const refuse=()=>{throw Error('UBUNTU24_CONTROLLED_ABA_REFUSED');};
const phases=['baseline','app-specific-pilot','rollback'];
const profileModes=['not-applied','administrator-applied-app-specific','removed-after-pilot'];
const signals=new Set(['none','SIGTRAP','SIGABRT','SIGSEGV','other']);
const probes=new Set(['allowed','permission-denied','unknown','unavailable']);
const isObj=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);

function validateProcess(p){
 if(!isObj(p)||typeof p.windowMapped!=='boolean'||
    typeof p.windowOwned!=='boolean'||typeof p.nativeProcessObserved!=='boolean'||
    !signals.has(p.exitSignal))refuse();
 if(p.windowOwned&&!p.nativeProcessObserved)refuse();
 if(p.windowMapped&&(!p.windowOwned||!p.nativeProcessObserved||p.exitSignal!=='none'))refuse();
 return Object.freeze({mapped:p.windowMapped,owned:p.windowOwned,
  nativeProcess:p.nativeProcessObserved,signal:p.exitSignal});
}

function validateStep(s,i){
 if(!isObj(s)||s.phase!==phases[i]||s.profileState!==profileModes[i]||
    s.runner!=='ubuntu-24.04'||!sha(s.artifactSha256)||
    !sha(s.disposableSessionTag)||
    !['GNOME','KDE'].includes(s.desktopLabel)||
    s.apparmorModule!=='enabled'||s.globalNamespaceRestriction!=='enabled'||
    !probes.has(s.userNamespaceProbe)||s.x11BaselineMapped!==true||
    s.adminApprovedDisposableHost!==true||s.stableExecutablePathReviewed!==true||
    s.globalPolicyChanged!==false||s.sandboxBypassUsed!==false||
    s.electronRanAsRoot!==false)refuse();
 return Object.freeze({
  artifactSha256:s.artifactSha256,
  disposableSessionTag:s.disposableSessionTag,
  desktopLabel:s.desktopLabel,
  userNamespaceProbe:s.userNamespaceProbe,
  launcher:validateProcess(s.launcher),direct:validateProcess(s.direct)
 });
}
const bothSigtrap=s=>s.userNamespaceProbe==='permission-denied'&&
 [s.launcher,s.direct].every(p=>p.mapped===false&&p.signal==='SIGTRAP');
const bothMapped=s=>s.userNamespaceProbe==='allowed'&&
 [s.launcher,s.direct].every(p=>p.mapped&&p.owned&&p.nativeProcess&&p.signal==='none');

export function compareControlledUbuntu24ABA(input){
 if(!isObj(input)||input.schema!=='UBUNTU24_CONTROLLED_ABA_INPUT_V1'||
    input.scope!=='approved-disposable-host-categorical-only'||
    !Array.isArray(input.observations)||input.observations.length!==3)refuse();
 const [baseline,pilot,rollback]=input.observations.map(validateStep);
 if(new Set([baseline.artifactSha256,pilot.artifactSha256,rollback.artifactSha256]).size!==1||
    new Set([baseline.disposableSessionTag,pilot.disposableSessionTag,rollback.disposableSessionTag]).size!==1||
    new Set([baseline.desktopLabel,pilot.desktopLabel,rollback.desktopLabel]).size!==1)refuse();
 const initialFailure=bothSigtrap(baseline);
 const pilotRecovered=bothMapped(pilot);
 const rollbackReproduced=bothSigtrap(rollback);
 let classification='baseline-not-reproduced';
 if(initialFailure&&!pilotRecovered)classification='pilot-recovery-not-demonstrated';
 else if(initialFailure&&pilotRecovered&&!rollbackReproduced)
  classification='rollback-reproduction-not-demonstrated';
 else if(initialFailure&&pilotRecovered&&rollbackReproduced)
  classification='reversible-namespace-correlation-observed';
 return Object.freeze({
  schema:'UBUNTU24_CONTROLLED_ABA_COMPARISON_V1',classification,
  baselineFailureReproduced:initialFailure,
  pilotBothEntrypointsMapped:pilotRecovered,
  rollbackFailureReproduced:rollbackReproduced,
  allThreePhasesPresent:true,
  reportedArtifactShaConsistent:true,
  reportedSessionTagConsistent:true,
  desktopLabelConsistent:true,
  source:'human-reported-categorical-observations',
  actualHostIdentityVerified:false,
  independentlyAuthenticatedEvidence:false,
  packageBytesIndependentlyVerified:false,
  apparmorPolicyIndependentlyVerified:false,
  policyRestorationIndependentlyVerified:false,
  actualElectronSandboxCertified:false,
  apparmorCausalityProven:false,
  compatibilityCertified:false,
  releaseAuthorized:false,
  nativeCIRequirementWaived:false,
  comparatorChangedHostPolicy:false,
  comparatorBypassedSandbox:false
 });
}
