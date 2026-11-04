import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSanitizedX11Evidence as create} from './auto-x11-sanitized-evidence.mjs';
import {parseSanitizedX11Record as parse,compareSanitizedX11Records as compare}
 from './auto-x11-evidence-diff.mjs';
const archiveSha256='a'.repeat(64);
const host=(restriction,probe)=>({
 apparmorRestriction:restriction,apparmorModuleState:'enabled',
 userNamespaceProbe:probe
});
const entry=(desktop,success)=>({
 desktop,mapped:success,failed:!success,windowOwned:success,
 nativeProcess:true,triageClassification:success?
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
  good.replace('AUTO_X11_HOST_EVIDENCE_V2',secret),
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
