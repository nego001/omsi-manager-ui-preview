import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {M31_MAGIC} from './ubuntu24-synthetic-byte-provenance.mjs';
import {compareM32SyntheticAcquisitionCustody as compare}
 from './ubuntu24-two-source-custody.mjs';

const REFUSE=/^Error: UBUNTU24_M32_CUSTODY_REFUSED$/;
const HEX='a'.repeat(64);
const PHASES=['baseline','app-specific-pilot','rollback'];
const LABELS=['GNOME','KDE'];
const STAGES=['acquired','handoff','received'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const original=()=>Buffer.from(M31_MAGIC+'SYNTHETIC_TEST_ARTIFACT_32|v1','ascii');
function fixture(){
 const bytes=original();
 return {
  schema:'UBUNTU24_M32_TWO_SOURCE_CUSTODY_INPUT_V1',
  scope:'separate-synthetic-memory-slots-no-real-acquisition',
  acquisitionSources:['fixture-source-A','fixture-source-B'].map(sourceSlot=>({
   sourceSlot,
   phaseRecords:LABELS.flatMap(desktopLabel=>PHASES.map(phase=>({
    desktopLabel,phase,sourceDeclaredSha256:hash(bytes),
    custodyStages:STAGES.map(stageId=>({
     stageId,syntheticBytes:Buffer.from(bytes)
    }))
   })))
  }))
 };
}
const at=(x,slot=0,phase=0,hop=0)=>
 x.acquisitionSources[slot].phaseRecords[phase].custodyStages[hop];
function safe(result){
 assert.equal(result.schema,'UBUNTU24_M32_TWO_SOURCE_CUSTODY_RESULT_V1');
 assert.equal(result.source,'two-untrusted-artificial-memory-fixture-slots');
 for(const name of [
  'independentArtifactAcquisitionAuthenticated',
  'independentHostIdentitiesVerified','acquisitionSourceOwnershipVerified',
  'independentHumanReviewerAuthenticated','realPackageBytesAccessed',
  'realPackageSha256Verified','realPackageProvenanceVerified',
  'm30EvidenceReceiptsAuthenticated','realPolicyRestorationVerified',
  'realRendererConfinementVerified','apparmorCausalityProven',
  'strictUbuntu24CIPassed','hostSecurityPolicyChanged',
  'strictSandboxBypassApplied','branchProtectionSatisfied',
  'requiredChecksApproved','releaseAuthorized','mergeAuthorized',
  'installationAuthorized'
 ])assert.equal(result[name],false,name);
 assert.equal(Object.isFrozen(result),true);
 assert.equal(result.allSyntheticAcquisitionBytesCompared,true);
 assert.equal(result.onlyArtificialInMemoryBytesAccessed,true);
}
test('36 real synthetic custody SHA computations + 12 Python/Node acquisitions',()=>{
 const r=compare(fixture());
 assert.equal(r.status,'syntheticDualSourceBytesConsistentProvenanceUnverified');
 assert.equal(r.syntheticAcquisitionSlotsValidated,2);
 assert.equal(r.syntheticPhaseSnapshotsPerSlot,6);
 assert.equal(r.syntheticCustodyStageSnapshotsHashed,36);
 assert.equal(r.pythonNodeAcquisitionDigestAgreements,12);
 assert.equal(r.syntheticCustodyHopMutations,0);
 assert.equal(r.syntheticCrossSlotByteDifferences,0);
 assert.equal(r.syntheticWithinSlotPhaseByteDrift,0);
 assert.equal(r.syntheticDeclaredSha256Mismatches,0);
 safe(r);
});
test('different source B acquired bytes are detected even when hash claims updated',()=>{
 const x=fixture(),next=Buffer.from(M31_MAGIC+'ALTERED_SYNTHETIC_SOURCE_B','ascii');
 for(let s=0;s<3;s++) at(x,1,3,s).syntheticBytes=Buffer.from(next);
 x.acquisitionSources[1].phaseRecords[3].sourceDeclaredSha256=hash(next);
 const r=compare(x);
 assert.equal(r.status,'syntheticSourcesDisagreeOnBytes');
 assert.equal(r.syntheticCrossSlotByteDifferences,1);
 assert.equal(r.syntheticWithinSlotPhaseByteDrift,1);
 assert.equal(r.syntheticDeclaredSha256Mismatches,0);
 safe(r);
});
test('byte flip at handoff is classified as custody mutation, not source mismatch',()=>{
 const x=fixture();
 at(x,0,4,1).syntheticBytes=
  Buffer.from(M31_MAGIC+'SYNTHETIC_HOP_TAMPERING','ascii');
 const r=compare(x);
 assert.equal(r.status,'syntheticCustodyHopMutationObserved');
 assert.equal(r.syntheticCustodyHopMutations,2);
 assert.equal(r.syntheticCrossSlotByteDifferences,0);
 safe(r);
});
test('mutation only at receipt is counted once',()=>{
 const x=fixture();
 at(x,1,0,2).syntheticBytes=
  Buffer.from(M31_MAGIC+'SYNTHETIC_RECEIPT_TAMPER','ascii');
 const r=compare(x);
 assert.equal(r.status,'syntheticCustodyHopMutationObserved');
 assert.equal(r.syntheticCustodyHopMutations,1);
 safe(r);
});
test('stale SHA claim is detected against actual synthetic acquisition bytes',()=>{
 const x=fixture();
 x.acquisitionSources[0].phaseRecords[1].sourceDeclaredSha256=HEX;
 const r=compare(x);
 assert.equal(r.status,'syntheticAcquisitionClaimMismatch');
 assert.equal(r.syntheticDeclaredSha256Mismatches,1);
 safe(r);
});
test('phase drift in both channels is not a trusted unchanged artifact',()=>{
 const x=fixture();
 const drift=Buffer.from(M31_MAGIC+'SYNTHETIC_NEW_PHASE_IMAGE','ascii');
 for(let slot=0;slot<2;slot++){
  for(let hop=0;hop<3;hop++)at(x,slot,2,hop).syntheticBytes=Buffer.from(drift);
  x.acquisitionSources[slot].phaseRecords[2].sourceDeclaredSha256=hash(drift);
 }
 const r=compare(x);
 assert.equal(r.status,'syntheticPhaseByteDriftObserved');
 assert.equal(r.syntheticCrossSlotByteDifferences,0);
 assert.equal(r.syntheticWithinSlotPhaseByteDrift,2);
 safe(r);
});
test('custody mutation takes priority over source mismatch and fake digest',()=>{
 const x=fixture();
 at(x,1,5,0).syntheticBytes=Buffer.from(M31_MAGIC+'SYNTHETIC_NEW_SOURCE','ascii');
 x.acquisitionSources[1].phaseRecords[5].sourceDeclaredSha256=HEX;
 const r=compare(x);
 assert.equal(r.status,'syntheticCustodyHopMutationObserved');
 assert.equal(r.syntheticCrossSlotByteDifferences,1);
 assert.equal(r.syntheticDeclaredSha256Mismatches,1);
 safe(r);
});
test('the two source inputs must not alias the same acquisition Buffer object',()=>{
 const x=fixture();
 at(x,1,2,0).syntheticBytes=at(x,0,2,0).syntheticBytes;
 assert.throws(()=>compare(x),REFUSE);
});
test('swapped source channel names, duplicate source slots and unexpected origins refuse',()=>{
 for(const value of [
  ['fixture-source-B','fixture-source-A'],
  ['fixture-source-A','fixture-source-A'],
  ['trusted-real-mod','fixture-source-B'],
 ]){
  const x=fixture();
  x.acquisitionSources.forEach((s,i)=>{s.sourceSlot=value[i];});
  assert.throws(()=>compare(x),REFUSE);
 }
});
test('changed phase ordering, labels, and missing phases fail closed',()=>{
 const x=fixture();
 [x.acquisitionSources[0].phaseRecords[0],x.acquisitionSources[0].phaseRecords[1]]=
  [x.acquisitionSources[0].phaseRecords[1],x.acquisitionSources[0].phaseRecords[0]];
 assert.throws(()=>compare(x),REFUSE);
 const y=fixture();y.acquisitionSources[1].phaseRecords[3].desktopLabel='GNOME';
 assert.throws(()=>compare(y),REFUSE);
 const z=fixture();z.acquisitionSources[0].phaseRecords.pop();
 assert.throws(()=>compare(z),REFUSE);
});
test('missing custody stage, wrong stage label, extra stage, and duplicate stage refuse',()=>{
 const a=fixture();a.acquisitionSources[1].phaseRecords[2].custodyStages.pop();
 assert.throws(()=>compare(a),REFUSE);
 const b=fixture();at(b,0,1,1).stageId='received';
 assert.throws(()=>compare(b),REFUSE);
 const c=fixture();
 c.acquisitionSources[0].phaseRecords[0].custodyStages.push(at(c,0,0,0));
 assert.throws(()=>compare(c),REFUSE);
});
test('reject real binary-like data without the explicit in-memory marker',()=>{
 const x=fixture();
 at(x,0,0,2).syntheticBytes=Buffer.from([0x4d,0x5a,0,3,4,5]);
 assert.throws(()=>compare(x),REFUSE);
});
test('refuse oversize, empty, marker-only or non-Buffer acquisition',()=>{
 for(const value of [
  Buffer.alloc(0),Buffer.from(M31_MAGIC,'ascii'),
  Buffer.concat([Buffer.from(M31_MAGIC),Buffer.alloc(8192)]),
  new Uint8Array(original()),'/home/omsi/mod.zip',null
 ]){
  const x=fixture();at(x,0,2,0).syntheticBytes=value;
  assert.throws(()=>compare(x),REFUSE);
 }
});
test('unknown metadata, real file paths, scope, and forged permission reject',()=>{
 const a=fixture();a.operatorLogin='someone';assert.throws(()=>compare(a),REFUSE);
 const b=fixture();b.scope='real-file-acquisition';assert.throws(()=>compare(b),REFUSE);
 const c=fixture();c.acquisitionSources[0].realUri='file:///game';
 assert.throws(()=>compare(c),REFUSE);
 const d=fixture();at(d,1,3,0).independentReviewerApproved=true;
 assert.throws(()=>compare(d),REFUSE);
});
test('invalid SHA-256 case, type and length are rejected',()=>{
 for(const value of [
  'A'.repeat(64),'a'.repeat(63),'f'.repeat(65),
  null,true,43,{},[], '/tmp/package'
 ]){
  const x=fixture();
  x.acquisitionSources[0].phaseRecords[0].sourceDeclaredSha256=value;
  assert.throws(()=>compare(x),REFUSE);
 }
});
test('never output hashes, source bytes, admin identity, or filenames',()=>{
 const result=compare(fixture()),text=JSON.stringify(result);
 for(const secret of [
  hash(original()),original().toString('utf8'),
  '/home/private/package', 'Bearer secret','operatorLogin'
 ])assert.equal(text.includes(secret),false,secret);
 safe(result);
});
test('all proof and release flags remain false even with clean artificial sources',()=>{
 const r=compare(fixture());
 assert.equal(r.status,'syntheticDualSourceBytesConsistentProvenanceUnverified');
 assert.equal(r.independentArtifactAcquisitionAuthenticated,false);
 assert.equal(r.realPackageSha256Verified,false);
 assert.equal(r.realRendererConfinementVerified,false);
 assert.equal(r.strictUbuntu24CIPassed,false);
 safe(r);
});
test('invalid envelope forms and malformed source list are refused',()=>{
 for(const v of [undefined,null,false,12,'',{},[],new Date()]){
  assert.throws(()=>compare(v),REFUSE);
 }
 const x=fixture();x.acquisitionSources.pop();assert.throws(()=>compare(x),REFUSE);
 const y=fixture();y.acquisitionSources.push(x.acquisitionSources[0]);
 assert.throws(()=>compare(y),REFUSE);
});
