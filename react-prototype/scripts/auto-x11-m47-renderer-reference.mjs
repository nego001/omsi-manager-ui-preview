// M47: sanitized reference from *real* packaged Chromium renderer observations
// on a disposable Ubuntu 22.04 Xvfb job. Three labels != three real desktops.
// Never classify any Ubuntu 24.04 sandbox as certified.
import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyM46ABAIntake} from './auto-x11-m46-external-aba-intake.mjs';
const REFUSE='M47_RENDERER_MATRIX_REFUSED';
const refuse=()=>{throw Error(REFUSE);};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,fields)=>plain(x)&&Object.keys(x).length===fields.length&&
 fields.every(k=>Object.hasOwn(x,k));
const LABELS=Object.freeze(['packaged-main','xvfb-gnome-label','xvfb-kde-label']);
const ROLES=Object.freeze([
 'renderer-process-command-line-only',
 'electron-metrics-and-process-command-line',
 'electron-tab-metric-and-zygote-fork-cmdline'
]);
const APPARMOR=Object.freeze([
 'unavailable','unknown','unconfined','enforce-label-observed',
 'complain-label-observed','kill-label-observed'
]);
const RUNTIME_FIELDS=Object.freeze([
 'schema','processRole','commandLineSandboxBypassDetected','seccompMode',
 'noNewPrivs','apparmorRendererLabelCategory','apparmorTargetPolicyIndependentlyVerified',
 'category','runtimeRendererIdentityChecked','roleEvidence',
 'fullElectronSandboxCertified','userNamespaceIsolationCertified',
 'apparmorCausalityProven','hostPolicyChanged','gameContentRead'
]);
const HARD_FALSE=Object.freeze([
 'chromiumRendererSandboxCertified','userNamespaceIsolationCertified',
 'appSpecificAppArmorPolicyVerified','realGnomeKdeDesktopCertified',
 'ubuntu24StrictNativeGatePassed','ubuntu24GateWaived',
 'hostPolicyChanged','sandboxBypassApplied','realModRead',
 'installationAuthorized','mergeAuthorized','releaseAuthorized'
]);
const SCENARIO_FIELDS=Object.freeze([
 'label','classification','seccompMode','noNewPrivs',
 'roleEvidence','apparmorRendererLabelCategory',
 'rendererRoleConfirmed','rawProcessFieldsDiscarded'
]);
const REPORT_FIELDS=Object.freeze([
 'schema','source','runner','desktopContext','status',
 'scenarios','observedRendererCount','sameCICommitContextOnly',
 'independentlyAttestedPackageOrigin','mainProcessIsNotRendererProof',
 ...HARD_FALSE
]);
function runtimeEvidence(x){
 if(!exact(x,RUNTIME_FIELDS)||
    x.schema!=='ELECTRON_PACKAGED_RENDERER_KERNEL_EVIDENCE_V1'||
    x.processRole!=='renderer'||
    x.commandLineSandboxBypassDetected!==false||
    !['filter','strict','off'].includes(x.seccompMode)||
    !['enabled','disabled'].includes(x.noNewPrivs)||
    !APPARMOR.includes(x.apparmorRendererLabelCategory)||
    !ROLES.includes(x.roleEvidence)||
    !['renderer-kernel-restrictions-observed','renderer-kernel-restrictions-incomplete'].includes(x.category)||
    x.runtimeRendererIdentityChecked!==true||
    ['apparmorTargetPolicyIndependentlyVerified','fullElectronSandboxCertified',
     'userNamespaceIsolationCertified','apparmorCausalityProven',
     'hostPolicyChanged','gameContentRead'].some(k=>x[k]!==false)||
    x.category!==(x.seccompMode==='filter'&&x.noNewPrivs==='enabled'?
      'renderer-kernel-restrictions-observed':'renderer-kernel-restrictions-incomplete'))refuse();
 return x;
}
function scenario(x,label){
 if(!exact(x,['label','evidence'])||x.label!==label)refuse();
 const r=runtimeEvidence(x.evidence);
 if(r.category!=='renderer-kernel-restrictions-observed')refuse();
 return Object.freeze({
  label,
  classification:'renderer-kernel-restrictions-observed',
  seccompMode:r.seccompMode,noNewPrivs:r.noNewPrivs,
  roleEvidence:r.roleEvidence,
  apparmorRendererLabelCategory:r.apparmorRendererLabelCategory,
  rendererRoleConfirmed:true,rawProcessFieldsDiscarded:true
 });
}
export function createM47RendererReference(input){
 if(!exact(input,['runner','desktopContext','observations'])||
    input.runner!=='ubuntu-22.04'||input.desktopContext!=='xvfb-synthetic-gnome-kde-labels'||
    !Array.isArray(input.observations)||input.observations.length!==3)refuse();
 const observed=input.observations.map((x,i)=>scenario(x,LABELS[i]));
 return verifyM47RendererReference(Object.freeze({
  schema:'M47_UBUNTU22_RENDERER_KERNEL_REFERENCE_V1',
  source:'three-process-owned-packaged-electron-tests-proc-read-only',
  runner:input.runner,desktopContext:input.desktopContext,
  status:'three-xvfb-renderer-kernel-restrictions-observed-not-certified',
  scenarios:Object.freeze(observed),
  observedRendererCount:3,
  sameCICommitContextOnly:true,
  independentlyAttestedPackageOrigin:false,
  mainProcessIsNotRendererProof:true,
  ...Object.fromEntries(HARD_FALSE.map(k=>[k,false]))
 }));
}
export function verifyM47RendererReference(r){
 if(!exact(r,REPORT_FIELDS)||
    r.schema!=='M47_UBUNTU22_RENDERER_KERNEL_REFERENCE_V1'||
    r.source!=='three-process-owned-packaged-electron-tests-proc-read-only'||
    r.runner!=='ubuntu-22.04'||
    r.desktopContext!=='xvfb-synthetic-gnome-kde-labels'||
    r.status!=='three-xvfb-renderer-kernel-restrictions-observed-not-certified'||
    !Array.isArray(r.scenarios)||r.scenarios.length!==3||
    r.observedRendererCount!==3||
    r.sameCICommitContextOnly!==true||
    r.independentlyAttestedPackageOrigin!==false||
    r.mainProcessIsNotRendererProof!==true||
    HARD_FALSE.some(k=>r[k]!==false))refuse();
 for(let i=0;i<3;i++){
  const s=r.scenarios[i];
  if(!exact(s,SCENARIO_FIELDS)||s.label!==LABELS[i]||
     s.classification!=='renderer-kernel-restrictions-observed'||
     s.seccompMode!=='filter'||s.noNewPrivs!=='enabled'||
     !ROLES.includes(s.roleEvidence)||!APPARMOR.includes(s.apparmorRendererLabelCategory)||
     s.rendererRoleConfirmed!==true||
     s.rawProcessFieldsDiscarded!==true)refuse();
 }
 return r;
}
// Additional CI step consumes only fixed-name sanitized reports, no host access.
export function compareM47ReferenceWithM46(input){
 if(!exact(input,['m46','m47']))refuse();
 let r;
 try{r=verifyM47RendererReference(input.m47);}catch{refuse();}
 const m=input.m46;
 try{verifyM46ABAIntake(m);}catch{refuse();}
 if(m.status!=='awaiting-admin-authorization-and-external-aba-records'||
    m.externalPilotRecordPresent!==false||
    m.m45ReviewRequested!==true||
    m.humanReportedAbaClassification!=='not-provided'||
    m.rendererSandboxIndependentlyVerified!==false||
    m.nativeUbuntu24StrictCIPassed!==false||
    m.mergeAuthorized!==false||m.releaseAuthorized!==false||
    m.installationAuthorized!==false||
    m.evidenceSourceIndependentOfCI!==false||
    m.humanPilotAuthenticated!==false||
    r.observedRendererCount!==3)refuse();
 return Object.freeze({
  schema:'M47_RENDERER_REFERENCE_VS_M46_PILOT_READINESS_V1',
  classification:'ubuntu22-xvfb-kernel-reference-only-ubuntu24-unverified',
  ubuntu22RendererSamplesObserved:3,
  ubuntu24ExternalAbaRecordPresent:false,
  actualGnomeKdeSessionsVerified:false,
  ubuntu24RendererSandboxIndependentlyVerified:false,
  appArmorCauseEstablished:false,
  ubuntu24NativeGatePassed:false,ubuntu24GateWaived:false,
  hostSecurityPolicyChanged:false,realModRead:false,
  installationAuthorized:false,mergeAuthorized:false,releaseAuthorized:false
 });
}
function main(){
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.RUNNER_OS!=='Linux')refuse();
 const base=resolve('test-results');
 const read=(sub,name)=>{
  const file=resolve(base,sub,name);
  if(!file.startsWith(base+sep))refuse();
  const bytes=readFileSync(file);
  if(bytes.length<5||bytes.length>8192)refuse();
  try{return JSON.parse(bytes.toString('utf8'));}catch{refuse();}
 };
 const r=compareM47ReferenceWithM46({
  m46:read('m46','operator-aba-intake.json'),
  m47:read('m47','renderer-reference.json')
 });
 console.log('M47_RENDERER_REFERENCE_COMPARISON',JSON.stringify(r));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main();}catch{console.error(REFUSE);process.exitCode=1;}
}
