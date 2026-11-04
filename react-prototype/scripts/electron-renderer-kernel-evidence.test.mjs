import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyPackagedRendererKernelEvidence as classify,
 probePackagedRendererKernelEvidence as probe} from './electron-renderer-kernel-evidence.mjs';
const status=(seccomp='2',nnp='1')=>
 'Name:\tOMSI-Manager\nState:\tS (sleeping)\nNoNewPrivs:\t'+nnp+'\nSeccomp:\t'+seccomp+'\n';
const cmd=(parts=['/fake/release/OMSI-Manager-Preview','--type=renderer','--lang=en-US'])=>
 Buffer.from(parts.join('\0')+'\0');
const refused=/^Error: ELECTRON_RENDERER_KERNEL_EVIDENCE_REFUSED$/;
test('observes renderer seccomp filter and no-new-privileges, without sandbox certification',()=>{
 const result=classify(status(),cmd());
 assert.equal(result.category,'renderer-kernel-restrictions-observed');
 assert.equal(result.seccompMode,'filter');
 assert.equal(result.noNewPrivs,'enabled');
 for(const flag of ['fullElectronSandboxCertified','userNamespaceIsolationCertified',
  'apparmorCausalityProven','hostPolicyChanged','gameContentRead'])
  assert.equal(result[flag],false,flag);
 assert.equal(Object.isFrozen(result),true);
});
test('missing kernel hardening remains incomplete, never a verified sandbox',()=>{
 for(const [seccomp,nnp] of [['0','1'],['1','1'],['2','0'],['0','0']]){
  const result=classify(status(seccomp,nnp),cmd());
  assert.equal(result.category,'renderer-kernel-restrictions-incomplete');
  assert.equal(result.fullElectronSandboxCertified,false);
 }
});
test('rejects impersonated nonrenderer, extra renderer role and bypass flags',()=>{
 const bad=[
  ['/fake/release/another','--type=renderer'],
  ['/fake/release/OMSI-Manager-Preview','--type=gpu-process'],
  ['/fake/release/OMSI-Manager-Preview','--type=renderer','--type=renderer'],
  ['/fake/release/OMSI-Manager-Preview','--type=renderer','--no-sandbox'],
  ['/fake/release/OMSI-Manager-Preview','--type=renderer','--disable-setuid-sandbox'],
  ['/fake/release/OMSI-Manager-Preview','--type=renderer','--disable-seccomp-filter-sandbox=1'],
  ['/fake/release/OMSI-Manager-Preview','--no-sandbox']
 ];
 for(const argv of bad)assert.throws(()=>classify(status(),cmd(argv)),refused);
});
test('rejects malformed, duplicated, or contradictory proc status',()=>{
 const bad=[
  '',status()+'NoNewPrivs:\t0\n',
  status()+'Seccomp:\t0\n',
  status().replace('NoNewPrivs:\t1','NoNewPrivs:\tunknown'),
  status().replace('Seccomp:\t2',''),
  status().replace('Seccomp:\t2','Seccomp:\t3'),
  'private:/home/user\n'+status()+'A'.repeat(65536)
 ];
 for(const input of bad)assert.throws(()=>classify(input,cmd()),refused);
});
test('non-NUL or excessive cmdline is refused',()=>{
 for(const value of [Buffer.from('not terminated'),
  Buffer.from('/fake/OMSI-Manager-Preview\0--type=renderer'),
  Buffer.from('A'.repeat(65537)),Buffer.alloc(0)])
  assert.throws(()=>classify(status(),value),refused);
});
test('no arbitrary pid or unprivileged host inspection via API',async()=>{
 for(const pid of [null,-2,0,1,1.25,'2',{},2147483648])
  await assert.rejects(probe(pid),refused);
});
test('raw paths and credentials never become serialized evidence',()=>{
 const secret='/home/private/key TOKEN-123';
 const result=classify(status()+secret+'\n',cmd([
 '/home/private/OMSI-Manager-Preview','--type=renderer','--user-data-dir='+secret
 ]));
 const serialized=JSON.stringify(result);
 assert.equal(serialized.includes(secret),false);
 assert.equal(serialized.includes('uid'),false);
});
