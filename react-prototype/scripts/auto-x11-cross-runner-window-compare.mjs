// M41: correlate two read-only owned X11 window witnesses with the
// exact M40 direct exit artifacts from the same two CI jobs. Missing,
// mismatched or forged metadata fails closed. Never a sandbox approval.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {compareM40DirectLinuxRunnerExits}
 from './auto-x11-cross-runner-exit-compare.mjs';
import {classifyM41OwnedX11Window,M41_FLAGS}
 from './auto-x11-cross-runner-owned-window.mjs';

const REFUSAL='M41_TWO_RUNNER_WINDOW_COMPARISON_REFUSED';
const refuse=()=>{throw Error(REFUSAL);};
const NAMES=Object.freeze(['ubuntu-22.04','ubuntu-24.04']);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const same=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&
 keys.every(k=>Object.hasOwn(v,k));
const WITNESS_FIELDS=Object.freeze([
 'schema','source','runner','category','nativeCommandLineObserved',
 'candidateWindowTitleObserved','exactNETWMPIDAttributed',
 'mappedUsableWindowObserved','observedChildExitSignal',
 'observedChildTimedOut','x11TitleAloneIsNotProof',
 'pidPropertyNotCryptographicallyAuthenticated',
 'x11MappingWitnessIsNotRendererSandboxProof',
 'independentRendererSandboxVerified',
 'fullNativeX11AutoGateCertifiedByThisWitness',
 'strictUbuntu24NativeGatePassed','strictNativeGateWaived',
 'apparmorCausalityProven','hostPolicyChanged','sandboxBypassApplied',
 'realModRead','mergeAuthorized','releaseAuthorized',
 'installationAuthorized'
]);
export function compareM41TwoRunnerNativeX11WindowEvidence(input){
 if(!same(input,['m40Pair','m41Witnesses'])||
    !Array.isArray(input.m41Witnesses)||input.m41Witnesses.length!==2)
  refuse();
 try{compareM40DirectLinuxRunnerExits(input.m40Pair);}catch{refuse();}
 const mapped=[];
 for(let i=0;i<2;i++){
  const witness=input.m41Witnesses[i],
        direct=input.m40Pair.observations[i];
  if(!same(witness,WITNESS_FIELDS)||witness.runner!==NAMES[i]||
     witness.observedChildExitSignal!==direct.exitSignal||
     witness.observedChildTimedOut!==direct.timedOut)refuse();
  let rebuilt;
  try{
   rebuilt=classifyM41OwnedX11Window({
    runner:witness.runner,
    flags:{
     processImageObserved:witness.nativeCommandLineObserved,
     windowTitleObserved:witness.candidateWindowTitleObserved,
     pidAttributed:witness.exactNETWMPIDAttributed,
     mappedUsableWindowObserved:witness.mappedUsableWindowObserved
    },
    exit:{
     exitCode:direct.exitCode,exitSignal:direct.exitSignal,
     timedOut:direct.timedOut
    }
   });
  }catch{refuse();}
  if(WITNESS_FIELDS.some(k=>witness[k]!==rebuilt[k]))refuse();
  mapped.push(witness.mappedUsableWindowObserved);
 }
 const [a,b]=mapped;
 const ubuntu24Trap=input.m40Pair.observations[1].exitSignal==='SIGTRAP'&&
  input.m40Pair.observations[1].timedOut===false;
 const status=a&&!b&&ubuntu24Trap?
  'ubuntu22OwnedMappedDirectWindowWhileUbuntu24SIGTRAPNoMappedWindow':
  !a&&ubuntu24Trap?
  'ubuntu22DirectWindowUnverifiedWhileUbuntu24SIGTRAP':
  a&&b?'bothRunnersOwnedMappedWindowsObserved':
  'crossRunnerDirectWindowEvidenceIncomplete';
 return Object.freeze({
  schema:'M41_DIRECT_X11_CROSS_RUNNER_WINDOW_COMPARISON_V1',
  source:'same-ci-package-two-explicit-direct-runner-jobs',
  status,
  ubuntu22OwnedMappedWindowObserved:a,
  ubuntu24OwnedMappedWindowObserved:b,
  ubuntu24DirectSIGTRAPObserved:ubuntu24Trap,
  directExitCategoriesReconciledWithM40:true,
  witnessedWindowPIDsNotCryptographicIdentity:true,
  fullRendererSandboxIndependentlyVerified:false,
  nativeAutoX11StrictGatePassedByThisComparison:false,
  rootCauseApparmorOrCapabilitiesProven:false,
  strictUbuntu24GateWaived:false,
  hostPolicyChanged:false,
  sandboxBypassApplied:false,
  realModRead:false,
  mergeAuthorized:false,
  releaseAuthorized:false,
  installationAuthorized:false
 });
}
function load(file){
 const raw=readFileSync(resolve('test-results/m41/'+file+'.json'));
 if(raw.length>8192)refuse();
 try{return JSON.parse(raw.toString('utf8'));}catch{refuse();}
}
function main(){
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.RUNNER_OS!=='Linux')refuse();
 const input={
  m40Pair:{
   schema:'M40_DIRECT_CROSS_RUNNER_INPUT_V1',
   scope:'two-disposable-linux-runner-exit-observations',
   observations:NAMES.map(n=>load('m40-direct-'+n))
  },
  m41Witnesses:NAMES.map(n=>load('m41-window-'+n))
 };
 console.log('M41_CROSS_RUNNER_OWNED_WINDOW',JSON.stringify(
  compareM41TwoRunnerNativeX11WindowEvidence(input)));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main();}catch{console.error(REFUSAL);process.exitCode=1;}
}
