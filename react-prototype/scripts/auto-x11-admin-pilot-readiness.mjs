// M45 — fixed same-run M40-M44 read-only evidence -> administrator handoff.
// This tool is NEVER an AppArmor policy installer or an approval authority.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {compareM42HostUsernsAndDirectWindows} from './auto-x11-direct-userns-compare.mjs';
import {compareM43Pair} from './auto-x11-direct-repeatability-compare.mjs';
import {compareM44Pair} from './auto-x11-direct-stderr-compare.mjs';

const REFUSE='M45_OPERATOR_HANDOFF_REFUSED';
const refuse=()=>{throw Error(REFUSE);};
const NAMES=Object.freeze(['ubuntu-22.04','ubuntu-24.04']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(x,fields)=>plain(x)&&Object.keys(x).length===fields.length&&
 fields.every(k=>Object.hasOwn(x,k));
const BLOCKERS=Object.freeze([
 'administrator-explicit-approval-not-verified',
 'disposable-vm-and-host-identity-not-verified',
 'independent-executed-package-integrity-not-verified',
 'app-specific-profile-scope-not-independently-verified',
 'baseline-pilot-rollback-not-performed',
 'rollback-host-restoration-not-independently-verified',
 'electron-renderer-sandbox-not-independently-verified',
 'real-desktop-native-ubuntu24-gate-not-passed'
]);
const LOCKS=Object.freeze({
 apparmorCausalityProven:false,hostPolicyChanged:false,
 administratorAuthorizedPolicyExperiment:false,
 pilotVmIdentityAuthenticated:false,independentPackageAuthenticityCertified:false,
 appSpecificProfileLoaded:false,abaRollbackVerified:false,
 electronRendererSandboxCertified:false,nativeUbuntu24StrictGatePassed:false,
 nativeUbuntu24GateWaived:false,sandboxBypassApplied:false,realModRead:false,
 installationAuthorized:false,mergeAuthorized:false,releaseAuthorized:false
});
const REPORT_FIELDS=Object.freeze([
 'schema','source','status','m42HostContrast','m43WindowContrast','m44StderrContrast',
 'ubuntu22MappedOutOfThree','ubuntu24MappedOutOfThree','ubuntu24SIGTRAPOutOfThree',
 'ubuntu24StderrCategory','reviewRequestedOnly','blockers',
 'sameWorkflowArtifactInputsIndependentlyAuthenticated',...Object.keys(LOCKS)
]);
export function createM45OperatorHandoff(input){
 if(!exact(input,['m42Input','m43Reports','m44Reports']))refuse();
 let a,b,c;
 try{
  a=compareM42HostUsernsAndDirectWindows(input.m42Input);
  b=compareM43Pair(input.m43Reports);
  c=compareM44Pair(input.m44Reports);
 }catch{refuse();}
 const hostContrast=a.ubuntu22UsernsRestriction==='disabled'&&
  a.ubuntu24UsernsRestriction==='enabled'&&
  a.ubuntu22UnshareCategory==='none'&&
  a.ubuntu24UnshareCategory==='permission-denied';
 const windows=a.ubuntu22OwnedMappedWindowObserved===true&&
  a.ubuntu24OwnedMappedWindowObserved===false&&a.ubuntu24DirectSIGTRAPObserved===true&&
  b.ubuntu22WindowCount===3&&b.ubuntu24WindowCount===0&&
  b.ubuntu22SIGTRAPCount===0&&b.ubuntu24SIGTRAPCount===3;
 const stderr=c.ubuntu22ExitCategory==='timeout'&&
  c.ubuntu24ExitCategory==='sigtrap'&&c.ubuntu24StderrPresent===true&&
  c.ubuntu24StderrTruncated===false;
 const status=hostContrast&&windows&&stderr?
  'repeated-host-contrast-for-administrator-review-only':
  'missing-or-divergent-evidence-no-policy-review-conclusion';
 return Object.freeze({
  schema:'M45_OPERATOR_READINESS_HANDOFF_V1',
  source:'validated-sanitized-m40-m44-reports-from-fixed-ci-artifact-names',
  status,
  m42HostContrast:hostContrast,
  m43WindowContrast:windows,
  m44StderrContrast:stderr,
  ubuntu22MappedOutOfThree:b.ubuntu22WindowCount,
  ubuntu24MappedOutOfThree:b.ubuntu24WindowCount,
  ubuntu24SIGTRAPOutOfThree:b.ubuntu24SIGTRAPCount,
  ubuntu24StderrCategory:c.ubuntu24StderrCategory,
  reviewRequestedOnly:hostContrast&&windows&&stderr,
  blockers:BLOCKERS,
  // GitHub's same-run download step is not an independent
  // cryptographic attestation of the observed host or executable.
  sameWorkflowArtifactInputsIndependentlyAuthenticated:false,
  ...LOCKS
 });
}
export function verifyM45Handoff(report){
 if(!exact(report,REPORT_FIELDS)||report.schema!=='M45_OPERATOR_READINESS_HANDOFF_V1'||
    report.source!=='validated-sanitized-m40-m44-reports-from-fixed-ci-artifact-names'||
    !['repeated-host-contrast-for-administrator-review-only',
      'missing-or-divergent-evidence-no-policy-review-conclusion'].includes(report.status)||
    ['m42HostContrast','m43WindowContrast','m44StderrContrast',
     'reviewRequestedOnly'].some(k=>typeof report[k]!=='boolean')||
    !Number.isInteger(report.ubuntu22MappedOutOfThree)||
    !Number.isInteger(report.ubuntu24MappedOutOfThree)||
    !Number.isInteger(report.ubuntu24SIGTRAPOutOfThree)||
    [report.ubuntu22MappedOutOfThree,report.ubuntu24MappedOutOfThree,
     report.ubuntu24SIGTRAPOutOfThree].some(v=>v<0||v>3)||
    !['namespace-denial-message','sandbox-unavailable-message',
      'seccomp-failure-message','zygote-failure-message',
      'generic-fatal-message','no-recognized-diagnostic'].includes(report.ubuntu24StderrCategory)||
    !Array.isArray(report.blockers)||
    report.blockers.length!==BLOCKERS.length||
    BLOCKERS.some((s,i)=>report.blockers[i]!==s)||
    report.sameWorkflowArtifactInputsIndependentlyAuthenticated!==false||
    Object.keys(LOCKS).some(k=>report[k]!==false)||
    report.reviewRequestedOnly!==(report.status==='repeated-host-contrast-for-administrator-review-only')||
    (report.reviewRequestedOnly&&
     (!report.m42HostContrast||!report.m43WindowContrast||!report.m44StderrContrast)))refuse();
 return report;
}
function readFile(sub,name){
 const dir=resolve('test-results/'+sub);
 const path=resolve(dir,name+'.json');
 if(!path.startsWith(dir+sep))refuse();
 const buf=readFileSync(path);
 if(buf.length<3||buf.length>8192)refuse();
 try{return JSON.parse(buf.toString('utf8'));}catch{refuse();}
}
function main(){
 if(process.platform!=='linux'||process.getuid?.()===0||
    process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
    process.env.RUNNER_OS!=='Linux')refuse();
 const input={
  m42Input:{
   m40Pair:{
    schema:'M40_DIRECT_CROSS_RUNNER_INPUT_V1',
    scope:'two-disposable-linux-runner-exit-observations',
    observations:NAMES.map(n=>readFile('m41','m40-direct-'+n))
   },
   m41Witnesses:NAMES.map(n=>readFile('m41','m41-window-'+n)),
   m42HostProbes:NAMES.map(n=>readFile('m41','m42-userns-'+n))
  },
  m43Reports:{
   ubuntu22:readFile('m43','m43-repeatability-ubuntu-22.04'),
   ubuntu24:readFile('m43','m43-repeatability-ubuntu-24.04')
  },
  m44Reports:{
   ubuntu22:readFile('m44','m44-stderr-ubuntu-22.04'),
   ubuntu24:readFile('m44','m44-stderr-ubuntu-24.04')
  }
 };
 const result=verifyM45Handoff(createM45OperatorHandoff(input));
 const dir=resolve('test-results/m45');
 mkdirSync(dir,{recursive:true,mode:0o700});
 const path=resolve(dir,'operator-review-handoff.json');
 if(!path.startsWith(dir+sep))refuse();
 writeFileSync(path,JSON.stringify(result)+'\n',{flag:'wx',mode:0o600});
 console.log('M45_ADMINISTRATOR_READINESS_HANDOFF',JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main();}catch{console.error(REFUSE);process.exitCode=1;}
}
