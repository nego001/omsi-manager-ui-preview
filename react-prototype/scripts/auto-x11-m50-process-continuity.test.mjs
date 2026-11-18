import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {parseM50ProcStartTick as parse,
 beginM50ProcessPair as begin,finishM50ProcessPair as finish,
 createM50ProcessContinuityReport as create,
 verifyM50ProcessContinuityReport as verify,
 compareM50AgainstM46M49 as compare}
 from './auto-x11-m50-process-continuity.mjs';
import {createM47RendererReference} from './auto-x11-m47-renderer-reference.mjs';
import {createM48NamespaceReference} from './auto-x11-m48-namespace-relation.mjs';
import {createM49RendererPrivilegeReference} from './auto-x11-m49-renderer-privilege.mjs';
import {createM46ABAIntake} from './auto-x11-m46-external-aba-intake.mjs';

const BAD=/M50_PROCESS_BIRTHMARKER_REFUSED/;
const labels=['packaged-main','xvfb-gnome-label','xvfb-kde-label'];
const copy=x=>JSON.parse(JSON.stringify(x));
function stat(pid=345,marker='12345678',comm='OMSI (renderer) tricky'){
 const fields=['S',...Array(18).fill('0'),marker,...Array(20).fill('0')];
 return String(pid)+' ('+comm+') '+fields.join(' ')+'\n';
}
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
  observations:labels.map(label=>({label,evidence:{...evidence}}))
 });
}
function m48(v47){
 return createM48NamespaceReference({
  runner:'ubuntu-22.04',desktopContext:'xvfb-synthetic-gnome-kde-labels',
  m47:v47,samples:labels.map(label=>({
   label,relation:{userNamespace:'different',mountNamespace:'same'}
  }))
 });
}
function m49(v47,v48){
 return createM49RendererPrivilegeReference({
  runner:'ubuntu-22.04',desktopContext:'xvfb-synthetic-gnome-kde-labels',
  m47:v47,m48:v48,samples:labels.map(label=>({
   label,privileges:{effectiveCapabilities:'none',permittedCapabilities:'none',
    ambientCapabilities:'none',tracer:'not-traced',seccompFilters:'positive'}
  }))
 });
}
function m46(){
 return createM46ABAIntake({externalPilot:null,m45:{
  schema:'M45_OPERATOR_READINESS_HANDOFF_V1',
  source:'validated-sanitized-m40-m44-reports-from-fixed-ci-artifact-names',
  status:'repeated-host-contrast-for-administrator-review-only',
  m42HostContrast:true,m43WindowContrast:true,m44StderrContrast:true,
  ubuntu22MappedOutOfThree:3,ubuntu24MappedOutOfThree:0,
  ubuntu24SIGTRAPOutOfThree:3,ubuntu24StderrCategory:'generic-fatal-message',
  reviewRequestedOnly:true,blockers:[
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
  sandboxBypassApplied:false,realModRead:false,installationAuthorized:false,
  mergeAuthorized:false,releaseAuthorized:false
 }});
}
function fixture(){
 const v47=m47(),v48=m48(v47),v49=m49(v47,v48);
 return {runner:'ubuntu-22.04',desktopContext:'xvfb-synthetic-gnome-kde-labels',
  m47:v47,m48:v48,m49:v49,
  samples:labels.map(label=>({label,continuity:{
   mainKernelBirthMarkerMatched:true,
   rendererKernelBirthMarkerMatched:true,
   opaqueOneTimeProofConsumed:true
  }}))
 };
}
test('read-only stat parser selects Linux field 22 after a parenthesized comm',()=>{
 assert.equal(parse(stat(),345),'12345678');
});
test('embedded parentheses and whitespace in comm do not shift field 22',()=>{
 assert.equal(parse(stat(345,'87654321','(odd ) worker) A (x)'),345),'87654321');
});
test('stat parser reads a large unsigned tick exactly as a string',()=>{
 assert.equal(parse(stat(345,'18446744073709551615'),345),'18446744073709551615');
});
test('wrong PID, missing closing delimiter or invalid state fail closed',()=>{
 for(const input of [
  stat(346),stat().replace('345 (','345 '),
  stat().replace(') S ',') ? '),
  stat().replace('345 (','345 [bad ('),
  stat().replace(') S ',') ST ')
 ])assert.throws(()=>parse(input,345),BAD);
});
test('missing, malformed or zero start time cannot establish continuity',()=>{
 for(const tick of ['0','0000000','n/a','-1','1.2',
  '1'.repeat(21),''])assert.throws(()=>parse(stat(345,tick),345),BAD);
 const x=stat(345).replace(' 12345678 ',' ');
 assert.throws(()=>parse(x,345),BAD);
});
test('oversized status, hidden newline, carriage return and NUL refuse',()=>{
 for(const input of [stat().slice(0,-1),stat().replace('345 (','345 (\n'),
  stat()+'\n',stat().replace('12345678','12345678\0'),
  stat().replace('12345678','12345678\r'),
  'A'.repeat(5000)])assert.throws(()=>parse(input,345),BAD);
});
test('stat parser refuses unsafe PID parameters and confusing leading values',()=>{
 for(const id of [null,-1,0,1,1.5,'345',2147483648])
  assert.throws(()=>parse(stat(345),id),BAD);
 assert.throws(()=>parse('0345'+stat(345).slice(3),345),BAD);
});
test('real snapshot cannot be fabricated by a caller-provided boolean proof',async()=>{
 for(const forged of [null,{},[],{kind:'M50_IN_MEMORY_PROCESS_PAIR_V1'}])
  await assert.rejects(finish(forged,345,346),BAD);
});
test('live pair API refuses same PID and invalid process ID before any filesystem read',async()=>{
 for(const [a,b] of [[2,2],[-1,3],[3,-1],[null,6],
  [7,7.3],['345',346],[2147483648,4]])
  await assert.rejects(begin(a,b),BAD);
});
test('categorical M50 output retains exactly three fixed launch scenarios',()=>{
 const out=create(fixture());
 assert.deepEqual(out.observations.map(r=>r.label),labels);
 assert.equal(out.verifiedPairs,3);
 assert.equal(out.allStartTickReadingsMatched,true);
 assert.equal(verify(out),out);
});
test('a missing or forged main/renderer birth marker refuses the whole report',()=>{
 for(const key of ['mainKernelBirthMarkerMatched',
  'rendererKernelBirthMarkerMatched','opaqueOneTimeProofConsumed']){
  const x=fixture();x.samples[1].continuity[key]=false;
  assert.throws(()=>create(x),BAD);
 }
});
test('extra fields, hidden PIDs, duplicate rows and reordered labels refuse',()=>{
 for(const f of [
  x=>{x.samples[0].pid=456;},
  x=>{x.samples[1].continuity.rawStarttime='123';},
  x=>{x.samples.pop();},
  x=>{x.samples.push(x.samples[0]);},
  x=>{x.samples.reverse();},
  x=>{x.runner='ubuntu-24.04';}
 ]){
  const x=copy(fixture());f(x);
  assert.throws(()=>create(x),BAD);
 }
});
test('mismatched M47 M48 M49 runner or renderer identity never passes',()=>{
 for(const f of [
  x=>{x.m47.scenarios[0].rendererRoleConfirmed=false;},
  x=>{x.m48.observations[0].label='KDE';},
  x=>{x.m49.runner='ubuntu-24.04';},
  x=>{x.m49.observations[1].label='other';}
 ]){
  const x=copy(fixture());f(x);
  assert.throws(()=>create(x),BAD);
 }
});
test('falsified sandbox, AppArmor, native gate or merge certification refuses',()=>{
 for(const field of ['pidRecyclingCompletelyRuledOut',
  'chromiumSandboxIndependentlyCertified','rendererIsolationIndependentlyCertified',
  'appArmorCausalityProven','actualGnomeKdeDesktopSessionsVerified',
  'ubuntu24RendererObserved','ubuntu24NativeGatePassed','ubuntu24GateWaived',
  'hostPolicyChanged','sandboxBypassApplied','installationAuthorized',
  'mergeAuthorized','releaseAuthorized']){
  const r=copy(create(fixture()));r[field]=true;
  assert.throws(()=>verify(r),BAD,field);
 }
});
test('output never exposes main/renderer PIDs, raw ticks or private paths',()=>{
 const out=JSON.stringify(create(fixture()));
 for(const secret of ['12345678','/proc/','/home/','345 (','creationTime',
  'starttimeRaw','rawComm','personalToken','--no-sandbox'])
  assert.equal(out.includes(secret),false,secret);
});
test('M50 M46–M49 reconciliation never authorizes Ubuntu24 rollout',()=>{
 const x=fixture(),m50=create(x);
 const out=compare({m46:m46(),m47:x.m47,m48:x.m48,m49:x.m49,m50});
 assert.equal(out.category,
  'ubuntu22-sampled-process-continuity-ubuntu24-unverified');
 assert.equal(out.rendererBirthMarkersMatched,3);
 assert.equal(out.mainProcessBirthMarkersMatched,3);
 assert.equal(out.pidRecyclingAbsolutelyExcluded,false);
 assert.equal(out.ubuntu24StrictNativeGatePassed,false);
 assert.equal(out.mergeAuthorized,false);
});
test('forged external pilot, changed Linux status, partial proof all refuse',()=>{
 const x=fixture(),original={m46:m46(),m47:x.m47,m48:x.m48,
  m49:x.m49,m50:create(x)};
 for(const f of [
  z=>{z.m46.externalPilotRecordPresent=true;},
  z=>{z.m46.rendererSandboxIndependentlyVerified=true;},
  z=>{z.m49.observations[0].effectiveCapabilities='present';},
  z=>{z.m50.observations[0].rendererKernelBirthMarkerMatched=false;},
  z=>{z.extraSecret='/home/secret';}
 ]){
  const n=copy(original);f(n);
  assert.throws(()=>compare(n),BAD);
 }
});
test('standalone CLI without CI context rejects before opening any live files',()=>{
 const z=spawnSync(process.execPath,['./auto-x11-m50-process-continuity.mjs'],{
  cwd:new URL('.',import.meta.url).pathname,
  env:{CI:'false',GITHUB_ACTIONS:'false',PATH:'/usr/bin:/bin'},
  encoding:'utf8',timeout:4000,maxBuffer:1024
 });
 assert.equal(z.status,1);
 assert.equal(z.stdout,'');
 assert.match(z.stderr,BAD);
});
