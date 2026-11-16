// M30: offline, synthetic-only A-B-A evidence receipt custody gate.
// Checks receipt shape, cross-source DIGEST CONSISTENCY and missing evidence.
// Never reads package bytes, contacts a host, authenticates reviewers,
// executes Electron or AppArmor, or authorizes merge, installation or release.
import {compareTwoDesktopUbuntu24ABA} from './ubuntu24-two-desktop-aba-evidence.mjs';

const REFUSAL='UBUNTU24_ABA_CUSTODY_REFUSED';
const refuse=()=>{throw Error(REFUSAL);};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const keys=(v,arr)=>plain(v)&&Object.keys(v).length===arr.length&&
 arr.every(k=>Object.hasOwn(v,k));
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const LABELS=['GNOME','KDE'];
const PHASES=['baseline','app-specific-pilot','rollback'];
const FIELDS=['artifactBytes','appPolicyState','rendererEvidence','rollbackRestoration'];
const PAIR=['operatorReportedSha256','reviewerReportedSha256'];
const RECEIPT_FIELDS=['desktopLabel','phase',...FIELDS];

function digestPair(v,allowAbsent){
 if(v===null && allowAbsent)return Object.freeze({missing:true,match:false});
 if(!keys(v,PAIR)||!sha(v.operatorReportedSha256)||
    !sha(v.reviewerReportedSha256))refuse();
 return Object.freeze({
  missing:false,
  match:v.operatorReportedSha256===v.reviewerReportedSha256
 });
}

export function reviewUbuntu24ABAReceiptCustody(bundle){
 if(!keys(bundle,['schema','scope','pilot','receipts'])||
    bundle.schema!=='UBUNTU24_ABA_CUSTODY_INPUT_V1'||
    bundle.scope!=='offline-receipts-no-host-operations'||
    !Array.isArray(bundle.receipts)||bundle.receipts.length!==6)refuse();

 // Reuse previous M29 validated two-label A-B-A contract. Both 'reported'
 // approval and hash are untrusted inputs without independent authentication.
 let comparison;
 try{comparison=compareTwoDesktopUbuntu24ABA(bundle.pilot);}
 catch{refuse();}
 if(comparison.schema!=='UBUNTU24_TWO_DESKTOP_ABA_COMPARISON_V1'||
    comparison.chromiumRendererSandboxCertified!==false||
    comparison.mergeAuthorized!==false||
    comparison.installationAuthorized!==false)refuse();

 const pilotRaw=bundle.pilot.desktopPilots;
 let matched=0, mismatched=0, missing=0;
 const missingKinds=new Set(), mismatchKinds=new Set();
 let rollbackReceiptCount=0;

 for(let index=0;index<bundle.receipts.length;index++){
  const label=LABELS[Math.floor(index/3)],phase=PHASES[index%3];
  const receipt=bundle.receipts[index];
  if(!keys(receipt,RECEIPT_FIELDS)||
     receipt.desktopLabel!==label||receipt.phase!==phase)refuse();

  const expectedReportedArtifactSha=pilotRaw[Math.floor(index/3)]
   .observation.observations[index%3].artifactSha256;
  const artifact=receipt.artifactBytes;
  if(!keys(artifact,PAIR)||
     artifact.operatorReportedSha256!==expectedReportedArtifactSha)refuse();
  // A real, independent byte hash is NOT performed here. Reusing a copied
  // digest or a false reviewer claim cannot authenticate a package.
  for(const field of FIELDS){
   if(field==='rollbackRestoration'&&phase!=='rollback'){
    if(receipt[field]!==null)refuse();
    continue; // Not applicable: only the two rollback phases have this slot.
   }
   const kind=digestPair(receipt[field],field!=='artifactBytes');
   if(kind.missing){
    missing++;
    missingKinds.add(field);
   }else if(kind.match){
    matched++;
   }else{
    mismatched++;
    mismatchKinds.add(field);
   }
   if(field==='rollbackRestoration'&&!kind.missing)rollbackReceiptCount++;
  }
 }

 const patternComplete=comparison.classification===
   'two-labels-reversible-correlation-reported';
 const status=mismatched>0?'reportedDigestMismatchNeedsInvestigation':
   missing>0?'missingEvidenceReceiptsNeedsReview':
   !patternComplete?'aBaObservationsIncompleteNeedsReview':
   'pairedReportedDigestsConsistentAuthenticationPending';

 return Object.freeze({
  schema:'UBUNTU24_ABA_CUSTODY_REVIEW_V1',
  source:'untrusted-offline-categorical-and-digest-statements',
  status,
  desktopGroups:2,
  phaseRecordsValidated:6,
  evidenceReceiptSlots:20,
  matchedReportedDigestPairs:matched,
  mismatchedReportedDigestPairs:mismatched,
  missingReceiptCategories: Object.freeze([...missingKinds].sort()),
  mismatchedReceiptCategories: Object.freeze([...mismatchKinds].sort()),
  rollbackPhaseReceiptsReported:rollbackReceiptCount,
  twoDesktopABAReportedComplete:patternComplete,
  artifactOperatorDigestMatchesReportedPilotAcrossSixPhases:true,
  checkActuallyComputedPackageBytesSha256:false,
  separatelyAuthenticatedReviewerDigest:false,
  hashMatchEstablishesAuthenticity:false,
  independentAdminAuthorizationVerified:false,
  independentHostIdentityVerified:false,
  appSpecificPolicyIndependentlyVerified:false,
  rollbackIndependentlyVerified:false,
  rendererSandboxIndependentlyVerified:false,
  apparmorCausalityProven:false,
  nativeUbuntu24StrictCIPassed:false,
  releaseAuthorized:false,
  mergeAuthorized:false,
  installationAuthorized:false,
  hostPolicyChangedByComparator:false,
  sandboxBypassApplied:false
 });
}
