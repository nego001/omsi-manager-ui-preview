import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {M31_MAGIC,M31_MAX_BYTES,verifyM31SyntheticBytes as verify}
 from './ubuntu24-synthetic-byte-provenance.mjs';

const REFUSE=/^Error: UBUNTU24_SYNTHETIC_BYTE_PROVENANCE_REFUSED$/;
const LABELS=['GNOME','KDE'];
const PHASES=['baseline','app-specific-pilot','rollback'];
const fixture=(suffix='synthetic-original-v1')=>
 Buffer.from(M31_MAGIC+'FAKE_IN_MEMORY_ONLY|'+suffix,'ascii');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function input(){
 const b=fixture(),hash=digest(b);
 return {
  schema:'UBUNTU24_M31_SYNTHETIC_BYTES_INPUT_V1',
  scope:'ci-in-memory-artificial-fixtures-only',
  phaseSamples:LABELS.flatMap(desktopLabel=>PHASES.map(phase=>({
   desktopLabel,phase,syntheticBytes:Buffer.from(b),
   operatorReportedSha256:hash,reviewerReportedSha256:hash
  })))
 };
}
function locked(r){
 assert.equal(r.schema,'UBUNTU24_M31_SYNTHETIC_BYTES_PROVENANCE_V1');
 for(const k of [
  'realPackageBytesEverAccessed','realPackageBytesSha256Verified',
  'independentArtifactAcquisitionVerified',
  'independentReviewerIdentityVerified','provenanceSourceAuthenticated',
  'm30HumanReceiptAuthenticityVerified',
  'hostIdentityIndependentlyVerified','appSpecificAppArmorPolicyVerified',
  'rollbackIndependentlyVerified','rendererSandboxIndependentlyVerified',
  'apparmorCausalityProven','ubuntu24StrictNativeCIPassing',
  'branchProtectionSatisfied','sandboxBypassApplied','mergeAuthorized',
  'releaseAuthorized','installationAuthorized'
 ])assert.equal(r[k],false,k);
 assert.equal(Object.isFrozen(r),true);
}
test('six synthetic byte snapshots are rehashed by Node and isolated Python',()=>{
 const r=verify(input());
 assert.equal(r.status,'syntheticByteHashesRecomputedAuthenticationPending');
 assert.equal(r.syntheticPhaseSamplesValidated,6);
 assert.equal(r.crossRuntimeDigestAgreements,6);
 assert.deepEqual(r.runtimeHashImplementations,['node-crypto','python-hashlib']);
 assert.equal(r.actualSyntheticBytesHashed,true);
 assert.equal(r.sixSyntheticByteArraysExactlyEqual,true);
 assert.equal(r.operatorDigestClaimsMatchingSyntheticBytes,6);
 assert.equal(r.reviewerDigestClaimsMatchingSyntheticBytes,6);
 assert.equal(r.reportedDigestMismatchPhaseCount,0);
 locked(r);
});
test('byte-level drift with recomputed claims is NOT same synthetic artifact',()=>{
 const v=input(),newBytes=fixture('synthetic-other-v2');
 v.phaseSamples[4].syntheticBytes=newBytes;
 v.phaseSamples[4].operatorReportedSha256=digest(newBytes);
 v.phaseSamples[4].reviewerReportedSha256=digest(newBytes);
 const r=verify(v);
 assert.equal(r.crossRuntimeDigestAgreements,6);
 assert.equal(r.sixSyntheticByteArraysExactlyEqual,false);
 assert.equal(r.status,'syntheticByteDriftBetweenReportedPhases');
 assert.equal(r.reportedDigestMismatchPhaseCount,0);
 locked(r);
});
test('tampered bytes with old text claims become a real computed mismatch',()=>{
 const v=input(),oldHash=v.phaseSamples[5].operatorReportedSha256;
 v.phaseSamples[5].syntheticBytes=fixture('synthetic-byte-tamper');
 const r=verify(v);
 assert.equal(r.operatorDigestClaimsMatchingSyntheticBytes,5);
 assert.equal(r.reviewerDigestClaimsMatchingSyntheticBytes,5);
 assert.equal(r.reportedDigestMismatchPhaseCount,1);
 assert.equal(r.status,'syntheticReportedDigestsMismatchComputedBytes');
 assert.notEqual(digest(v.phaseSamples[5].syntheticBytes),oldHash);
 locked(r);
});
test('forged reviewer text claim never overrides actual byte hash',()=>{
 const v=input();
 v.phaseSamples[2].reviewerReportedSha256='f'.repeat(64);
 const r=verify(v);
 assert.equal(r.operatorDigestClaimsMatchingSyntheticBytes,6);
 assert.equal(r.reviewerDigestClaimsMatchingSyntheticBytes,5);
 assert.equal(r.status,'syntheticReportedDigestsMismatchComputedBytes');
 locked(r);
});
test('even identical text claims do not establish independent reviewer identity',()=>{
 const r=verify(input());
 assert.equal(r.operatorDigestClaimsMatchingSyntheticBytes,6);
 assert.equal(r.reviewerDigestClaimsMatchingSyntheticBytes,6);
 assert.equal(r.independentReviewerIdentityVerified,false);
 assert.equal(r.independentArtifactAcquisitionVerified,false);
 assert.equal(r.provenanceSourceAuthenticated,false);
 locked(r);
});
test('swapped GNOME/KDE records cannot masquerade as six ordered phases',()=>{
 const v=input();
 [v.phaseSamples[0],v.phaseSamples[3]]=
  [v.phaseSamples[3],v.phaseSamples[0]];
 assert.throws(()=>verify(v),REFUSE);
});
test('swapped baseline, pilot or rollback phase is refused',()=>{
 const v=input();
 [v.phaseSamples[0],v.phaseSamples[1]]=
  [v.phaseSamples[1],v.phaseSamples[0]];
 assert.throws(()=>verify(v),REFUSE);
});
test('missing or duplicated synthetic phase is refused',()=>{
 const a=input();a.phaseSamples.pop();assert.throws(()=>verify(a),REFUSE);
 const b=input();b.phaseSamples.push({...b.phaseSamples[0]});
 assert.throws(()=>verify(b),REFUSE);
});
test('real binary-looking bytes without explicit artificial marker are refused',()=>{
 const v=input();
 v.phaseSamples[0].syntheticBytes=Buffer.from([0x4f,0x4d,0x53,0x49,0,1,2]);
 assert.throws(()=>verify(v),REFUSE);
});
test('raw TypedArray instead of bounded Node Buffer is refused',()=>{
 const v=input();
 v.phaseSamples[0].syntheticBytes=
  new Uint8Array(v.phaseSamples[0].syntheticBytes);
 assert.throws(()=>verify(v),REFUSE);
});
test('empty, marker-only, oversized and unrelated inputs fail closed',()=>{
 for(const b of [
  Buffer.alloc(0),Buffer.from(M31_MAGIC,'ascii'),
  Buffer.concat([Buffer.from(M31_MAGIC),Buffer.alloc(M31_MAX_BYTES)]),
  Buffer.from('REAL_MOD_FROM_GAME_DIR','ascii')
 ]){
  const v=input();v.phaseSamples[0].syntheticBytes=b;
  assert.throws(()=>verify(v),REFUSE);
 }
});
test('invalid declared SHA type/case/length is rejected before any approval',()=>{
 for(const value of [
  'A'.repeat(64),'a'.repeat(63),'0x'+'f'.repeat(64),
  '/home/sensitive-file',true,42,null,{},[]
 ]){
  const v=input();v.phaseSamples[4].operatorReportedSha256=value;
  assert.throws(()=>verify(v),REFUSE);
 }
});
test('unexpected schema, scope, or extra user supplied path is rejected',()=>{
 const a=input();a.schema='PRODUCTION_BYTES_CERTIFIED';
 assert.throws(()=>verify(a),REFUSE);
 const b=input();b.scope='real-omsi-directory';assert.throws(()=>verify(b),REFUSE);
 const c=input();c.hostPath='/home/private/OMSI';assert.throws(()=>verify(c),REFUSE);
 const d=input();d.phaseSamples[0].privateLog='SECRETS';
 assert.throws(()=>verify(d),REFUSE);
});
test('malformed envelope cannot invoke a purported evidence verifier',()=>{
 for(const x of [null,undefined,false,1,'',[],{},new Date()]){
  assert.throws(()=>verify(x),REFUSE);
 }
});
test('result never exports computed SHA, bytes, addresses or private strings',()=>{
 const v=input(),r=verify(v),serialized=JSON.stringify(r);
 for(const secret of [
  digest(v.phaseSamples[0].syntheticBytes),
  v.phaseSamples[0].syntheticBytes.toString('ascii'),
  '/home/negresco-os/Jogos','PRIVATE_RECORD','Authorization','token'
 ]){
  assert.equal(serialized.includes(secret),false,secret);
 }
 locked(r);
});
test('six separate memory snapshots do not mutate the caller byte buffers',()=>{
 const v=input(),before=v.phaseSamples.map(p=>Buffer.from(p.syntheticBytes));
 const r=verify(v);
 assert.equal(r.crossRuntimeDigestAgreements,6);
 for(let i=0;i<6;i++){
  assert.ok(v.phaseSamples[i].syntheticBytes.equals(before[i]));
 }
 locked(r);
});
