import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyPackagedRendererKernelEvidence as classify,
 probePackagedRendererKernelEvidence as probe,
 verifyElectronRendererMetric as verifyMetric} from './electron-renderer-kernel-evidence.mjs';
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


test('each failure uses only a fixed privacy-safe category',()=>{
 const cases=[
  [status(),cmd(['/fake/another','--type=renderer']),'unexpected-executable'],
  [status(),cmd(['/fake/OMSI-Manager-Preview','--type=gpu-process']),'renderer-role-unverified'],
  [status(),cmd(['/fake/OMSI-Manager-Preview','--type=renderer','--no-sandbox']),'sandbox-bypass-switch'],
  [status().replace('Seccomp:\t2',''),'','invalid-seccomp-field'],
  [status().replace('NoNewPrivs:\t1',''),'','invalid-no-new-privileges-field']
 ];
 for(const [stat,argv,reason] of cases){
  const command=argv===''?cmd():argv;
  assert.throws(()=>classify(stat,command),e=>
   e.message==='ELECTRON_RENDERER_KERNEL_EVIDENCE_REFUSED'&&e.reason===reason);
 }
 for(const value of [42,null,undefined,Buffer.alloc(0)])
  assert.throws(()=>classify(status(),value),e=>
   e.message==='ELECTRON_RENDERER_KERNEL_EVIDENCE_REFUSED'&&
   e.reason==='invalid-proc-command-line');
});
test('reason codes are fixed even when raw input includes private data',()=>{
 const error=assert.throws(()=>classify(status(),cmd([
  '/home/private/key/unknown-binary','--type=renderer','--user-data-dir=/home/private/token'
 ])));
 // Explicitly capture via try/catch because assert.throws may not return a value.
 let caught;
 try{classify(status(),cmd(['/home/private/key/unknown-binary','--type=renderer']));}
 catch(e){caught=e;}
 assert.equal(caught.reason,'unexpected-executable');
 assert.equal(Object.keys(caught).includes('reason'),false);
 assert.equal(JSON.stringify({reason:caught.reason}).includes('/home/private'),false);
});


test('trusted Electron Tab metric identifies a real renderer even if Chromium omits --type switch',()=>{
 const pid=34567;
 const proof=verifyMetric(pid,[{pid,type:'Tab',creationTime:1710000000000}]);
 const noType=cmd(['/fake/release/OMSI-Manager-Preview','--lang=en-US','--sandboxed-renderer']);
 const result=classify(status(),noType,proof);
 assert.equal(result.category,'renderer-kernel-restrictions-observed');
 assert.equal(result.roleEvidence,'electron-metrics-and-process-command-line');
 assert.equal(result.fullElectronSandboxCertified,false);
});
test('renderer metric cannot be forged with plain object or wrong process type',()=>{
 const pid=34567;
 const noType=cmd(['/fake/release/OMSI-Manager-Preview','--lang=en-US']);
 assert.throws(()=>classify(status(),noType,{source:'electron-main-process-metrics'}),e=>
  e.reason==='renderer-role-unverified');
 for(const records of [[],null,{},[{}],
  [{pid,type:'Browser',creationTime:1710000000000}],
  [{pid:pid+1,type:'Tab',creationTime:1710000000000}],
  [{pid,type:'Utility',creationTime:1710000000000}],
  [{pid,type:'Tab',creationTime:0}],
  [{pid,type:'Tab',creationTime:'1710000000000'}],
  [{pid,type:'Tab',creationTime:1710000000000},{pid,type:'Tab',creationTime:1710000000000}]
 ]){
  assert.throws(()=>verifyMetric(pid,records),e=>
   e.reason==='electron-metric-role-unverified');
 }
});
test('trusted Electron metric never overrides a contrary --type or sandbox bypass',()=>{
 const pid=34567;
 const proof=verifyMetric(pid,[{pid,type:'Tab',creationTime:1710000000000}]);
 for(const argv of [
  ['/fake/OMSI-Manager-Preview','--type=gpu-process'],
  ['/fake/OMSI-Manager-Preview','--type=utility'],
  ['/fake/OMSI-Manager-Preview','--type=renderer','--type=renderer'],
  ['/fake/OMSI-Manager-Preview','--type=renderer','--no-sandbox'],
  ['/fake/OMSI-Manager-Preview','--disable-seccomp-filter-sandbox','--lang=en-US']
 ])assert.throws(()=>classify(status(),cmd(argv),proof),refused);
});
test('probe rejects absent main-process role evidence before attempting proc read',async()=>{
 await assert.rejects(probe(34567,[]),e=>
  e.reason==='electron-metric-role-unverified');
});
