import {test} from 'node:test';
import assert from 'node:assert/strict';
import {captureNativeAtSpawn as capture,
 recordVerifiedIdentitySource as recordSource}
 from './auto-x11-spawn-witness.mjs';
import {EARLY_NATIVE_UNAVAILABLE} from './auto-x11-early-native-kernel.mjs';
const pid=34567;
const command=Buffer.from('/sandbox/OMSI-Manager-Preview\0--ozone-platform=x11\0');
const status='Name:\tOMSI\nState:\tS\nSeccomp:\t0\nNoNewPrivs:\t0\n';
const sensitive='/home/private/user/secret (enforce)\n';
const reader=(path,encoding)=>{
 if(path===`/proc/${pid}/cmdline`)return command;
 if(path===`/proc/${pid}/status`)return status;
 if(path===`/proc/${pid}/attr/current`)return sensitive;
 throw Error('unknown');
};
test('positive evidence requires valid Electron cmdline before kernel categorization',()=>{
 const result=capture(pid,'x11',reader);
 assert.equal(result.nativeProcess,true);
 assert.equal(result.processImageVerifiedByCmdline,true);
 assert.equal(result.spawnEventAloneAccepted,false);
 assert.equal(result.earlyNativeKernel.seccompMode,'off');
 assert.equal(result.earlyNativeKernel.noNewPrivs,'disabled');
 assert.equal(result.earlyNativeKernel.apparmorLabelCategory,'enforce-label-observed');
 assert.equal(result.earlyNativeKernel.rendererSandboxCertified,false);
 assert.equal(result.earlyNativeKernel.fullElectronSandboxCertified,false);
 assert.equal(JSON.stringify(result).includes('/home/private'),false);
 assert.ok(Object.isFrozen(result));
});
test('missing, still-wrapper, malicious switches or invalid pid never prove image',()=>{
 for(const input of [
  Buffer.from('/sandbox/OMSI-Manager-Auto\0'),
  Buffer.from('/sandbox/OMSI-Manager-Preview\0--no-sandbox\0'),
  Buffer.from('/sandbox/OMSI-Manager-Preview\0--ozone-platform=wayland\0'),
  Buffer.from('/sandbox/OMSI-Manager-Preview\0--ozone-platform=x11\0--extra\0'),
  Buffer.from('/sandbox/other\0--ozone-platform=x11\0')
 ]){
  const result=capture(pid,'x11',path=>
   path.endsWith('/cmdline')?input:status);
  assert.equal(result.nativeProcess,false);
  assert.strictEqual(result.earlyNativeKernel,EARLY_NATIVE_UNAVAILABLE);
 }
 for(const p of [-1,0,1,1.5,'123',{},2147483648]){
  let called=false;
  const result=capture(p,'x11',()=>{called=true;throw Error('invalid');});
  assert.equal(called,false);
  assert.equal(result.nativeProcess,false);
 }
});
test('kernel snapshot failure does not forge restrictions after verified identity',()=>{
 const witness=capture(pid,'x11',path=>{
  if(path.endsWith('/cmdline'))return command;
  throw Error('permission denied PRIVATE /home/private');
 });
 assert.equal(witness.nativeProcess,true);
 assert.equal(witness.earlyNativeKernel.seccompMode,'unknown');
 assert.equal(witness.earlyNativeKernel.noNewPrivs,'unknown');
 assert.equal(witness.earlyNativeKernel.apparmorLabelCategory,'unavailable');
 assert.equal(witness.spawnEventAloneAccepted,false);
 assert.equal(JSON.stringify(witness).includes('PRIVATE'),false);
});
test('real X11 CI has both spawn-edge witness hooks and async retry checks',async()=>{
 const {readFile}=await import('node:fs/promises');
 const content=await readFile(new URL('./auto-real-x11-smoke.mjs',import.meta.url),'utf8');
 assert.equal((content.match(/captureNativeAtSpawn\(child\.pid,'x11'\)/g)||[]).length,3);
 assert.equal((content.match(/captureNativeOnStderr\(child,(?:seen|observed)\)/g)||[]).length,2);
 assert.equal((content.match(/verifyNativeCommandLine\(command,'x11'\)/g)||[]).length,2);
 assert.match(content,/AUTO_X11_SANITIZED_CHECKPOINT/);
 assert.doesNotMatch(content,/--no-sandbox|--disable-setuid-sandbox|ELECTRON_DISABLE_SANDBOX/);
});


test('source attribution refuses spawn-only events and preserves first verified method',()=>{
 assert.equal(recordSource('unobserved','spawn-callback',false),'unobserved');
 assert.equal(recordSource('unobserved','spawn-callback','true'),'unobserved');
 assert.equal(recordSource('unobserved','spawn-callback',true),'spawn-callback');
 assert.equal(recordSource('unobserved','polling',true),'polling');
 assert.equal(recordSource('unobserved','stderr-callback',true),'stderr-callback');
 assert.equal(recordSource('unobserved','stderr-callback',false),'unobserved');
 assert.equal(recordSource('stderr-callback','polling',true),'stderr-callback');
 assert.equal(recordSource('spawn-callback','polling',true),'spawn-callback');
 assert.equal(recordSource('polling','spawn-callback',true),'polling');
 for(const input of ['PRIVATE /home/user','unexpected',null,{},'true']){
  assert.equal(recordSource('unobserved',input,true),'unobserved');
 }
 assert.equal(recordSource('unobserved','unobserved',true),'unobserved');
 assert.equal(recordSource('PRIVATE PATH','polling',true),'unobserved');
});
test('both X11 observation paths record source only after exact process identity',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('./auto-real-x11-smoke.mjs',import.meta.url),'utf8');
 assert.equal((source.match(/sample\.nativeProcess&&sample\.processImageVerifiedByCmdline/g)||[]).length,2);
 assert.equal((source.match(/identityCaptureSource=recordVerifiedIdentitySource\(/g)||[]).length,5);
 assert.equal((source.match(/,'spawn-callback',true\)/g)||[]).length,2);
 assert.equal((source.match(/,'polling',true\)/g)||[]).length,2);
 assert.equal((source.match(/,'stderr-callback',true\)/g)||[]).length,1);
 assert.equal((source.match(/captureNativeOnStderr\(child,(?:seen|observed)\)/g)||[]).length,2);
 assert.equal((source.match(/verifyNativeCommandLine\(command,'x11'\)/g)||[]).length,2);
 assert.ok(source.includes('identityCaptureSource:observed.identityCaptureSource'));
 assert.doesNotMatch(source,/--no-sandbox|--disable-setuid-sandbox|ELECTRON_DISABLE_SANDBOX/);
});
