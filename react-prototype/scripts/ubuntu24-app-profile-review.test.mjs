import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessApparmorAdminReview as rawAssess} from './ubuntu24-app-profile-review.mjs';
// Existing cases model the confirmed Ubuntu 24.04 permission-denied probe.
const assess=input=>rawAssess(input&&typeof input==='object'?
 {apparmorModuleState:'enabled',namespaceProbe:'permission-denied',...input}:input);
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
  classification:'native-auto-window-mapped',autoMapped:true,autoSignal:'none',nativeAutoWindowVerified:true
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
 for(const invalid of [null,false,42,'host string'])
  assert.equal(assess(invalid).status,'insufficient-evidence');
 assert.equal(assess({apparmorRestriction:'enabled',triage:null}).profileLoaded,false);
});

test('conflicting mapped-window signals cannot short-circuit a guarded review',()=>{
 const inputs=[
  {classification:'native-auto-window-mapped',autoMapped:true,nativeAutoWindowVerified:true,autoSignal:'SIGTRAP'},
  {classification:'shared-electron-sandbox-startup-suspected',autoMapped:true,nativeAutoWindowVerified:true,autoSignal:'none'},
  {classification:'native-auto-window-mapped',autoMapped:false,nativeAutoWindowVerified:true,autoSignal:'none'}
 ];
 for(const mutation of inputs)
  assert.equal(assess({apparmorRestriction:'enabled',triage:sample(mutation)}).status,
   'insufficient-evidence',JSON.stringify(mutation));
});

test('AppArmor switch without an independent permission-denied user namespace probe cannot request intervention',()=>{
 for(const probe of ['unknown','unavailable','injected /home/private/user','',null]){
  const input={apparmorRestriction:'enabled',apparmorModuleState:'enabled',triage:sample(),namespaceProbe:probe};
  const out=rawAssess(input);
  assert.equal(out.status,'insufficient-evidence');
  assert.equal(out.administratorApprovalRequired,false);
  assert.equal(out.apparmorCausalityProven,false);
  assert.ok(!JSON.stringify(out).includes('/home/private/user'));
 }
 const missing=rawAssess({apparmorRestriction:'enabled',apparmorModuleState:'enabled',triage:sample()});
 assert.equal(missing.status,'insufficient-evidence');
 assert.equal(missing.userNamespaceProbe,'unknown');
});
test('user namespace permission allowed contradicts AppArmor-namespace-denial hypothesis',()=>{
 const out=rawAssess({apparmorRestriction:'enabled',apparmorModuleState:'enabled',namespaceProbe:'allowed',triage:sample()});
 assert.equal(out.status,'investigate-startup-with-userns-probe-allowed');
 assert.equal(out.administratorApprovalRequired,false);
 assert.equal(out.profileLoaded,false);
});
test('verified permission-denied category plus two failed Electron controls still requests human review only',()=>{
 const out=rawAssess({apparmorRestriction:'enabled',apparmorModuleState:'enabled',namespaceProbe:'permission-denied',triage:sample()});
 assert.equal(out.status,'request-administrator-review-of-app-specific-userns-policy');
 assert.equal(out.userNamespaceProbe,'permission-denied');
 assert.equal(out.apparmorCausalityProven,false);
 assert.equal(out.actualElectronSandboxCertified,false);
});

test('AppArmor module must be observed enabled before requesting administrator intervention',()=>{
 for(const apparmorModuleState of ['disabled','unknown','unavailable',null,'Y /home/private',{}]){
  const result=rawAssess({apparmorRestriction:'enabled',apparmorModuleState,
   namespaceProbe:'permission-denied',triage:sample()});
  assert.equal(result.status,'insufficient-evidence');
  assert.equal(result.administratorApprovalRequired,false);
  assert.equal(result.apparmorCausalityProven,false);
  assert.ok(!JSON.stringify(result).includes('/home/private'));
 }
 const absent=rawAssess({apparmorRestriction:'enabled',
  namespaceProbe:'permission-denied',triage:sample()});
 assert.equal(absent.status,'insufficient-evidence');
 assert.equal(absent.apparmorModuleState,'unknown');
});
