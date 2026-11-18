import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
 classifyM48NamespaceLinks as classify,
 probeM48NamespaceRelation as probe,
 createM48NamespaceReference as create,
 verifyM48NamespaceReference as verify,
 compareM48AgainstM47AndM46 as compare
} from './auto-x11-m48-namespace-relation.mjs';
import {createM47RendererReference} from './auto-x11-m47-renderer-reference.mjs';
import {createM46ABAIntake} from './auto-x11-m46-external-aba-intake.mjs';
const REFUSED=/M48_NAMESPACE_RELATION_REFUSED/;
const clone=x=>JSON.parse(JSON.stringify(x));
const LABELS=['packaged-main','xvfb-gnome-label','xvfb-kde-label'];
const paths=(userA='user:[4026531837]',userB='user:[4026531838]',
             mountA='mnt:[4026531840]',mountB='mnt:[4026531840]')=>({
 main:{user:userA,mnt:mountA},renderer:{user:userB,mnt:mountB}
});
function m47(){
 const evidence={
  schema:'ELECTRON_PACKAGED_RENDERER_KERNEL_EVIDENCE_V1',
  processRole:'renderer',commandLineSandboxBypassDetected:false,
  seccompMode:'filter',noNewPrivs:'enabled',
  apparmorRendererLabelCategory:'unconfined',
  apparmorTargetPolicyIndependentlyVerified:false,
  category:'renderer-kernel-restrictions-observed',
  runtimeRendererIdentityChecked:true,
  roleEvidence:'electron-tab-metric-and-zygote-fork-cmdline',
  fullElectronSandboxCertified:false,userNamespaceIsolationCertified:false,
  apparmorCausalityProven:false,hostPolicyChanged:false,gameContentRead:false
 };
 return createM47RendererReference({
  runner:'ubuntu-22.04',desktopContext:'xvfb-synthetic-gnome-kde-labels',
  observations:LABELS.map(label=>({label,evidence:{...evidence}}))
 });
}
function m46(){
 const blockers=[
 'administrator-explicit-approval-not-verified','disposable-vm-and-host-identity-not-verified',
 'independent-executed-package-integrity-not-verified',
 'app-specific-profile-scope-not-independently-verified',
 'baseline-pilot-rollback-not-performed',
 'rollback-host-restoration-not-independently-verified',
 'electron-renderer-sandbox-not-independently-verified',
 'real-desktop-native-ubuntu24-gate-not-passed'
 ];
 const a={
  schema:'M45_OPERATOR_READINESS_HANDOFF_V1',
  source:'validated-sanitized-m40-m44-reports-from-fixed-ci-artifact-names',
  status:'repeated-host-contrast-for-administrator-review-only',
  m42HostContrast:true,m43WindowContrast:true,m44StderrContrast:true,
  ubuntu22MappedOutOfThree:3,ubuntu24MappedOutOfThree:0,
  ubuntu24SIGTRAPOutOfThree:3,ubuntu24StderrCategory:'generic-fatal-message',
  reviewRequestedOnly:true,blockers,
  sameWorkflowArtifactInputsIndependentlyAuthenticated:false,
  apparmorCausalityProven:false,hostPolicyChanged:false,
  administratorAuthorizedPolicyExperiment:false,pilotVmIdentityAuthenticated:false,
  independentPackageAuthenticityCertified:false,appSpecificProfileLoaded:false,
  abaRollbackVerified:false,electronRendererSandboxCertified:false,
  nativeUbuntu24StrictGatePassed:false,nativeUbuntu24GateWaived:false,
  sandboxBypassApplied:false,realModRead:false,installationAuthorized:false,
  mergeAuthorized:false,releaseAuthorized:false
 };
 return createM46ABAIntake({m45:a,externalPilot:null});
}
function input(){
 return {
  runner:'ubuntu-22.04',desktopContext:'xvfb-synthetic-gnome-kde-labels',
  m47:m47(),
  samples:[
   {label:LABELS[0],relation:{userNamespace:'different',mountNamespace:'same'}},
   {label:LABELS[1],relation:{userNamespace:'same',mountNamespace:'different'}},
   {label:LABELS[2],relation:{userNamespace:'different',mountNamespace:'different'}}
  ]
 };
}
test('synthetic /proc namespace targets are compared without exposing inode',()=>{
 assert.deepEqual(classify(paths()),{
  userNamespace:'different',mountNamespace:'same'
 });
 const s=JSON.stringify(classify(paths()));
 assert.equal(s.includes('402653'),false);
});
test('identical namespace targets are same, not automatically sandbox failure',()=>{
 const x=classify(paths('user:[1]','user:[1]','mnt:[2]','mnt:[2]'));
 assert.deepEqual(x,{userNamespace:'same',mountNamespace:'same'});
});
test('inaccessible or malformed namespace targets become unavailable, not proof',()=>{
 for(const target of [null,'','user:[private]','user:[123] PRIVATE',
   '/proc/123/ns/user','user:[123]\n','user:[-12]']){
  const a=classify(paths('user:[1]',target));
  assert.equal(a.userNamespace,'unavailable');
 }
});
test('wrong namespace type cannot be compared as a valid user inode',()=>{
 const r=classify(paths('mnt:[22]','user:[22]'));
 assert.equal(r.userNamespace,'unavailable');
});
test('input rejects arbitrary properties or large raw strings',()=>{
 for(const x of [
  null,{},[],{...paths(),secret:123},
  {main:{...paths().main,path:'/home'},renderer:paths().renderer},
  paths('user:['+'1'.repeat(90)+']')
 ]) assert.throws(()=>classify(x),REFUSED);
});
test('three real-sample categories are kept in fixed main/GNOME/KDE label order',()=>{
 const report=create(input());
 assert.equal(report.status,'three-readonly-namespace-pairs-observed-no-certification');
 assert.deepEqual(report.observations.map(x=>x.label),LABELS);
 assert.equal(verify(report),report);
});
test('same/different totals are independently recomputed for user and mount',()=>{
 const r=create(input());
 assert.equal(r.userNamespaceDifferentCount,2);
 assert.equal(r.userNamespaceSameCount,1);
 assert.equal(r.mountNamespaceDifferentCount,2);
 assert.equal(r.mountNamespaceSameCount,1);
 assert.equal(r.userNamespaceUnavailableCount,0);
});
test('one missing link remains a partial reference with no positive conclusion',()=>{
 const x=input();
 x.samples[1].relation.userNamespace='unavailable';
 const r=create(x);
 assert.equal(r.status,'partial-namespace-links-unavailable-no-certification');
 assert.equal(r.userNamespaceUnavailableCount,1);
 assert.equal(r.chromiumSandboxIndependentlyCertified,false);
});
test('even all namespace differences cannot claim sandbox certification',()=>{
 const x=input();
 for(const s of x.samples)
  s.relation={userNamespace:'different',mountNamespace:'different'};
 const r=create(x);
 for(const field of ['chromiumSandboxIndependentlyCertified',
  'namespaceIsolationIndependentlyCertified','appArmorCauseProven',
  'actualGnomeKdeDesktopCertified','ubuntu24RendererNamespaceObserved',
  'ubuntu24StrictNativeGatePassed','nativeGateWaived',
  'hostPolicyChanged','installationAuthorized','releaseAuthorized',
  'mergeAuthorized'])assert.equal(r[field],false,field);
});
test('a different runner or real-desktop claim is rejected',()=>{
 for(const mutate of [
  x=>{x.runner='ubuntu-24.04';},
  x=>{x.desktopContext='actual-gnome-kde';},
  x=>{x.m47.runner='ubuntu-24.04';},
  x=>{x.samples[0].label='KDE';},
  x=>{x.samples.reverse();}
 ]){
  const x=clone(input());mutate(x);
  assert.throws(()=>create(x),REFUSED);
 }
});
test('unknown relation, excess sample, absent sample and renderer identity forgery refused',()=>{
 for(const mutate of [
  x=>{x.samples[0].relation.userNamespace='namespace-isolated-certified';},
  x=>{x.samples[2].relation.hiddenPid=35;},
  x=>{x.samples.push(x.samples[0]);},
  x=>{x.samples.pop();},
  x=>{x.m47.scenarios[1].rendererRoleConfirmed=false;}
 ]){
  const x=clone(input());mutate(x);
  assert.throws(()=>create(x),REFUSED);
 }
});
test('output forged totals, status or privileges are refused',()=>{
 for(const mutate of [
  x=>{x.userNamespaceDifferentCount=3;},
  x=>{x.mountNamespaceUnavailableCount=1;},
  x=>{x.status='all-renderers-sandbox-certified';},
  x=>{x.nativeGateWaived=true;},
  x=>{x.rawPidsPersisted=true;},
  x=>{x.observations[0].rawInode='4026531840';},
  x=>{x.observations[2].rendererRoleVerifiedByExistingM47=false;}
 ]){
  const r=clone(create(input()));mutate(r);
  assert.throws(()=>verify(r),REFUSED);
 }
});
test('M48/M47/M46 reconciliation remains a read-only Ubuntu22-only reference',()=>{
 const out=compare({m46:m46(),m47:m47(),m48:create(input())});
 assert.equal(out.classification,
  'ubuntu22-namespace-relations-only-ubuntu24-native-still-blocked');
 assert.equal(out.ubuntu22RendererSamplesObserved,3);
 assert.equal(out.ubuntu22UserNamespaceDifferences,2);
 assert.equal(out.ubuntu24NativeGatePassed,false);
 assert.equal(out.ubuntu24SandboxIndependentlyCertified,false);
 assert.equal(out.mergeAuthorized,false);
});
test('reconciler refuses forged M46 approval, mismatched samples and missing evidence',()=>{
 const original={m46:m46(),m47:m47(),m48:create(input())};
 for(const mutate of [
  x=>{x.m46.humanPilotAuthenticated=true;},
  x=>{x.m46.externalPilotRecordPresent=true;},
  x=>{x.m47.scenarios[0].label='wrong';},
  x=>{x.m48.observations.pop();},
  x=>{x.privatePath='/home/runner';}
 ]){
  const x=clone(original);mutate(x);
  assert.throws(()=>compare(x),REFUSED);
 }
});
test('exposing a namespace relation does not expose a PID or raw /proc inode',()=>{
 const serialized=JSON.stringify(create(input()));
 for(const secret of ['4026531840','/proc/','/home/','PID:', 'user:[','mnt:['])
  assert.equal(serialized.includes(secret),false,secret);
});
test('negative PID, invalid PID, matching PIDs and root cannot probe',async()=>{
 for(const pair of [[-1,22],[0,22],[1,22],[22,22],
   ['22',23],[2.5,44],[2147483648,55]]){
  await assert.rejects(probe(...pair),REFUSED);
 }
});
test('CLI refuses non-CI contexts before reading private /proc or artifacts',()=>{
 const s=spawnSync(process.execPath,['./auto-x11-m48-namespace-relation.mjs'],{
  cwd:new URL('.',import.meta.url).pathname,
  env:{CI:'false',GITHUB_ACTIONS:'false',PATH:'/usr/bin:/bin'},
  encoding:'utf8',timeout:4000,maxBuffer:1024
 });
 assert.equal(s.status,1);
 assert.equal(s.stdout,'');
 assert.match(s.stderr,REFUSED);
});
