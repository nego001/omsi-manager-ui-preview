// M48: read-only cross-process namespace relations for the exact CI-packaged
// Electron main process and its Electron-metrics-identified renderer.
// A DIFFERENT namespace is not a Chromium sandbox certification; a SAME
// namespace is not proof of an escape or necessarily a failure.
// No raw inodes, PIDs, paths, argv, private labels or log lines are retained.
import {readlink} from 'node:fs/promises';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyM47RendererReference} from './auto-x11-m47-renderer-reference.mjs';
import {verifyM46ABAIntake} from './auto-x11-m46-external-aba-intake.mjs';

const BAD='M48_NAMESPACE_RELATION_REFUSED';
const deny=()=>{throw Error(BAD);};
const LABELS=Object.freeze(['packaged-main','xvfb-gnome-label','xvfb-kde-label']);
const RELATIONS=Object.freeze(['same','different','unavailable']);
const validPid=n=>Number.isSafeInteger(n)&&n>1&&n<=2147483647;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,fields)=>plain(x)&&Object.keys(x).length===fields.length&&
 fields.every(k=>Object.hasOwn(x,k));
const RELATION_FIELDS=Object.freeze(['userNamespace','mountNamespace']);
const OBS_FIELDS=Object.freeze(['label','userNamespace','mountNamespace',
 'rendererRoleVerifiedByExistingM47','mainAndRendererPidsNotPersisted']);
const FALSE_FLAGS=Object.freeze([
 'chromiumSandboxIndependentlyCertified',
 'namespaceIsolationIndependentlyCertified',
 'appArmorCauseProven',
 'actualGnomeKdeDesktopCertified',
 'ubuntu24RendererNamespaceObserved',
 'ubuntu24StrictNativeGatePassed',
 'nativeGateWaived','hostPolicyChanged','sandboxBypassApplied',
 'realModRead','installationAuthorized','mergeAuthorized','releaseAuthorized'
]);
const REPORT_FIELDS=Object.freeze([
 'schema','source','runner','desktopContext','status',
 'observations','rendererSamples',
 'userNamespaceSameCount','userNamespaceDifferentCount',
 'userNamespaceUnavailableCount','mountNamespaceSameCount',
 'mountNamespaceDifferentCount','mountNamespaceUnavailableCount',
 'comparisonWithMainProcessOnly','readOnlyProcNamespaceSymlinks',
 'rawNamespaceInodesPersisted','rawPidsPersisted',
 'sameCiArtifactButNoIndependentAuthenticity',
 ...FALSE_FLAGS
]);
const nsPattern=kind=>new RegExp('^'+kind+':\\[[0-9]{1,20}\\]$');
const compare=(a,b,kind)=>{
 if(typeof a!=='string'||typeof b!=='string'||
    !nsPattern(kind).test(a)||!nsPattern(kind).test(b))
  return 'unavailable';
 return a===b?'same':'different';
};
// Pure classifier for adversarial synthetic tests; raw symlinks never leave
// the caller on production runs. Malformed link targets become "unavailable".
export function classifyM48NamespaceLinks(input){
 if(!exact(input,['main','renderer'])||
    !exact(input.main,['user','mnt'])||
    !exact(input.renderer,['user','mnt'])||
    ['user','mnt'].some(k=>vTooBig(input.main[k])||vTooBig(input.renderer[k])))deny();
 return Object.freeze({
  userNamespace:compare(input.main.user,input.renderer.user,'user'),
  mountNamespace:compare(input.main.mnt,input.renderer.mnt,'mnt')
 });
}
function vTooBig(x){return x!==null&&
 (typeof x!=='string'||x.length>64);}
// One live observation: only namespace symlink *identities* are read, and
// discarded as soon as same/different/unavailable categories are computed.
// The parent caller checks the Electron process identity/PID before and after.
export async function probeM48NamespaceRelation(mainPid,rendererPid){
 if(process.platform!=='linux'||process.getuid?.()===0||
    !validPid(mainPid)||!validPid(rendererPid)||mainPid===rendererPid)deny();
 const link=async(pid,kind)=>{
  try{return await readlink('/proc/'+pid+'/ns/'+kind);}
  catch{return null;}
 };
 const [a,b,c,d]=await Promise.all([
  link(mainPid,'user'),link(mainPid,'mnt'),
  link(rendererPid,'user'),link(rendererPid,'mnt')
 ]);
 return classifyM48NamespaceLinks({
  main:{user:a,mnt:b},renderer:{user:c,mnt:d}
 });
}
export function createM48NamespaceReference(input){
 if(!exact(input,['runner','desktopContext','m47','samples'])||
    input.runner!=='ubuntu-22.04'||
    input.desktopContext!=='xvfb-synthetic-gnome-kde-labels'||
    !Array.isArray(input.samples)||input.samples.length!==3)deny();
 let m47;
 try{m47=verifyM47RendererReference(input.m47);}catch{deny();}
 if(m47.runner!==input.runner||m47.desktopContext!==input.desktopContext)deny();
 const observations=input.samples.map((s,i)=>{
  if(!exact(s,['label','relation'])||s.label!==LABELS[i]||
     !exact(s.relation,RELATION_FIELDS)||
     !RELATIONS.includes(s.relation.userNamespace)||
     !RELATIONS.includes(s.relation.mountNamespace)||
     m47.scenarios[i].label!==s.label||
     m47.scenarios[i].rendererRoleConfirmed!==true)deny();
  return Object.freeze({
   label:s.label,
   userNamespace:s.relation.userNamespace,
   mountNamespace:s.relation.mountNamespace,
   rendererRoleVerifiedByExistingM47:true,
   mainAndRendererPidsNotPersisted:true
  });
 });
 const count=(kind,val)=>observations.filter(x=>x[kind]===val).length;
 const anyUnavailable=observations.some(x=>
  x.userNamespace==='unavailable'||x.mountNamespace==='unavailable');
 const report={
  schema:'M48_PACKAGED_RENDERER_NS_RELATION_V1',
  source:'real-ubuntu22-packaged-electron-main-vs-renderer-proc-namespace-links',
  runner:input.runner,desktopContext:input.desktopContext,
  status:anyUnavailable?'partial-namespace-links-unavailable-no-certification':
   'three-readonly-namespace-pairs-observed-no-certification',
  observations:Object.freeze(observations),rendererSamples:3,
  userNamespaceSameCount:count('userNamespace','same'),
  userNamespaceDifferentCount:count('userNamespace','different'),
  userNamespaceUnavailableCount:count('userNamespace','unavailable'),
  mountNamespaceSameCount:count('mountNamespace','same'),
  mountNamespaceDifferentCount:count('mountNamespace','different'),
  mountNamespaceUnavailableCount:count('mountNamespace','unavailable'),
  comparisonWithMainProcessOnly:true,
  readOnlyProcNamespaceSymlinks:true,
  rawNamespaceInodesPersisted:false,
  rawPidsPersisted:false,
  sameCiArtifactButNoIndependentAuthenticity:true,
  ...Object.fromEntries(FALSE_FLAGS.map(k=>[k,false]))
 };
 return verifyM48NamespaceReference(Object.freeze(report));
}
export function verifyM48NamespaceReference(r){
 if(!exact(r,REPORT_FIELDS)||
    r.schema!=='M48_PACKAGED_RENDERER_NS_RELATION_V1'||
    r.source!=='real-ubuntu22-packaged-electron-main-vs-renderer-proc-namespace-links'||
    r.runner!=='ubuntu-22.04'||
    r.desktopContext!=='xvfb-synthetic-gnome-kde-labels'||
    !Array.isArray(r.observations)||r.observations.length!==3||
    r.rendererSamples!==3||
    r.comparisonWithMainProcessOnly!==true||
    r.readOnlyProcNamespaceSymlinks!==true||
    r.rawNamespaceInodesPersisted!==false||
    r.rawPidsPersisted!==false||
    r.sameCiArtifactButNoIndependentAuthenticity!==true||
    FALSE_FLAGS.some(k=>r[k]!==false))deny();
 for(let i=0;i<3;i++){
  const x=r.observations[i];
  if(!exact(x,OBS_FIELDS)||x.label!==LABELS[i]||
     !RELATIONS.includes(x.userNamespace)||!RELATIONS.includes(x.mountNamespace)||
     x.rendererRoleVerifiedByExistingM47!==true||
     x.mainAndRendererPidsNotPersisted!==true)deny();
 }
 for(const [kind,prefix] of [['userNamespace','userNamespace'],
    ['mountNamespace','mountNamespace']]){
  let total=0;
  for(const [cat,suffix] of [['same','SameCount'],['different','DifferentCount'],
      ['unavailable','UnavailableCount']]){
   const wanted=r.observations.filter(x=>x[kind]===cat).length;
   if(r[prefix+suffix]!==wanted)deny();
   total+=wanted;
  }
  if(total!==3)deny();
 }
 const unavailable=r.observations.some(x=>
  x.userNamespace==='unavailable'||x.mountNamespace==='unavailable');
 if(r.status!==(unavailable?'partial-namespace-links-unavailable-no-certification':
     'three-readonly-namespace-pairs-observed-no-certification'))deny();
 return r;
}
export function compareM48AgainstM47AndM46(input){
 if(!exact(input,['m46','m47','m48']))deny();
 let m46,m47,m48;
 try{
  m46=verifyM46ABAIntake(input.m46);
  m47=verifyM47RendererReference(input.m47);
  m48=verifyM48NamespaceReference(input.m48);
 }catch{deny();}
 if(m46.status!=='awaiting-admin-authorization-and-external-aba-records'||
    m46.m45ReviewRequested!==true||m46.externalPilotRecordPresent!==false||
    m46.humanPilotAuthenticated!==false||
    m46.rendererSandboxIndependentlyVerified!==false||
    m46.nativeUbuntu24StrictCIPassed!==false||
    m47.runner!==m48.runner||m47.desktopContext!==m48.desktopContext||
    m47.scenarios.length!==m48.observations.length||
    m47.scenarios.some((s,i)=>s.label!==m48.observations[i].label||
     s.rendererRoleConfirmed!==true)||m48.rendererSamples!==3)deny();
 return Object.freeze({
  schema:'M48_UBUNTU22_NAMESPACE_REFERENCE_VS_M46_V1',
  classification:'ubuntu22-namespace-relations-only-ubuntu24-native-still-blocked',
  ubuntu22RendererSamplesObserved:3,
  ubuntu22UserNamespaceDifferences:m48.userNamespaceDifferentCount,
  ubuntu22UserNamespaceUnavailable:m48.userNamespaceUnavailableCount,
  ubuntu22MountNamespaceDifferences:m48.mountNamespaceDifferentCount,
  ubuntu22MountNamespaceUnavailable:m48.mountNamespaceUnavailableCount,
  ubuntu24SandboxIndependentlyCertified:false,
  namespaceDifferencesProveSandbox:false,
  absenceOfDifferencesProvesSandboxFailure:false,
  appArmorCausalityProven:false,
  realGnomeKdeDesktopsTested:false,
  externalAbaPilotPerformed:false,
  ubuntu24NativeGatePassed:false,ubuntu24GateWaived:false,
  hostPolicyChanged:false,sandboxBypassApplied:false,
  installationAuthorized:false,mergeAuthorized:false,releaseAuthorized:false
 });
}
function main(){
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.RUNNER_OS!=='Linux')deny();
 const load=(sub,file)=>{
  const dir=resolve('test-results/'+sub);
  const path=resolve(dir,file);
  if(!path.startsWith(dir+sep))deny();
  const bytes=readFileSync(path);
  if(bytes.length<3||bytes.length>8192)deny();
  try{return JSON.parse(bytes.toString('utf8'));}catch{deny();}
 };
 const r=compareM48AgainstM47AndM46({
  m46:load('m46','operator-aba-intake.json'),
  m47:load('m47','renderer-reference.json'),
  m48:load('m48','renderer-namespace-relations.json')
 });
 console.log('M48_NAMESPACE_RELATION_REVIEW',JSON.stringify(r));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main();}catch{console.error(BAD);process.exitCode=1;}
}
