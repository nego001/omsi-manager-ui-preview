import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectRuntimeReadPlan as plan} from './runtime-read-policy.mjs';
const refuse=/^Error: CORE_RUNTIME_POLICY_REFUSED$/;
const input=()=>({scope:'synthetic-fixture',platform:'linux',requests:[{path:'vehicle/a.bus',operation:'read-bytes',maxBytes:128},{path:'vehicle/b.cfg',operation:'metadata',maxBytes:0}],limits:{maxEntries:8,maxTotalBytes:1024,maxFileBytes:512,maxDepth:4}});
test('runtime dry-run reserves bounded bytes and never authorizes real reads',()=>{
 for(const platform of ['win32','linux']){
  const x=input();x.platform=platform;const r=plan(x);
  assert.equal(r.reservedBytes,128);assert.equal(r.decision,'deny-real-access');assert.equal(r.dryRunValidated,true);
  for(const k of ['filesystemOpened','realReadsPerformed','osIsolationVerified','realSecurityGateVerified','operationsEnabled','releaseAuthorized'])assert.equal(r[k],false);
  assert.ok(r.pendingGates.includes('packaged-linux-f1'));
 }
});
test('runtime plan refuses actual roots, dangerous operations and fake gate assertions',()=>{
 for(const v of [{...input(),scope:'real-mod'},{...input(),root:'/tmp'},{...input(),platform:'darwin'},{...input(),realSecurityGateVerified:true}])assert.throws(()=>plan(v),refuse);
 for(const operation of ['write','delete','execute','extract','rename','open','network']){const x=input();x.requests[0].operation=operation;assert.throws(()=>plan(x),refuse);}
});
test('runtime plan rejects traversal absolute paths reserved names and alias collisions',()=>{
 for(const path of ['../a','/a','C:\\a','\\\\host\\a','vehicle/../a','vehicle//a','vehicle/NUL.txt','vehicle/a.','vehicle/a:stream','vehicle/B.cfg','vehicle/b.cfg','vehicle']){
  const x=input();x.requests[0].path=path;assert.throws(()=>plan(x),refuse);
 }
});
test('per-file, aggregate, depth and entry ceilings are independent',()=>{
 for(const patch of [{maxFileBytes:64},{maxTotalBytes:127,maxFileBytes:127},{maxDepth:1},{maxEntries:1}]){
  const x=input();Object.assign(x.limits,patch);assert.throws(()=>plan(x),refuse);
 }
 const x=input();x.requests[0].maxBytes=512;x.requests[1]={path:'vehicle/b.cfg',operation:'read-bytes',maxBytes:512};
 assert.equal(plan(x).reservedBytes,1024);x.limits.maxTotalBytes=1023;assert.throws(()=>plan(x),refuse);
});
test('runtime metadata reservation cannot carry a byte-read budget',()=>{
 const x=input();x.requests[1].maxBytes=1;assert.throws(()=>plan(x),refuse);
 x.requests[1].maxBytes=0;x.requests[0].maxBytes=0;assert.throws(()=>plan(x),refuse);
});
test('plan identity deterministic and immutable, bound to platform and limits',()=>{
 const x=input(),r=plan(x);assert.deepEqual(plan({...x,requests:[...x.requests].reverse()}),r);
 assert.notEqual(plan({...x,platform:'win32'}).planDigest,r.planDigest);
 assert.notEqual(plan({...x,limits:{...x.limits,maxEntries:9}}).planDigest,r.planDigest);
 const {planDigest,...body}=r;assert.equal(planDigest,createHash('sha256').update(JSON.stringify(body)).digest('hex'));
 for(const o of [r,r.limits,r.requests,r.requests[0],r.pendingGates])assert.ok(Object.isFrozen(o));
});
test('runtime request accessors and extra fields are refused without invocation',()=>{
 const x=input();let called=false;Object.defineProperty(x.requests[0],'path',{get(){called=true;return 'a'}});
 assert.throws(()=>plan(x),refuse);assert.equal(called,false);
 const y=input();y.requests[0].handle='fake';assert.throws(()=>plan(y),refuse);
});
