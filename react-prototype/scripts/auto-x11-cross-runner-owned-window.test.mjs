import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {classifyM40DirectExit} from './auto-x11-cross-runner-direct-exit.mjs';
import {classifyM41OwnedX11Window as classify}
 from './auto-x11-cross-runner-owned-window.mjs';
import {compareM41TwoRunnerNativeX11WindowEvidence as compare}
 from './auto-x11-cross-runner-window-compare.mjs';
import {
 findPreviewWindow,verifyNativeWindowOwner,verifyMappedWindow,
 verifyNativeCommandLine
} from './auto-real-x11-contract.mjs';

const refusal=/^Error: M41_OWNED_X11_WINDOW_WITNESS_REFUSED$/;
const pairRefusal=/^Error: M41_TWO_RUNNER_WINDOW_COMPARISON_REFUSED$/;
const flags=(mapped=false)=>({
 processImageObserved:true,windowTitleObserved:mapped,
 pidAttributed:mapped,mappedUsableWindowObserved:mapped
});
const exit=(runner,exitCode=null,exitSignal='SIGTRAP',timedOut=false)=>
 ({runner,exitCode,exitSignal,timedOut});
const m40=(runner,...rest)=>classifyM40DirectExit(exit(runner,...rest));
const m41=(runner,found,run)=>classify({runner,flags:flags(found),
 exit:{exitCode:run.exitCode,exitSignal:run.exitSignal,timedOut:run.timedOut}});
const make=()=>{
 const a=m40('ubuntu-22.04',null,'SIGKILL',true),
       b=m40('ubuntu-24.04');
 return {m40Pair:{
   schema:'M40_DIRECT_CROSS_RUNNER_INPUT_V1',
   scope:'two-disposable-linux-runner-exit-observations',
   observations:[{...a},{...b}]
  },m41Witnesses:[{...m41('ubuntu-22.04',true,a)},
    {...m41('ubuntu-24.04',false,b)}]};
};
function invariant(result){
 assert.equal(result.schema,'M41_DIRECT_X11_CROSS_RUNNER_WINDOW_COMPARISON_V1');
 assert.equal(result.directExitCategoriesReconciledWithM40,true);
 assert.equal(result.witnessedWindowPIDsNotCryptographicIdentity,true);
 for(const k of [
  'fullRendererSandboxIndependentlyVerified',
  'nativeAutoX11StrictGatePassedByThisComparison',
  'rootCauseApparmorOrCapabilitiesProven',
  'strictUbuntu24GateWaived','hostPolicyChanged','sandboxBypassApplied',
  'realModRead','mergeAuthorized','releaseAuthorized',
  'installationAuthorized'
 ])assert.equal(result[k],false,k);
 assert.equal(Object.isFrozen(result),true);
}
test('direct Ubuntu22 mapped/owned witness plus Ubuntu24 SIGTRAP without window',()=>{
 const r=compare(make());
 assert.equal(r.status,
  'ubuntu22OwnedMappedDirectWindowWhileUbuntu24SIGTRAPNoMappedWindow');
 assert.equal(r.ubuntu22OwnedMappedWindowObserved,true);
 assert.equal(r.ubuntu24OwnedMappedWindowObserved,false);
 assert.equal(r.ubuntu24DirectSIGTRAPObserved,true);invariant(r);
});
test('Ubuntu22 direct timeout without window remains inconclusive',()=>{
 const input=make();
 input.m41Witnesses[0]={...m41('ubuntu-22.04',false,
   input.m40Pair.observations[0])};
 const r=compare(input);
 assert.equal(r.status,'ubuntu22DirectWindowUnverifiedWhileUbuntu24SIGTRAP');
 assert.equal(r.ubuntu22OwnedMappedWindowObserved,false);invariant(r);
});
test('both mapped windows never certify a renderer sandbox',()=>{
 const input=make(),a=input.m40Pair.observations[1];
 input.m41Witnesses[1]={...m41('ubuntu-24.04',true,a)};
 const r=compare(input);
 assert.equal(r.status,'bothRunnersOwnedMappedWindowsObserved');
 assert.equal(r.fullRendererSandboxIndependentlyVerified,false);invariant(r);
});
test('Ubuntu24 non-SIGTRAP exit without mapped window is not proof of root cause',()=>{
 const input=make(),b=m40('ubuntu-24.04',1,null);
 input.m40Pair.observations[1]={...b};
 input.m41Witnesses[1]={...m41('ubuntu-24.04',false,b)};
 const r=compare(input);
 assert.equal(r.status,'crossRunnerDirectWindowEvidenceIncomplete');
 assert.equal(r.ubuntu24DirectSIGTRAPObserved,false);invariant(r);
});
test('mapped witness with timed out child remains an observation not clean exit',()=>{
 const r=classify({runner:'ubuntu-22.04',flags:flags(true),
   exit:{exitCode:null,exitSignal:'SIGKILL',timedOut:true}});
 assert.equal(r.category,'directOwnedMappedUsableX11WindowObserved');
 assert.equal(r.observedChildTimedOut,true);
 assert.equal(r.independentRendererSandboxVerified,false);
 assert.equal(r.fullNativeX11AutoGateCertifiedByThisWitness,false);
});
test('a timeout alone cannot set window, owner or verified title',()=>{
 const r=classify({runner:'ubuntu-22.04',flags:flags(false),
   exit:{exitCode:null,exitSignal:'SIGKILL',timedOut:true}});
 assert.equal(r.category,'directTimeoutWindowUnverified');
 assert.equal(r.mappedUsableWindowObserved,false);
});
test('a child SIGTRAP without window is not proof of AppArmor',()=>{
 const r=classify({runner:'ubuntu-24.04',flags:flags(false),
   exit:{exitCode:null,exitSignal:'SIGTRAP',timedOut:false}});
 assert.equal(r.category,'directSIGTRAPWithoutVerifiedWindow');
 assert.equal(r.apparmorCausalityProven,false);
});
test('a title that is not owned by child cannot be treated as mapped',()=>{
 const x=classify({runner:'ubuntu-22.04',
  flags:{processImageObserved:true,windowTitleObserved:true,
   pidAttributed:false,mappedUsableWindowObserved:false},
  exit:{exitCode:1,exitSignal:null,timedOut:false}});
 assert.equal(x.category,'candidateTitleWithoutOwnedMappedWindow');
 assert.equal(x.exactNETWMPIDAttributed,false);
});
test('fake mapped flag without exact PID, process or title refuses',()=>{
 const scenarios=[
  {processImageObserved:true,windowTitleObserved:true,
   pidAttributed:false,mappedUsableWindowObserved:true},
  {processImageObserved:false,windowTitleObserved:true,
   pidAttributed:true,mappedUsableWindowObserved:true},
  {processImageObserved:true,windowTitleObserved:false,
   pidAttributed:true,mappedUsableWindowObserved:false}
 ];
 for(const f of scenarios)
  assert.throws(()=>classify({runner:'ubuntu-22.04',flags:f,
   exit:{exitCode:0,exitSignal:null,timedOut:false}}),refusal);
});
test('incomplete or unexpected fields cannot leak private window names',()=>{
 const input={runner:'ubuntu-22.04',flags:{
  ...flags(true),windowTitle:'Private OMSI Mod'},
  exit:{exitCode:0,exitSignal:null,timedOut:false}};
 assert.throws(()=>classify(input),refusal);
 const x=make();x.m41Witnesses[0].windowTitle='/home/private';
 assert.throws(()=>compare(x),pairRefusal);
});
test('wrong runner or forged sandbox approval is refused',()=>{
 const input=make();input.m41Witnesses[1].runner='ubuntu-22.04';
 assert.throws(()=>compare(input),pairRefusal);
 const x=make();x.m41Witnesses[1].strictNativeGateWaived=true;
 assert.throws(()=>compare(x),pairRefusal);
 const y=make();y.m41Witnesses[0].independentRendererSandboxVerified=true;
 assert.throws(()=>compare(y),pairRefusal);
});
test('pair metadata must come from same process exit as M40',()=>{
 const input=make();input.m41Witnesses[1].observedChildExitSignal='SIGSYS';
 assert.throws(()=>compare(input),pairRefusal);
 const x=make();x.m41Witnesses[0].observedChildTimedOut=false;
 assert.throws(()=>compare(x),pairRefusal);
});
test('a claimed mapped witness without process identity is rejected',()=>{
 const input=make();
 input.m41Witnesses[0].nativeCommandLineObserved=false;
 assert.throws(()=>compare(input),pairRefusal);
});
test('wrong M40 direct exit category is never accepted as genuine',()=>{
 const input=make();input.m40Pair.observations[1].category='sandbox-passed';
 assert.throws(()=>compare(input),pairRefusal);
});
test('all real witness fields are recalculated from mandatory fixed contracts',()=>{
 const input=make();input.m41Witnesses[0].category='fake-valid-window';
 assert.throws(()=>compare(input),pairRefusal);
 const y=make();y.m41Witnesses[0].source='foreign-observer';
 assert.throws(()=>compare(y),pairRefusal);
});
test('missing, duplicated or reversed observations are refused',()=>{
 const a=make();a.m41Witnesses.pop();
 assert.throws(()=>compare(a),pairRefusal);
 const b=make();b.m41Witnesses.reverse();
 assert.throws(()=>compare(b),pairRefusal);
 const c=make();c.m40Pair.observations.reverse();
 assert.throws(()=>compare(c),pairRefusal);
});
test('native window title must be exact OMSI Manager pattern not arbitrary',()=>{
 const tree='0x111111 "Private Launcher": ("app" "app")\n';
 assert.throws(()=>findPreviewWindow(tree),/X11_WINDOW_NOT_VERIFIED/);
 const matching='0xabc123 "OMSI Manager Preview": ("app" "app")\n';
 assert.equal(findPreviewWindow(matching),'0xabc123');
});
test('exact _NET_WM_PID and viewable 800x500 geometry required',()=>{
 assert.equal(verifyNativeWindowOwner(
  '_NET_WM_PID(CARDINAL) = 12345\n',12345),true);
 assert.throws(()=>verifyNativeWindowOwner(
  '_NET_WM_PID(CARDINAL) = 12346\n',12345),/X11_WINDOW_OWNER_NOT_VERIFIED/);
 const mapped='Map State: IsViewable\nWidth: 1024\nHeight: 768\n';
 assert.equal(verifyMappedWindow(mapped).mapped,true);
 assert.throws(()=>verifyMappedWindow(
  'Map State: IsUnMapped\nWidth: 1024\nHeight: 768'),
  /X11_WINDOW_NOT_VERIFIED/);
});
test('native process identification requires exact path and X11 ozone flag',()=>{
 const ok=Buffer.from('/opt/OMSI-Manager-Preview\u0000--ozone-platform=x11\u0000');
 assert.equal(verifyNativeCommandLine(ok,'x11'),true);
 assert.throws(()=>verifyNativeCommandLine(
  Buffer.from('/opt/OMSI-Manager-Preview\u0000--no-sandbox\u0000'),'x11'),
  /NATIVE_AUTO_PROCESS_NOT_VERIFIED/);
});
test('malformed envelopes, fake runner and impossible exit record refuse',()=>{
 for(const value of [null,undefined,{},[],false,'preview'])
  assert.throws(()=>compare(value),pairRefusal);
 const x=make();x.m40Pair.observations[0].exitCode=133;
 // With timedOut=true, recording an exit code isn't proof of success;
 // make a genuinely contradictory *non-timeout* exit+signal record.
 x.m40Pair.observations[0].timedOut=false;
 assert.throws(()=>compare(x),pairRefusal);
 const y=make();y.m41Witnesses[1].mappedUsableWindowObserved='yes';
 assert.throws(()=>compare(y),pairRefusal);
});
test('no process IDs, raw X11 output, paths or tokens leave the report',()=>{
 const raw=JSON.stringify(compare(make()));
 for(const secret of ['/home/private','xwininfo','xprop','_NET_WM_PID',
  '12345','--ozone-platform=x11','ghp_','stderr','PID:'])
  assert.equal(raw.includes(secret),false,secret);
 invariant(compare(make()));
});
test('comparison CLI refuses offline invocation without CI credentials',()=>{
 const r=spawnSync(process.execPath,
  ['./auto-x11-cross-runner-window-compare.mjs'],{
   cwd:new URL('.',import.meta.url).pathname,
   encoding:'utf8',timeout:3000,maxBuffer:1024,
   env:{PATH:'/usr/bin:/bin',CI:'false',GITHUB_ACTIONS:'false'}
  });
 assert.equal(r.status,1);
 assert.match(r.stderr,/M41_TWO_RUNNER_WINDOW_COMPARISON_REFUSED/);
 assert.equal(r.stdout,'');
});
