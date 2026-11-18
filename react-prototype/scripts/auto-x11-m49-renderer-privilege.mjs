// M49 — actual Ubuntu22 packaged Electron renderer /proc status *categories*.
// Effective/permitted/ambient capabilities, tracing and seccomp filter count.
// No raw status, capability masks, PIDs, paths, credentials or host mutations.
// Even all-zero capabilities and positive filters NEVER certify Chromium sandbox.
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyM47RendererReference} from './auto-x11-m47-renderer-reference.mjs';
import {verifyM48NamespaceReference} from './auto-x11-m48-namespace-relation.mjs';
import {verifyM46ABAIntake} from './auto-x11-m46-external-aba-intake.mjs';

const REFUSE='M49_RENDERER_PRIVILEGE_REFUSED';
const deny=()=>{throw Error(REFUSE);};
const LABELS=Object.freeze(['packaged-main','xvfb-gnome-label','xvfb-kde-label']);
const FIELDS=Object.freeze(['effectiveCapabilities','permittedCapabilities',
 'ambientCapabilities','tracer','seccompFilters']);
const SAMPLE_FIELDS=Object.freeze(['label','privileges']);
const ROW_FIELDS=Object.freeze(['label',...FIELDS,
 'rendererIdentityValidatedByM47','originalProcValuesDiscarded']);
const FALSE_FIELDS=Object.freeze([
 'chromiumRendererSandboxIndependentlyCertified',
 'userNamespaceIsolationCertified','apparmorCausalityProven',
 'realGnomeKdeDesktopSessionsCertified','ubuntu24RendererPrivilegeObserved',
 'ubuntu24StrictNativeGatePassed','ubuntu24GateWaived',
 'hostPolicyChanged','sandboxBypassApplied','realModRead',
 'installationAuthorized','mergeAuthorized','releaseAuthorized'
]);
const REPORT_FIELDS=Object.freeze([
 'schema','source','runner','desktopContext','status','observations',
 'rendererSamples','allEffectiveCapabilitiesAbsent',
 'allPermittedCapabilitiesAbsent','allAmbientCapabilitiesAbsent',
 'allTracersAbsent','allPositiveSeccompFilterCountsObserved',
 'actualRendererPidStabilityCheckedByCaller','rawCapabilityMasksRetained',
 'rawProcStatusRetained','rawPidsRetained',
 ...FALSE_FIELDS
]);
const isPlain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,fields)=>isPlain(x)&&Object.keys(x).length===fields.length&&
 fields.every(k=>Object.hasOwn(x,k));
const pidOK=x=>Number.isSafeInteger(x)&&x>1&&x<=2147483647;
const row=(raw,name)=>{
 const found=[...raw.matchAll(new RegExp('^'+name+':[ \\t]*([^\\r\\n]+)$','gm'))];
 if(found.length!==1)deny();
 return found[0][1].trim();
};
function capability(v){
 if(!/^[A-Fa-f0-9]{16}$/.test(v))deny();
 return /^0{16}$/.test(v)?'none':'present';
}
function intCategory(v,kind){
 if(!/^(0|[1-9][0-9]{0,9})$/.test(v))deny();
 const n=Number(v);
 if(!Number.isSafeInteger(n)||n>2147483647)deny();
 if(kind==='tracer')return n===0?'not-traced':'tracer-present';
 if(kind==='filter')return n>0?'positive':'zero';
 deny();
}
export function classifyM49ProcStatus(raw){
 if(typeof raw!=='string'||raw.length<30||raw.length>65536||
    raw.includes('\0')||raw.includes('\r'))deny();
 const seccomp=row(raw,'Seccomp');
 const nnp=row(raw,'NoNewPrivs');
 if(seccomp!=='2'||nnp!=='1')deny();
 const classified={
  effectiveCapabilities:capability(row(raw,'CapEff')),
  permittedCapabilities:capability(row(raw,'CapPrm')),
  ambientCapabilities:capability(row(raw,'CapAmb')),
  tracer:intCategory(row(raw,'TracerPid'),'tracer'),
  seccompFilters:intCategory(row(raw,'Seccomp_filters'),'filter')
 };
 return Object.freeze(classified);
}
export async function probeM49RendererPrivilegeStatus(pid){
 if(process.platform!=='linux'||process.getuid?.()===0||!pidOK(pid))deny();
 let raw;
 try{raw=await readFile('/proc/'+pid+'/status','utf8');}
 catch{deny();}
 return classifyM49ProcStatus(raw);
}
export function createM49RendererPrivilegeReference(input){
 if(!exact(input,['runner','desktopContext','m47','m48','samples'])||
    input.runner!=='ubuntu-22.04'||
    input.desktopContext!=='xvfb-synthetic-gnome-kde-labels'||
    !Array.isArray(input.samples)||input.samples.length!==3)deny();
 let m47,m48;
 try{
  m47=verifyM47RendererReference(input.m47);
  m48=verifyM48NamespaceReference(input.m48);
 }catch{deny();}
 if(m47.runner!==input.runner||m48.runner!==input.runner||
    m47.desktopContext!==input.desktopContext||
    m48.desktopContext!==input.desktopContext)deny();
 const observations=input.samples.map((s,i)=>{
  if(!exact(s,SAMPLE_FIELDS)||s.label!==LABELS[i]||
    m47.scenarios[i].label!==s.label||
    m48.observations[i].label!==s.label||
    m47.scenarios[i].rendererRoleConfirmed!==true||
    m47.scenarios[i].seccompMode!=='filter'||
    m47.scenarios[i].noNewPrivs!=='enabled'||
    !exact(s.privileges,FIELDS)||
    !['none','present'].includes(s.privileges.effectiveCapabilities)||
    !['none','present'].includes(s.privileges.permittedCapabilities)||
    !['none','present'].includes(s.privileges.ambientCapabilities)||
    !['not-traced','tracer-present'].includes(s.privileges.tracer)||
    !['positive','zero'].includes(s.privileges.seccompFilters))deny();
  return Object.freeze({
   label:s.label,
   ...s.privileges,
   rendererIdentityValidatedByM47:true,
   originalProcValuesDiscarded:true
  });
 });
 // Failure here preserves the red required CI gate; there is no permissive
 // alternative when the renderer is traced, privileged or unfiltered.
 if(observations.some(s=>s.effectiveCapabilities!=='none'||
   s.permittedCapabilities!=='none'||s.ambientCapabilities!=='none'||
   s.tracer!=='not-traced'||s.seccompFilters!=='positive'))deny();
 return verifyM49RendererPrivilegeReference(Object.freeze({
  schema:'M49_UBUNTU22_RENDERER_PRIVILEGE_REFERENCE_V1',
  source:'actual-packaged-electron-renderer-proc-status-categories-only',
  runner:input.runner,desktopContext:input.desktopContext,
  status:'three-renderers-unprivileged-untraced-filtered-no-certification',
  observations:Object.freeze(observations),rendererSamples:3,
  allEffectiveCapabilitiesAbsent:true,allPermittedCapabilitiesAbsent:true,
  allAmbientCapabilitiesAbsent:true,allTracersAbsent:true,
  allPositiveSeccompFilterCountsObserved:true,
  actualRendererPidStabilityCheckedByCaller:true,
  rawCapabilityMasksRetained:false,rawProcStatusRetained:false,rawPidsRetained:false,
  ...Object.fromEntries(FALSE_FIELDS.map(k=>[k,false]))
 }));
}
export function verifyM49RendererPrivilegeReference(r){
 if(!exact(r,REPORT_FIELDS)||r.schema!=='M49_UBUNTU22_RENDERER_PRIVILEGE_REFERENCE_V1'||
    r.source!=='actual-packaged-electron-renderer-proc-status-categories-only'||
    r.runner!=='ubuntu-22.04'||
    r.desktopContext!=='xvfb-synthetic-gnome-kde-labels'||
    r.status!=='three-renderers-unprivileged-untraced-filtered-no-certification'||
    !Array.isArray(r.observations)||r.observations.length!==3||
    r.rendererSamples!==3||
    ['allEffectiveCapabilitiesAbsent','allPermittedCapabilitiesAbsent',
     'allAmbientCapabilitiesAbsent','allTracersAbsent',
     'allPositiveSeccompFilterCountsObserved',
     'actualRendererPidStabilityCheckedByCaller'].some(k=>r[k]!==true)||
    ['rawCapabilityMasksRetained','rawProcStatusRetained',
     'rawPidsRetained'].some(k=>r[k]!==false)||
    FALSE_FIELDS.some(k=>r[k]!==false))deny();
 for(let i=0;i<3;i++){
  const s=r.observations[i];
  if(!exact(s,ROW_FIELDS)||s.label!==LABELS[i]||
    s.effectiveCapabilities!=='none'||
    s.permittedCapabilities!=='none'||s.ambientCapabilities!=='none'||
    s.tracer!=='not-traced'||s.seccompFilters!=='positive'||
    s.rendererIdentityValidatedByM47!==true||
    s.originalProcValuesDiscarded!==true)deny();
 }
 return r;
}
export function compareM49AgainstM46M47M48(input){
 if(!exact(input,['m46','m47','m48','m49']))deny();
 let m46,m47,m48,m49;
 try{
  m46=verifyM46ABAIntake(input.m46);
  m47=verifyM47RendererReference(input.m47);
  m48=verifyM48NamespaceReference(input.m48);
  m49=verifyM49RendererPrivilegeReference(input.m49);
 }catch{deny();}
 if(m46.status!=='awaiting-admin-authorization-and-external-aba-records'||
    m46.externalPilotRecordPresent!==false||
    m46.nativeUbuntu24StrictCIPassed!==false||
    m46.rendererSandboxIndependentlyVerified!==false||
    m47.runner!==m49.runner||m48.runner!==m49.runner||
    m47.desktopContext!==m49.desktopContext||
    m48.desktopContext!==m49.desktopContext||
    m49.observations.some((s,i)=>
     m47.scenarios[i].label!==s.label||
     m48.observations[i].label!==s.label))deny();
 return Object.freeze({
  schema:'M49_UBUNTU22_PRIVILEGE_VS_M46_PILOT_V1',
  status:'ubuntu22-renderer-privilege-reference-ubuntu24-unverified',
  ubuntu22RendererSamplesObserved:3,
  ubuntu22UnprivilegedUntracedWithFilters:3,
  ubuntu24RendererPrivilegesObserved:false,
  chromiumSandboxIndependentlyCertified:false,
  userNamespaceSecurityCompletenessCertified:false,
  appArmorCausalityProven:false,
  independentAdminPilotExecuted:false,
  nativeUbuntu24GatePassed:false,
  hostPolicyChanged:false,sandboxBypassApplied:false,
  mergeAuthorized:false,installationAuthorized:false,releaseAuthorized:false
 });
}
function main(){
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.RUNNER_OS!=='Linux')deny();
 const load=(dir,name)=>{
  const root=resolve('test-results/'+dir);
  const path=resolve(root,name);
  if(!path.startsWith(root+sep))deny();
  const data=readFileSync(path);
  if(data.length<3||data.length>8192)deny();
  try{return JSON.parse(data.toString('utf8'));}catch{deny();}
 };
 const out=compareM49AgainstM46M47M48({
  m46:load('m46','operator-aba-intake.json'),
  m47:load('m47','renderer-reference.json'),
  m48:load('m48','renderer-namespace-relations.json'),
  m49:load('m49','renderer-privilege-categories.json')
 });
 console.log('M49_RENDERER_PRIVILEGE_COMPARISON',JSON.stringify(out));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main();}catch{console.error(REFUSE);process.exitCode=1;}
}
