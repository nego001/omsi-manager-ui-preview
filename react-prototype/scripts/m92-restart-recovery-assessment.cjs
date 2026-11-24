'use strict';
// Test-only orchestration. Owns the temp root and worker; never accepts
// caller paths, PIDs, journal records, or a claimed recovery verdict.
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {fork,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {PREFIX,MARKER}=require('./temp-recovery-fixture.cjs');
const {NAMES,inspectAfterRestart}=require('./m90-interrupted-restore-fixture.cjs');
const exec=promisify(execFile);
const expected=Object.freeze({
 'after-backup':'backup-only-untrusted',
 'after-intent':'intent-untrusted',
 'after-stage':'staged-untrusted',
 'after-publish':'published-untrusted'
});
const refuse=()=>{throw Error('M92_FIXTURE_REFUSED');};
const env={...process.env,NODE_OPTIONS:''};
async function identity(root){
 const s=await fs.lstat(root,{bigint:true});
 if(!s.isDirectory()||s.isSymbolicLink())refuse();
 return [s.dev,s.ino].join(':');
}
function stopOwnedChild(root,nonce,point){
 return new Promise((resolve,reject)=>{
  const child=fork(path.join(__dirname,'m91-external-termination-worker.cjs'),[root,nonce,point],
   {execArgv:[],stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,env});
  let reached=false,killRequested=false,failure=null;
  const timer=setTimeout(()=>{failure=Error('M92_CHECKPOINT_TIMEOUT');child.kill('SIGKILL');},15000);
  child.on('message',msg=>{
   if(reached||msg?.kind!=='fixture-checkpoint'||msg.stage!==point){
    failure=Error('M92_CHECKPOINT_MISMATCH');child.kill('SIGKILL');return;
   }
   reached=true;killRequested=child.kill('SIGKILL');
   if(!killRequested)failure=Error('M92_KILL_REFUSED');
  });
  child.once('error',e=>{failure=e;clearTimeout(timer);child.kill('SIGKILL');reject(e);});
  child.once('close',(code,signal)=>{
   clearTimeout(timer);
   if(failure)return reject(failure);
   if(!reached||!killRequested||code!==null||signal!=='SIGKILL')return reject(Error('M92_EXIT_NOT_OBSERVED'));
   resolve();
  });
 });
}
async function freshObservation(root,nonce){
 const {stdout}=await exec(process.execPath,[path.join(__dirname,'m90-interrupted-restore-worker.cjs'),'inspect',root,nonce],
  {encoding:'utf8',timeout:15000,maxBuffer:16384,windowsHide:true,env});
 return JSON.parse(stdout);
}
async function assessSyntheticRestart(point='after-stage',scenario='normal'){
 if(typeof point!=='string'||!Object.hasOwn(expected,point)||
    !['normal','changed-backup','changed-after-first-observation','lost-controller-anchor'].includes(scenario))refuse();
 const root=await fs.mkdtemp(path.join(os.tmpdir(),PREFIX));
 try{
  const nonce=randomBytes(16).toString('hex');
  await fs.writeFile(path.join(root,MARKER),nonce,{flag:'wx',mode:0o600});
  const rootBefore=await identity(root);
  // Expected state is selected in the live controller before the child starts.
  // The nonce and known checkpoint are not an authentication mechanism.
  const anchor=Object.freeze({rootIdentity:rootBefore,expectedOutcome:expected[point]});
  await stopOwnedChild(root,nonce,point);
  if(scenario==='changed-backup')await fs.writeFile(path.join(root,NAMES[1]),'M92 controlled corruption');
  const first=await freshObservation(root,nonce);
  if(scenario==='changed-after-first-observation')await fs.writeFile(path.join(root,NAMES[0]),'M92 controlled target drift');
  const second=await freshObservation(root,nonce);
  const local=await inspectAfterRestart(root,nonce);
  const observationsAgree=JSON.stringify(first)===JSON.stringify(second)&&JSON.stringify(second)===JSON.stringify(local);
  const anchorRetained=scenario!=='lost-controller-anchor';
  const rootMatches=(await identity(root))===anchor.rootIdentity;
  const checkpointMatches=anchorRetained&&rootMatches&&local.outcome===anchor.expectedOutcome;
  let disposition='manual-review-refused';
  if(!anchorRetained)disposition='independent-anchor-unavailable';
  else if(!observationsAgree||!checkpointMatches)disposition='state-divergence-refused';
  else if(local.outcome==='published-untrusted')disposition='publication-observed-no-replay';
  else if(local.outcome==='staged-untrusted')disposition='staged-fixture-manual-review';
  else disposition='incomplete-fixture-review';
  return Object.freeze({schema:'omsi-m92-restart-assessment-v1',scope:'self-created-temporary-fixture-only',
   checkpoint:point,disposition,observedOutcome:local.outcome,
   ownedChildTerminationObserved:true,freshProcessesObserved:2,observationsAgree,anchorRetained,rootMatches,checkpointMatches,
   recoveryAttempted:false,automaticReplayAllowed:false,oldEvidenceReusable:false,
   crossRestartTrustProven:false,nativeIdentityProven:false,durabilityProven:false,
   realFilesInspected:false,operationsEnabled:false,filesModifiedInGames:0});
 }finally{await fs.rm(root,{recursive:true,force:true});}
}
module.exports={assessSyntheticRestart};
