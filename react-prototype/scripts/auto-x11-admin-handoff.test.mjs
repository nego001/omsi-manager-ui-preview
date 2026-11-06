import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createX11AdminHandoff as handoff}
 from './auto-x11-admin-handoff.mjs';
import {createSanitizedX11Evidence as create}
 from './auto-x11-sanitized-evidence.mjs';
import {compareSanitizedX11Records as compare}
 from './auto-x11-evidence-diff.mjs';
import {categorizeEarlyNativeSecurity as early}
 from './auto-x11-early-native-kernel.mjs';
const sha='a'.repeat(64);
const snapshot=early('Name:\tOMSI\nState:\tS\nSeccomp:\t0\nNoNewPrivs:\t0\n','unconfined\n');
const runner=(runner,success,options={})=>create({
 runner,archiveSha256:sha,baselineMapped:true,
 host:{apparmorModuleState:'enabled',
  apparmorRestriction:runner==='ubuntu-22.04'?'disabled':'enabled',
  userNamespaceProbe:runner==='ubuntu-22.04'?'allowed':'permission-denied'},
 outcomes:['GNOME','KDE'].map((desktop,index)=>{
  const missing=options.missingAll===true||
   (options.missingKde===true&&index===1);
  return {desktop,mapped:success,failed:!success,
   windowOwned:success,nativeProcess:!missing,
   triageClassification:success?'native-auto-window-mapped':
    missing?'shared-native-electron-startup-undetermined':
     'shared-electron-sandbox-startup-suspected',
   earlyNativeKernel:missing?early(null,null):snapshot,
   identityCaptureSource:missing?'unobserved':'polling',
   directControlCategory:success?'not-run':'sigtrap-cmdline-spawn'
  };
 })
});
const older=runner('ubuntu-22.04',true);
const newer=runner('ubuntu-24.04',false);
const comparison=()=>compare(older,newer);
test('handoff preserves blocked status and no sandbox claim despite correlated evidence',()=>{
 const hand=handoff(comparison());
 assert.equal(hand.schema,'AUTO_X11_ADMIN_HANDOFF_V1');
 assert.equal(hand.status,'ubuntu24-native-window-blocked');
 assert.equal(hand.startupCorrelationObserved,true);
 assert.equal(hand.autoIdentityCoverage,'complete');
 assert.equal(hand.directElectronSigtrapWitnessComplete,true);
 assert.equal(hand.recommendedNextStep,
  'request-independent-app-specific-policy-review-on-approved-disposable-host');
 assert.deepEqual(hand.byDesktop,[
  {desktop:'GNOME',earlyMainKernelComparison:'matched-observed',
   ubuntu24AutoIdentitySource:'polling',
   ubuntu24DirectElectronControl:'sigtrap-cmdline-spawn'},
  {desktop:'KDE',earlyMainKernelComparison:'matched-observed',
   ubuntu24AutoIdentitySource:'polling',
   ubuntu24DirectElectronControl:'sigtrap-cmdline-spawn'}
 ]);
 for(const key of ['fullReleaseAuthorized','nativeCIWaived',
  'apparmorCausalityProven','rendererSandboxCertified',
  'genuineGnomeKdeCertified','policyChangeRequestedByThisReport'])
   assert.equal(hand[key],false);
 assert.ok(Object.isFrozen(hand));
 assert.ok(Object.isFrozen(hand.byDesktop));
 assert.ok(Object.isFrozen(hand.byDesktop[0]));
});
test('missing native process and unobserved capture remain diagnostic, not inferred',()=>{
 const partial=compare(older,runner('ubuntu-24.04',false,{missingKde:true}));
 const hand=handoff(partial);
 assert.equal(hand.status,'ubuntu24-native-window-blocked');
 assert.equal(hand.byDesktop[1].earlyMainKernelComparison,'insufficient-data');
 assert.equal(hand.byDesktop[1].ubuntu24AutoIdentitySource,'unobserved');
 assert.equal(hand.autoIdentityCoverage,'partial');
 assert.equal(hand.directElectronSigtrapWitnessComplete,true);
 assert.equal(hand.startupCorrelationObserved,false);
 assert.equal(hand.recommendedNextStep,
  'collect-missing-evidence-and-review-startup-before-policy-experiment');
 assert.equal(hand.apparmorCausalityProven,false);
});
test('two missing Auto identities cannot be inferred from two verified direct SIGTRAP controls',()=>{
 const partial=compare(older,runner('ubuntu-24.04',false,{missingAll:true}));
 const hand=handoff(partial);
 assert.equal(hand.autoIdentityCoverage,'none');
 assert.equal(hand.directElectronSigtrapWitnessComplete,true);
 assert.equal(hand.startupCorrelationObserved,false);
 assert.equal(hand.status,'ubuntu24-native-window-blocked');
 assert.equal(hand.recommendedNextStep,
  'collect-missing-evidence-and-review-startup-before-policy-experiment');
 assert.equal(hand.apparmorCausalityProven,false);
 assert.equal(hand.fullReleaseAuthorized,false);
});
test('direct control missing or an intact window cannot authorize release',()=>{
 const unavailable=create({runner:'ubuntu-24.04',
  archiveSha256:sha,baselineMapped:true,
  host:{apparmorModuleState:'enabled',apparmorRestriction:'enabled',
   userNamespaceProbe:'permission-denied'},
  outcomes:['GNOME','KDE'].map(desktop=>({
   desktop,mapped:false,failed:true,windowOwned:false,nativeProcess:true,
   triageClassification:'shared-electron-sandbox-startup-suspected',
   earlyNativeKernel:snapshot,identityCaptureSource:'polling',
   directControlCategory:'unavailable'
  }))
 });
 const noDirect=handoff(compare(older,unavailable));
 assert.equal(noDirect.startupCorrelationObserved,false);
 assert.equal(noDirect.recommendedNextStep,
  'collect-missing-evidence-and-review-startup-before-policy-experiment');
 const fullyMapped=handoff(compare(older,runner('ubuntu-24.04',true)));
 assert.equal(fullyMapped.status,'further-security-validation-required');
 assert.equal(fullyMapped.fullReleaseAuthorized,false);
 assert.equal(fullyMapped.rendererSandboxCertified,false);
});
test('forged comparisons, contradictory schemas, secret paths and positive flags are refused',()=>{
 const valid=comparison();
 for(const corrupt of [
  null,false,'private',{},[],
  {...valid,schema:'OLD'},
  {...valid,archiveSha256:'/home/private/secret'},
  {...valid,packageSignatureVerified:true},
  {...valid,electronSandboxCertified:true},
  {...valid,apparmorCausalityProven:true},
  {...valid,sandboxBypassApplied:true},
  {...valid,readOnlyComparison:false},
  {...valid,earlyMainKernelComparison:'matched-observed',
   earlyMainKernelByDesktop:[
    valid.earlyMainKernelByDesktop[0],
    {desktop:'KDE',comparison:'insufficient-data'}]},
  {...valid,ubuntu24DirectControlByDesktop:[{desktop:'GNOME',
   category:'/tmp/secret'},valid.ubuntu24DirectControlByDesktop[1]]},
  {...valid,identityCaptureByDesktop:[
   {desktop:'GNOME',ubuntu22CaptureSource:'polling',
    ubuntu24CaptureSource:'anonymous-private-path'},
   valid.identityCaptureByDesktop[1]]},
  {...valid,ubuntu24NativeWindowsVerified:true},
  {...valid,classification:'both-x11-window-probes-mapped'},
  {...valid,identityCaptureByDesktop:[
   valid.identityCaptureByDesktop[0],
   {...valid.identityCaptureByDesktop[1],ubuntu24CaptureSource:'unobserved'}]}
 ]){
  assert.throws(()=>handoff(corrupt),/^Error: AUTO_X11_ADMIN_HANDOFF_REFUSED$/);
 }
 const withSecrets={...valid,rawStderr:'/home/private/user/token',
  linuxProfile:'/home/private/profile'};
 const s=JSON.stringify(handoff(withSecrets));
 assert.equal(s.includes('/home/private'),false);
 assert.equal(s.includes('rawStderr'),false);
 assert.equal(s.includes('linuxProfile'),false);
});
