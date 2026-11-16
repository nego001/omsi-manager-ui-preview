import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewUbuntu24ABAReceiptCustody as review} from './ubuntu24-aba-evidence-custody.mjs';

const A='a'.repeat(64), B='b'.repeat(64), C='c'.repeat(64),
 D='d'.repeat(64), E='e'.repeat(64), F='f'.repeat(64);
const LABELS=['GNOME','KDE'];
const PHASES=['baseline','app-specific-pilot','rollback'];
const crash=()=>({windowMapped:false,windowOwned:false,
 nativeProcessObserved:true,exitSignal:'SIGTRAP'});
const opened=()=>({windowMapped:true,windowOwned:true,
 nativeProcessObserved:true,exitSignal:'none'});
const phase=(label,name)=>{
 const i=PHASES.indexOf(name),ok=i===1;
 return {
  phase:name,profileState:['not-applied','administrator-applied-app-specific',
   'removed-after-pilot'][i],runner:'ubuntu-24.04',
  artifactSha256:A,disposableSessionTag:B,desktopLabel:label,
  apparmorModule:'enabled',globalNamespaceRestriction:'enabled',
  userNamespaceProbe:ok?'allowed':'permission-denied',
  x11BaselineMapped:true,adminApprovedDisposableHost:true,
  stableExecutablePathReviewed:true,globalPolicyChanged:false,
  sandboxBypassUsed:false,electronRanAsRoot:false,
  launcher:ok?opened():crash(),direct:ok?opened():crash()
 };
};
const pair=x=>({operatorReportedSha256:x,reviewerReportedSha256:x});
const pilot=()=>({
 schema:'UBUNTU24_TWO_DESKTOP_ABA_INPUT_V1',
 scope:'human-supplied-disposable-host-categories-only',
 desktopPilots:LABELS.map(label=>({
  desktopLabel:label,observation:{
   schema:'UBUNTU24_CONTROLLED_ABA_INPUT_V1',
   scope:'approved-disposable-host-categorical-only',
   observations:PHASES.map(name=>phase(label,name))
  }
 }))
});
const receipts=()=>LABELS.flatMap(desktopLabel=>PHASES.map(phase=>({
 desktopLabel,phase,artifactBytes:pair(A),appPolicyState:pair(C),
 rendererEvidence:pair(D),
 rollbackRestoration:phase==='rollback'?pair(E):null
})));
const bundle=()=>({
 schema:'UBUNTU24_ABA_CUSTODY_INPUT_V1',
 scope:'offline-receipts-no-host-operations',
 pilot:pilot(),receipts:receipts()
});
const refusal=/^Error: UBUNTU24_ABA_CUSTODY_REFUSED$/;
function assertLocked(r){
 assert.equal(r.schema,'UBUNTU24_ABA_CUSTODY_REVIEW_V1');
 for(const name of [
  'checkActuallyComputedPackageBytesSha256',
  'separatelyAuthenticatedReviewerDigest','hashMatchEstablishesAuthenticity',
  'independentAdminAuthorizationVerified','independentHostIdentityVerified',
  'appSpecificPolicyIndependentlyVerified','rollbackIndependentlyVerified',
  'rendererSandboxIndependentlyVerified','apparmorCausalityProven',
  'nativeUbuntu24StrictCIPassed','releaseAuthorized','mergeAuthorized',
  'installationAuthorized','hostPolicyChangedByComparator',
  'sandboxBypassApplied'
 ]) assert.equal(r[name],false,name);
 assert.ok(Object.isFrozen(r));
 assert.ok(Object.isFrozen(r.missingReceiptCategories));
 assert.ok(Object.isFrozen(r.mismatchedReceiptCategories));
}
const updated=(index,field,value)=>{
 const input=bundle();input.receipts[index][field]=value;return input;
};

test('all 20 pairs agree but authentication and release remain explicitly false',()=>{
 const r=review(bundle());
 assert.equal(r.status,'pairedReportedDigestsConsistentAuthenticationPending');
 assert.equal(r.desktopGroups,2);
 assert.equal(r.phaseRecordsValidated,6);
 assert.equal(r.evidenceReceiptSlots,20);
 assert.equal(r.matchedReportedDigestPairs,20);
 assert.equal(r.mismatchedReportedDigestPairs,0);
 assert.deepEqual(r.missingReceiptCategories,[]);
 assert.deepEqual(r.mismatchedReceiptCategories,[]);
 assert.equal(r.rollbackPhaseReceiptsReported,2);
 assert.equal(r.twoDesktopABAReportedComplete,true);
 assertLocked(r);
});
test('changed reviewer package digest produces discrepancy, never approval',()=>{
 const r=review(updated(3,'artifactBytes',{
  operatorReportedSha256:A,reviewerReportedSha256:F
 }));
 assert.equal(r.status,'reportedDigestMismatchNeedsInvestigation');
 assert.deepEqual(r.mismatchedReceiptCategories,['artifactBytes']);
 assert.equal(r.mismatchedReportedDigestPairs,1);
 assertLocked(r);
});
test('reported AppArmor policy-state digest mismatch remains under investigation',()=>{
 const r=review(updated(1,'appPolicyState',{
  operatorReportedSha256:C,reviewerReportedSha256:F
 }));
 assert.deepEqual(r.mismatchedReceiptCategories,['appPolicyState']);
 assert.equal(r.status,'reportedDigestMismatchNeedsInvestigation');
 assertLocked(r);
});
test('reported renderer evidence disagreement is not sandbox certification',()=>{
 const r=review(updated(4,'rendererEvidence',{
  operatorReportedSha256:D,reviewerReportedSha256:F
 }));
 assert.deepEqual(r.mismatchedReceiptCategories,['rendererEvidence']);
 assert.equal(r.status,'reportedDigestMismatchNeedsInvestigation');
 assertLocked(r);
});
test('different rollback restoration digests preserve blocker',()=>{
 const r=review(updated(5,'rollbackRestoration',{
  operatorReportedSha256:E,reviewerReportedSha256:F
 }));
 assert.deepEqual(r.mismatchedReceiptCategories,['rollbackRestoration']);
 assert.equal(r.rollbackPhaseReceiptsReported,2);
 assertLocked(r);
});
test('missing policy, renderer and rollback receipts need independent review',()=>{
 const input=bundle();
 input.receipts[0].appPolicyState=null;
 input.receipts[4].rendererEvidence=null;
 input.receipts[2].rollbackRestoration=null;
 const r=review(input);
 assert.equal(r.status,'missingEvidenceReceiptsNeedsReview');
 assert.equal(r.matchedReportedDigestPairs,17);
 assert.deepEqual(r.missingReceiptCategories,
  ['appPolicyState','rendererEvidence','rollbackRestoration']);
 assert.equal(r.rollbackPhaseReceiptsReported,1);
 assertLocked(r);
});
test('any mismatch takes precedence over another missing record',()=>{
 const input=updated(0,'rendererEvidence',null);
 input.receipts[4].appPolicyState={
  operatorReportedSha256:C,reviewerReportedSha256:F
 };
 const r=review(input);
 assert.equal(r.status,'reportedDigestMismatchNeedsInvestigation');
 assert.deepEqual(r.missingReceiptCategories,['rendererEvidence']);
 assert.deepEqual(r.mismatchedReceiptCategories,['appPolicyState']);
 assertLocked(r);
});
test('complete receipts with partial A-B-A observations remain incomplete',()=>{
 const input=bundle();
 input.pilot.desktopPilots[1].observation.observations[1].direct=crash();
 const r=review(input);
 assert.equal(r.status,'aBaObservationsIncompleteNeedsReview');
 assert.equal(r.twoDesktopABAReportedComplete,false);
 assert.equal(r.matchedReportedDigestPairs,20);
 assertLocked(r);
});
test('artifact operator claim must match M29 phase record exactly',()=>{
 const input=updated(0,'artifactBytes',pair(F));
 assert.throws(()=>review(input),refusal);
});
test('missing artifact digest cannot count as verified evidence',()=>{
 assert.throws(()=>review(updated(0,'artifactBytes',null)),refusal);
});
test('a rollback receipt outside rollback phase is rejected',()=>{
 assert.throws(()=>review(updated(0,'rollbackRestoration',pair(E))),refusal);
 assert.throws(()=>review(updated(4,'rollbackRestoration',pair(E))),refusal);
});
test('reordered labels, phases, extra records and missing records refused',()=>{
 const x=bundle();x.receipts.reverse();assert.throws(()=>review(x),refusal);
 const y=bundle();y.receipts[3].phase='rollback';assert.throws(()=>review(y),refusal);
 const z=bundle();z.receipts.push(receipts()[0]);assert.throws(()=>review(z),refusal);
 const a=bundle();a.receipts.pop();assert.throws(()=>review(a),refusal);
});
test('unknown fields, free-form evidence or bogus schema cannot be accepted',()=>{
 const x=bundle();x.receipts[0].privatePath='/home/private';assert.throws(()=>review(x),refusal);
 const y=bundle();y.receipts[0].appPolicyState.stderr='secret';assert.throws(()=>review(y),refusal);
 const z=bundle();z.sandboxBypassUsed=true;assert.throws(()=>review(z),refusal);
 const a=bundle();a.schema='PRODUCTION_CERTIFICATE';assert.throws(()=>review(a),refusal);
});
test('digest case, length, type and arbitrary path values are refused',()=>{
 for(const value of ['A'.repeat(64),'a'.repeat(63),'/home/user/private',false,0,{},[],null]){
  assert.throws(()=>review(updated(0,'rendererEvidence',{
   operatorReportedSha256:D,reviewerReportedSha256:value
  })),refusal);
 }
});
test('the M29 validator refuses root, global policy and sandbox bypass',()=>{
 for(const field of ['electronRanAsRoot','globalPolicyChanged','sandboxBypassUsed']){
  const input=bundle();
  input.pilot.desktopPilots[0].observation.observations[1][field]=true;
  assert.throws(()=>review(input),refusal);
 }
});
test('no token, path, private log, artifact hash or opaque session tag leaks',()=>{
 const input=bundle(),secret='/home/person/secret-profile-path';
 input.pilot.desktopPilots[0].observation.observations[0].stderr=secret;
 const serialized=JSON.stringify(review(input));
 for(const s of [A,B,C,D,E,secret,'stderr','rawLog','authToken']){
  assert.equal(serialized.includes(s),false,s);
 }
});
test('malformed envelope and missing prior M29 pilot are refused',()=>{
 for(const x of [undefined,null,false,1,[],{},'production',new Date()]){
  assert.throws(()=>review(x),refusal);
 }
 const a=bundle();a.pilot=null;assert.throws(()=>review(a),refusal);
});
