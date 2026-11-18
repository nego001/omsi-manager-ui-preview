// M43: independent packaged Electron trials, only categorical evidence.
import {accessSync,constants,realpathSync,mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launchM40DirectElectron,classifyM40DirectExit} from './auto-x11-cross-runner-direct-exit.mjs';
import {classifyM41OwnedX11Window,M41_FLAGS} from './auto-x11-cross-runner-owned-window.mjs';
const REFUSE='M43_DIRECT_REPEATABILITY_REFUSED';
const refuse=()=>{throw Error(REFUSE);};
const names=['ubuntu-22.04','ubuntu-24.04'];
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const locks={hostPolicyChanged:false,sysctlChanged:false,sandboxBypassApplied:false,
 appArmorCauseProven:false,rendererSandboxCertified:false,ubuntu24NativeGatePassed:false,
 ubuntu24GateWaived:false,installationAuthorized:false,mergeAuthorized:false,releaseAuthorized:false};
const keys=['schema','source','runner','attempts','mappedCount','sigtrapCount','status',
 'freshProcessPerAttempt','sameCIArtifactRequired','windowIsNotSandboxProof',...Object.keys(locks)];
const exits=['timedOutNotWindowOrSandboxProof','directSIGTRAPSignal','directOtherSignal',
 'exitCode133NotSignalProof','directOtherExitCode'];
const windows=['directOwnedMappedUsableX11WindowObserved','directTimeoutWindowUnverified',
 'directSIGTRAPWithoutVerifiedWindow','candidateTitleWithoutOwnedMappedWindow',
 'processImageButNoVerifiedWindow','noDirectProcessImageOrWindowVerified'];
const entry=['attempt','exitCategory','windowCategory','mapped'];
function summary(a){
 const mapped=a.filter(x=>x.mapped).length,trap=a.filter(x=>x.exitCategory==='directSIGTRAPSignal').length;
 const status=mapped===3?'windowInEveryTrial':mapped>0?'windowInSomeTrials':
  trap===3?'threeSIGTRAPWithoutVerifiedWindow':trap>0?'someSIGTRAPWithoutVerifiedWindow':
  'noWindowVerified';
 return {mapped,trap,status};
}
export function classifyM43Trials(input){
 if(!exact(input,['runner','observations'])||!names.includes(input.runner)||
    !Array.isArray(input.observations)||input.observations.length!==3)refuse();
 const attempts=input.observations.map((ob,i)=>{
  if(!exact(ob,['exit','witness'])||!exact(ob.exit,['runner','exitCode','exitSignal','timedOut'])||
     !exact(ob.witness,M41_FLAGS)||ob.exit.runner!==input.runner)refuse();
  let e,w;
  try{
   e=classifyM40DirectExit(ob.exit);
   w=classifyM41OwnedX11Window({runner:input.runner,flags:ob.witness,
    exit:{exitCode:ob.exit.exitCode,exitSignal:ob.exit.exitSignal,timedOut:ob.exit.timedOut}});
  }catch{refuse();}
  return {attempt:i+1,exitCategory:e.category,windowCategory:w.category,mapped:w.mappedUsableWindowObserved};
 });
 const s=summary(attempts);
 const result={schema:'M43_DIRECT_X11_REPEATABILITY_V1',
  source:'three-independent-direct-ci-electron-process-observations',runner:input.runner,
  attempts,mappedCount:s.mapped,sigtrapCount:s.trap,status:s.status,
  freshProcessPerAttempt:true,sameCIArtifactRequired:true,windowIsNotSandboxProof:true,...locks};
 verifyM43Trials(result);
 return Object.freeze(result);
}
export function verifyM43Trials(x){
 if(!exact(x,keys)||x.schema!=='M43_DIRECT_X11_REPEATABILITY_V1'||
    x.source!=='three-independent-direct-ci-electron-process-observations'||
    !names.includes(x.runner)||!Array.isArray(x.attempts)||x.attempts.length!==3||
    x.freshProcessPerAttempt!==true||x.sameCIArtifactRequired!==true||
    x.windowIsNotSandboxProof!==true||Object.keys(locks).some(k=>x[k]!==false))refuse();
 for(let i=0;i<3;i++){
  const a=x.attempts[i];
  if(!exact(a,entry)||a.attempt!==i+1||!exits.includes(a.exitCategory)||
     !windows.includes(a.windowCategory)||typeof a.mapped!=='boolean'||
     a.mapped!==(a.windowCategory==='directOwnedMappedUsableX11WindowObserved')||
     (a.exitCategory==='directSIGTRAPSignal'&&!a.mapped&&
      a.windowCategory!=='directSIGTRAPWithoutVerifiedWindow')||
     (a.exitCategory==='timedOutNotWindowOrSandboxProof'&&!a.mapped&&
      a.windowCategory!=='directTimeoutWindowUnverified')||
     (a.windowCategory==='directSIGTRAPWithoutVerifiedWindow'&&a.exitCategory!=='directSIGTRAPSignal')||
     (a.windowCategory==='directTimeoutWindowUnverified'&&
      a.exitCategory!=='timedOutNotWindowOrSandboxProof'))refuse();
 }
 const s=summary(x.attempts);
 if(x.mappedCount!==s.mapped||x.sigtrapCount!==s.trap||x.status!==s.status)refuse();
 return Object.freeze({runner:x.runner,mapped:s.mapped,trap:s.trap,status:s.status});
}
async function main(){
 const runner=process.env.M40_RUNNER;
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.RUNNER_OS!=='Linux'||!names.includes(runner)||
    !/^:\d{1,4}(?:\.\d{1,2})?$/.test(process.env.DISPLAY||''))refuse();
 const folder=realpathSync(resolve('release/OMSI-Manager-Preview-linux-x64'));
 const bin=realpathSync(resolve(folder,'OMSI-Manager-Preview'));
 if(!bin.startsWith(folder+sep))refuse();
 accessSync(bin,constants.X_OK);
 const observations=[];
 for(let i=0;i<3;i++){
  const temp=mkdtempSync(join(tmpdir(),'omsi-m43-'));
  try{observations.push(await launchM40DirectElectron(bin,temp,runner));}
  finally{rmSync(temp,{recursive:true,force:true,maxRetries:2});}
 }
 const report=classifyM43Trials({runner,observations});
 const dest=resolve('test-results');
 mkdirSync(dest,{recursive:true,mode:0o700});
 const name=resolve(dest,'m43-repeatability-'+runner+'.json');
 if(!name.startsWith(dest+sep))refuse();
 writeFileSync(name,JSON.stringify(report)+'\n',{mode:0o600,flag:'wx'});
 console.log('M43_DIRECT_REPEATABILITY',JSON.stringify(report));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{await main();}catch{console.error(REFUSE);process.exitCode=1;}
}