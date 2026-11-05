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
  [status(),cmd(['/fake/OMSI-Manager-Preview','--type=gpu-process']),'renderer-role-conflicting-gpu'],
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


test('categorizes contradictory Chromium roles without logging raw process arguments',()=>{
 const pid=45678;
 const proof=verifyMetric(pid,[{pid,type:'Tab',creationTime:1710000000000}]);
 const scenarios=[
  [['--type=renderer','--type=renderer'],'renderer-role-duplicate-type-switch'],
  [['--type=renderer','--type=utility'],'renderer-role-duplicate-type-switch'],
  [['--type=gpu-process'],'renderer-role-conflicting-gpu'],
  [['--type=utility'],'renderer-role-conflicting-utility'],
  [['--type=zygote'],'renderer-role-conflicting-zygote'],
  [['--type=irrelevant-private-secret'],'renderer-role-conflicting-other']
 ];
 for(const [args,expected] of scenarios){
  let result;
  try{classify(status(),cmd(['/fake/OMSI-Manager-Preview',...args,'--lang=en-US']),proof);}
  catch(e){result=e;}
  assert.equal(result?.reason,expected);
  assert.equal(result?.message,'ELECTRON_RENDERER_KERNEL_EVIDENCE_REFUSED');
  assert.equal(JSON.stringify({reason:result.reason}).includes('secret'),false);
  assert.equal(Object.keys(result).includes('reason'),false);
 }
});
test('missing type switch is accepted only with a valid Electron Tab proof',()=>{
 const pid=45678;
 const line=cmd(['/fake/OMSI-Manager-Preview','--lang=en-US']);
 assert.throws(()=>classify(status(),line),e=>e.reason==='renderer-role-unverified');
 const proof=verifyMetric(pid,[{pid,type:'Tab',creationTime:1710000000000}]);
 assert.equal(classify(status(),line,proof).roleEvidence,
  'electron-metrics-and-process-command-line');
});


test('Linux zygote-fork cmdline is accepted ONLY with a verified Electron Tab metric',()=>{
 const pid=56321;
 const inherited=cmd(['/fake/release/OMSI-Manager-Preview','--type=zygote','--lang=en-US']);
 assert.throws(()=>classify(status(),inherited),e=>
  e.reason==='renderer-role-conflicting-zygote');
 const proof=verifyMetric(pid,[{pid,type:'Tab',creationTime:1710000000000}]);
 const result=classify(status(),inherited,proof);
 assert.equal(result.category,'renderer-kernel-restrictions-observed');
 assert.equal(result.roleEvidence,'electron-tab-metric-and-zygote-fork-cmdline');
 assert.equal(result.seccompMode,'filter');
 assert.equal(result.noNewPrivs,'enabled');
 assert.equal(result.fullElectronSandboxCertified,false);
 assert.equal(result.userNamespaceIsolationCertified,false);
 assert.ok(Object.isFrozen(result));
});
test('zygote inheritance never authorizes bypass or another process type',()=>{
 const pid=56321;
 const proof=verifyMetric(pid,[{pid,type:'Tab',creationTime:1710000000000}]);
 for(const sw of ['--no-sandbox','--disable-setuid-sandbox',
  '--disable-seccomp-filter-sandbox','--no-zygote','--single-process']){
  assert.throws(()=>classify(status(),cmd([
   '/fake/release/OMSI-Manager-Preview','--type=zygote',sw
  ]),proof),e=>e.reason==='sandbox-bypass-switch',sw);
 }
 for(const sw of ['--type=utility','--type=gpu-process','--type=unknown']){
  assert.throws(()=>classify(status(),cmd([
   '/fake/release/OMSI-Manager-Preview',sw
  ]),proof),refused);
 }
 for(const [seccomp,nnp] of [['0','1'],['1','1'],['2','0']]){
  const evidence=classify(status(seccomp,nnp),cmd([
   '/fake/release/OMSI-Manager-Preview','--type=zygote','--lang=en-US'
  ]),proof);
  assert.equal(evidence.category,'renderer-kernel-restrictions-incomplete');
  assert.equal(evidence.fullElectronSandboxCertified,false);
 }
});
test('zygote identity proof is invalid when metric PID or type mismatches',()=>{
 const pid=56321;
 for(const row of [
  {pid:pid+1,type:'Tab',creationTime:1710000000000},
  {pid,type:'Zygote',creationTime:1710000000000},
  {pid,type:'Utility',creationTime:1710000000000},
  {pid,type:'Tab',creationTime:0}
 ])assert.throws(()=>verifyMetric(pid,[row]),e=>e.reason==='electron-metric-role-unverified');
});


test('all packaged Linux Electron Playwright launches explicitly request Chromium sandbox',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('./portable-linux-smoke.mjs',import.meta.url),'utf8');
 const starts=[...source.matchAll(/\bapplication\s*=\s*await\s+electron\.launch\s*\(\s*\{/g)];
 assert.equal(starts.length,2,'expected main and GNOME/KDE X11 Electron launch sites');
 for(const match of starts){
  const body=source.slice(match.index,match.index+500);
  assert.match(body,/chromiumSandbox:\s*true\b/);
  assert.doesNotMatch(body,/chromiumSandbox:\s*false\b/);
 }
 assert.doesNotMatch(source,/chromiumSandbox:\s*false\b/);
 // A removed or weakened option must fail the gate for that launch site.
 for(const changed of [
  source.replace('chromiumSandbox:true,',''),
  source.replace('chromiumSandbox:true,','chromiumSandbox:false,')
 ]){
  const launches=[...changed.matchAll(/\bapplication\s*=\s*await\s+electron\.launch\s*\(\s*\{/g)];
  assert.equal(launches.length,2);
  assert.equal(launches.every(m=>
   /chromiumSandbox:\s*true\b/.test(changed.slice(m.index,m.index+500)) &&
   !/chromiumSandbox:\s*false\b/.test(changed.slice(m.index,m.index+500))
  ),false);
 }
});
