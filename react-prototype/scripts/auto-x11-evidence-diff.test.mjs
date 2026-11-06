import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSanitizedX11Evidence as create} from './auto-x11-sanitized-evidence.mjs';
import {parseSanitizedX11Record as parse,compareSanitizedX11Records as compare}
 from './auto-x11-evidence-diff.mjs';
import {categorizeEarlyNativeSecurity as earlyKernel,
 EARLY_NATIVE_UNAVAILABLE} from './auto-x11-early-native-kernel.mjs';
const archiveSha256='a'.repeat(64);
const host=(restriction,probe)=>({
 apparmorRestriction:restriction,apparmorModuleState:'enabled',
 userNamespaceProbe:probe
});
const mainKernel=earlyKernel(
 'Name:\tOMSI\nState:\tS\nSeccomp:\t0\nNoNewPrivs:\t0\n','unconfined\n');
const entry=(desktop,success)=>({
 desktop,mapped:success,failed:!success,windowOwned:success,
 nativeProcess:true,earlyNativeKernel:mainKernel,
 identityCaptureSource:'polling',
 directControlCategory:success?'not-run':'sigtrap-cmdline-spawn',
 triageClassification:success?
  'native-auto-window-mapped':'shared-electron-sandbox-startup-suspected'
});
const record=(runner,restriction,probe,success)=>create({
 runner,archiveSha256,host:host(restriction,probe),baselineMapped:true,
 outcomes:['GNOME','KDE'].map(d=>entry(d,success))
});
const older=record('ubuntu-22.04','disabled','allowed',true);
const newer=record('ubuntu-24.04','enabled','permission-denied',false);
test('refuses inconsistent package checksums across Ubuntu evidence reports',()=>{
 const different=create({runner:'ubuntu-24.04',archiveSha256:'b'.repeat(64),
  host:host('enabled','permission-denied'),baselineMapped:true,
  outcomes:['GNOME','KDE'].map(d=>entry(d,false))});
 assert.throws(()=>compare(older,different),/^Error: AUTO_X11_CROSS_RUNNER_REFUSED$/);
});
test('compares two real-shaped records without asserting AppArmor causality',()=>{
 const loaded22=parse(JSON.stringify(older)+'\n','ubuntu-22.04');
 const loaded24=parse(JSON.stringify(newer)+'\n','ubuntu-24.04');
 const comparison=compare(loaded22,loaded24);
 assert.equal(comparison.classification,
  'namespace-restriction-correlated-with-startup-failure');
 assert.equal(comparison.ubuntu22NativeWindowsVerified,true);
 assert.equal(comparison.ubuntu24NativeWindowsVerified,false);
 assert.equal(comparison.archiveSha256,archiveSha256);
 assert.equal(comparison.sameArchiveSha256ReportedByBothRunners,true);
 assert.equal(comparison.packageSignatureVerified,false);
 assert.equal(comparison.earlyMainKernelComparison,'matched-observed');
 assert.equal(comparison.earlyMainKernelIsRendererProof,false);
 assert.equal(comparison.identityCaptureSourceProvesSandbox,false);
 assert.equal(comparison.directControlProvesSandbox,false);
 assert.deepEqual(comparison.ubuntu24DirectControlByDesktop,[
  {desktop:'GNOME',category:'sigtrap-cmdline-spawn'},
  {desktop:'KDE',category:'sigtrap-cmdline-spawn'}
 ]);
 assert.deepEqual(comparison.identityCaptureByDesktop,[
  {desktop:'GNOME',ubuntu22CaptureSource:'polling',ubuntu24CaptureSource:'polling'},
  {desktop:'KDE',ubuntu22CaptureSource:'polling',ubuntu24CaptureSource:'polling'}
 ]);
 assert.equal(comparison.schema,'AUTO_X11_CROSS_RUNNER_COMPARISON_V6');
 assert.deepEqual(comparison.earlyMainKernelByDesktop,[
  {desktop:'GNOME',comparison:'matched-observed'},
  {desktop:'KDE',comparison:'matched-observed'}
 ]);
 assert.equal(Object.isFrozen(comparison.earlyMainKernelByDesktop),true);
 assert.equal(Object.isFrozen(comparison.earlyMainKernelByDesktop[0]),true);
 for(const field of ['apparmorCausalityProven','electronSandboxCertified',
  'realDesktopCertified','hostPolicyChanged','sandboxBypassApplied'])
  assert.equal(comparison[field],false);
 assert.ok(Object.isFrozen(comparison));
});
test('refuses malformed, secret-bearing, swapped and contradictory evidence',()=>{
 const secret='/home/private/user?api_key=token';
 const good=JSON.stringify(older)+'\n';
 const mutations=[
  good.replace('ubuntu-22.04','ubuntu-24.04'),
  good.replace('nativeWindowVerified":true','nativeWindowVerified":false'),
  good.replace('electronSandboxCertified":false','electronSandboxCertified":true'),
  good.replace('readOnlyEvidence":true','readOnlyEvidence":false'),
  good.replace('AUTO_X11_HOST_EVIDENCE_V5',secret),
  good.replace('"schema":','"privatePath":"'+secret+'","schema":'),
  good.replace('"GNOME"','"KDE"'),
  good.replace('native-auto-window-mapped','native-auto-window-exit-observed'),
  good.slice(0,-1),good+'\n',good.repeat(40),'{}\n','not json\n'
 ];
 for(const sample of mutations){
  assert.throws(()=>parse(sample,'ubuntu-22.04'),
   /^Error: AUTO_X11_CROSS_RUNNER_REFUSED$/);
 }
 assert.throws(()=>parse(JSON.stringify(newer)+'\n','ubuntu-22.04'));
 assert.throws(()=>compare(newer,older));
 assert.throws(()=>compare({...older,debug:secret},newer));
});
test('inconclusive or both-window-mapped outcomes never imply certification',()=>{
 const allGood=record('ubuntu-24.04','disabled','allowed',true);
 assert.equal(compare(older,allGood).classification,'both-x11-window-probes-mapped');
 const other=record('ubuntu-24.04','enabled','permission-denied',true);
 assert.equal(compare(older,other).classification,'both-x11-window-probes-mapped');
 const noUserns=record('ubuntu-24.04','enabled','allowed',false);
 assert.equal(compare(older,noUserns).classification,'inconclusive');
 const result=compare(older,allGood);
 assert.equal(result.electronSandboxCertified,false);
 assert.equal(result.apparmorCausalityProven,false);
});
test('accepts partial window ownership as failure evidence only',()=>{
 const partial=create({runner:'ubuntu-24.04',archiveSha256,
  host:host('enabled','permission-denied'),baselineMapped:true,
  outcomes:[
   {...entry('GNOME',false),windowOwned:true},
   entry('KDE',false)
  ]
 });
 const result=compare(older,partial);
 assert.equal(result.ubuntu24NativeWindowsVerified,false);
 assert.equal(result.classification,'namespace-restriction-correlated-with-startup-failure');
});


test('early kernel difference and missing sample stay diagnostic, never causal',()=>{
 const changed=create({
  runner:'ubuntu-24.04',archiveSha256,host:host('enabled','permission-denied'),
  baselineMapped:true,
  outcomes:['GNOME','KDE'].map(d=>({...entry(d,false),
   earlyNativeKernel:earlyKernel(
    'Name:\tOMSI\nState:\tS\nSeccomp:\t2\nNoNewPrivs:\t1\n',
    'some-policy (enforce)\n')}))
 });
 const different=compare(older,changed);
 assert.equal(different.earlyMainKernelComparison,'different-observed');
 assert.equal(different.classification,'namespace-restriction-correlated-with-startup-failure');
 assert.equal(different.earlyMainKernelIsRendererProof,false);
 const missing=create({runner:'ubuntu-24.04',archiveSha256,
  host:host('enabled','permission-denied'),baselineMapped:true,
  outcomes:['GNOME','KDE'].map(d=>({...entry(d,false),
   earlyNativeKernel:EARLY_NATIVE_UNAVAILABLE}))});
 const incomplete=compare(older,missing);
 assert.equal(incomplete.earlyMainKernelComparison,'insufficient-data');
 assert.equal(incomplete.apparmorCausalityProven,false);
});
test('cross-runner loader refuses edited kernel statuses and forged sandbox proof',()=>{
 const orig=JSON.stringify(newer)+'\n';
 for(const altered of [
  orig.replace('"seccompMode":"off"','"seccompMode":"invalid"'),
  orig.replace('"noNewPrivs":"disabled"','"noNewPrivs":"ENABLED"'),
  orig.replace('"apparmorLabelCategory":"unconfined"',
   '"apparmorLabelCategory":"/home/private/secret"'),
  orig.replace('"rendererSandboxCertified":false',
   '"rendererSandboxCertified":true'),
  orig.replace('"AUTO_X11_HOST_EVIDENCE_V5"','"AUTO_X11_HOST_EVIDENCE_V3"'),
  orig.replace('"identityCaptureSource":"polling"',
   '"identityCaptureSource":"/home/private/secret"'),
  orig.replace('"identityCaptureSource":"polling"',
   '"identityCaptureSource":"unobserved"')
 ]){
  assert.throws(()=>parse(altered,'ubuntu-24.04'),
   /^Error: AUTO_X11_CROSS_RUNNER_REFUSED$/);
 }
});


test('early GNOME equality survives a missing KDE process without claiming a complete match',()=>{
 const partial=create({runner:'ubuntu-24.04',archiveSha256,
  host:host('enabled','permission-denied'),baselineMapped:true,
  outcomes:[
   entry('GNOME',false),
   {...entry('KDE',false),nativeProcess:false,
    identityCaptureSource:'unobserved',
    earlyNativeKernel:EARLY_NATIVE_UNAVAILABLE,
    triageClassification:'shared-native-electron-startup-undetermined'}
  ]
 });
 const result=compare(older,partial);
 assert.deepEqual(result.earlyMainKernelByDesktop,[
  {desktop:'GNOME',comparison:'matched-observed'},
  {desktop:'KDE',comparison:'insufficient-data'}
 ]);
 assert.equal(result.earlyMainKernelComparison,'insufficient-data');
 assert.equal(result.classification,'inconclusive');
 assert.equal(result.earlyMainKernelIsRendererProof,false);
 for(const flag of ['apparmorCausalityProven','electronSandboxCertified',
  'hostPolicyChanged','sandboxBypassApplied'])assert.equal(result[flag],false);
 const serialized=JSON.stringify(result);
 assert.equal(serialized.includes('/proc/'),false);
 assert.equal(serialized.includes('private'),false);
});
test('a real observed difference is kept per label even if the other label is missing',()=>{
 const different=earlyKernel(
  'Name:\tOMSI\nState:\tS\nSeccomp:\t2\nNoNewPrivs:\t1\n',
  'label (enforce)\n');
 const partial=create({runner:'ubuntu-24.04',archiveSha256,
  host:host('enabled','permission-denied'),baselineMapped:true,
  outcomes:[
   {...entry('GNOME',false),earlyNativeKernel:different},
   {...entry('KDE',false),nativeProcess:false,
    identityCaptureSource:'unobserved',
    earlyNativeKernel:EARLY_NATIVE_UNAVAILABLE,
    triageClassification:'shared-native-electron-startup-undetermined'}
  ]
 });
 const result=compare(older,partial);
 assert.deepEqual(result.earlyMainKernelByDesktop,[
  {desktop:'GNOME',comparison:'different-observed'},
  {desktop:'KDE',comparison:'insufficient-data'}
 ]);
 assert.equal(result.earlyMainKernelComparison,'insufficient-data');
 assert.equal(result.apparmorCausalityProven,false);
 assert.equal(result.packageSignatureVerified,false);
});

test('per-label capture source persists without claiming sandbox or causality',()=>{
 const newerSpawn=create({runner:'ubuntu-24.04',archiveSha256,
  host:host('enabled','permission-denied'),baselineMapped:true,
  outcomes:[
   {...entry('GNOME',false),identityCaptureSource:'spawn-callback'},
   entry('KDE',false)
  ]});
 const result=compare(older,newerSpawn);
 assert.deepEqual(result.identityCaptureByDesktop,[
  {desktop:'GNOME',ubuntu22CaptureSource:'polling',
   ubuntu24CaptureSource:'spawn-callback'},
  {desktop:'KDE',ubuntu22CaptureSource:'polling',
   ubuntu24CaptureSource:'polling'}
 ]);
 assert.equal(result.identityCaptureSourceProvesSandbox,false);
 assert.equal(result.electronSandboxCertified,false);
 assert.equal(result.apparmorCausalityProven,false);
 assert.ok(Object.isFrozen(result.identityCaptureByDesktop));
 assert.ok(Object.isFrozen(result.identityCaptureByDesktop[0]));
});

test('unavailable direct control remains a failure-compatible diagnostic, not a pass',()=>{
 const partial=create({runner:'ubuntu-24.04',archiveSha256,
  host:host('enabled','permission-denied'),baselineMapped:true,
  outcomes:['GNOME','KDE'].map(d=>({...entry(d,false),
   directControlCategory:'unavailable'}))});
 const result=compare(older,partial);
 assert.deepEqual(result.ubuntu24DirectControlByDesktop,[
  {desktop:'GNOME',category:'unavailable'},
  {desktop:'KDE',category:'unavailable'}]);
 assert.equal(result.directControlProvesSandbox,false);
 assert.equal(result.electronSandboxCertified,false);
 assert.equal(result.ubuntu24NativeWindowsVerified,false);
});
