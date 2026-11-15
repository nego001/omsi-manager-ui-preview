import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyStableX11HostCategories as stable} from './auto-x11-host-stability.mjs';
const ubuntu24={apparmorRestriction:'enabled',apparmorModuleState:'enabled',
 userNamespaceProbe:'permission-denied'};
const ubuntu22={apparmorRestriction:'disabled',apparmorModuleState:'enabled',
 userNamespaceProbe:'allowed'};
const refuse=value=>assert.throws(value,
 /^Error: AUTO_X11_HOST_CATEGORIES_NOT_STABLE$/);
test('same three category observations before and after produce evidence-only result',()=>{
 for(const sample of [ubuntu24,ubuntu22]){
  const result=stable(sample,{...sample});
  assert.equal(result.schema,'AUTO_X11_HOST_CATEGORIES_STABILITY_V1');
  assert.equal(result.repeatedCategoriesMatched,true);
  assert.equal(result.checkedCategories,3);
  assert.equal(result.namespaceProbeRepeated,true);
  for(const flag of ['apparmorCausalityProven','entireHostPolicyUnchangedProven',
   'electronSandboxCertified','realDesktopCertified','hostPolicyModifiedByChecker',
   'bypassUsedByChecker'])assert.equal(result[flag],false,flag);
  assert.ok(Object.isFrozen(result));
 }
});
test('any changed AppArmor or independent namespace category fails closed',()=>{
 for(const key of Object.keys(ubuntu24)){
  const next={...ubuntu24,[key]:key==='userNamespaceProbe'?'allowed':'disabled'};
  refuse(()=>stable(ubuntu24,next));
  refuse(()=>stable(next,ubuntu24));
 }
});
test('incomplete, unavailable, contradictory and malformed evidence never passes',()=>{
 const values=[null,undefined,'enabled',false,[],{},3,
  {...ubuntu24,apparmorRestriction:'unknown'},
  {...ubuntu24,apparmorModuleState:'unavailable'},
  {...ubuntu24,userNamespaceProbe:'unknown'},
  {...ubuntu24,userNamespaceProbe:'unavailable'},
  {...ubuntu24,userNamespaceProbe:'injected /home/private'},
  {...ubuntu24,rawProfile:'/etc/private-profile'}];
 for(const value of values){
  refuse(()=>stable(ubuntu24,value));
  refuse(()=>stable(value,ubuntu24));
 }
});
test('private strings and false approval flags never enter a successful report',()=>{
 const json=JSON.stringify(stable(ubuntu24,ubuntu24));
 assert.ok(!json.includes('/home/'));
 assert.ok(!json.includes('/etc/'));
 assert.ok(!json.includes('policyApproved'));
 assert.ok(!json.includes('--no-sandbox'));
});
