import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateNativeSandboxPreflight} from './native-sandbox-preflight-contract.mjs';
const keys=[
 'apparmorUsernsRestriction','unprivilegedUsernsSwitch','usernsCapacity',
 'userNamespacePolicyHint','userNamespaceCreationVerified',
 'electronSandboxVerified','hostSecurityPolicyChanged',
 'securityBypassApplied','nextAction'
];
function sample(values={}){
 const data={
  apparmorUsernsRestriction:'disabled',unprivilegedUsernsSwitch:'enabled',
  usernsCapacity:'positive',userNamespacePolicyHint:'no-obvious-restriction',
  userNamespaceCreationVerified:'false',electronSandboxVerified:'false',
  hostSecurityPolicyChanged:'false',securityBypassApplied:'false',
  nextAction:'review-read-only-diagnostic-with-system-administrator',
  ...values
 };
 return 'OMSI_MANAGER_SANDBOX_PREFLIGHT_V1\n'+
  keys.map(k=>k+'='+data[k]).join('\n')+'\n';
}
test('classifies native report from Ubuntu-like synthetic kernel states',()=>{
 const clear=validateNativeSandboxPreflight(sample());
 assert.equal(clear.userNamespacePolicyHint,'no-obvious-restriction');
 const restricted=validateNativeSandboxPreflight(sample({
  apparmorUsernsRestriction:'enabled',userNamespacePolicyHint:'restriction-indicated'
 }));
 assert.equal(restricted.userNamespacePolicyHint,'restriction-indicated');
 const unavailable=validateNativeSandboxPreflight(sample({
  apparmorUsernsRestriction:'unavailable',userNamespacePolicyHint:'undetermined'
 }));
 assert.equal(unavailable.userNamespacePolicyHint,'undetermined');
 for(const r of [clear,restricted,unavailable]){
  for(const k of ['userNamespaceCreationVerified','electronSandboxVerified',
                   'hostSecurityPolicyChanged','securityBypassApplied','provesX11Window'])
   assert.equal(r[k],false);
  assert.ok(!JSON.stringify(r).includes('/proc/'));
  assert.ok(Object.isFrozen(r));
 }
});
test('rejects inconsistent policy labels (never certifies positive)',()=>{
 for(const overrides of [
  {apparmorUsernsRestriction:'enabled'},
  {apparmorUsernsRestriction:'unavailable'},
  {usernsCapacity:'zero'},
  {unprivilegedUsernsSwitch:'disabled'},
  {userNamespacePolicyHint:'restriction-indicated'},
  {userNamespacePolicyHint:'undetermined'},
 ])assert.throws(()=>validateNativeSandboxPreflight(sample(overrides)),
  /^Error: NATIVE_SANDBOX_PREFLIGHT_REFUSED$/);
});
test('rejects malformed, duplicated and privacy-bearing stdout, never echoes it',()=>{
 const correct=sample();
 const bad=[
  '',null,1,{},correct.trim(),correct+'\n',correct.replaceAll('\n','\r\n'),
  correct.replace('false','true'),
  correct.replace('positive','positive /home/private/secret'),
  correct.replace('disabled','/home/private/secret'),
  correct.replace('OMSI_MANAGER_SANDBOX_PREFLIGHT_V1','INVALID_HEADER'),
  correct.replace('nextAction=','nextAction=/home/private/'),
  correct.replace('securityBypassApplied=false','securityBypassApplied=true'),
  correct+'X'.repeat(5000),
  correct.replace('userNamespaceCreationVerified=false\n',''),
  correct.replace('userNamespaceCreationVerified=false\n','userNamespaceCreationVerified=false\nuserNamespaceCreationVerified=false\n'),
  correct.replace('userNamespaceCreationVerified=false','electronSandboxVerified=false'),
  correct.replace('disabled','disabled\0'),
  correct.replace('disabled','disabled\nsecret=/home/private')
 ];
 for(const input of bad){
  let message='';
  try{validateNativeSandboxPreflight(input);assert.fail('accepted malformed report');}
  catch(error){message=String(error.message);}
  assert.equal(message,'NATIVE_SANDBOX_PREFLIGHT_REFUSED');
  assert.ok(!message.includes('/home/'));
 }
});
