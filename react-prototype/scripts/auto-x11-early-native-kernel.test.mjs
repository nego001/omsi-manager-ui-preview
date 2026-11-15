import {test} from 'node:test';
import assert from 'node:assert/strict';
import {categorizeEarlyNativeSecurity as classify,
 EARLY_NATIVE_UNAVAILABLE,observeEarlyNativeSecurity as observe}
 from './auto-x11-early-native-kernel.mjs';

const status=(seccomp='2',nnp='1')=>
 'Name:\tOMSI\nState:\tS\nSeccomp:\t'+seccomp+'\nNoNewPrivs:\t'+nnp+'\n';
test('main process snapshot distinguishes strict kernel fields without attesting renderer',()=>{
 const sample=classify(status(),'/private/path/app (enforce)\n');
 assert.equal(sample.seccompMode,'filter');
 assert.equal(sample.noNewPrivs,'enabled');
 assert.equal(sample.apparmorLabelCategory,'enforce-label-observed');
 for(const key of ['processIdentityIndependentAttestation',
  'rendererSandboxCertified','fullElectronSandboxCertified',
  'hostPolicyChanged','userNamespaceIsolationCertified'])
  assert.equal(sample[key],false,key);
 assert.ok(Object.isFrozen(sample));
 assert.equal(JSON.stringify(sample).includes('/private'),false);
});
test('off, strict and missing kernel status never become observed hardening',()=>{
 const cases=[
  [status('0','0'),'off','disabled'],
  [status('1','1'),'strict','enabled'],
  ['', 'unknown','unknown'],
  [null,'unknown','unknown'],
  [status()+'Seccomp:\t0\n','unknown','enabled'],
  [status()+'NoNewPrivs:\t0\n','filter','unknown'],
  [status('99','99'),'unknown','unknown'],
  [status().replace('Seccomp:\t2','Seccomp:\tSECRET'),'unknown','enabled'],
  [status()+'x'.repeat(65536),'unknown','unknown']
 ];
 for(const [input,seccompMode,noNewPrivs] of cases){
  const result=classify(input,'unconfined\n');
  assert.equal(result.seccompMode,seccompMode);
  assert.equal(result.noNewPrivs,noNewPrivs);
  assert.equal(result.rendererSandboxCertified,false);
 }
});
test('AppArmor profile names, PIDs and raw exceptions never enter output',()=>{
 const privateLabel='/home/somebody/.secrets/token (complain)\n';
 const snapshot=classify(status(),privateLabel);
 assert.equal(snapshot.apparmorLabelCategory,'complain-label-observed');
 for(const value of [privateLabel,'/home/','token','pid','stderr'])
  assert.equal(JSON.stringify(snapshot).includes(value),false);
 for(const invalid of ['user-profile (unknown)','line1\nline2',null,{},42]){
  const result=classify(status(),invalid);
  assert.ok(['unknown','unavailable'].includes(result.apparmorLabelCategory));
 }
});
test('unavailable and invalid processes stay unknown, not runtime certificates',async()=>{
 assert.equal(EARLY_NATIVE_UNAVAILABLE.seccompMode,'unknown');
 assert.equal(EARLY_NATIVE_UNAVAILABLE.noNewPrivs,'unknown');
 assert.equal(EARLY_NATIVE_UNAVAILABLE.apparmorLabelCategory,'unavailable');
 for(const id of [null,0,1,-1,'2',1.2,{},2147483648]){
  assert.strictEqual(await observe(id),EARLY_NATIVE_UNAVAILABLE);
 }
});
