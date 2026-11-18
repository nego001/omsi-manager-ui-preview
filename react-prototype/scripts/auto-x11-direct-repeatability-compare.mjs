// Compare only sanitized M43 categories; no gate or sandbox certification.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyM43Trials} from './auto-x11-direct-repeatability.mjs';
const REFUSE='M43_REPEATABILITY_PAIR_REFUSED';
const refuse=()=>{throw Error(REFUSE);};
export function compareM43Pair(x){
 if(x===null||typeof x!=='object'||Array.isArray(x)||
    Object.keys(x).length!==2||!Object.hasOwn(x,'ubuntu22')||
    !Object.hasOwn(x,'ubuntu24'))refuse();
 let a,b;
 try{a=verifyM43Trials(x.ubuntu22);b=verifyM43Trials(x.ubuntu24);}catch{refuse();}
 if(a.runner!=='ubuntu-22.04'||b.runner!=='ubuntu-24.04')refuse();
 const status=b.trap===3&&b.mapped===0?
   (a.mapped>0?'ubuntu22WindowObservedUbuntu24ThreeSIGTRAP':'ubuntu22WindowUnverifiedUbuntu24ThreeSIGTRAP'):
   b.mapped>0?'ubuntu24WindowObservedNativeGateStillSeparate':'bothRunnerOutcomesUnresolved';
 return Object.freeze({
  schema:'M43_DIRECT_X11_REPEATABILITY_PAIR_V1',
  source:'two-fixed-three-trial-sanitized-ci-runner-reports',status,
  ubuntu22WindowCount:a.mapped,ubuntu24WindowCount:b.mapped,
  ubuntu22SIGTRAPCount:a.trap,ubuntu24SIGTRAPCount:b.trap,
  repeatedSIGTRAPProvesAppArmorCause:false,
  sampledWindowProvesRendererSandbox:false,
  ubuntu24NativeGatePassed:false,ubuntu24GateWaived:false,
  hostPolicyChanged:false,sandboxBypassApplied:false,
  installationAuthorized:false,mergeAuthorized:false,releaseAuthorized:false
 });
}
function read(name){
 const buffer=readFileSync(resolve('test-results/m43/m43-repeatability-'+name+'.json'));
 if(buffer.length>8192)refuse();
 try{return JSON.parse(buffer.toString('utf8'));}catch{refuse();}
}
function main(){
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.RUNNER_OS!=='Linux')refuse();
 console.log('M43_DIRECT_REPEATABILITY_PAIR',JSON.stringify(
  compareM43Pair({ubuntu22:read('ubuntu-22.04'),ubuntu24:read('ubuntu-24.04')})
 ));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main();}catch{console.error(REFUSE);process.exitCode=1;}
}