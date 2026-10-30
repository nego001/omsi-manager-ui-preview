import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyNativeX11Startup as classify} from './auto-x11-native-triage.mjs';
const auto=(mapped,exitSignal=null,startupHints=[],exited=false)=>({mapped,exitSignal,startupHints,exited});
const direct=(mapped,exitSignal=null,hints=[])=>({seen:{mapped},exitSignal,hints});
test('two sandbox-hinted SIGTRAP controls are a suspicion, never certification',()=>{
 const r=classify({desktop:'GNOME',baselineMapped:true,
  auto:auto(false,'SIGTRAP',['sandbox'],true),
  direct:direct(false,'SIGTRAP',['sandbox'])});
 assert.equal(r.classification,'shared-electron-sandbox-startup-suspected');
 for(const key of ['hostPolicyChanged','sandboxBypassApplied',
  'electronSandboxCertified','realDesktopCertified','nativeAutoWindowVerified'])
  assert.equal(r[key],false);
 assert.ok(Object.isFrozen(r));
});
test('successful native Auto and separate direct control states are distinguished',()=>{
 const pass=classify({desktop:'KDE',baselineMapped:true,auto:auto(true)});
 assert.equal(pass.classification,'native-auto-window-mapped');
 assert.equal(pass.nativeAutoWindowVerified,true);
 const launcher=classify({desktop:'KDE',baselineMapped:true,
  auto:auto(false,'SIGTRAP',['sandbox'],true),direct:direct(true)});
 assert.equal(launcher.classification,'auto-launcher-specific-suspected');
});
test('missing direct control, baseline failure and post-window crash stay unverified',()=>{
 assert.equal(classify({desktop:'KDE',baselineMapped:true,auto:auto(false),
  direct:{probeUnavailable:true}}).classification,'direct-control-unavailable');
 assert.equal(classify({desktop:'KDE',baselineMapped:false,auto:auto(true)})
  .classification,'display-baseline-unverified');
 assert.equal(classify({desktop:'GNOME',baselineMapped:true,auto:auto(true,null,[],true)})
  .classification,'native-auto-window-exit-observed');
 assert.equal(classify({desktop:'GNOME',baselineMapped:true,
  auto:auto(false,'SIGTRAP',[],true),direct:direct(false,'SIGTRAP',[])})
  .classification,'shared-native-electron-startup-undetermined');
});
test('output is bounded to enums and booleans, without raw paths or injected secrets',()=>{
 const secret='/home/user/private?token=secret';
 const r=classify({desktop:secret,baselineMapped:'true',
  auto:{mapped:'true',exited:true,exitSignal:secret,startupHints:[secret],stderr:secret},
  direct:{seen:{mapped:secret},probeUnavailable:secret,exitSignal:secret,hints:[secret],log:secret}});
 assert.equal(r.desktop,'unknown');
 assert.equal(r.autoMapped,false);
 assert.equal(r.sandboxBypassApplied,false);
 assert.ok(!JSON.stringify(r).includes(secret));
 assert.ok(!JSON.stringify(r).includes('/home/'));
});
