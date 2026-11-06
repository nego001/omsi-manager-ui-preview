import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSanitizedX11Evidence as create} from './auto-x11-sanitized-evidence.mjs';
import {categorizeEarlyNativeSecurity as earlyKernel,
 EARLY_NATIVE_UNAVAILABLE} from './auto-x11-early-native-kernel.mjs';
const archiveSha256='a'.repeat(64);
const host={apparmorRestriction:'enabled',apparmorModuleState:'enabled',userNamespaceProbe:'permission-denied'};
const mainKernel=earlyKernel(
 'Name:\tOMSI\nState:\tS\nSeccomp:\t0\nNoNewPrivs:\t0\n','unconfined\n');
const outcomes=[
 {desktop:'GNOME',mapped:false,failed:true,windowOwned:false,nativeProcess:true,
  triageClassification:'shared-electron-sandbox-startup-suspected',earlyNativeKernel:mainKernel,
  identityCaptureSource:'polling'},
 {desktop:'KDE',mapped:false,failed:true,windowOwned:false,nativeProcess:true,
  triageClassification:'shared-electron-sandbox-startup-suspected',earlyNativeKernel:mainKernel,
  identityCaptureSource:'spawn-callback'}
];
const sample=(changes={})=>({
 runner:'ubuntu-24.04',archiveSha256,host,baselineMapped:true,outcomes,...changes
});
test('records the 24.04 SIGTRAP investigation with no certification or secrets',()=>{
 const evidence=create(sample());
 assert.equal(evidence.schema,'AUTO_X11_HOST_EVIDENCE_V4');
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


test('a canonical early native kernel snapshot stays categorical and cannot certify a sandbox',()=>{
 const evidence=create(sample());
 for(const item of evidence.windows){
  assert.equal(item.earlyNativeKernel.seccompMode,'off');
  assert.equal(item.earlyNativeKernel.noNewPrivs,'disabled');
  assert.equal(item.earlyNativeKernel.apparmorLabelCategory,'unconfined');
  assert.equal(item.earlyNativeKernel.rendererSandboxCertified,false);
  assert.ok(Object.isFrozen(item.earlyNativeKernel));
 }
 const secret='/home/private/sensitive/profile';
 const sampleWithExtra=sample({outcomes:outcomes.map(o=>({...o,
  earlyNativeKernel:{...mainKernel,rawLabel:secret,rawProcessPath:secret}}))});
 assert.equal(JSON.stringify(create(sampleWithExtra)).includes(secret),false);
});
test('missing, forged, contradictory and private kernel snapshots are refused',()=>{
 const bad=[null,{},false,
  {...mainKernel,schema:'FAKE'},
  {...mainKernel,seccompMode:'2'},
  {...mainKernel,apparmorLabelCategory:'/home/private/profile'},
  {...mainKernel,noNewPrivs:'enabeld'},
  {...mainKernel,fullElectronSandboxCertified:true},
  {...mainKernel,userNamespaceIsolationCertified:true},
  {...mainKernel,processIdentityIndependentAttestation:true}
 ];
 for(const input of bad){
  const changed=outcomes.map(o=>({...o}));
  changed[0].earlyNativeKernel=input;
  assert.throws(()=>create(sample({outcomes:changed})),
   /^Error: AUTO_X11_EVIDENCE_REFUSED$/);
 }
 const cannotObserve=outcomes.map(o=>({...o}));
 cannotObserve[0]={...cannotObserve[0],nativeProcess:false,
  earlyNativeKernel:mainKernel};
 assert.throws(()=>create(sample({outcomes:cannotObserve})));
 const noProcess=outcomes.map(o=>({...o}));
 noProcess[0]={...noProcess[0],nativeProcess:false,
  identityCaptureSource:'unobserved',earlyNativeKernel:EARLY_NATIVE_UNAVAILABLE,
  triageClassification:'shared-native-electron-startup-undetermined'};
 const record=create(sample({outcomes:noProcess}));
 assert.equal(record.windows[0].earlyNativeKernel.seccompMode,'unknown');
 assert.equal(record.windows[0].earlyNativeKernel.apparmorLabelCategory,'unavailable');
});

test('verified process identity source remains restricted to three safe categories',()=>{
 const validated=create(sample());
 assert.deepEqual(validated.windows.map(w=>w.identityCaptureSource),['polling','spawn-callback']);
 const cases=[null,{},'unverified','/home/private/token','SPAWN',false,''];
 for(const identityCaptureSource of cases){
  assert.throws(()=>create(sample({outcomes:[
   {...outcomes[0],identityCaptureSource},outcomes[1]
  ]})),/^Error: AUTO_X11_EVIDENCE_REFUSED$/);
 }
 assert.throws(()=>create(sample({outcomes:[
  {...outcomes[0],identityCaptureSource:'unobserved'},outcomes[1]
 ]})));
 const noProc=create(sample({outcomes:[
  {...outcomes[0],nativeProcess:false,identityCaptureSource:'unobserved',
   earlyNativeKernel:EARLY_NATIVE_UNAVAILABLE,
   triageClassification:'shared-native-electron-startup-undetermined'},
  outcomes[1]
 ]}));
 assert.equal(noProc.windows[0].identityCaptureSource,'unobserved');
 assert.equal(noProc.windows[0].nativeWindowVerified,false);
 assert.equal(noProc.electronSandboxCertified,false);
});
