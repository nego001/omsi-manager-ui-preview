// M42: pair sanitized host userns categories to the SAME two
// M40/M41 direct CI runs. A difference in policy does not prove
// Chromium, Electron or AppArmor causality.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {
 classifyM42UsernsProbe,M42_FIELDS
} from './auto-x11-direct-userns-observation.mjs';
import {compareM41TwoRunnerNativeX11WindowEvidence}
 from './auto-x11-cross-runner-window-compare.mjs';

const REFUSE='M42_DIRECT_USERNS_CROSS_RUNNER_REFUSED';
const refuse=()=>{throw Error(REFUSE);};
const NAMES=['ubuntu-22.04','ubuntu-24.04'];
const FIELD_INPUT=[
 'runner','apparmorModule','apparmorUsernsRestriction',
 'unprivilegedUsernsSwitch','usernsCapacity',
 'nodeProcessApparmorProfile','unshareAttempt',
 'unshareFailureCategory'
];
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const exact=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&
 keys.every(k=>Object.hasOwn(v,k));
export function compareM42HostUsernsAndDirectWindows(input){
 if(!exact(input,['m40Pair','m41Witnesses','m42HostProbes'])||
    !Array.isArray(input.m42HostProbes)||
    input.m42HostProbes.length!==2)refuse();
 let windowResult;
 try{
  windowResult=compareM41TwoRunnerNativeX11WindowEvidence({
   m40Pair:input.m40Pair,m41Witnesses:input.m41Witnesses
  });
 }catch{refuse();}
 const accepted=[];
 for(let i=0;i<2;i++){
  const x=input.m42HostProbes[i];
  if(!exact(x,M42_FIELDS)||x.runner!==NAMES[i])refuse();
  let recomputed;
  try{
   recomputed=classifyM42UsernsProbe(
    Object.fromEntries(FIELD_INPUT.map(k=>[k,x[k]]))
   );
  }catch{refuse();}
  if(M42_FIELDS.some(k=>x[k]!==recomputed[k]))refuse();
  accepted.push(recomputed);
 }
 const [a,b]=accepted;
 const knownPolicyContrast=
  a.apparmorUsernsRestriction==='disabled'&&
  b.apparmorUsernsRestriction==='enabled';
 const bothDenied=
  a.unshareFailureCategory==='permission-denied'&&
  b.unshareFailureCategory==='permission-denied';
 const status=knownPolicyContrast?
  'ubuntu24RestrictsUsernsWhileUbuntu22DoesNotInSameBuildContexts':
  bothDenied?'bothDirectRunnersDeniedUnshareWithoutCausality':
  a.unshareAttempt==='allowed'&&b.unshareAttempt==='blocked-or-unavailable'?
   'ubuntu22UnshareAllowedUbuntu24NotAllowedReasonUnresolved':
   'hostPolicyContrastUnresolvedOrNotObserved';
 return Object.freeze({
  schema:'M42_DIRECT_HOST_USERNS_CROSS_RUNNER_COMPARISON_V1',
  source:'two-same-commit-direct-runner-host-categories-plus-m41-witness',
  status,
  ubuntu22UsernsRestriction:a.apparmorUsernsRestriction,
  ubuntu24UsernsRestriction:b.apparmorUsernsRestriction,
  ubuntu22UnshareCategory:a.unshareFailureCategory,
  ubuntu24UnshareCategory:b.unshareFailureCategory,
  ubuntu22OwnedMappedWindowObserved:windowResult.ubuntu22OwnedMappedWindowObserved,
  ubuntu24OwnedMappedWindowObserved:windowResult.ubuntu24OwnedMappedWindowObserved,
  ubuntu24DirectSIGTRAPObserved:windowResult.ubuntu24DirectSIGTRAPObserved,
  comparedSameTwoRunnerLabels:true,
  m41AndM40ReportsValidated:true,
  noAppArmorSettingsWereChanged:true,
  policyDifferenceProvesSIGTRAPCause:false,
  usernsDeniedIsProofOfApparmorCause:false,
  NodeHostProbeProvesElectronRendererConfinement:false,
  nativeUbuntu24X11GatePassed:false,
  nativeUbuntu24GateWaived:false,
  binaryOriginIndependentlyVerified:false,
  realModRead:false,
  mergeAuthorized:false,
  releaseAuthorized:false,
  installationAuthorized:false
 });
}
function read(name){
 const path=resolve('test-results/m41/'+name+'.json');
 const buf=readFileSync(path);
 if(buf.length>8192)refuse();
 try{return JSON.parse(buf.toString('utf8'));}catch{refuse();}
}
function main(){
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.RUNNER_OS!=='Linux')refuse();
 const input={
  m40Pair:{
   schema:'M40_DIRECT_CROSS_RUNNER_INPUT_V1',
   scope:'two-disposable-linux-runner-exit-observations',
   observations:NAMES.map(n=>read('m40-direct-'+n))
  },
  m41Witnesses:NAMES.map(n=>read('m41-window-'+n)),
  m42HostProbes:NAMES.map(n=>read('m42-userns-'+n))
 };
 console.log('M42_DIRECT_HOST_USERNS_DIFF',JSON.stringify(
  compareM42HostUsernsAndDirectWindows(input)));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main();}catch{console.error(REFUSE);process.exitCode=1;}
}
