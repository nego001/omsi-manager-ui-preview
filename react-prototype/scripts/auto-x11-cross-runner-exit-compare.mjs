// M40: compare ONLY two fixed sanitized same-build CI observations.
// The Ubuntu 22 and 24 runners use separate hosts but neither exit
// observation proves X11 mapping, sandbox confinement or AppArmor cause.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {classifyM40DirectExit} from './auto-x11-cross-runner-direct-exit.mjs';

const REFUSAL='M40_TWO_RUNNER_COMPARISON_REFUSED';
const refuse=()=>{throw Error(REFUSAL);};
const NAMES=Object.freeze(['ubuntu-22.04','ubuntu-24.04']);
const PLAIN=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const sameKeys=(v,n)=>PLAIN(v)&&Object.keys(v).length===n.length&&n.every(k=>Object.hasOwn(v,k));
const FIELDS=Object.freeze([
 'schema','source','runner','category','exitCode','exitSignal','timedOut',
 'executedWithoutPtrace','sameBuildArtifactNameRequiredByCI',
 'archiveChecksumCheckedInPriorCIStep','independentArtifactOriginCertified',
 'actualX11WindowMappedMeasured','rendererSandboxIndependentlyVerified',
 'signalReproducesCausalAppArmorDenial','kernelCapabilityQueryCausesCrashProven',
 'nativeUbuntu24StrictGatePassed','strictNativeGateWaived','apparmorPolicyChanged',
 'sysctlChanged','sandboxBypassApplied','realOMSIModRead',
 'mergeAuthorized','releaseAuthorized','installationAuthorized'
]);
const YES=['executedWithoutPtrace','sameBuildArtifactNameRequiredByCI',
 'archiveChecksumCheckedInPriorCIStep'];
const NO=FIELDS.filter(x=>[
 'independentArtifactOriginCertified','actualX11WindowMappedMeasured',
 'rendererSandboxIndependentlyVerified','signalReproducesCausalAppArmorDenial',
 'kernelCapabilityQueryCausesCrashProven','nativeUbuntu24StrictGatePassed',
 'strictNativeGateWaived','apparmorPolicyChanged','sysctlChanged',
 'sandboxBypassApplied','realOMSIModRead','mergeAuthorized',
 'releaseAuthorized','installationAuthorized'
].includes(x));

export function compareM40DirectLinuxRunnerExits(pair){
 if(!sameKeys(pair,['schema','scope','observations'])||
    pair.schema!=='M40_DIRECT_CROSS_RUNNER_INPUT_V1'||
    pair.scope!=='two-disposable-linux-runner-exit-observations'||
    !Array.isArray(pair.observations)||
    pair.observations.length!==2)refuse();

 const observations=pair.observations;
 for(let i=0;i<2;i++){
  const current=observations[i];
  if(!sameKeys(current,FIELDS)||current.runner!==NAMES[i]||
     current.schema!=='M40_CI_LINUX_DIRECT_EXIT_OBSERVATION_V1'||
     current.source!=='ci-packaged-electron-direct-xvfb-without-ptrace'||
     YES.some(k=>current[k]!==true)||
     NO.some(k=>current[k]!==false))refuse();
  let recomputed;
  try{
   recomputed=classifyM40DirectExit({
    runner:current.runner,exitCode:current.exitCode,
    exitSignal:current.exitSignal,timedOut:current.timedOut
   });
  }catch{refuse();}
  if(recomputed.category!==current.category)refuse();
 }
 const a=observations[0],b=observations[1];
 let status;
 if(a.timedOut||b.timedOut)
  status='oneOrBothRunnerObservationsTimedOut';
 else if(a.exitSignal!=='SIGTRAP'&&b.exitSignal==='SIGTRAP')
  status='ubuntu24SIGTRAPAndUbuntu22DifferentDirectExit';
 else if(a.exitSignal==='SIGTRAP'&&b.exitSignal==='SIGTRAP')
  status='bothLinuxRunnersDirectSIGTRAP';
 else if(a.exitSignal==='SIGTRAP')
  status='ubuntu22DirectSIGTRAPButUbuntu24Not';
 else
  status='neitherDirectRunnerTerminatedWithSIGTRAP';

 return Object.freeze({
  schema:'M40_DIRECT_LINUX_CROSS_RUNNER_COMPARISON_V1',
  source:'two-fixed-sanitized-observations-from-same-ci-build',
  status,
  ubuntu22ExitCategory:a.category,
  ubuntu24ExitCategory:b.category,
  ubuntu22SIGTRAPObserved:!a.timedOut&&a.exitSignal==='SIGTRAP',
  ubuntu24SIGTRAPObserved:!b.timedOut&&b.exitSignal==='SIGTRAP',
  twoDistinctLinuxRunnerLabelsObserved:true,
  sameUnsignedCIArtifactNameUsed:true,
  actualPackageBytesIndependentlyAcquired:false,
  nativeWindowOwnershipProvenByThisComparison:false,
  rendererConfinementIndependentlyVerified:false,
  thisComparisonDeterminesAppArmorCausality:false,
  thisComparisonCertifiesUbuntu24StrictGate:false,
  nativeUbuntu24StrictGateWaived:false,
  hostPolicyChanged:false,
  sandboxBypassApplied:false,
  realOMSIModRead:false,
  mergeAuthorized:false,
  releaseAuthorized:false,
  installationAuthorized:false
 });
}

function loadFixed(name){
 const raw=readFileSync(resolve('test-results/m40/m40-direct-'+name+'.json'));
 if(raw.length>8192)refuse();
 let json;
 try{json=JSON.parse(raw.toString('utf8'));}catch{refuse();}
 return json;
}
function main(){
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true'||
    process.env.RUNNER_OS!=='Linux'||process.platform!=='linux'||
    process.getuid?.()===0)refuse();
 const result=compareM40DirectLinuxRunnerExits({
  schema:'M40_DIRECT_CROSS_RUNNER_INPUT_V1',
  scope:'two-disposable-linux-runner-exit-observations',
  observations:NAMES.map(loadFixed)
 });
 console.log('M40_CROSS_RUNNER_EXIT_COMPARISON',JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main();}catch{console.error(REFUSAL);process.exitCode=1;}
}
