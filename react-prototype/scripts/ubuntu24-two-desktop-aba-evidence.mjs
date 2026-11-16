// M29: join two human-reported Ubuntu 24.04 A-B-A pilot records (GNOME+KDE).
// CI runs synthetic fixtures ONLY. Never touches AppArmor, namespaces, hosts,
// executables, real mods, credentials, or the sandbox gate; never certifies it.
import {compareControlledUbuntu24ABA} from './ubuntu24-controlled-pilot-aba.mjs';

const REFUSAL='UBUNTU24_TWO_DESKTOP_ABA_REFUSED';
const refuse=()=>{throw Error(REFUSAL);};
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
  (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const exactKeys=(o,names)=>plain(o)&&
  Object.keys(o).length===names.length&&
  names.every(k=>Object.hasOwn(o,k));

export function compareTwoDesktopUbuntu24ABA(bundle){
 if(!exactKeys(bundle,['schema','scope','desktopPilots'])||
    bundle.schema!=='UBUNTU24_TWO_DESKTOP_ABA_INPUT_V1'||
    bundle.scope!=='human-supplied-disposable-host-categories-only'||
    !Array.isArray(bundle.desktopPilots)||
    bundle.desktopPilots.length!==2)refuse();
 const names=['GNOME','KDE'];
 let previousSha,previousSession;
 const results=[];
 for(let index=0;index<names.length;index++){
  const group=bundle.desktopPilots[index], label=names[index];
  if(!exactKeys(group,['desktopLabel','observation'])||
     group.desktopLabel!==label||
     !plain(group.observation)||
     !Array.isArray(group.observation.observations)||
     group.observation.observations.length!==3)refuse();

  const raw=group.observation.observations;
  if(raw.some(step=>!plain(step)||step.desktopLabel!==label))refuse();

  // Reuse the existing strict per-label V1 comparator; no reimplementation of
  // process ownership, exit signals, phase ordering or policy validation.
  let report;
  try{report=compareControlledUbuntu24ABA(group.observation);}
  catch{refuse();}
  if(report.schema!=='UBUNTU24_CONTROLLED_ABA_COMPARISON_V1'||
     report.source!=='human-reported-categorical-observations'||
     report.actualElectronSandboxCertified!==false||
     report.apparmorCausalityProven!==false||
     report.releaseAuthorized!==false||
     report.nativeCIRequirementWaived!==false)refuse();

  const sha=raw[0].artifactSha256,session=raw[0].disposableSessionTag;
  if(index===0){previousSha=sha;previousSession=session;}
  else if(sha!==previousSha||session!==previousSession)refuse();
  results.push(Object.freeze({
   desktopLabel:label,
   classification:report.classification,
   baselineFailureReported:report.baselineFailureReproduced,
   pilotBothEntrypointsMappedReported:report.pilotBothEntrypointsMapped,
   rollbackFailureReported:report.rollbackFailureReproduced
  }));
 }
 // The same two opaque hex strings across two labels are *claims* only.
 // No host identity, executable SHA or process sandbox was independently
 // verified; even two apparent A-B-A recoveries never authorize release.
 const bothReversible=results.every(
  r=>r.classification==='reversible-namespace-correlation-observed');
 const baselineBoth=results.every(r=>r.baselineFailureReported);
 const pilotBoth=results.every(r=>r.pilotBothEntrypointsMappedReported);
 const rollbackBoth=results.every(r=>r.rollbackFailureReported);
 return Object.freeze({
  schema:'UBUNTU24_TWO_DESKTOP_ABA_COMPARISON_V1',
  source:'human-supplied-categorical-data-only',
  classification:bothReversible?
   'two-labels-reversible-correlation-reported':
   'two-label-evidence-incomplete-needs-independent-review',
  desktopLabelCount:2,
  phaseRecordsValidated:6,
  reportOnlySameArtifactHashAcrossLabels:true,
  reportOnlySameSessionTagAcrossLabels:true,
  baselineReproducedOnBothLabels:baselineBoth,
  pilotBothEntrypointsMappedOnBothLabels:pilotBoth,
  rollbackReproducedOnBothLabels:rollbackBoth,
  perDesktopResults:Object.freeze(results),
  independentAdminAuthorizationVerified:false,
  independentHostIdentityVerified:false,
  packageBytesIndependentlyVerified:false,
  appSpecificPolicyIndependentlyVerified:false,
  policyRollbackIndependentlyVerified:false,
  chromiumRendererSandboxCertified:false,
  apparmorCausalityProven:false,
  realGnomeKdeDesktopCertified:false,
  productionCompatibilityCertified:false,
  pilotActuallyExecutedByComparator:false,
  hostPolicyChangedByComparator:false,
  sandboxBypassApplied:false,
  ubuntu24StrictCIPassing:false,
  nativeCIGateWaived:false,
  mergeAuthorized:false,
  installationAuthorized:false
 });
}
