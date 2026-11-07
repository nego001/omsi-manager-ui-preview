// Pure comparison of administrator-supplied, categorical observations.
// This never modifies AppArmor, invokes a process, or certifies Electron sandboxing.
const refuse=()=>{throw Error('UBUNTU24_CONTROLLED_PILOT_REFUSED');};
const signals=new Set(['SIGTRAP','SIGABRT','SIGSEGV','other','none']);
const probes=new Set(['permission-denied','allowed','unavailable','unknown']);

function checkProcess(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    typeof value.windowMapped!=='boolean'||
    typeof value.windowOwned!=='boolean'||
    typeof value.nativeProcessObserved!=='boolean'||
    !signals.has(value.exitSignal))refuse();
 if(value.windowMapped&&(!value.windowOwned||!value.nativeProcessObserved||
    value.exitSignal!=='none'))refuse();
 if(value.windowOwned&&!value.nativeProcessObserved)refuse();
 return Object.freeze({
  windowMapped:value.windowMapped,
  windowOwned:value.windowOwned,
  nativeProcessObserved:value.nativeProcessObserved,
  exitSignal:value.exitSignal
 });
}
function checkObservation(value,phase){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    value.phase!==phase||
    !/^[a-f0-9]{64}$/.test(value.reportedArtifactSha256)||
    value.runner!=='ubuntu-24.04'||
    value.apparmorModule!=='enabled'||
    value.globalNamespaceRestriction!=='enabled'||
    !probes.has(value.userNamespaceProbe)||
    value.x11BaselineMapped!==true||
    value.globalHostPolicyModified!==false||
    value.electronSandboxBypass!==false||
    value.electronRunAsRoot!==false||
    value.disposableHostApproved!==true||
    value.stableExecutablePathReviewed!==true||
    value.profileState!==(phase==='baseline'?'not-applied':'administrator-applied-app-specific'))refuse();
 return Object.freeze({
  phase,reportedArtifactSha256:value.reportedArtifactSha256,
  userNamespaceProbe:value.userNamespaceProbe,
  profileState:value.profileState,
  launcher:checkProcess(value.launcher),direct:checkProcess(value.direct)
 });
}

// An 'interesting' A/B result is still not causal proof: external variables,
// process confinement and renderer isolation require independent verification.
export function compareControlledUbuntu24Pilot(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
    input.schema!=='UBUNTU24_CONTROLLED_PILOT_INPUT_V1'||
    input.scope!=='approved-disposable-host-only'||
    !Array.isArray(input.observations)||input.observations.length!==2)refuse();
 const baseline=checkObservation(input.observations[0],'baseline');
 const pilot=checkObservation(input.observations[1],'app-specific-policy-pilot');
 if(baseline.reportedArtifactSha256!==pilot.reportedArtifactSha256)refuse();
 const beforeBlocked=baseline.userNamespaceProbe==='permission-denied'&&
  [baseline.launcher,baseline.direct].every(p=>p.nativeProcessObserved===true&&
   !p.windowMapped&&p.exitSignal==='SIGTRAP');
 const afterRecovered=pilot.userNamespaceProbe==='allowed'&&
  [pilot.launcher,pilot.direct].every(p=>p.windowMapped&&p.windowOwned&&p.nativeProcessObserved);
 const status=!beforeBlocked?'baseline-not-reproduced':
  afterRecovered?'candidate-for-independent-runtime-and-sandbox-review':
  'pilot-did-not-demonstrate-full-recovery';
 return Object.freeze({
  schema:'UBUNTU24_CONTROLLED_PILOT_COMPARISON_V1',
  status,
  baselineFailureReproduced:beforeBlocked,
  appSpecificPilotRecoveredBothEntrypoints:afterRecovered,
  sameArtifactHashReported:true,
  independentArtifactHashVerified:false,
  administratorSuppliedCategoriesOnly:true,
  approvedHostIndependentlyVerified:false,
  targetedProfileIndependentlyVerified:false,
  electronSandboxCertified:false,
  apparmorCausalityProven:false,
  compatibilityCertified:false,
  systemPolicyModifiedByComparator:false,
  sandboxBypassAppliedByComparator:false,
  nativeCIRequirementWaived:false
 });
}
