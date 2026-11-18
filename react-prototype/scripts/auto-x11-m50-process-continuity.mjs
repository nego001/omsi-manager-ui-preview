// M50 — read-only /proc/<pid>/stat start-time continuity for the exact
// packaged Electron main + Electron-metrics-identified renderer process pair.
// A live PID can be recycled; a repeated PID alone is NOT enough. Compare
// same kernel start-tick token before and after M47–M49 probes, with no output
// of tokens, process IDs, file paths or arguments. This is still a sampled
// continuity check, not independent host or full sandbox attestation.
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyM46ABAIntake} from './auto-x11-m46-external-aba-intake.mjs';
import {verifyM47RendererReference} from './auto-x11-m47-renderer-reference.mjs';
import {verifyM48NamespaceReference} from './auto-x11-m48-namespace-relation.mjs';
import {verifyM49RendererPrivilegeReference} from './auto-x11-m49-renderer-privilege.mjs';

const BAD='M50_PROCESS_BIRTHMARKER_REFUSED';
const refuse=()=>{throw Error(BAD);};
const labels=Object.freeze(['packaged-main','xvfb-gnome-label','xvfb-kde-label']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const pidOK=pid=>Number.isSafeInteger(pid)&&pid>1&&pid<=2147483647;
const proofData=new WeakMap();
// A stat record has 1:pid, 2:(comm), 3:state, ... 22:starttime.
// The executable name in (comm) may contain parentheses and spaces; find the
// LAST ") " delimiter and take field 22 by position after state (index 19).
// Reject ambiguous or malformed snapshots instead of assuming a birth token.
export function parseM50ProcStartTick(raw,expectedPid){
 if(!pidOK(expectedPid)||typeof raw!=='string'||raw.length<45||
    raw.length>4096||raw.includes('\0')||raw.includes('\r')||
    !raw.endsWith('\n'))refuse();
 const prefix=String(expectedPid)+' (';
 if(!raw.startsWith(prefix))refuse();
 const close=raw.lastIndexOf(') ');
 if(close<=prefix.length||close>512)refuse();
 const comm=raw.slice(prefix.length,close);
 if(comm.length===0||comm.length>256||comm.includes('\n'))refuse();
 const tail=raw.slice(close+2,-1);
 if(tail.includes('\n')||!tail||/^\s|\s$/.test(tail))refuse();
 const columns=tail.split(/\s+/);
 if(columns.length<20||columns.length>128||!/^[A-Za-z]$/.test(columns[0]))
  refuse();
 const birth=columns[19];
 if(!/^[0-9]{1,20}$/.test(birth)||!/[1-9]/.test(birth))
  refuse();
 return birth; // PRIVATE in-memory continuity token; never serialized/logged
}
async function readBirthTick(pid){
 let raw;
 try{raw=await readFile('/proc/'+pid+'/stat','utf8');}catch{refuse();}
 return parseM50ProcStartTick(raw,pid);
}
// The opaque proof object contains no PIDs or start ticks, and cannot be
// reconstituted from JSON. The original start ticks exist only in a WeakMap.
export async function beginM50ProcessPair(mainPid,rendererPid){
 if(process.platform!=='linux'||process.getuid?.()===0||
    !pidOK(mainPid)||!pidOK(rendererPid)||mainPid===rendererPid)refuse();
 const [mainTick,rendererTick]=await Promise.all([
  readBirthTick(mainPid),readBirthTick(rendererPid)
 ]);
 const proof=Object.freeze({kind:'M50_IN_MEMORY_PROCESS_PAIR_V1'});
 proofData.set(proof,{mainPid,rendererPid,mainTick,rendererTick});
 return proof;
}
export async function finishM50ProcessPair(proof,mainPid,rendererPid){
 if(process.platform!=='linux'||process.getuid?.()===0||
    !pidOK(mainPid)||!pidOK(rendererPid)||mainPid===rendererPid||
    !proof||typeof proof!=='object')refuse();
 const stored=proofData.get(proof);
 proofData.delete(proof); // one-shot: cannot replay the same proof
 if(!stored||stored.mainPid!==mainPid||stored.rendererPid!==rendererPid)
  refuse();
 const [mainAfter,rendererAfter]=await Promise.all([
  readBirthTick(mainPid),readBirthTick(rendererPid)
 ]);
 if(mainAfter!==stored.mainTick||rendererAfter!==stored.rendererTick)refuse();
 return Object.freeze({
  mainKernelBirthMarkerMatched:true,
  rendererKernelBirthMarkerMatched:true,
  opaqueOneTimeProofConsumed:true
 });
}
const continuityFields=Object.freeze([
 'mainKernelBirthMarkerMatched','rendererKernelBirthMarkerMatched',
 'opaqueOneTimeProofConsumed'
]);
const falseFields=Object.freeze([
 'pidRecyclingCompletelyRuledOut','chromiumSandboxIndependentlyCertified',
 'rendererIsolationIndependentlyCertified','appArmorCausalityProven',
 'actualGnomeKdeDesktopSessionsVerified','ubuntu24RendererObserved',
 'ubuntu24NativeGatePassed','ubuntu24GateWaived','hostPolicyChanged',
 'sandboxBypassApplied','realModRead','installationAuthorized',
 'mergeAuthorized','releaseAuthorized'
]);
const rowFields=Object.freeze(['label',...continuityFields,
 'electronRendererRolePreviouslyVerified',
 'rawBirthTicksRetained','rawPidsRetained']);
const reportFields=Object.freeze([
 'schema','source','runner','desktopContext','status','observations',
 'verifiedPairs','allStartTickReadingsMatched',
 'm47M48M49SameLauncherScenarios','sampledContinuityNotIndependentAttestation',
 'actualPackageBytesIndependentlyAuthenticated',
 ...falseFields
]);
export function createM50ProcessContinuityReport(input){
 if(!exact(input,['runner','desktopContext','m47','m48','m49','samples'])||
    input.runner!=='ubuntu-22.04'||
    input.desktopContext!=='xvfb-synthetic-gnome-kde-labels'||
    !Array.isArray(input.samples)||input.samples.length!==3)refuse();
 let m47,m48,m49;
 try{
  m47=verifyM47RendererReference(input.m47);
  m48=verifyM48NamespaceReference(input.m48);
  m49=verifyM49RendererPrivilegeReference(input.m49);
 }catch{refuse();}
 if([m47,m48,m49].some(x=>x.runner!==input.runner||
   x.desktopContext!==input.desktopContext))refuse();
 const observations=input.samples.map((s,i)=>{
  if(!exact(s,['label','continuity'])||s.label!==labels[i]||
     m47.scenarios[i].label!==s.label||
     m48.observations[i].label!==s.label||
     m49.observations[i].label!==s.label||
     m47.scenarios[i].rendererRoleConfirmed!==true||
     !exact(s.continuity,continuityFields)||
     continuityFields.some(k=>s.continuity[k]!==true))refuse();
  return Object.freeze({
   label:s.label,
   mainKernelBirthMarkerMatched:true,
   rendererKernelBirthMarkerMatched:true,
   opaqueOneTimeProofConsumed:true,
   electronRendererRolePreviouslyVerified:true,
   rawBirthTicksRetained:false,rawPidsRetained:false
  });
 });
 return verifyM50ProcessContinuityReport(Object.freeze({
  schema:'M50_UBUNTU22_PACKAGED_PROCESS_CONTINUITY_V1',
  source:'read-only-sampled-proc-stat-starttime-on-main-and-renderer',
  runner:input.runner,desktopContext:input.desktopContext,
  status:'three-main-renderer-pairs-starttick-matched-no-certification',
  observations:Object.freeze(observations),
  verifiedPairs:3,allStartTickReadingsMatched:true,
  m47M48M49SameLauncherScenarios:true,
  sampledContinuityNotIndependentAttestation:true,
  actualPackageBytesIndependentlyAuthenticated:false,
  ...Object.fromEntries(falseFields.map(k=>[k,false]))
 }));
}
export function verifyM50ProcessContinuityReport(r){
 if(!exact(r,reportFields)||
   r.schema!=='M50_UBUNTU22_PACKAGED_PROCESS_CONTINUITY_V1'||
   r.source!=='read-only-sampled-proc-stat-starttime-on-main-and-renderer'||
   r.runner!=='ubuntu-22.04'||
   r.desktopContext!=='xvfb-synthetic-gnome-kde-labels'||
   r.status!=='three-main-renderer-pairs-starttick-matched-no-certification'||
   !Array.isArray(r.observations)||r.observations.length!==3||
   r.verifiedPairs!==3||r.allStartTickReadingsMatched!==true||
   r.m47M48M49SameLauncherScenarios!==true||
   r.sampledContinuityNotIndependentAttestation!==true||
   r.actualPackageBytesIndependentlyAuthenticated!==false||
   falseFields.some(k=>r[k]!==false))refuse();
 for(let i=0;i<3;i++){
  const s=r.observations[i];
  if(!exact(s,rowFields)||s.label!==labels[i]||
     continuityFields.some(k=>s[k]!==true)||
     s.electronRendererRolePreviouslyVerified!==true||
     s.rawBirthTicksRetained!==false||s.rawPidsRetained!==false)refuse();
 }
 return r;
}
export function compareM50AgainstM46M49(input){
 if(!exact(input,['m46','m47','m48','m49','m50']))refuse();
 let m46,m47,m48,m49,m50;
 try{
  m46=verifyM46ABAIntake(input.m46);
  m47=verifyM47RendererReference(input.m47);
  m48=verifyM48NamespaceReference(input.m48);
  m49=verifyM49RendererPrivilegeReference(input.m49);
  m50=verifyM50ProcessContinuityReport(input.m50);
 }catch{refuse();}
 if(m46.status!=='awaiting-admin-authorization-and-external-aba-records'||
    m46.externalPilotRecordPresent!==false||
    m46.nativeUbuntu24StrictCIPassed!==false||
    m46.rendererSandboxIndependentlyVerified!==false||
    [m47,m48,m49].some(x=>x.runner!==m50.runner||
      x.desktopContext!==m50.desktopContext)||
    m50.observations.some((r,i)=>
      m47.scenarios[i].label!==r.label||
      m48.observations[i].label!==r.label||
      m49.observations[i].label!==r.label))refuse();
 return Object.freeze({
  schema:'M50_PROCESS_CONTINUITY_VS_M46_ABA_V1',
  category:'ubuntu22-sampled-process-continuity-ubuntu24-unverified',
  ubuntu22ProcessPairsSampled:3,
  rendererBirthMarkersMatched:3,
  mainProcessBirthMarkersMatched:3,
  pidRecyclingAbsolutelyExcluded:false,
  ubuntu24RendererContinuityObserved:false,
  electronSandboxCertified:false,
  appArmorCausalityProven:false,
  authorizedAdministratorPilotPerformed:false,
  ubuntu24StrictNativeGatePassed:false,
  hostPolicyChanged:false,sandboxBypassApplied:false,
  installationAuthorized:false,releaseAuthorized:false,mergeAuthorized:false
 });
}
function main(){
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.RUNNER_OS!=='Linux')refuse();
 const get=(sub,name)=>{
  const root=resolve('test-results/'+sub),p=resolve(root,name);
  if(!p.startsWith(root+sep))refuse();
  const bytes=readFileSync(p);
  if(bytes.length<3||bytes.length>8192)refuse();
  try{return JSON.parse(bytes.toString('utf8'));}catch{refuse();}
 };
 const r=compareM50AgainstM46M49({
  m46:get('m46','operator-aba-intake.json'),
  m47:get('m47','renderer-reference.json'),
  m48:get('m48','renderer-namespace-relations.json'),
  m49:get('m49','renderer-privilege-categories.json'),
  m50:get('m50','renderer-process-continuity.json')
 });
 console.log('M50_PROCESS_CONTINUITY_COMPARISON',JSON.stringify(r));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main();}catch{console.error(BAD);process.exitCode=1;}
}
