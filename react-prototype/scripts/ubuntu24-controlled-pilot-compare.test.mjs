import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareControlledUbuntu24Pilot as compare} from './ubuntu24-controlled-pilot-compare.mjs';
const failed=()=>({windowMapped:false,windowOwned:false,nativeProcessObserved:true,exitSignal:'SIGTRAP'});
const mapped=()=>({windowMapped:true,windowOwned:true,nativeProcessObserved:true,exitSignal:'none'});
const record=(phase,changes={})=>({
 phase,runner:'ubuntu-24.04',reportedArtifactSha256:'a'.repeat(64),
 apparmorModule:'enabled',globalNamespaceRestriction:'enabled',
 userNamespaceProbe:phase==='baseline'?'permission-denied':'allowed',
 x11BaselineMapped:true,globalHostPolicyModified:false,
 electronSandboxBypass:false,electronRunAsRoot:false,
 disposableHostApproved:true,stableExecutablePathReviewed:true,
 profileState:phase==='baseline'?'not-applied':'administrator-applied-app-specific',
 launcher:phase==='baseline'?failed():mapped(),
 direct:phase==='baseline'?failed():mapped(),...changes
});
const input=(a=record('baseline'),b=record('app-specific-policy-pilot'))=>({
 schema:'UBUNTU24_CONTROLLED_PILOT_INPUT_V1',scope:'approved-disposable-host-only',
 observations:[a,b]
});
const refusal=/^Error: UBUNTU24_CONTROLLED_PILOT_REFUSED$/;
test('an apparent recovery is not a release, causality or sandbox certificate',()=>{
 const result=compare(input());
 assert.equal(result.status,'candidate-for-independent-runtime-and-sandbox-review');
 assert.equal(result.appSpecificPilotRecoveredBothEntrypoints,true);
 for(const flag of ['electronSandboxCertified','apparmorCausalityProven',
  'compatibilityCertified','independentArtifactHashVerified',
  'targetedProfileIndependentlyVerified','nativeCIRequirementWaived',
  'systemPolicyModifiedByComparator','sandboxBypassAppliedByComparator'])
  assert.equal(result[flag],false,flag);
 assert.equal(Object.isFrozen(result),true);
});
test('partial or absent recovery never upgrades compatibility',()=>{
 for(const bad of [
  record('app-specific-policy-pilot',{direct:failed()}),
  record('app-specific-policy-pilot',{userNamespaceProbe:'permission-denied'}),
  record('app-specific-policy-pilot',{launcher:failed(),direct:failed()})
 ]){
  const result=compare(input(undefined,bad));
  assert.equal(result.status,'pilot-did-not-demonstrate-full-recovery');
  assert.equal(result.compatibilityCertified,false);
 }
});
test('missing SIGTRAP baseline cannot support an A/B interpretation',()=>{
 const result=compare(input(record('baseline',{direct:{...failed(),exitSignal:'SIGABRT'}})));
 assert.equal(result.status,'baseline-not-reproduced');
 assert.equal(result.baselineFailureReproduced,false);
});
test('refuses different packages and switched hosts or kernel restrictions',()=>{
 const changes=[
  {reportedArtifactSha256:'b'.repeat(64)},{runner:'ubuntu-22.04'},
  {apparmorModule:'disabled'},{globalNamespaceRestriction:'disabled'},
  {globalHostPolicyModified:true},{disposableHostApproved:false},
  {stableExecutablePathReviewed:false},{electronRunAsRoot:true},
  {electronSandboxBypass:true},{profileState:'unconfined-global'},
  {reportedArtifactSha256:'a'.repeat(63)},{x11BaselineMapped:false}
 ];
 for(const change of changes)
  assert.throws(()=>compare(input(undefined,record('app-specific-policy-pilot',change))),refusal,JSON.stringify(change));
});
test('refuses contradictions in process proof and false-positive ownership',()=>{
 const bad=[
  {windowMapped:true,windowOwned:false,nativeProcessObserved:true,exitSignal:'none'},
  {windowMapped:true,windowOwned:true,nativeProcessObserved:false,exitSignal:'none'},
  {windowMapped:true,windowOwned:true,nativeProcessObserved:true,exitSignal:'SIGTRAP'},
  {windowMapped:false,windowOwned:true,nativeProcessObserved:false,exitSignal:'none'},
  {windowMapped:'true',windowOwned:true,nativeProcessObserved:true,exitSignal:'none'}
 ];
 for(const p of bad)
  assert.throws(()=>compare(input(undefined,record('app-specific-policy-pilot',{launcher:p}))),refusal);
});
test('refuses malformed scope, reordered or truncated observations',()=>{
 for(const value of [null,{},42,'raw log',[],
  {...input(),scope:'production-host'},
  {...input(),observations:[record('app-specific-policy-pilot'),record('baseline')]},
  {...input(),observations:[record('baseline')]},
  {...input(),schema:'UNTRUSTED'}])assert.throws(()=>compare(value),refusal);
});
test('private free-text fields cannot appear in the canonical output',()=>{
 const secret='/home/private/user/key';
 const a=record('baseline',{stderr:secret,privatePath:secret});
 const b=record('app-specific-policy-pilot',{rawProfile:secret,
  launcher:{...mapped(),commandLine:secret}});
 const out=JSON.stringify(compare({...input(a,b),trace:secret}));
 assert.ok(!out.includes(secret));
 assert.ok(!out.includes('stderr'));
 assert.ok(!out.includes('commandLine'));
});
