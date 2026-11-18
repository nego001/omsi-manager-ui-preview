import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {classifyM44 as classify,verifyM44}
 from './auto-x11-direct-stderr-categories.mjs';
import {compareM44Pair} from './auto-x11-direct-stderr-compare.mjs';
const REFUSE=/M44_STDERR_REFUSED/,PAIR=/M44_STDERR_PAIR_REFUSED/;
const input=(runner='ubuntu-24.04',stderr='',signal='SIGTRAP')=>
 ({runner,exitCode:signal===null?0:null,exitSignal:signal,
   timedOut:false,stderr,truncated:false});
const sample=(r='ubuntu-24.04',s='')=>classify(input(r,s));
const timeout=()=>classify({runner:'ubuntu-22.04',exitCode:null,
 exitSignal:'SIGKILL',timedOut:true,stderr:'',truncated:false});
test('specific namespace-denied message becomes category, not causality',()=>{
 const r=sample('ubuntu-24.04','Failed to move to new namespace: Operation not permitted');
 assert.equal(r.stderrCategory,'namespace-denial-message');
 assert.equal(r.apparmorCauseProven,false);
});
test('sandbox-unavailable classification keeps gate red',()=>{
 const r=sample('ubuntu-24.04','No usable sandbox!');
 assert.equal(r.stderrCategory,'sandbox-unavailable-message');
 assert.equal(r.ubuntu24StrictGatePassed,false);
});
test('seccomp and zygote failure categories distinct',()=>{
 assert.equal(sample('ubuntu-24.04','seccomp initialization failed').stderrCategory,'seccomp-failure-message');
 assert.equal(sample('ubuntu-24.04','zygote initialization failed').stderrCategory,'zygote-failure-message');
});
test('generic FATAL and unknown diagnostics remain separate',()=>{
 assert.equal(sample('ubuntu-24.04','FATAL: unexpected').stderrCategory,'generic-fatal-message');
 assert.equal(sample().stderrCategory,'no-recognized-diagnostic');
});
test('specific category wins over generic FATAL',()=>{
 assert.equal(sample('ubuntu-24.04','FATAL: No usable sandbox!').stderrCategory,'sandbox-unavailable-message');
});
test('numeric code 133 is not an actual SIGTRAP signal',()=>{
 const r=classify({...input('ubuntu-24.04','',null),exitCode:133});
 assert.equal(r.exitCategory,'code133-not-signal');
 assert.equal(sample().exitCategory,'sigtrap');
});
test('intentional timeout is not proof of clean shutdown or sandbox',()=>{
 const r=timeout();assert.equal(r.exitCategory,'timeout');
 assert.equal(r.rendererSandboxCertified,false);
});
test('invalid input, wrong labels, extra private fields refused',()=>{
 for(const v of [null,false,{},[],undefined])assert.throws(()=>classify(v),REFUSE);
 assert.throws(()=>classify({...input(),privatePath:'/home/runner'}),REFUSE);
 assert.throws(()=>classify(input('ubuntu-20.04')),REFUSE);
});
test('stderr over bounded maximum refused',()=>{
 assert.throws(()=>classify(input('ubuntu-24.04','z'.repeat(8193))),REFUSE);
});
test('forged policy, renderer, approval fields refuse verification',()=>{
 for(const k of ['mergeAuthorized','rendererSandboxCertified','hostPolicyChanged',
  'ubuntu24StrictGateWaived','releaseAuthorized']){
  const r={...sample(),[k]:true};
  assert.throws(()=>verifyM44(r),REFUSE);
 }
});
test('private raw log never appears in serialized reports',()=>{
 const raw='FATAL: No usable sandbox! /home/runner PID: 12345 secret';
 const s=JSON.stringify(sample('ubuntu-24.04',raw));
 for(const word of ['/home/runner','PID: 12345','secret','FATAL:'])
  assert.equal(s.includes(word),false);
});
test('paired reports distinguish both hosts without approval',()=>{
 const r=compareM44Pair({ubuntu22:timeout(),ubuntu24:sample()});
 assert.equal(r.status,'ubuntu24SIGTRAPCategoryObserved');
 assert.equal(r.stderrCategoryProvesCausality,false);
 assert.equal(r.installationAuthorized,false);
});
test('pair refuses swaps and forged reports',()=>{
 assert.throws(()=>compareM44Pair({ubuntu22:sample(),ubuntu24:timeout()}),PAIR);
 assert.throws(()=>compareM44Pair({ubuntu22:timeout()}),PAIR);
 const r={...sample(),mergeAuthorized:true};
 assert.throws(()=>compareM44Pair({ubuntu22:timeout(),ubuntu24:r}),PAIR);
});
test('CLI entrypoints refuse offline invocation',()=>{
 for(const name of ['auto-x11-direct-stderr-categories.mjs',
                    'auto-x11-direct-stderr-compare.mjs']){
  const x=spawnSync(process.execPath,['./'+name],{
   cwd:new URL('.',import.meta.url).pathname,
   env:{PATH:'/usr/bin:/bin',CI:'false',GITHUB_ACTIONS:'false'},
   encoding:'utf8',maxBuffer:1024,timeout:4000
  });
  assert.equal(x.status,1,name);assert.equal(x.stdout,'',name);
  assert.match(x.stderr,name.includes('-compare')?PAIR:REFUSE);
 }
});
