import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyM44} from './auto-x11-direct-stderr-categories.mjs';
const BAD='M44_STDERR_PAIR_REFUSED',deny=()=>{throw Error(BAD);};
export function compareM44Pair(x){
 if(x===null||typeof x!=='object'||Array.isArray(x)||
   Object.keys(x).length!==2||!Object.hasOwn(x,'ubuntu22')||
   !Object.hasOwn(x,'ubuntu24'))deny();
 let a,b;
 try{a=verifyM44(x.ubuntu22);b=verifyM44(x.ubuntu24);}catch{deny();}
 if(a.runner!=='ubuntu-22.04'||b.runner!=='ubuntu-24.04')deny();
 return Object.freeze({
  schema:'M44_DIRECT_STDERR_PAIR_V1',
  status:b.exitCategory==='sigtrap'?'ubuntu24SIGTRAPCategoryObserved':'ubuntu24ExitInconclusive',
  ubuntu22ExitCategory:a.exitCategory,ubuntu24ExitCategory:b.exitCategory,
  ubuntu22StderrCategory:a.stderrCategory,ubuntu24StderrCategory:b.stderrCategory,
  ubuntu22StderrPresent:a.stderrPresent,ubuntu24StderrPresent:b.stderrPresent,
  ubuntu22StderrTruncated:a.stderrTruncated,ubuntu24StderrTruncated:b.stderrTruncated,
  stderrCategoryProvesCausality:false,rendererSandboxCertified:false,
  ubuntu24StrictGatePassed:false,ubuntu24StrictGateWaived:false,
  policyChanged:false,sandboxBypassApplied:false,
  installationAuthorized:false,mergeAuthorized:false,releaseAuthorized:false
 });
}
function read(runner){
 const buffer=readFileSync(resolve('test-results/m44/m44-stderr-'+runner+'.json'));
 if(buffer.length>8192)deny();
 try{return JSON.parse(buffer.toString('utf8'));}catch{deny();}
}
function main(){
 if(process.platform!=='linux'||process.getuid?.()===0||
  process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
  process.env.RUNNER_OS!=='Linux')deny();
 console.log('M44_STDERR_PAIR',JSON.stringify(compareM44Pair({
  ubuntu22:read('ubuntu-22.04'),ubuntu24:read('ubuntu-24.04')
 })));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main();}catch{console.error(BAD);process.exitCode=1;}
}