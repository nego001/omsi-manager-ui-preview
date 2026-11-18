import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createM46ABAIntake as intake,verifyM46ABAIntake as verify,
 renderM46OperatorRunbook as runbook}
 from './auto-x11-m46-external-aba-intake.mjs';
const DENY=/M46_ABA_INTAKE_REFUSED/;
const clone=x=>JSON.parse(JSON.stringify(x));
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
function m45(){
 return {
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
  independentPackageAuthenticityCertified:false,
  appSpecificProfileLoaded:false,abaRollbackVerified:false,
  electronRendererSandboxCertified:false,nativeUbuntu24StrictGatePassed:false,
  nativeUbuntu24GateWaived:false,sandboxBypassApplied:false,
  realModRead:false,installationAuthorized:false,mergeAuthorized:false,
  releaseAuthorized:false
 };
}
const FALSE_PROCESS=()=>({windowMapped:false,windowOwned:false,
 nativeProcessObserved:true,exitSignal:'SIGTRAP'});
const MAPPED_PROCESS=()=>({windowMapped:true,windowOwned:true,
 nativeProcessObserved:true,exitSignal:'none'});
function humanPilot(){
 const sha='a'.repeat(64),tag='b'.repeat(64);
 const labels=['GNOME','KDE'];
 const phases=['baseline','app-specific-pilot','rollback'];
 const states=['not-applied','administrator-applied-app-specific','removed-after-pilot'];
 return {schema:'UBUNTU24_TWO_DESKTOP_ABA_INPUT_V1',
  scope:'human-supplied-disposable-host-categories-only',
  desktopPilots:labels.map(label=>({
   desktopLabel:label,
   observation:{
    schema:'UBUNTU24_CONTROLLED_ABA_INPUT_V1',
    scope:'approved-disposable-host-categorical-only',
    observations:phases.map((phase,i)=>({
     phase,profileState:states[i],runner:'ubuntu-24.04',
     artifactSha256:sha,disposableSessionTag:tag,desktopLabel:label,
     apparmorModule:'enabled',globalNamespaceRestriction:'enabled',
     userNamespaceProbe:i===1?'allowed':'permission-denied',
     x11BaselineMapped:true,adminApprovedDisposableHost:true,
     stableExecutablePathReviewed:true,globalPolicyChanged:false,
     sandboxBypassUsed:false,electronRanAsRoot:false,
     launcher:i===1?MAPPED_PROCESS():FALSE_PROCESS(),
     direct:i===1?MAPPED_PROCESS():FALSE_PROCESS()
    }))
   }
  }))
 };
}
const base=()=>({m45:m45(),externalPilot:null});
test('M45 favorable handoff with no pilot produces only waiting state',()=>{
 const r=intake(base());
 assert.equal(r.status,'awaiting-admin-authorization-and-external-aba-records');
 assert.equal(r.externalPilotRecordPresent,false);
 assert.equal(r.humanReportedAbaClassification,'not-provided');
 assert.equal(verify(r),r);
});
test('all six A/B/A phase labels across two desktops are required',()=>{
 const r=intake(base());
 assert.deepEqual(r.requiredPhaseLabels,[
  'GNOME:baseline','GNOME:app-specific-pilot','GNOME:rollback',
  'KDE:baseline','KDE:app-specific-pilot','KDE:rollback'
 ]);
});
test('all independent review controls remain missing',()=>{
 const r=intake(base());
 assert.equal(r.mandatoryIndependentChecks.length,9);
 for(const key of ['externalABAPerformedByCI',
  'administratorApprovalIndependentlyVerified','policyAppliedByCI',
  'hostIdentityIndependentlyVerified','actualExecutableBytesIndependentlyVerified',
  'appSpecificPolicyIndependentlyVerified','apparmorCausedSIGTRAPProven',
  'rollbackIndependentlyVerified','rendererSandboxIndependentlyVerified',
  'nativeUbuntu24StrictCIPassed','sandboxBypassApplied','hostPolicyChangedByCI',
  'installationAuthorized','releaseAuthorized','mergeAuthorized'])assert.equal(r[key],false,key);
});
test('human-readable protocol stays an unsigned, read-only checklist',()=>{
 const md=runbook(intake(base()));
 assert.match(md,/A1/);
 assert.match(md,/rollback/);
 assert.match(md,/renderer/);
 assert.match(md,/NAO APROVADO/);
 assert.match(md,/GitHub Actions nao executou o piloto/);
 assert.equal((md.match(/- \[ \] GNOME:/g)||[]).length,3);
 assert.equal((md.match(/- \[ \] KDE:/g)||[]).length,3);
});
test('no prior M45 contrast means no pilot clearance',()=>{
 const x=base();
 x.m45.m42HostContrast=false;
 x.m45.reviewRequestedOnly=false;
 x.m45.status='missing-or-divergent-evidence-no-policy-review-conclusion';
 assert.equal(intake(x).status,'m45-contrast-incomplete-no-pilot-clearance');
});
test('reported reversible pattern remains untrusted and does not authorize policy',()=>{
 const r=intake({m45:m45(),externalPilot:humanPilot()});
 assert.equal(r.status,'untrusted-reversible-aba-claims-need-independent-review');
 assert.equal(r.externalPilotRecordPresent,true);
 assert.equal(r.humanReportedAbaClassification,'two-labels-reversible-correlation-reported');
 assert.equal(r.humanPilotAuthenticated,false);
 assert.equal(r.apparmorCausedSIGTRAPProven,false);
 assert.equal(r.rendererSandboxIndependentlyVerified,false);
 assert.equal(r.mergeAuthorized,false);
});
test('rollback absent on one desktop cannot report a complete reversible pattern',()=>{
 const p=humanPilot();
 const step=p.desktopPilots[1].observation.observations[2];
 step.userNamespaceProbe='allowed';
 const r=intake({m45:m45(),externalPilot:p});
 assert.equal(r.status,'untrusted-aba-incomplete-needs-independent-review');
});
test('mismatched package SHA across reported desktop phases fails closed',()=>{
 const p=humanPilot();
 p.desktopPilots[1].observation.observations[1].artifactSha256='c'.repeat(64);
 assert.throws(()=>intake({m45:m45(),externalPilot:p}),DENY);
});
test('different disposable session tags between desktop labels refuse',()=>{
 const p=humanPilot();
 for(const step of p.desktopPilots[1].observation.observations)
  step.disposableSessionTag='d'.repeat(64);
 assert.throws(()=>intake({m45:m45(),externalPilot:p}),DENY);
});
test('missing pilot phase, swapped labels or incorrect profile modes refuse',()=>{
 for(const edit of [
  p=>p.desktopPilots[0].observation.observations.pop(),
  p=>{p.desktopPilots[0].desktopLabel='KDE';},
  p=>{p.desktopPilots[0].observation.observations[1].profileState='not-applied';}
 ]){
  const p=humanPilot();edit(p);
  assert.throws(()=>intake({m45:m45(),externalPilot:p}),DENY);
 }
});
test('window without process ownership and unsafe flags refuse',()=>{
 const p=humanPilot();
 p.desktopPilots[0].observation.observations[1].direct.windowOwned=false;
 assert.throws(()=>intake({m45:m45(),externalPilot:p}),DENY);
 const q=humanPilot();
 q.desktopPilots[0].observation.observations[1].sandboxBypassUsed=true;
 assert.throws(()=>intake({m45:m45(),externalPilot:q}),DENY);
});
test('extra M45 hidden operator identity or fake approval is refused',()=>{
 for(const edit of [
  x=>{x.m45.pilotPrivateHost='/home/runner';},
  x=>{x.m45.administratorAuthorizedPolicyExperiment=true;},
  x=>{x.m45.releaseAuthorized=true;}
 ]){
  const x=base();edit(x);
  assert.throws(()=>intake(x),DENY);
 }
});
test('wrong outer input shape and fake external pilot contents refuse',()=>{
 for(const x of [null,{},[],false,{m45:m45()},
  {...base(),extraField:123},{...base(),externalPilot:{}}])
  assert.throws(()=>intake(x),DENY);
});
test('tampered output cannot claim fake approval, sandbox, or restored VM',()=>{
 for(const field of ['humanPilotAuthenticated','rollbackIndependentlyVerified',
  'rendererSandboxIndependentlyVerified','nativeUbuntu24StrictCIPassed',
  'mergeAuthorized','appSpecificPolicyIndependentlyVerified']){
  const r=clone(intake(base()));r[field]=true;
  assert.throws(()=>verify(r),DENY);
 }
});
test('tampered phase inventory, status and independent checks refuse',()=>{
 for(const edit of [
  r=>{r.requiredPhaseLabels[1]='GNOME:unrelated';},
  r=>{r.mandatoryIndependentChecks.pop();},
  r=>{r.status='approved';},
  r=>{r.externalPilotRecordPresent=true;},
  r=>{r.humanReportedAbaClassification='two-labels-reversible-correlation-reported';}
 ]){
  const r=clone(intake(base()));edit(r);
  assert.throws(()=>verify(r),DENY);
 }
});
test('neither output format exposes host identity, executable path or raw logs',()=>{
 const r=intake(base()),rendered=JSON.stringify(r)+'\n'+runbook(r);
 for(const token of ['/home/','/proc/','/etc/apparmor.d/','PID:',
  'Bearer ','SIGTRAP: private','--disable-setuid-sandbox'])
  assert.equal(rendered.includes(token),false,token);
});
test('offline direct CLI without CI context is refused before reading files',()=>{
 const result=spawnSync(process.execPath,['./auto-x11-m46-external-aba-intake.mjs'],{
  cwd:new URL('.',import.meta.url).pathname,
  env:{CI:'false',GITHUB_ACTIONS:'false',PATH:'/usr/bin:/bin'},
  encoding:'utf8',timeout:4000,maxBuffer:1024
 });
 assert.equal(result.status,1);assert.equal(result.stdout,'');
 assert.match(result.stderr,DENY);
});
