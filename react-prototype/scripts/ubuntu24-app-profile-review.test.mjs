import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessApparmorAdminReview as assess} from './ubuntu24-app-profile-review.mjs';
const sample=(changes={})=>({
 schema:'AUTO_X11_NATIVE_TRIAGE_V1',
 classification:'shared-electron-sandbox-startup-suspected',
 x11BaselineMapped:true,autoMapped:false,directMapped:false,
 directControlUnavailable:false,autoSignal:'SIGTRAP',directSignal:'SIGTRAP',
 nativeAutoWindowVerified:false,...changes
});
test('restrictive host plus independent SIGTRAP controls triggers admin review only',()=>{
 const out=assess({apparmorRestriction:'enabled',triage:sample()});
 assert.equal(out.status,'request-administrator-review-of-app-specific-userns-policy');
 assert.equal(out.administratorApprovalRequired,true);
 assert.ok(Object.isFrozen(out));
 for(const flag of ['apparmorCausalityProven','actualElectronSandboxCertified','profileCreated',
  'profileLoaded','hostPolicyChanged','sandboxBypassApplied','realDesktopCertified'])
  assert.equal(out[flag],false,flag);
});
test('restricted switch alone or one failed Electron process cannot imply a causal finding',()=>{
 const mutations=[
  {classification:'native-auto-window-exit-observed'},
  {x11BaselineMapped:false},{autoMapped:true},{directMapped:true},
  {directControlUnavailable:true},{autoSignal:'none'},{directSignal:'SIGABRT'},
  {schema:'injected'}, {nativeAutoWindowVerified:true,autoMapped:false}
 ];
 for(const mutation of mutations){
  assert.equal(assess({apparmorRestriction:'enabled',triage:sample(mutation)}).status,
   'insufficient-evidence',JSON.stringify(mutation));
 }
});
test('no obvious AppArmor switch restriction produces a separate investigation path',()=>{
 const out=assess({apparmorRestriction:'disabled',triage:sample()});
 assert.equal(out.status,'investigate-startup-without-obvious-apparmor-namespace-restriction');
 assert.equal(out.administratorApprovalRequired,false);
});
test('observed native window does not request AppArmor changes or certify a real desktop',()=>{
 const out=assess({apparmorRestriction:'enabled',triage:sample({
  classification:'native-auto-window-mapped',autoMapped:true,nativeAutoWindowVerified:true
 })});
 assert.equal(out.status,'native-window-observed-no-policy-change-indicated');
 assert.equal(out.administratorApprovalRequired,false);
 assert.equal(out.realDesktopCertified,false);
});
test('unknown host data, malformed inputs and private-string injection fail closed',()=>{
 const bad=['unknown','unavailable','enabled /private/home',null,42,{},''];
 for(const apparmorRestriction of bad){
  const result=assess({apparmorRestriction,triage:sample()});
  assert.equal(result.status,'insufficient-evidence');
  assert.ok(['unknown','unavailable'].includes(result.apparmorRestriction));
 }
 const injection='/home/private/person .ssh TOKEN \u2028 --no-sandbox';
 const output=assess({
  apparmorRestriction:'enabled',
  triage:{schema:'AUTO_X11_NATIVE_TRIAGE_V1',classification:injection,
   autoSignal:injection,directSignal:injection,debug:injection}
 });
 assert.equal(output.status,'insufficient-evidence');
 assert.ok(!JSON.stringify(output).includes(injection));
 assert.equal(assess().status,'insufficient-evidence');
 assert.equal(assess({apparmorRestriction:'enabled',triage:null}).profileLoaded,false);
});
