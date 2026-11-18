import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {classifyM49ProcStatus as parse,probeM49RendererPrivilegeStatus as probe,
 createM49RendererPrivilegeReference as create,
 verifyM49RendererPrivilegeReference as verify,
 compareM49AgainstM46M47M48 as compare}
 from './auto-x11-m49-renderer-privilege.mjs';
import {createM47RendererReference} from './auto-x11-m47-renderer-reference.mjs';
import {createM48NamespaceReference} from './auto-x11-m48-namespace-relation.mjs';
import {createM46ABAIntake} from './auto-x11-m46-external-aba-intake.mjs';
const FAIL=/M49_RENDERER_PRIVILEGE_REFUSED/;
const labels=['packaged-main','xvfb-gnome-label','xvfb-kde-label'];
const clone=x=>JSON.parse(JSON.stringify(x));
function status(changes={}){
 const values={
  Seccomp:'2',NoNewPrivs:'1',CapEff:'0000000000000000',
  CapPrm:'0000000000000000',CapAmb:'0000000000000000',
  TracerPid:'0',Seccomp_filters:'2',...changes
 };
 return Object.entries(values).map(([k,v])=>k+':\t'+v+'\n').join('')+
  'Name:\tOMSI-Manager-Preview\n';
}
const none={
 effectiveCapabilities:'none',permittedCapabilities:'none',
 ambientCapabilities:'none',tracer:'not-traced',seccompFilters:'positive'
};
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
  fullElectronSandboxCertified:false,
  userNamespaceIsolationCertified:false,
  apparmorCausalityProven:false,hostPolicyChanged:false,gameContentRead:false
 };
 return createM47RendererReference({
  runner:'ubuntu-22.04',desktopContext:'xvfb-synthetic-gnome-kde-labels',
  observations:labels.map(label=>({label,evidence:{...evidence}}))
 });
}
function m48(ref){
 return createM48NamespaceReference({
  runner:'ubuntu-22.04',desktopContext:'xvfb-synthetic-gnome-kde-labels',
  m47:ref,samples:labels.map(label=>({
   label,relation:{userNamespace:'different',mountNamespace:'same'}
  }))
 });
}
function m46(){
 const blockers=[
  'administrator-explicit-approval-not-verified',
  'disposable-vm-and-host-identity-not-verified',
  'independent-executed-package-integrity-not-verified',
  'app-specific-profile-scope-not-independently-verified',
  'baseline-pilot-rollback-not-performed',
  'rollback-host-restoration-not-independently-verified',
  'electron-renderer-sandbox-not-independently-verified',
  'real-desktop-native-ubuntu24-gate-not-passed'
 ];
 const old={
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
  sandboxBypassApplied:false,realModRead:false,
  installationAuthorized:false,mergeAuthorized:false,releaseAuthorized:false
 };
 return createM46ABAIntake({m45:old,externalPilot:null});
}
const fixture=()=>{
 const a=m47();
 return {runner:'ubuntu-22.04',desktopContext:'xvfb-synthetic-gnome-kde-labels',
  m47:a,m48:m48(a),samples:labels.map(label=>({label,privileges:{...none}}))};
};
test('actual Linux /proc status zero capabilities and positive filters classify without raw masks',()=>{
 assert.deepEqual(parse(status()),none);
 assert.equal(JSON.stringify(parse(status())).includes('0000000000000000'),false);
});
test('one positive effective, permitted or ambient capability is categorized as present',()=>{
 for(const k of ['CapEff','CapPrm','CapAmb']){
  const out=parse(status({[k]:'0000000000000001'}));
  const category={CapEff:'effectiveCapabilities',CapPrm:'permittedCapabilities',
   CapAmb:'ambientCapabilities'}[k];
  assert.equal(out[category],'present');
 }
});
test('tracer process or zero seccomp filters explicitly categorized as anomalous',()=>{
 assert.equal(parse(status({TracerPid:'42'})).tracer,'tracer-present');
 assert.equal(parse(status({Seccomp_filters:'0'})).seccompFilters,'zero');
});
test('duplicate, missing or malformed required /proc fields refuse',()=>{
 for(const wrong of [
  status()+'CapEff:\t0000000000000000\n',
  status().replace('TracerPid:\t0\n',''),
  status().replace('NoNewPrivs:\t1','NoNewPrivs:\t0'),
  status().replace('Seccomp:\t2','Seccomp:\t0'),
  status().replace('CapEff:\t0000000000000000','CapEff:\tZZZZZZZZZZZZZZZZ'),
  status().replace('CapPrm:\t0000000000000000','CapPrm:\t0'),
  status().replace('Seccomp_filters:\t2','Seccomp_filters:\tunavailable'),
  status().replace('TracerPid:\t0','TracerPid:\t-1'),
  status({TracerPid:'99999999999'}),
  status()+'\0secret'
 ])assert.throws(()=>parse(wrong),FAIL);
});
test('malicious status content cannot masquerade as a second canonical field',()=>{
 const x=status()+'NoNewPrivs:\t1\n';
 assert.throws(()=>parse(x),FAIL);
});
test('three legitimate renderer samples can form only a no-certification reference',()=>{
 const report=create(fixture());
 assert.equal(report.observations.length,3);
 assert.equal(report.status,'three-renderers-unprivileged-untraced-filtered-no-certification');
 assert.equal(verify(report),report);
 assert.equal(Object.isFrozen(report),true);
});
test('all three renderer sample labels remain in launch order',()=>{
 assert.deepEqual(create(fixture()).observations.map(x=>x.label),labels);
});
test('privileged, traced or unfiltered report rejected despite matching M47 kernel flags',()=>{
 for(const [field,value] of [
  ['effectiveCapabilities','present'],['permittedCapabilities','present'],
  ['ambientCapabilities','present'],['tracer','tracer-present'],
  ['seccompFilters','zero']]){
  const input=fixture();
  input.samples[0].privileges[field]=value;
  assert.throws(()=>create(input),FAIL);
 }
});
test('forged renderer role and mismatched runner, label, context refuse',()=>{
 for(const modify of [
  x=>{x.runner='ubuntu-24.04';},
  x=>{x.desktopContext='real-GNOME-KDE';},
  x=>{x.m47.scenarios[0].rendererRoleConfirmed=false;},
  x=>{x.m48.runner='ubuntu-24.04';},
  x=>{x.samples[1].label='GNOME';}
 ]){
  const x=clone(fixture());modify(x);
  assert.throws(()=>create(x),FAIL);
 }
});
test('missing or additional records and private process metadata are rejected',()=>{
 for(const modify of [
  x=>x.samples.pop(),
  x=>x.samples.push(x.samples[0]),
  x=>{x.samples[0].privileges.pid=34566;},
  x=>{x.samples[1].privatePath='/home/runner';},
  x=>{x.m48.observations[0].label='different';}
 ]){
  const x=clone(fixture());modify(x);
  assert.throws(()=>create(x),FAIL);
 }
});
test('all sandbox, policy, real desktop, release flags stay permanently false',()=>{
 const r=create(fixture());
 for(const key of ['chromiumRendererSandboxIndependentlyCertified',
 'userNamespaceIsolationCertified','apparmorCausalityProven',
 'realGnomeKdeDesktopSessionsCertified','ubuntu24RendererPrivilegeObserved',
 'ubuntu24StrictNativeGatePassed','ubuntu24GateWaived','hostPolicyChanged',
 'sandboxBypassApplied','realModRead','installationAuthorized',
 'mergeAuthorized','releaseAuthorized']){
  assert.equal(r[key],false,key);
 }
});
test('published report includes categories only, not raw hexadecimal masks',()=>{
 const raw=JSON.stringify(create(fixture()));
 for(const token of ['/proc/','/home/','CapEff:','CapPrm:',
 '0000000000000000','Seccomp_filters:','TracerPid:','PID:'])
  assert.equal(raw.includes(token),false,token);
});
test('output tampering with raw identity, states or count fails closed',()=>{
 for(const change of [
  r=>{r.rawPidsRetained=true;},
  r=>{r.observations[1].tracer='tracer-present';},
  r=>{r.observations[0].effectiveCapabilities='present';},
  r=>{r.observations[0].privatePath='/home/operator';},
  r=>{r.rendererSamples=4;},
  r=>{r.status='sandbox-fully-certified';},
  r=>{r.ubuntu24GateWaived=true;}
 ]){
  const r=clone(create(fixture()));change(r);
  assert.throws(()=>verify(r),FAIL);
 }
});
test('M49 reconciles exact M46 M47 M48 reports but keeps Ubuntu24 blocked',()=>{
 const x=fixture();
 const r=compare({m46:m46(),m47:x.m47,m48:x.m48,m49:create(x)});
 assert.equal(r.ubuntu22UnprivilegedUntracedWithFilters,3);
 assert.equal(r.status,'ubuntu22-renderer-privilege-reference-ubuntu24-unverified');
 assert.equal(r.nativeUbuntu24GatePassed,false);
 assert.equal(r.chromiumSandboxIndependentlyCertified,false);
 assert.equal(r.mergeAuthorized,false);
});
test('M49 refuses forged human A/B/A, approval, or changed renderer label',()=>{
 const x=fixture();
 const original={m46:m46(),m47:x.m47,m48:x.m48,m49:create(x)};
 for(const mutate of [
  y=>{y.m46.externalPilotRecordPresent=true;},
  y=>{y.m46.nativeUbuntu24StrictCIPassed=true;},
  y=>{y.m47.scenarios[1].label='other';},
  y=>{y.m48.observations[0].label='other';},
  y=>{y.m49.ubuntu24RendererPrivilegeObserved=true;},
  y=>{y.privatePid=1234;}
 ]){
  const y=clone(original);mutate(y);
  assert.throws(()=>compare(y),FAIL);
 }
});
test('unprivileged live probe refuses wrong PIDs and root',async()=>{
 for(const pid of [null,undefined,-1,0,1,3.5,'3',2147483648])
  await assert.rejects(probe(pid),FAIL);
});
test('CLI cannot be invoked offline to inspect arbitrary processes',()=>{
 const out=spawnSync(process.execPath,['./auto-x11-m49-renderer-privilege.mjs'],{
  cwd:new URL('.',import.meta.url).pathname,
  env:{CI:'false',GITHUB_ACTIONS:'false',PATH:'/usr/bin:/bin'},
  encoding:'utf8',timeout:4000,maxBuffer:1024
 });
 assert.equal(out.status,1);
 assert.equal(out.stdout,'');
 assert.match(out.stderr,FAIL);
});
