import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {classifyM43Trials as classify,verifyM43Trials as verify}
 from './auto-x11-direct-repeatability.mjs';
import {compareM43Pair as compare} from './auto-x11-direct-repeatability-compare.mjs';
const err=/M43_DIRECT_REPEATABILITY_REFUSED/;
const pairErr=/M43_REPEATABILITY_PAIR_REFUSED/;
function trial(r,k){
 const t=k==='timeout',s=k==='trap',m=k==='mapped';
 return {exit:{runner:r,exitCode:t||s?null:0,exitSignal:t?'SIGKILL':s?'SIGTRAP':null,timedOut:t},
  witness:{processImageObserved:true,windowTitleObserved:m,pidAttributed:m,mappedUsableWindowObserved:m}};
}
function build(r,kinds){return classify({runner:r,observations:kinds.map(k=>trial(r,k))});}
const a=()=>build('ubuntu-22.04',['mapped','timeout','mapped']);
const b=()=>build('ubuntu-24.04',['trap','trap','trap']);
test('some windows means intermittent, not deterministic',()=>{
 const r=a();assert.equal(r.mappedCount,2);
 assert.equal(r.status,'windowInSomeTrials');assert.equal(verify(r).mapped,2);
});
test('repeated SIGTRAP is not AppArmor causality',()=>{
 const r=b();assert.equal(r.sigtrapCount,3);
 assert.equal(r.appArmorCauseProven,false);assert.equal(r.ubuntu24NativeGatePassed,false);
});
test('all observed windows still do not certify renderer confinement',()=>{
 const r=build('ubuntu-22.04',['mapped','mapped','mapped']);
 assert.equal(r.status,'windowInEveryTrial');
 assert.equal(r.rendererSandboxCertified,false);assert.equal(r.mergeAuthorized,false);
});
test('partial SIGTRAP observations remain partial',()=>{
 const r=build('ubuntu-24.04',['trap','timeout','trap']);
 assert.equal(r.status,'someSIGTRAPWithoutVerifiedWindow');
});
test('wrong number of trials refused',()=>{
 for(const kinds of [[],['trap'],['trap','trap'],['trap','trap','trap','trap']]){
  assert.throws(()=>build('ubuntu-24.04',kinds),err);
 }
});
test('mixed runner labels and private paths fail closed',()=>{
 const input={runner:'ubuntu-22.04',observations:['mapped','mapped','mapped'].map(k=>trial('ubuntu-22.04',k))};
 input.observations[0].exit.runner='ubuntu-24.04';assert.throws(()=>classify(input),err);
 input.observations[0].exit.runner='ubuntu-22.04';
 input.home='/home/runner';assert.throws(()=>classify(input),err);
});
test('unsafe X11 witness without PID ownership refused',()=>{
 const input={runner:'ubuntu-22.04',observations:['mapped','timeout','mapped'].map(k=>trial('ubuntu-22.04',k))};
 input.observations[0].witness.pidAttributed=false;
 assert.throws(()=>classify(input),err);
});
test('forged approval and extra fields rejected',()=>{
 for(const [key,value] of [['mergeAuthorized',true],['ubuntu24GateWaived',true],
   ['rendererSandboxCertified',true],['privatePath','/home/user']]){
  const r=JSON.parse(JSON.stringify(a()));r[key]=value;assert.throws(()=>verify(r),err);
 }
});
test('tampered counts, status, category, attempt rejected',()=>{
 for(const mutate of [
  r=>{r.mappedCount=3;},r=>{r.status='success';},
  r=>{r.attempts[0].attempt=2;},r=>{r.attempts[0].mapped=false;},
  r=>{r.attempts[0].windowCategory='directSIGTRAPWithoutVerifiedWindow';}
 ]){
  const r=JSON.parse(JSON.stringify(a()));mutate(r);assert.throws(()=>verify(r),err);
 }
});
test('reports do not include raw stderr, paths or PIDs',()=>{
 const s=JSON.stringify(a())+JSON.stringify(b());
 for(const word of ['stderr','/home/runner','/proc/self','_NET_WM_PID','xwininfo',
  'Bearer ','/etc/apparmor'])assert.equal(s.includes(word),false,word);
});
test('pair reports limited contrast, never native gate waiver',()=>{
 const r=compare({ubuntu22:a(),ubuntu24:b()});
 assert.equal(r.status,'ubuntu22WindowObservedUbuntu24ThreeSIGTRAP');
 assert.equal(r.ubuntu24NativeGatePassed,false);
 assert.equal(r.repeatedSIGTRAPProvesAppArmorCause,false);
});
test('missing Ubuntu22 window cannot be claimed a success',()=>{
 const r=compare({ubuntu22:build('ubuntu-22.04',['timeout','timeout','timeout']),ubuntu24:b()});
 assert.equal(r.status,'ubuntu22WindowUnverifiedUbuntu24ThreeSIGTRAP');
});
test('swapped and forged pair labels rejected',()=>{
 assert.throws(()=>compare({ubuntu22:b(),ubuntu24:a()}),pairErr);
 const r=JSON.parse(JSON.stringify(b()));r.mergeAuthorized=true;
 assert.throws(()=>compare({ubuntu22:a(),ubuntu24:r}),pairErr);
});
test('both diagnostic entrypoints reject offline execution',()=>{
 for(const path of ['./auto-x11-direct-repeatability.mjs',
                     './auto-x11-direct-repeatability-compare.mjs']){
  const r=spawnSync(process.execPath,[path],{cwd:new URL('.',import.meta.url).pathname,
   env:{CI:'false',GITHUB_ACTIONS:'false',PATH:'/usr/bin:/bin'},
   encoding:'utf8',timeout:4000,maxBuffer:1024});
  assert.equal(r.status,1);assert.equal(r.stdout,'');
  assert.match(r.stderr,path.includes('compare')?pairErr:err);
 }
});
