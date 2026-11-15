import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareControlledUbuntu24ABA as compare} from './ubuntu24-controlled-pilot-aba.mjs';
const sha='a'.repeat(64),nonce='b'.repeat(64);
const crash=()=>({windowMapped:false,windowOwned:false,nativeProcessObserved:true,exitSignal:'SIGTRAP'});
const opened=()=>({windowMapped:true,windowOwned:true,nativeProcessObserved:true,exitSignal:'none'});
function phase(name,overrides={}){
 const index=['baseline','app-specific-pilot','rollback'].indexOf(name);
 const success=index===1;
 return {phase:name,profileState:['not-applied','administrator-applied-app-specific','removed-after-pilot'][index],
  runner:'ubuntu-24.04',artifactSha256:sha,disposableSessionTag:nonce,desktopLabel:'GNOME',
  apparmorModule:'enabled',globalNamespaceRestriction:'enabled',
  userNamespaceProbe:success?'allowed':'permission-denied',x11BaselineMapped:true,
  adminApprovedDisposableHost:true,stableExecutablePathReviewed:true,
  globalPolicyChanged:false,sandboxBypassUsed:false,electronRanAsRoot:false,
  launcher:success?opened():crash(),direct:success?opened():crash(),...overrides};
}
const sample=()=>({schema:'UBUNTU24_CONTROLLED_ABA_INPUT_V1',
 scope:'approved-disposable-host-categorical-only',
 observations:[phase('baseline'),phase('app-specific-pilot'),phase('rollback')]});
const refusal=/^Error: UBUNTU24_CONTROLLED_ABA_REFUSED$/;
const modified=(index,changes)=>{
 const value=sample();value.observations[index]={...value.observations[index],...changes};return value;
};

test('a full categorical A-B-A pattern remains correlation, never certification',()=>{
 const result=compare(sample());
 assert.equal(result.classification,'reversible-namespace-correlation-observed');
 assert.equal(result.baselineFailureReproduced,true);
 assert.equal(result.pilotBothEntrypointsMapped,true);
 assert.equal(result.rollbackFailureReproduced,true);
 for(const name of ['actualHostIdentityVerified','independentlyAuthenticatedEvidence',
  'packageBytesIndependentlyVerified','apparmorPolicyIndependentlyVerified',
  'policyRestorationIndependentlyVerified','actualElectronSandboxCertified',
  'apparmorCausalityProven','compatibilityCertified','releaseAuthorized',
  'nativeCIRequirementWaived','comparatorChangedHostPolicy','comparatorBypassedSandbox'])
  assert.equal(result[name],false,name);
 assert.ok(Object.isFrozen(result));
});
test('a missing or changed baseline never produces the positive classification',()=>{
 const value=modified(0,{direct:{...crash(),exitSignal:'SIGABRT'}});
 assert.equal(compare(value).classification,'baseline-not-reproduced');
});
test('one failed launcher or denied namespace during pilot remains inconclusive',()=>{
 for(const changes of [{direct:crash()},{launcher:crash()},
  {userNamespaceProbe:'permission-denied'}])
  assert.equal(compare(modified(1,changes)).classification,'pilot-recovery-not-demonstrated');
});
test('failure not reproduced after rollback is not proof of reversibility',()=>{
 for(const changes of [{direct:opened()},{launcher:opened()},{userNamespaceProbe:'allowed'}])
  assert.equal(compare(modified(2,changes)).classification,'rollback-reproduction-not-demonstrated');
});
test('different package, session, or desktop labels must refuse to compare',()=>{
 for(const change of [{artifactSha256:'c'.repeat(64)},
  {disposableSessionTag:'d'.repeat(64)},{desktopLabel:'KDE'},
  {artifactSha256:'b'.repeat(63)},{disposableSessionTag:'/home/private/user'}])
  assert.throws(()=>compare(modified(1,change)),refusal,JSON.stringify(change));
});
test('wrong profile phase, X11 baseline or host security flags are refused',()=>{
 for(const change of [{profileState:'global-unconfined'},{apparmorModule:'disabled'},
  {globalNamespaceRestriction:'disabled'},{x11BaselineMapped:false},
  {adminApprovedDisposableHost:false},{stableExecutablePathReviewed:false},
  {globalPolicyChanged:true},{sandboxBypassUsed:true},{electronRanAsRoot:true},
  {runner:'ubuntu-22.04'},{userNamespaceProbe:'invalid'}])
  assert.throws(()=>compare(modified(1,change)),refusal,JSON.stringify(change));
});
test('inconsistent native process ownership, mapping, exit signals are refused',()=>{
 const bad=[{windowMapped:true,windowOwned:false,nativeProcessObserved:true,exitSignal:'none'},
  {windowMapped:true,windowOwned:true,nativeProcessObserved:false,exitSignal:'none'},
  {windowMapped:true,windowOwned:true,nativeProcessObserved:true,exitSignal:'SIGTRAP'},
  {windowMapped:false,windowOwned:true,nativeProcessObserved:false,exitSignal:'none'},
  {windowMapped:'true',windowOwned:true,nativeProcessObserved:true,exitSignal:'none'}];
 for(const p of bad)assert.throws(()=>compare(modified(1,{launcher:p})),refusal);
});
test('no partial, reordered, or malformed three-phase input',()=>{
 for(const bad of [null,false,42,'raw stderr',{},[],
  {...sample(),schema:'malformed'},
  {...sample(),scope:'production-host'},
  {...sample(),observations:sample().observations.slice(0,2)},
  {...sample(),observations:sample().observations.toReversed()}])
  assert.throws(()=>compare(bad),refusal);
});
test('unexpected private strings do not enter the comparison output',()=>{
 const secret='/home/private/secret/path';
 const input=modified(1,{stderr:secret,profileFile:secret,launcher:{...opened(),argument:secret}});
 input.rawLog=secret;
 const result=JSON.stringify(compare(input));
 assert.ok(!result.includes(secret));assert.ok(!result.includes('rawLog'));
 assert.ok(!result.includes('profileFile'));
});
test('unexpected unknown results fail closed rather than imply success',()=>{
 assert.equal(compare(modified(2,{userNamespaceProbe:'unknown'})).classification,
  'rollback-reproduction-not-demonstrated');
 assert.equal(compare(modified(1,{userNamespaceProbe:'unknown'})).classification,
  'pilot-recovery-not-demonstrated');
});

test('missing native-process confirmation defeats baseline and rollback SIGTRAP correlation',()=>{
 for(const target of ['launcher','direct']){
  const unobserved={...crash(),nativeProcessObserved:false};
  const before=compare(modified(0,{[target]:unobserved}));
  assert.equal(before.classification,'baseline-not-reproduced');
  assert.equal(before.baselineFailureReproduced,false);
  const after=compare(modified(2,{[target]:unobserved}));
  assert.equal(after.classification,'rollback-reproduction-not-demonstrated');
  assert.equal(after.rollbackFailureReproduced,false);
  assert.equal(after.actualElectronSandboxCertified,false);
 }
});
