// M32: two intentionally FAKE in-memory acquisition slots with custody hops.
// Recompute SHA from each snapshot (Node), reuse M31 isolated Python audit for
// acquisition, and compare actual synthetic bytes between slots. This is NOT
// authentic independent acquisition, a real pilot, or an installation gate.
import {createHash} from 'node:crypto';
import {M31_MAGIC,M31_MAX_BYTES,verifyM31SyntheticBytes}
 from './ubuntu24-synthetic-byte-provenance.mjs';

const REFUSAL='UBUNTU24_M32_CUSTODY_REFUSED';
const refuse=()=>{throw Error(REFUSAL);};
const PHASES=['baseline','app-specific-pilot','rollback'];
const DESKTOPS=['GNOME','KDE'];
const SOURCES=['fixture-source-A','fixture-source-B'];
const STAGES=['acquired','handoff','received'];
const MARK=Buffer.from(M31_MAGIC,'ascii');
const HEX=/^[a-f0-9]{64}$/;
const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const exact=(v,names)=>isPlain(v)&&Object.keys(v).length===names.length&&
 names.every(n=>Object.hasOwn(v,n));
const hex=x=>typeof x==='string'&&HEX.test(x);
const sha=b=>createHash('sha256').update(b).digest('hex');

function verifiedSyntheticSnapshot(value){
 if(!Buffer.isBuffer(value)||value.length<MARK.length+1||
    value.length>M31_MAX_BYTES||
    !value.subarray(0,MARK.length).equals(MARK))refuse();
 return Buffer.from(value);
}

export function compareM32SyntheticAcquisitionCustody(input){
 if(!exact(input,['schema','scope','acquisitionSources'])||
   input.schema!=='UBUNTU24_M32_TWO_SOURCE_CUSTODY_INPUT_V1'||
   input.scope!=='separate-synthetic-memory-slots-no-real-acquisition'||
   !Array.isArray(input.acquisitionSources)||
   input.acquisitionSources.length!==2)refuse();

 let syntheticReceiptBytesHashed=0,syntheticCustodyMutationCount=0;
 let mismatchedDeclaredAcquisitionDigests=0,byteDifferencesBetweenSources=0;
 let withinSourcePhaseByteDrift=0,pythonAgreements=0;
 const sourceAcquired=[];
 for(let channel=0;channel<2;channel++){
  const src=input.acquisitionSources[channel];
  if(!exact(src,['sourceSlot','phaseRecords'])||
     src.sourceSlot!==SOURCES[channel]||
     !Array.isArray(src.phaseRecords)||src.phaseRecords.length!==6)refuse();
  const acquired=[],m31Phases=[];
  for(let i=0;i<6;i++){
   const phase=src.phaseRecords[i];
   const desktop=DESKTOPS[Math.floor(i/3)],name=PHASES[i%3];
   if(!exact(phase,['desktopLabel','phase','sourceDeclaredSha256','custodyStages'])||
      phase.desktopLabel!==desktop||phase.phase!==name||
      !hex(phase.sourceDeclaredSha256)||
      !Array.isArray(phase.custodyStages)||
      phase.custodyStages.length!==3)refuse();
   const snapshots=[];
   for(let s=0;s<3;s++){
    const step=phase.custodyStages[s];
    if(!exact(step,['stageId','syntheticBytes'])||
       step.stageId!==STAGES[s])refuse();
    const bytes=verifiedSyntheticSnapshot(step.syntheticBytes);
    snapshots.push(bytes);
    syntheticReceiptBytesHashed++;
   }
   const initial=snapshots[0];
   const got=sha(initial);
   mismatchedDeclaredAcquisitionDigests+=Number(
    got!==phase.sourceDeclaredSha256);
   // Detect transport/receipt mutation at the byte level, even if any
   // operator copied a stale SHA or claimed that a review succeeded.
   syntheticCustodyMutationCount+=Number(!initial.equals(snapshots[1]));
   syntheticCustodyMutationCount+=Number(!snapshots[1].equals(snapshots[2]));
   acquired.push(initial);
   m31Phases.push({
    desktopLabel:desktop,phase:name,syntheticBytes:Buffer.from(initial),
    operatorReportedSha256:phase.sourceDeclaredSha256,
    reviewerReportedSha256:phase.sourceDeclaredSha256
   });
  }
  // M31 checks each source's six acquisition snapshots via two runtime
  // SHA-256 implementations. Both processes still see the SAME bytes.
  let result;
  try{
   result=verifyM31SyntheticBytes({
    schema:'UBUNTU24_M31_SYNTHETIC_BYTES_INPUT_V1',
    scope:'ci-in-memory-artificial-fixtures-only',
    phaseSamples:m31Phases
   });
  }catch{refuse();}
  if(result.crossRuntimeDigestAgreements!==6||
     result.actualSyntheticBytesHashed!==true||
     result.realPackageBytesEverAccessed!==false||
     result.mergeAuthorized!==false||
     result.installationAuthorized!==false)refuse();
  pythonAgreements+=result.crossRuntimeDigestAgreements;
  for(let i=1;i<acquired.length;i++){
   withinSourcePhaseByteDrift+=Number(!acquired[0].equals(acquired[i]));
  }
  sourceAcquired.push(acquired);
 }
 // Different Buffer objects are distinct *test inputs*, not independent
 // downloadable package sources or proven physical host custody.
 for(let i=0;i<6;i++){
  if(input.acquisitionSources[0].phaseRecords[i].custodyStages[0].syntheticBytes===
     input.acquisitionSources[1].phaseRecords[i].custodyStages[0].syntheticBytes)refuse();
  byteDifferencesBetweenSources+=Number(
   !sourceAcquired[0][i].equals(sourceAcquired[1][i]));
 }
 let status;
 if(syntheticCustodyMutationCount>0){
  status='syntheticCustodyHopMutationObserved';
 }else if(byteDifferencesBetweenSources>0){
  status='syntheticSourcesDisagreeOnBytes';
 }else if(mismatchedDeclaredAcquisitionDigests>0){
  status='syntheticAcquisitionClaimMismatch';
 }else if(withinSourcePhaseByteDrift>0){
  status='syntheticPhaseByteDriftObserved';
 }else{
  status='syntheticDualSourceBytesConsistentProvenanceUnverified';
 }

 return Object.freeze({
  schema:'UBUNTU24_M32_TWO_SOURCE_CUSTODY_RESULT_V1',
  source:'two-untrusted-artificial-memory-fixture-slots',
  status,
  syntheticAcquisitionSlotsValidated:2,
  syntheticPhaseSnapshotsPerSlot:6,
  syntheticCustodyStageSnapshotsHashed:syntheticReceiptBytesHashed,
  pythonNodeAcquisitionDigestAgreements:pythonAgreements,
  syntheticCustodyHopMutations:syntheticCustodyMutationCount,
  syntheticCrossSlotByteDifferences:byteDifferencesBetweenSources,
  syntheticWithinSlotPhaseByteDrift:withinSourcePhaseByteDrift,
  syntheticDeclaredSha256Mismatches:mismatchedDeclaredAcquisitionDigests,
  allSyntheticAcquisitionBytesCompared:true,
  onlyArtificialInMemoryBytesAccessed:true,
  independentArtifactAcquisitionAuthenticated:false,
  independentHostIdentitiesVerified:false,
  acquisitionSourceOwnershipVerified:false,
  independentHumanReviewerAuthenticated:false,
  realPackageBytesAccessed:false,
  realPackageSha256Verified:false,
  realPackageProvenanceVerified:false,
  m30EvidenceReceiptsAuthenticated:false,
  realPolicyRestorationVerified:false,
  realRendererConfinementVerified:false,
  apparmorCausalityProven:false,
  strictUbuntu24CIPassed:false,
  hostSecurityPolicyChanged:false,
  strictSandboxBypassApplied:false,
  branchProtectionSatisfied:false,
  requiredChecksApproved:false,
  releaseAuthorized:false,
  mergeAuthorized:false,
  installationAuthorized:false
 });
}
