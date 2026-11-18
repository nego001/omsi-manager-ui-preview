import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createM47RendererReference as create,
 verifyM47RendererReference as verify,
 compareM47ReferenceWithM46 as compare}
 from './auto-x11-m47-renderer-reference.mjs';
import {createM46ABAIntake} from './auto-x11-m46-external-aba-intake.mjs';
const REFUSE=/M47_RENDERER_MATRIX_REFUSED/;
const labels=['packaged-main','xvfb-gnome-label','xvfb-kde-label'];
const clone=x=>JSON.parse(JSON.stringify(x));
function renderer(overrides={}){
 return {
  schema:'ELECTRON_PACKAGED_RENDERER_KERNEL_EVIDENCE_V1',
  processRole:'renderer',commandLineSandboxBypassDetected:false,
  seccompMode:'filter',noNewPrivs:'enabled',
  apparmorRendererLabelCategory:'unconfined',
  apparmorTargetPolicyIndependentlyVerified:false,
  category:'renderer-kernel-restrictions-observed',
  runtimeRendererIdentityChecked:true,
  roleEvidence:'electron-metrics-and-process-command-line',
  fullElectronSandboxCertified:false,
  userNamespaceIsolationCertified:false,
  apparmorCausalityProven:false,hostPolicyChanged:false,gameContentRead:false,
  ...overrides
 };
}
function good(){
 return {runner:'ubuntu-22.04',desktopContext:'xvfb-synthetic-gnome-kde-labels',
 observations:labels.map(label=>({label,evidence:renderer()}))};
}
function m45(){
 return {
  schema:'M45_OPERATOR_READINESS_HANDOFF_V1',
  source:'validated-sanitized-m40-m44-reports-from-fixed-ci-artifact-names',
  status:'repeated-host-contrast-for-administrator-review-only',
  m42HostContrast:true,m43WindowContrast:true,m44StderrContrast:true,
  ubuntu22MappedOutOfThree:3,ubuntu24MappedOutOfThree:0,
  ubuntu24SIGTRAPOutOfThree:3,ubuntu24StderrCategory:'generic-fatal-message',
  reviewRequestedOnly:true,
  blockers:[
   'administrator-explicit-approval-not-verified',
   'disposable-vm-and-host-identity-not-verified',
   'independent-executed-package-integrity-not-verified',
   'app-specific-profile-scope-not-independently-verified',
   'baseline-pilot-rollback-not-performed',
   'rollback-host-restoration-not-independently-verified',
   'electron-renderer-sandbox-not-independently-verified',
   'real-desktop-native-ubuntu24-gate-not-passed'
  ],
  sameWorkflowArtifactInputsIndependentlyAuthenticated:false,
  apparmorCausalityProven:false,hostPolicyChanged:false,
  administratorAuthorizedPolicyExperiment:false,pilotVmIdentityAuthenticated:false,
  independentPackageAuthenticityCertified:false,appSpecificProfileLoaded:false,
  abaRollbackVerified:false,electronRendererSandboxCertified:false,
  nativeUbuntu24StrictGatePassed:false,nativeUbuntu24GateWaived:false,
  sandboxBypassApplied:false,realModRead:false,
  installationAuthorized:false,mergeAuthorized:false,releaseAuthorized:false
 };
}
const report46=()=>createM46ABAIntake({m45:m45(),externalPilot:null});
test('categorical three-renderer reference preserves only Seccomp/NoNewPrivs observations',()=>{
 const x=create(good());
 assert.equal(x.status,'three-xvfb-renderer-kernel-restrictions-observed-not-certified');
 assert.equal(x.observedRendererCount,3);
 assert.equal(x.scenarios.length,3);
 assert.equal(x.scenarios.every(s=>s.seccompMode==='filter'&&s.noNewPrivs==='enabled'),true);
 assert.equal(verify(x),x);
 assert.equal(Object.isFrozen(x),true);
});
test('actual main, simulated GNOME and simulated KDE labels retain exact order',()=>{
 assert.deepEqual(create(good()).scenarios.map(x=>x.label),labels);
});
test('all renderer and release authorization claims always remain false',()=>{
 const x=create(good());
 for(const k of ['chromiumRendererSandboxCertified','userNamespaceIsolationCertified',
 'appSpecificAppArmorPolicyVerified','realGnomeKdeDesktopCertified',
 'ubuntu24StrictNativeGatePassed','ubuntu24GateWaived',
 'hostPolicyChanged','sandboxBypassApplied','realModRead',
 'installationAuthorized','mergeAuthorized','releaseAuthorized'])
  assert.equal(x[k],false,k);
});
test('any disabled Seccomp filter or NoNewPrivs refuses collection',()=>{
 for(const fields of [
  {seccompMode:'off',category:'renderer-kernel-restrictions-incomplete'},
  {seccompMode:'strict',category:'renderer-kernel-restrictions-incomplete'},
  {noNewPrivs:'disabled',category:'renderer-kernel-restrictions-incomplete'},
  {seccompMode:'off'},
  {noNewPrivs:'disabled'}
 ]){
  const x=good();x.observations[2].evidence=renderer(fields);
  assert.throws(()=>create(x),REFUSE);
 }
});
test('no missing renderer role, spoofed main-process or unverified metric',()=>{
 for(const fields of [
  {processRole:'browser'},{runtimeRendererIdentityChecked:false},
  {commandLineSandboxBypassDetected:true},
  {roleEvidence:'main-process-only'},
  {roleEvidence:'main-process-observed'}
 ]){
  const x=good();x.observations[0].evidence=renderer(fields);
  assert.throws(()=>create(x),REFUSE);
 }
});
test('valid Chromium renderer zygote-fork role is a limited observation',()=>{
 const x=good();
 x.observations[2].evidence=renderer({
  roleEvidence:'electron-tab-metric-and-zygote-fork-cmdline',
  apparmorRendererLabelCategory:'enforce-label-observed'
 });
 assert.equal(create(x).scenarios[2].roleEvidence,
  'electron-tab-metric-and-zygote-fork-cmdline');
 assert.equal(create(x).apparmorCausalityProven,undefined);
});
test('AppArmor label cannot certify actual policy, namespace isolation or sandbox',()=>{
 const x=good();x.observations[1].evidence=renderer({
  apparmorRendererLabelCategory:'enforce-label-observed'
 });
 const r=create(x);
 assert.equal(r.appSpecificAppArmorPolicyVerified,false);
 assert.equal(r.chromiumRendererSandboxCertified,false);
 assert.equal(r.scenarios[1].apparmorRendererLabelCategory,'enforce-label-observed');
});
test('caller cannot forge full sandbox, AppArmor or userns certification',()=>{
 for(const name of ['fullElectronSandboxCertified',
 'apparmorTargetPolicyIndependentlyVerified','userNamespaceIsolationCertified',
 'apparmorCausalityProven','hostPolicyChanged','gameContentRead']){
  const x=good();x.observations[0].evidence[name]=true;
  assert.throws(()=>create(x),REFUSE,name);
 }
});
test('private properties and original process metadata do not enter the report',()=>{
 const x=good();x.observations[1].evidence.pid=1234;
 assert.throws(()=>create(x),REFUSE);
 const raw=JSON.stringify(create(good()));
 for(const token of ['/home/','/proc/','PID:','/etc/apparmor','--no-sandbox','1234'])
  assert.equal(raw.includes(token),false,token);
});
test('wrong runner or real-desktop claim refuses',()=>{
 for(const change of [
  x=>{x.runner='ubuntu-24.04';},
  x=>{x.desktopContext='actual-gnome-kde-certified';},
  x=>{x.observations[0].label='GNOME';},
  x=>{x.observations.reverse();}
 ]){
  const x=good();change(x);
  assert.throws(()=>create(x),REFUSE);
 }
});
test('missing, extra or duplicate observations refuse collection',()=>{
 for(const obj of [null,[],{},false,{...good(),secretPath:'/home/user'}])
  assert.throws(()=>create(obj),REFUSE);
 const x=good();x.observations.pop();
 assert.throws(()=>create(x),REFUSE);
 const y=good();y.observations.push(y.observations[0]);
 assert.throws(()=>create(y),REFUSE);
});
test('tampered output status, role and false flags fail verification',()=>{
 for(const mutate of [
  x=>{x.status='sandbox-certified';},
  x=>{x.scenarios[1].seccompMode='off';},
  x=>{x.scenarios[2].rawProcessFieldsDiscarded=false;},
  x=>{x.chromiumRendererSandboxCertified=true;},
  x=>{x.realGnomeKdeDesktopCertified=true;},
  x=>{x.privateProcessPath='/home/hidden';},
  x=>{x.observedRendererCount=4;}
 ]){
  const x=clone(create(good()));mutate(x);
  assert.throws(()=>verify(x),REFUSE);
 }
});
test('M47-M46 comparison permits reference only, never Ubuntu24 certification',()=>{
 const out=compare({m46:report46(),m47:create(good())});
 assert.equal(out.classification,'ubuntu22-xvfb-kernel-reference-only-ubuntu24-unverified');
 assert.equal(out.ubuntu22RendererSamplesObserved,3);
 assert.equal(out.ubuntu24ExternalAbaRecordPresent,false);
 assert.equal(out.ubuntu24RendererSandboxIndependentlyVerified,false);
 assert.equal(out.ubuntu24NativeGatePassed,false);
 assert.equal(out.mergeAuthorized,false);
});
test('forged M46 approval, external pilot and missing renderer data refuse comparator',()=>{
 const m46=report46(),m47=create(good());
 for(const change of [
  o=>{o.m46.mergeAuthorized=true;},
  o=>{o.m46.externalPilotRecordPresent=true;},
  o=>{o.m46.evidenceSourceIndependentOfCI=true;},
  o=>{o.m46.status='untrusted-reversible-aba-claims-need-independent-review';},
  o=>{o.m47.scenarios.pop();},
  o=>{o.m47.appSpecificAppArmorPolicyVerified=true;}
 ]){
  const input=clone({m46,m47});change(input);
  assert.throws(()=>compare(input),REFUSE);
 }
});
test('CLI refuses non-CI environment and never reads an arbitrary host process',()=>{
 const x=spawnSync(process.execPath,['./auto-x11-m47-renderer-reference.mjs'],{
  cwd:new URL('.',import.meta.url).pathname,
  env:{PATH:'/usr/bin:/bin',CI:'false',GITHUB_ACTIONS:'false'},
  encoding:'utf8',timeout:4000,maxBuffer:1024
 });
 assert.equal(x.status,1);assert.equal(x.stdout,'');
 assert.match(x.stderr,REFUSE);
});
