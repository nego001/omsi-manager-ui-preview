import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSanitizedX11Evidence as create} from './auto-x11-sanitized-evidence.mjs';
const archiveSha256='a'.repeat(64);
const host={apparmorRestriction:'enabled',apparmorModuleState:'enabled',userNamespaceProbe:'permission-denied'};
const outcomes=[
 {desktop:'GNOME',mapped:false,failed:true,windowOwned:false,nativeProcess:true,
  triageClassification:'shared-electron-sandbox-startup-suspected'},
 {desktop:'KDE',mapped:false,failed:true,windowOwned:false,nativeProcess:true,
  triageClassification:'shared-electron-sandbox-startup-suspected'}
];
const sample=(changes={})=>({
 runner:'ubuntu-24.04',archiveSha256,host,baselineMapped:true,outcomes,...changes
});
test('records the 24.04 SIGTRAP investigation with no certification or secrets',()=>{
 const evidence=create(sample());
 assert.equal(evidence.schema,'AUTO_X11_HOST_EVIDENCE_V2');
 assert.equal(evidence.host.userNamespaceProbe,'permission-denied');
 assert.equal(evidence.allNativeWindowsVerified,false);
 assert.equal(evidence.windows[0].startupClassification,
  'shared-electron-sandbox-startup-suspected');
 for(const flag of ['electronSandboxCertified','realDesktopCertified',
  'apparmorCausalityProven','hostPolicyChanged','sandboxBypassApplied'])
  assert.equal(evidence[flag],false);
 assert.ok(Object.isFrozen(evidence));
 assert.ok(Object.isFrozen(evidence.windows));
 assert.ok(Object.isFrozen(evidence.windows[0]));
});
test('records successful Ubuntu 22.04 windows without claiming sandbox certification',()=>{
 const good=outcomes.map(o=>({...o,mapped:true,failed:false,windowOwned:true,
  triageClassification:'native-auto-window-mapped'}));
 const evidence=create(sample({
  runner:'ubuntu-22.04',host:{...host,apparmorRestriction:'disabled',
    userNamespaceProbe:'allowed'},outcomes:good
 }));
 assert.equal(evidence.allNativeWindowsVerified,true);
 assert.equal(evidence.windows.filter(w=>w.nativeWindowVerified).length,2);
 assert.equal(evidence.electronSandboxCertified,false);
 assert.equal(evidence.realDesktopCertified,false);
});
test('refuses incomplete, contradictory, duplicated or out-of-order evidence',()=>{
 const variants=[
  sample({archiveSha256:'b'.repeat(63)}),sample({archiveSha256:'/home/private/secret'}),
  sample({runner:'local'}),sample({baselineMapped:false}),
  sample({host:{...host,apparmorRestriction:'/home/private'}}),
  sample({host:{...host,userNamespaceProbe:'EPERM: /home/private'}}),
  sample({outcomes:[outcomes[0]]}),sample({outcomes:[outcomes[1],outcomes[0]]}),
  sample({outcomes:[outcomes[0],outcomes[0]]}),
  sample({outcomes:[{...outcomes[0],mapped:true},outcomes[1]]}),
  sample({outcomes:[{...outcomes[0],triageClassification:'native-auto-window-mapped'},outcomes[1]]}),
  sample({outcomes:[{...outcomes[0],triageClassification:'/tmp/secret'},outcomes[1]]}),
  sample({outcomes:[{...outcomes[0],mapped:true,failed:false,windowOwned:true},outcomes[1]]}),
  sample({outcomes:[{...outcomes[0],nativeProcess:false,mapped:true},outcomes[1]]}),
  sample({outcomes:[{...outcomes[0],failed:'false'},outcomes[1]]}),
  null,{},false,'private-key',42
 ];
 for(const mutation of variants)assert.throws(()=>create(mutation),
  /^Error: AUTO_X11_EVIDENCE_REFUSED$/);
});
test('extra private strings from source are dropped, never serialized',()=>{
 const secret='/home/private/stolen-token';
 const value=sample({
  trace:secret,host:{...host,rawPath:secret},
  outcomes:outcomes.map(entry=>({...entry,stderr:secret,privateDirectory:secret}))
 });
 const result=JSON.stringify(create(value));
 assert.ok(!result.includes(secret));
 assert.ok(!result.includes('stderr'));
 assert.ok(!result.includes('rawPath'));
 assert.ok(!result.includes('/home/'));
});

test('unmapped but owned X11 window remains diagnostic evidence, not a pass',()=>{
 const partial=outcomes.map(o=>({...o}));
 partial[0].windowOwned=true;
 const result=create(sample({outcomes:partial}));
 assert.equal(result.windows[0].windowOwned,true);
 assert.equal(result.windows[0].windowMapped,false);
 assert.equal(result.windows[0].nativeWindowVerified,false);
 assert.equal(result.allNativeWindowsVerified,false);
});

test('mapped window without confirmed ownership is refused as impossible probe order',()=>{
 const invalid=outcomes.map(o=>({...o}));
 invalid[0].mapped=true;
 invalid[0].windowOwned=false;
 assert.throws(()=>create(sample({outcomes:invalid})),
  /^Error: AUTO_X11_EVIDENCE_REFUSED$/);
});
