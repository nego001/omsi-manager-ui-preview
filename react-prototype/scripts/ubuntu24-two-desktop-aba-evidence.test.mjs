import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareTwoDesktopUbuntu24ABA as compare}
 from './ubuntu24-two-desktop-aba-evidence.mjs';

const SHA='a'.repeat(64),TAG='b'.repeat(64);
const crash=()=>({windowMapped:false,windowOwned:false,
 nativeProcessObserved:true,exitSignal:'SIGTRAP'});
const open=()=>({windowMapped:true,windowOwned:true,
 nativeProcessObserved:true,exitSignal:'none'});
const phase=(name,label,changes={})=>{
 const phases=['baseline','app-specific-pilot','rollback'];
 const i=phases.indexOf(name),success=i===1;
 return {
  phase:name,
  profileState:['not-applied','administrator-applied-app-specific',
   'removed-after-pilot'][i],
  runner:'ubuntu-24.04',artifactSha256:SHA,disposableSessionTag:TAG,
  desktopLabel:label,apparmorModule:'enabled',
  globalNamespaceRestriction:'enabled',
  userNamespaceProbe:success?'allowed':'permission-denied',
  x11BaselineMapped:true,adminApprovedDisposableHost:true,
  stableExecutablePathReviewed:true,globalPolicyChanged:false,
  sandboxBypassUsed:false,electronRanAsRoot:false,
  launcher:success?open():crash(),direct:success?open():crash(),
  ...changes
 };
};
const groups=()=>['GNOME','KDE'].map(label=>({
 desktopLabel:label,
 observation:{
  schema:'UBUNTU24_CONTROLLED_ABA_INPUT_V1',
  scope:'approved-disposable-host-categorical-only',
  observations:['baseline','app-specific-pilot','rollback'].map(name=>phase(name,label))
 }
}));
const bundle=()=>({
 schema:'UBUNTU24_TWO_DESKTOP_ABA_INPUT_V1',
 scope:'human-supplied-disposable-host-categories-only',
 desktopPilots:groups()
});
const refusal=/^Error: UBUNTU24_TWO_DESKTOP_ABA_REFUSED$/;
function changed(label,phaseNumber,delta){
 const v=bundle();
 const group=v.desktopPilots.find(g=>g.desktopLabel===label);
 group.observation.observations[phaseNumber]={
  ...group.observation.observations[phaseNumber],...delta
 };
 return v;
}
function locked(report){
 assert.equal(report.schema,'UBUNTU24_TWO_DESKTOP_ABA_COMPARISON_V1');
 for(const key of [
  'independentAdminAuthorizationVerified','independentHostIdentityVerified',
  'packageBytesIndependentlyVerified','appSpecificPolicyIndependentlyVerified',
  'policyRollbackIndependentlyVerified','chromiumRendererSandboxCertified',
  'apparmorCausalityProven','realGnomeKdeDesktopCertified',
  'productionCompatibilityCertified','pilotActuallyExecutedByComparator',
  'hostPolicyChangedByComparator','sandboxBypassApplied',
  'ubuntu24StrictCIPassing','nativeCIGateWaived','mergeAuthorized',
  'installationAuthorized'
 ])assert.equal(report[key],false,key);
 assert.equal(Object.isFrozen(report),true);
 assert.equal(Object.isFrozen(report.perDesktopResults),true);
}

test('both simulated desktop A-B-A patterns still cannot approve host or renderer sandbox',()=>{
 const r=compare(bundle());
 assert.equal(r.classification,'two-labels-reversible-correlation-reported');
 assert.equal(r.phaseRecordsValidated,6);
 assert.equal(r.desktopLabelCount,2);
 assert.equal(r.baselineReproducedOnBothLabels,true);
 assert.equal(r.pilotBothEntrypointsMappedOnBothLabels,true);
 assert.equal(r.rollbackReproducedOnBothLabels,true);
 assert.deepEqual(r.perDesktopResults.map(x=>x.desktopLabel),['GNOME','KDE']);
 locked(r);
});

test('GNOME and KDE must report the same artifact SHA and session tag',()=>{
 for(const mutation of [
  {artifactSha256:'c'.repeat(64)},
  {disposableSessionTag:'d'.repeat(64)}
 ]){
  assert.throws(()=>compare(changed('KDE',0,mutation)),refusal);
  assert.throws(()=>compare(changed('GNOME',2,mutation)),refusal);
 }
});

test('rejects swapped, duplicated, missing and extra desktop labels',()=>{
 const a=bundle();a.desktopPilots.reverse();assert.throws(()=>compare(a),refusal);
 const b=bundle();b.desktopPilots[1].desktopLabel='GNOME';
 assert.throws(()=>compare(b),refusal);
 const c=bundle();c.desktopPilots.pop();assert.throws(()=>compare(c),refusal);
 const d=bundle();d.desktopPilots.push(groups()[0]);assert.throws(()=>compare(d),refusal);
});

test('disallows claimed KDE outcomes copied verbatim from GNOME labels',()=>{
 const a=bundle();
 a.desktopPilots[1].observation.observations=
  a.desktopPilots[0].observation.observations.map(x=>({...x}));
 assert.throws(()=>compare(a),refusal);
});

test('malformed, swapped or truncated pilot phases refuse',()=>{
 const a=bundle();a.desktopPilots[0].observation.observations.reverse();
 assert.throws(()=>compare(a),refusal);
 const b=bundle();b.desktopPilots[1].observation.observations.pop();
 assert.throws(()=>compare(b),refusal);
 const c=bundle();c.desktopPilots[0].observation.schema='FAKE';
 assert.throws(()=>compare(c),refusal);
});

test('a partial pilot recovery in KDE remains independent-review pending',()=>{
 for(const detail of [{direct:crash()},{userNamespaceProbe:'permission-denied'},
                       {launcher:crash()}]){
  const r=compare(changed('KDE',1,detail));
  assert.equal(r.classification,'two-label-evidence-incomplete-needs-independent-review');
  assert.equal(r.baselineReproducedOnBothLabels,true);
  assert.equal(r.pilotBothEntrypointsMappedOnBothLabels,false);
  assert.equal(r.rollbackReproducedOnBothLabels,true);
  locked(r);
 }
});

test('missing rollback failure is not reversible correlation',()=>{
 const r=compare(changed('GNOME',2,{direct:open()}));
 assert.equal(r.classification,'two-label-evidence-incomplete-needs-independent-review');
 assert.equal(r.rollbackReproducedOnBothLabels,false);
 locked(r);
});

test('without independent native process evidence no SIGTRAP baseline claim',()=>{
 const r=compare(changed('KDE',0,{
  launcher:{...crash(),nativeProcessObserved:false}
 }));
 assert.equal(r.baselineReproducedOnBothLabels,false);
 assert.equal(r.classification,'two-label-evidence-incomplete-needs-independent-review');
 locked(r);
});

test('rejects inconsistent owned mapped windows, signals and process witness',()=>{
 for(const invalid of [
  {windowMapped:true,windowOwned:false,nativeProcessObserved:true,exitSignal:'none'},
  {windowMapped:true,windowOwned:true,nativeProcessObserved:false,exitSignal:'none'},
  {windowMapped:true,windowOwned:true,nativeProcessObserved:true,exitSignal:'SIGTRAP'},
  {windowMapped:true,windowOwned:true,nativeProcessObserved:true,exitSignal:'unknown'}
 ])assert.throws(()=>compare(changed('KDE',1,{direct:invalid})),refusal);
});

test('host policy change, sandbox bypass, root, unapproved host always refused',()=>{
 for(const invalid of [
  {globalPolicyChanged:true},{sandboxBypassUsed:true},
  {electronRanAsRoot:true},{adminApprovedDisposableHost:false},
  {stableExecutablePathReviewed:false},{apparmorModule:'disabled'},
  {globalNamespaceRestriction:'disabled'},{x11BaselineMapped:false}
 ])assert.throws(()=>compare(changed('GNOME',1,invalid)),refusal);
});

test('rejects fake desktop and production host scope',()=>{
 for(const fields of [
  {schema:'WRONG'}, {scope:'production-host'},
  {desktopPilots:[]},{desktopPilots:'GNOME,KDE'}
 ]){
  const x={...bundle(),...fields};
  assert.throws(()=>compare(x),refusal);
 }
});

test('rejects top-level extra fields and extra group metadata',()=>{
 const x=bundle();x.privatePath='/home/secret';assert.throws(()=>compare(x),refusal);
 const y=bundle();y.desktopPilots[0].operatorToken='secret';assert.throws(()=>compare(y),refusal);
});

test('does not serialize hashes, tokens, labels beyond fixed names or private stderr',()=>{
 const x=bundle(),secret='/home/a/private-sample.o3d';
 x.desktopPilots[0].observation.observations[0].stderr=secret;
 x.desktopPilots[1].observation.observations[1].launcher.rawArgv=secret;
 const r=JSON.stringify(compare(x));
 for(const needle of [SHA,TAG,secret,'stderr','rawArgv','token',
                      'adminApprovedDisposableHost'])
  assert.ok(!r.includes(needle),needle);
 locked(JSON.parse(r)); // Serialized result has same safety flags.
});

test('nonobjects and nonarrays refuse without leaking input',()=>{
 for(const v of [null,undefined,42,[],{},'secret',false]){
  assert.throws(()=>compare(v),refusal);
 }
});
